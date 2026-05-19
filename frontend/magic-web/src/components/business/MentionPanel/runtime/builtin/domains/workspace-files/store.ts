import { makeAutoObservable } from "mobx"
import { MentionItemType, type MentionItem, type ProjectFileMentionData } from "../../../../types"
import type {
	WorkspaceEntry,
	WorkspaceFilesBuiltinIds,
	WorkspaceFilesStoreDependencies,
} from "./types"
import { getFolderMentionData } from "../../../../utils/directoryMention"

function toRelativePath(path: string) {
	return path.startsWith("/") ? path.slice(1) : path
}

export class MentionPanelWorkspaceFilesStore {
	private readonly projectFilesStore: WorkspaceFilesStoreDependencies["projectFilesStore"]

	constructor(dependencies: WorkspaceFilesStoreDependencies) {
		this.projectFilesStore = dependencies.projectFilesStore
		makeAutoObservable(this, {}, { autoBind: true })
	}

	workspaceFilesToMentionItems(files: WorkspaceEntry[]): MentionItem[] {
		return files.map((file) => {
			if (file.type === "directory") {
				return {
					id: file.relative_file_path,
					type: MentionItemType.FOLDER,
					name: file.file_name,
					icon: "file-folder",
					hasChildren: file.children.length > 0,
					isFolder: true,
					path: file.relative_file_path,
					display_config: file.display_config,
					children: file.children as unknown as MentionItem[],
					data: getFolderMentionData({
						directoryId: file.file_id,
						directoryName: file.file_name,
						directoryPath: toRelativePath(file.relative_file_path),
						directoryMetadata: file.display_config,
					}),
				}
			}

			return {
				id: file.file_id,
				type: MentionItemType.PROJECT_FILE,
				name: file.file_name,
				icon: file.file_extension,
				extension: file.file_extension,
				hasChildren: false,
				isFolder: false,
				path: file.relative_file_path,
				size: file.file_size,
				display_config: file.display_config,
				parentId: file.parent_id,
				data: {
					file_id: file.file_id,
					file_name: file.file_name,
					file_path: toRelativePath(file.relative_file_path),
					file_extension: file.file_extension,
				} as ProjectFileMentionData,
			}
		})
	}

	getFolderMentionItems(folderId: string, builtinIds: WorkspaceFilesBuiltinIds) {
		if (folderId === builtinIds.personalDrive || folderId === builtinIds.organizationDrive) {
			return []
		}

		if (folderId === builtinIds.projectFiles) {
			return this.workspaceFilesToMentionItems(
				this.projectFilesStore.workspaceFileTree as unknown as WorkspaceEntry[],
			)
		}

		const children =
			(this.projectFilesStore.workspaceFilesList.find(
				(item) => item.type === "directory" && item.relative_file_path === folderId,
			)?.children as unknown as WorkspaceEntry[]) || []

		return this.workspaceFilesToMentionItems(children)
	}

	searchItems(normalizedQuery: string, matchesQuery: (target: string, query: string) => boolean) {
		const workspaceFileItems = this.workspaceFilesToMentionItems(
			this.projectFilesStore.workspaceFilesList as unknown as WorkspaceEntry[],
		)

		return workspaceFileItems.filter((item) => matchesQuery(item.name, normalizedQuery))
	}

	hasProjectFile(fileId: string) {
		return this.projectFilesStore.hasProjectFile(fileId)
	}

	hasFolder(directoryId: string) {
		return this.projectFilesStore.hasFolder(directoryId)
	}
}
