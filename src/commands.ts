import PagememPlugin from "./main";
import { ReviewController } from "./review/review-controller";

export function registerCommands(plugin: PagememPlugin, reviewController: ReviewController) {
	plugin.addCommand({
		id: "pagemem-review-due-notes",
		name: "Review all due memory notes",
		callback: () => {
			void reviewController.reviewDueNotes();
		},
	});

	plugin.addCommand({
		id: "pagemem-review-folder-notes",
		name: "Review memory notes in folder",
		callback: () => {
			reviewController.pickFolderForReview();
		},
	});

	plugin.addCommand({
		id: "pagemem-review-current-note",
		name: "Review current memory note",
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile();
			if (!file || !reviewController.isMemoryNoteFile(file)) {
				return false;
			}

			if (!checking) {
				void reviewController.reviewCurrentNote(file);
			}
			return true;
		},
	});
}
