import { App, PluginSettingTab, Setting } from "obsidian";
import PagememPlugin from "./main";

export interface PagememSettings {
	reviewOnOpen: boolean;
}

export const DEFAULT_SETTINGS: PagememSettings = {
	reviewOnOpen: true,
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
	}
}
