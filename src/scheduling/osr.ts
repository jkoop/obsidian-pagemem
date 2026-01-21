import { addDays, formatDate, startOfDay } from "../utils/dates";
import { PagememSchedule } from "../review/note-meta";

export type ReviewResponse = "easy" | "good" | "hard";

export interface OsrSettings {
	baseEase: number;
	lapsesIntervalChange: number;
	easyBonus: number;
	loadBalance: boolean;
	maximumInterval: number;
}

export const DEFAULT_OSR_SETTINGS: OsrSettings = {
	baseEase: 250,
	lapsesIntervalChange: 0.5,
	easyBonus: 1.3,
	loadBalance: false,
	maximumInterval: 36525,
};

export function osrSchedule(
	response: ReviewResponse,
	originalInterval: number,
	ease: number,
	delayedBeforeReviewDays: number,
	settings: OsrSettings
): { interval: number; ease: number } {
	let interval = originalInterval;

	if (response === "easy") {
		ease += 20;
		interval = ((interval + delayedBeforeReviewDays) * ease) / 100;
		interval *= settings.easyBonus;
	} else if (response === "good") {
		interval = ((interval + delayedBeforeReviewDays / 2) * ease) / 100;
	} else if (response === "hard") {
		ease = Math.max(130, ease - 20);
		interval = Math.max(1, (interval + delayedBeforeReviewDays / 4) * settings.lapsesIntervalChange);
	}

	interval = Math.min(interval, settings.maximumInterval);
	interval = Math.round(interval * 10) / 10;

	return { interval, ease };
}

export function calculateNextSchedule(
	current: PagememSchedule | null,
	response: ReviewResponse,
	today: Date,
	settings: OsrSettings = DEFAULT_OSR_SETTINGS
): PagememSchedule {
	const baseInterval = current?.interval ?? 1;
	const baseEase = current?.ease ?? settings.baseEase;
	const delayBeforeReview = 0;
	const result = osrSchedule(response, baseInterval, baseEase, delayBeforeReview, settings);

	const roundedInterval = Math.max(1, Math.round(result.interval * 10) / 10);
	const nextReviewDate = addDays(startOfDay(today), Math.round(roundedInterval));

	return {
		lastReview: formatDate(startOfDay(today)),
		nextReview: formatDate(nextReviewDate),
		interval: roundedInterval,
		ease: Math.round(result.ease),
	};
}
