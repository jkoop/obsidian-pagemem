import { addDays, formatDate, startOfDay } from "../utils/dates";
import { PagememSchedule } from "../review/note-meta";

export type ReviewResponse = "easy" | "good" | "hard";

export const DEFAULT_LEITNER_INTERVALS = [1, 1, 2, 3, 5, 8, 10, 12, 15, 18, 20];

export function calculateNextSchedule(
	current: PagememSchedule | null,
	response: ReviewResponse,
	today: Date,
	intervals: number[]
): PagememSchedule {
	const normalized = normalizeIntervals(intervals);
	const currentBin = clamp(
		current?.bin ?? 0,
		0,
		normalized.length - 1
	);

	const nextBin = response === "hard" ? 0 : Math.min(currentBin + 1, normalized.length - 1);
	const interval = Math.max(1, normalized[nextBin] ?? 1);
	const reviewDate = startOfDay(today);
	const nextReviewDate = addDays(reviewDate, Math.round(interval));

	return {
		lastReview: formatDate(reviewDate),
		nextReview: formatDate(nextReviewDate),
		interval,
		bin: nextBin,
	};
}

export function normalizeIntervals(intervals: number[]): number[] {
	if (!intervals || intervals.length === 0) {
		return DEFAULT_LEITNER_INTERVALS.slice();
	}

	const result = intervals
		.map((value) => (Number.isFinite(value) ? value : NaN))
		.filter((value) => Number.isFinite(value) && value > 0);

	return result.length > 0 ? result : DEFAULT_LEITNER_INTERVALS.slice();
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
