import { Plugin } from "obsidian";
import { registerCommands } from "./commands";
import { ReviewController } from "./review/review-controller";
import { DEFAULT_SETTINGS, PagememSettings, PagememSettingTab } from "./settings";

export default class PagememPlugin extends Plugin {
	settings: PagememSettings;
	reviewController: ReviewController | null = null;

	async onload() {
		await this.loadSettings();
		this.reviewController = new ReviewController(this);
		registerCommands(this, this.reviewController);
		this.addSettingTab(new PagememSettingTab(this.app, this));
	}

	onunload() {
		this.reviewController?.onUnload();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PagememSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
