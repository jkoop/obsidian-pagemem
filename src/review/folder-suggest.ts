import { App, FuzzySuggestModal, TFolder } from "obsidian";

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private folders: TFolder[];
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.folders = getAllFolders(app);
		this.setPlaceholder("Select a folder to review");
	}

	getItems(): TFolder[] {
		return this.folders;
	}

	getItemText(item: TFolder): string {
		return item.path.length > 0 ? item.path : "/";
	}

	onChooseItem(item: TFolder): void {
		this.onChoose(item);
	}
}

function getAllFolders(app: App): TFolder[] {
	const folders: TFolder[] = [];
	for (const file of app.vault.getAllLoadedFiles()) {
		if (file instanceof TFolder) {
			folders.push(file);
		}
	}

	folders.sort((a, b) => a.path.localeCompare(b.path));
	return folders;
}
