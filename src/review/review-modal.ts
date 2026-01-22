import { App, Modal, Notice, TFile } from "obsidian";
import { calculateNextSchedule, ReviewResponse } from "../scheduling/leitner";
import { startOfDay } from "../utils/dates";
import { KeyboardLayout } from "./keyboard";
import { getSchedule, PagememSchedule, updateSchedule } from "./note-meta";
import { getReviewText, maskWord, tokenizeReviewText } from "./tokenizer";

interface ReviewModalOptions {
	keyboardLayout: KeyboardLayout;
	schedule: PagememSchedule;
	intervals: number[];
	successThresholdPercent: number;
	onComplete?: () => void;
	onSkip?: () => void;
}

export class PagememReviewModal extends Modal {
	private file: TFile;
	private options: ReviewModalOptions;
	private words: string[] = [];
	private wordSpans: HTMLSpanElement[] = [];
	private currentIndex = 0;
	private lastHighlightedIndex: number | null = null;
	private incorrectCount = 0;
	private progressEl: HTMLElement | null = null;
	private finalized = false;

	private keyHandler = (event: KeyboardEvent) => {
		this.handleKeyDown(event);
	};

	constructor(app: App, file: TFile, options: ReviewModalOptions) {
		super(app);
		this.file = file;
		this.options = options;
	}

	async onOpen() {
		this.modalEl.addClass("pagemem-review-modal");
		this.contentEl.empty();
		this.contentEl.addClass("pagemem-review-content");

		const header = this.contentEl.createDiv({ cls: "pagemem-review-header" });
		header.createEl("div", { cls: "pagemem-review-title", text: this.file.basename });
		this.progressEl = header.createEl("div", { cls: "pagemem-review-progress", text: "0 / 0" });

		const actions = header.createDiv({ cls: "pagemem-review-actions" });
		const skipButton = actions.createEl("button", { text: "Skip review" });
		skipButton.addEventListener("click", () => {
			this.finalize("skip");
			this.close();
		});

		const instructions = this.contentEl.createDiv({ cls: "pagemem-review-instructions" });
		instructions.textContent = "Type the first letter of each word. Press Esc to stop.";

		const body = this.contentEl.createDiv({ cls: "pagemem-review-body" });
		const textEl = body.createEl("pre", { cls: "pagemem-review-text" });

		const raw = await this.app.vault.read(this.file);
		const reviewText = getReviewText(raw);
		const tokens = tokenizeReviewText(reviewText);

		this.words = [];
		this.wordSpans = [];
		tokens.forEach((token) => {
			if (token.type === "separator") {
				textEl.appendChild(document.createTextNode(token.text));
				return;
			}

			const wordIndex = this.words.length;
			this.words.push(token.text);

			const span = document.createElement("span");
			span.classList.add("pagemem-word", "pagemem-word--hidden");
			span.dataset.index = String(wordIndex);
			span.textContent = maskWord(token.text);
			textEl.appendChild(span);
			this.wordSpans.push(span);
		});

		this.modalEl.tabIndex = -1;
		this.modalEl.focus();
		this.modalEl.addEventListener("keydown", this.keyHandler);

		if (this.words.length === 0) {
			const empty = body.createDiv({ cls: "pagemem-review-empty" });
			empty.textContent = "Nothing to review in this note.";
			this.updateProgress();
			return;
		}

		this.updateProgress();
		this.setCurrentWord(0);
	}

	onClose() {
		this.modalEl.removeEventListener("keydown", this.keyHandler);
		if (!this.finalized) {
			this.finalize("skip");
		}
		this.contentEl.empty();
	}

	private handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			this.finalize("skip");
			this.close();
			return;
		}

		if (event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}

		if (this.words.length === 0) {
			return;
		}

		if (event.key.length !== 1) {
			return;
		}
		if (!/[A-Za-z0-9]/.test(event.key)) {
			return;
		}
		event.preventDefault();

		const expectedWord = this.words[this.currentIndex];
		if (!expectedWord) {
			return;
		}

		const expectedChar = expectedWord[0];
		if (!expectedChar) {
			return;
		}
		const isCorrect = this.matchesExpected(event, expectedChar);
		this.revealCurrentWord(isCorrect);
		this.advance();
	}

	private matchesExpected(event: KeyboardEvent, expectedChar: string): boolean {
		if (/^[A-Za-z]$/.test(expectedChar)) {
			return this.options.keyboardLayout.matchesLetter(event, expectedChar);
		}

		const input = event.key;
		return input.length === 1 && input === expectedChar;
	}

	private revealCurrentWord(correct: boolean) {
		const span = this.wordSpans[this.currentIndex];
		if (!span) {
			return;
		}

		const word = this.words[this.currentIndex];
		if (word !== undefined) {
			span.textContent = word;
		}
		span.classList.remove("pagemem-word--hidden", "pagemem-word--current");

		if (!correct) {
			span.classList.add("pagemem-word--wrong");
			this.incorrectCount += 1;
			this.vibrate();
		}
	}

	private advance() {
		this.currentIndex += 1;
		if (this.currentIndex >= this.words.length) {
			this.updateProgress();
			void this.finishReview();
			return;
		}

		this.updateProgress();
		this.setCurrentWord(this.currentIndex);
	}

	private setCurrentWord(index: number) {
		if (this.lastHighlightedIndex !== null) {
			this.wordSpans[this.lastHighlightedIndex]?.classList.remove("pagemem-word--current");
		}
		const current = this.wordSpans[index];
		if (!current) {
			this.lastHighlightedIndex = null;
			return;
		}

		current.classList.add("pagemem-word--current");
		this.lastHighlightedIndex = index;
		current.scrollIntoView({ block: "center", inline: "nearest" });
	}

	private updateProgress() {
		if (!this.progressEl) {
			return;
		}

		const completed = Math.min(this.currentIndex, this.words.length);
		this.progressEl.textContent = `${completed} / ${this.words.length}`;
	}

	private async finishReview(): Promise<void> {
		const total = this.words.length;
		const accuracy = total === 0 ? 1 : (total - this.incorrectCount) / total;
		const accuracyPercent = accuracy * 100;
		const response = responseFromAccuracy(
			accuracyPercent,
			this.options.successThresholdPercent
		);

		const today = startOfDay(new Date());
		const latestSchedule = getSchedule(this.app.metadataCache.getFileCache(this.file));
		const baseSchedule = {
			...this.options.schedule,
			...latestSchedule,
		};
		
		const nextSchedule = calculateNextSchedule(
			baseSchedule,
			response,
			today,
			this.options.intervals
		);
		await updateSchedule(this.app, this.file, nextSchedule);

		const accuracyPercentRounded = Math.round(accuracyPercent);
		new Notice(
			`Review complete (${accuracyPercentRounded}%). Next review ${nextSchedule.nextReview ?? "not scheduled"}.`
		);

		this.finalize("complete");
		this.close();
	}

	private finalize(type: "complete" | "skip") {
		if (this.finalized) {
			return;
		}
		this.finalized = true;

		if (type === "complete") {
			this.options.onComplete?.();
		} else {
			this.options.onSkip?.();
		}
	}

	private vibrate() {
		if (navigator.vibrate) {
			navigator.vibrate(50);
		}
	}
}

function responseFromAccuracy(
	accuracyPercent: number,
	thresholdPercent: number
): ReviewResponse {
	return accuracyPercent >= thresholdPercent ? "success" : "fail";
}
