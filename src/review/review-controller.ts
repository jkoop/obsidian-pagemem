import { Notice, TFile, TFolder } from "obsidian";
import PagememPlugin from "../main";
import { KeyboardLayout } from "./keyboard";
import { FolderSuggestModal } from "./folder-suggest";
import { PagememReviewModal } from "./review-modal";
import { getSchedule, isMemoryNote, isScheduleDue, PagememSchedule } from "./note-meta";
import { parseDate, startOfDay } from "../utils/dates";

interface ReviewQueueState {
	files: TFile[];
	index: number;
	completionMessage: string;
}

export class ReviewController {
	private plugin: PagememPlugin;
	private keyboardLayoutPromise: Promise<KeyboardLayout>;
	private reviewQueue: ReviewQueueState | null = null;

	constructor(plugin: PagememPlugin) {
		this.plugin = plugin;
		this.keyboardLayoutPromise = KeyboardLayout.create();

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("file-open", (file) => {
				void this.onFileOpen(file);
			})
		);
	}

	onUnload() {
		this.reviewQueue = null;
	}

	isMemoryNoteFile(file: TFile): boolean {
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		return isMemoryNote(cache);
	}

	async reviewCurrentNote(file: TFile): Promise<void> {
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		if (!isMemoryNote(cache)) {
			new Notice("This note is not tagged for pagemem.");
			return;
		}

		const schedule = getSchedule(cache);
		await this.openReviewModal(file, schedule);
	}

	async reviewDueNotes(): Promise<void> {
		if (this.reviewQueue) {
			new Notice("A review session is already in progress.");
			return;
		}

		const dueNotes = this.getDueNotes();
		if (dueNotes.length === 0) {
			new Notice("No due memory notes found.");
			return;
		}

		this.reviewQueue = { files: dueNotes, index: 0, completionMessage: "All due memory notes reviewed." };
		await this.reviewNextInQueue();
	}

	async reviewNotesInFolder(folder: TFolder): Promise<void> {
		if (this.reviewQueue) {
			new Notice("A review session is already in progress.");
			return;
		}

		const notes = this.getNotesInFolder(folder);
		if (notes.length === 0) {
			new Notice("No memory notes found in that folder.");
			return;
		}

		this.reviewQueue = { files: notes, index: 0, completionMessage: "Folder review complete." };
		await this.reviewNextInQueue();
	}

	pickFolderForReview() {
		const modal = new FolderSuggestModal(this.plugin.app, (folder) => {
			void this.reviewNotesInFolder(folder);
		});
		modal.open();
	}

	private async onFileOpen(file: TFile | null): Promise<void> {
		if (!file || !this.plugin.settings.reviewOnOpen) {
			return;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		if (!isMemoryNote(cache)) {
			return;
		}

		const schedule = getSchedule(cache);
		if (!isScheduleDue(schedule, startOfDay(new Date()))) {
			return;
		}

		await this.openReviewModal(file, schedule);
	}

	private async reviewNextInQueue(): Promise<void> {
		if (!this.reviewQueue) {
			return;
		}

		const file = this.reviewQueue.files[this.reviewQueue.index];
		if (!file) {
			const completionMessage = this.reviewQueue.completionMessage;
			this.reviewQueue = null;
			new Notice(completionMessage);
			return;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const schedule = getSchedule(cache);

		await this.openReviewModal(file, schedule);

		if (this.reviewQueue) {
			this.reviewQueue.index += 1;
			await this.reviewNextInQueue();
		}
	}

	private async openReviewModal(
		file: TFile,
		schedule: PagememSchedule
	): Promise<void> {
		const keyboardLayout = await this.keyboardLayoutPromise;

		return new Promise((resolve) => {
			const modal = new PagememReviewModal(this.plugin.app, file, {
				keyboardLayout,
				schedule,
				intervals: this.plugin.settings.leitnerIntervals,
				successThresholdPercent: this.plugin.settings.leitnerSuccessThreshold,
				onComplete: resolve,
				onSkip: resolve,
			});
			modal.open();
		});
	}

	private getDueNotes(): TFile[] {
		const today = startOfDay(new Date());
		const dueNotes: Array<{ file: TFile; dueDate: Date | null }> = [];

		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!isMemoryNote(cache)) {
				continue;
			}

			const schedule = getSchedule(cache);
			if (!isScheduleDue(schedule, today)) {
				continue;
			}

			const dueDate = schedule.nextReview ? parseDate(schedule.nextReview) : null;
			dueNotes.push({ file, dueDate });
		}

		dueNotes.sort((a, b) => {
			if (!a.dueDate && !b.dueDate) {
				return a.file.path.localeCompare(b.file.path);
			}
			if (!a.dueDate) {
				return -1;
			}
			if (!b.dueDate) {
				return 1;
			}
			return a.dueDate.getTime() - b.dueDate.getTime();
		});

		return dueNotes.map((entry) => entry.file);
	}

	private getNotesInFolder(folder: TFolder): TFile[] {
		const today = startOfDay(new Date());
		const prefix = folder.path ? `${folder.path}/` : "";
		const notes: Array<{ file: TFile; dueDate: Date | null }> = [];

		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			if (prefix && !file.path.startsWith(prefix)) {
				continue;
			}

			const cache = this.plugin.app.metadataCache.getFileCache(file);
			if (!isMemoryNote(cache)) {
				continue;
			}

			const schedule = getSchedule(cache);
			const dueDate = schedule.nextReview ? parseDate(schedule.nextReview) : null;
			const isDue = isScheduleDue(schedule, today);
			notes.push({
				file,
				dueDate: isDue ? dueDate : null,
			});
		}

		notes.sort((a, b) => {
			if (!a.dueDate && !b.dueDate) {
				return a.file.path.localeCompare(b.file.path);
			}
			if (!a.dueDate) {
				return 1;
			}
			if (!b.dueDate) {
				return -1;
			}
			return a.dueDate.getTime() - b.dueDate.getTime();
		});

		return notes.map((entry) => entry.file);
	}
}
