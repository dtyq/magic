import { makeAutoObservable } from "mobx"
import {
	MentionItemType,
	type MentionItem,
	type ProjectFileDisplayResolver,
	type ProjectFileMentionData,
} from "../../../../types"
import { SCENE_CATALOG_ITEM_TAG } from "../scene-catalog/store"
import type {
	WorkspaceEntry,
	WorkspaceFilesBuiltinIds,
	WorkspaceFilesStoreDependencies,
} from "./types"
import { getFolderMentionData } from "../../../../utils/directoryMention"
import { normalizeProjectReferencePath } from "../../../../utils/projectReferenceMention"

export class MentionPanelWorkspaceFilesStore {
	private readonly projectFilesStore: WorkspaceFilesStoreDependencies["projectFilesStore"]
	/** Scene-provided relabelling of project entries (e.g. research folders); null on plain projects. */
	private displayResolver: ProjectFileDisplayResolver | null = null

	constructor(dependencies: WorkspaceFilesStoreDependencies) {
		this.projectFilesStore = dependencies.projectFilesStore
		makeAutoObservable<
			MentionPanelWorkspaceFilesStore,
			"projectFilesStore" | "displayResolver"
		>(this, { projectFilesStore: false, displayResolver: false }, { autoBind: true })
	}

	setDisplayResolver(resolver: ProjectFileDisplayResolver | null) {
		this.displayResolver = resolver
	}

	workspaceFilesToMentionItems(files: WorkspaceEntry[]): MentionItem[] {
		return files.flatMap((file) => {
			const display = this.displayResolver?.({
				path: normalizeProjectReferencePath(file.relative_file_path),
				name: file.file_name,
				isDirectory: file.type === "directory",
			})
			if (display?.hidden) return []
			if (file.type === "directory") {
				// Folders only change what the row shows; directory_name and path stay real.
				return {
					id: file.relative_file_path,
					type: MentionItemType.FOLDER,
					name: display?.name ?? file.file_name,
					icon: display?.icon ?? "file-folder",
					hasChildren: file.children.length > 0,
					isFolder: true,
					path: file.relative_file_path,
					display_config: file.display_config,
					children: file.children as unknown as MentionItem[],
					data: getFolderMentionData({
						directoryId: file.file_id,
						directoryName: file.file_name,
						directoryPath: normalizeProjectReferencePath(file.relative_file_path),
						directoryMetadata: file.display_config,
					}),
				}
			}

			// A relabelled file follows the scene catalog contract: the label is the chip label
			// and link text, the real name moves to the subtitle, file_path/file_id stay real.
			const label = display?.name
			return {
				id: file.file_id,
				type: MentionItemType.PROJECT_FILE,
				name: label ?? file.file_name,
				icon: display?.icon ?? file.file_extension,
				...(label ? { description: file.file_name, tags: [SCENE_CATALOG_ITEM_TAG] } : {}),
				extension: file.file_extension,
				hasChildren: false,
				isFolder: false,
				path: file.relative_file_path,
				size: file.file_size,
				display_config: file.display_config,
				parentId: file.parent_id,
				data: {
					file_id: file.file_id,
					file_name: label ?? file.file_name,
					file_path: normalizeProjectReferencePath(file.relative_file_path),
					file_extension: file.file_extension,
					project_id: file.project_id,
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

		// A relabelled row stays findable by its real file name, kept in the subtitle.
		return workspaceFileItems.filter(
			(item) =>
				matchesQuery(item.name, normalizedQuery) ||
				Boolean(item.description && matchesQuery(item.description, normalizedQuery)),
		)
	}

	hasProjectFile(fileId: string) {
		return this.projectFilesStore.hasProjectFile(fileId)
	}

	hasFolder(directoryId: string) {
		return this.projectFilesStore.hasFolder(directoryId)
	}
}
