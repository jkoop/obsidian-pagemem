import { App, CachedMetadata, TFile } from "obsidian";
import { formatDate, parseDate, startOfDay } from "../utils/dates";

export interface PagememSchedule {
	lastReview?: string;
	nextReview?: string;
	interval?: number;
	ease?: number;
}

const PAGEMEM_TAG = "pagemem";

export function isMemoryNote(cache: CachedMetadata | null): boolean {
	if (!cache) {
		return false;
	}

	if (cache.tags?.some((tag) => isPagememTag(tag.tag))) {
		return true;
	}

	const frontmatterTags = cache.frontmatter?.tags;
	if (typeof frontmatterTags === "string") {
		return isPagememTag(frontmatterTags);
	}

	if (Array.isArray(frontmatterTags)) {
		return frontmatterTags.some((tag) => typeof tag === "string" && isPagememTag(tag));
	}

	return false;
}

export function getSchedule(cache: CachedMetadata | null): PagememSchedule {
	const pagemem = cache?.frontmatter?.pagemem;
	if (!pagemem || typeof pagemem !== "object") {
		return {};
	}

	const schedule = pagemem as Record<string, unknown>;
	const lastReview = getString(schedule["last-review"]);
	const nextReview = getString(schedule["next-review"]);
	const interval = getNumber(schedule["interval"]);
	const ease = getNumber(schedule["ease"]);

	return { lastReview, nextReview, interval, ease };
}

export function isScheduleDue(schedule: PagememSchedule, today: Date): boolean {
	if (!schedule.nextReview) {
		return true;
	}

	const nextDate = parseDate(schedule.nextReview);
	if (!nextDate) {
		return true;
	}

	return startOfDay(nextDate).getTime() <= startOfDay(today).getTime();
}

export async function updateSchedule(
	app: App,
	file: TFile,
	schedule: PagememSchedule
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		const existing = frontmatter.pagemem;
		const pagemem =
			existing && typeof existing === "object"
				? (existing as Record<string, unknown>)
				: {};

		const lastReview = schedule.lastReview ?? formatDate(startOfDay(new Date()));
		pagemem["last-review"] = lastReview;
		if (schedule.nextReview) {
			pagemem["next-review"] = schedule.nextReview;
		}
		if (schedule.interval !== undefined) {
			pagemem["interval"] = schedule.interval;
		}
		if (schedule.ease !== undefined) {
			pagemem["ease"] = schedule.ease;
		}

		frontmatter.pagemem = pagemem;
	});
}

function isPagememTag(tag: string): boolean {
	const normalized = normalizeTag(tag);
	return normalized === PAGEMEM_TAG || normalized.startsWith(`${PAGEMEM_TAG}/`);
}

function normalizeTag(tag: string): string {
	return tag.startsWith("#") ? tag.slice(1) : tag;
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}
