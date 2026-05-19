import {
	MentionItemType,
	type DirectoryMentionData,
	type ProjectFileMentionData,
} from "../../../../types"
import type { MentionPanelValidationPlugin } from "../../registry-types"

export const workspaceFilesValidationPlugins: MentionPanelValidationPlugin[] = [
	{
		itemType: MentionItemType.PROJECT_FILE,
		validate: ({ store, data }) =>
			store.workspaceFilesStore.hasProjectFile((data as ProjectFileMentionData).file_id),
	},
	{
		itemType: MentionItemType.FOLDER,
		validate: ({ store, data }) =>
			store.workspaceFilesStore.hasFolder((data as DirectoryMentionData).directory_id),
	},
]
