import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import PagememPlugin from "./main";
import { DEFAULT_LEITNER_INTERVALS, normalizeIntervals } from "./scheduling/leitner";

export interface PagememSettings {
	reviewOnOpen: boolean;
	leitnerIntervals: number[];
}

export const DEFAULT_SETTINGS: PagememSettings = {
	reviewOnOpen: true,
	leitnerIntervals: DEFAULT_LEITNER_INTERVALS.slice(),
};

export class PagememSettingTab extends PluginSettingTab {
	plugin: PagememPlugin;

	constructor(app: App, plugin: PagememPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Review memory notes on open")
			.setDesc("Automatically start a review when a due memory note is opened.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.reviewOnOpen)
					.onChange(async (value) => {
						this.plugin.settings.reviewOnOpen = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Leitner intervals (days)")
			.setDesc("Comma-separated day intervals for each Leitner bin.")
			.addText((text) =>
				text
					.setPlaceholder(formatIntervals(DEFAULT_LEITNER_INTERVALS))
					.setValue(formatIntervals(this.plugin.settings.leitnerIntervals))
					.onChange(async (value) => {
						const parsed = parseIntervals(value);
						if (!parsed) {
							new Notice("Please enter a comma-separated list of positive numbers.");
							text.setValue(formatIntervals(this.plugin.settings.leitnerIntervals));
							return;
						}

						this.plugin.settings.leitnerIntervals = normalizeIntervals(parsed);
						await this.plugin.saveSettings();
					})
			);
	}
}

function parseIntervals(value: string): number[] | null {
	const parts = value
		.split(/[,\s]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	if (parts.length === 0) {
		return null;
	}

	const numbers = parts.map((part) => Number(part));
	if (numbers.some((num) => !Number.isFinite(num) || num <= 0)) {
		return null;
	}

	return numbers;
}

function formatIntervals(intervals: number[]): string {
	return intervals.join(", ");
}
