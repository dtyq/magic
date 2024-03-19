import { makeAutoObservable } from "mobx"
import { WorkspaceFolder } from "./types"
import { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"

export class ProjectFilesStore {
	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	workspaceFileTree: AttachmentItem[] = []
	workspaceFilesList: AttachmentItem[] = []
	currentSelectedProject: ProjectListItem | null = null

	isSameProject(project1: ProjectListItem | null, project2: ProjectListItem | null) {
		return project1?.id === project2?.id
	}

	setSelectedProject(selectedProject: ProjectListItem | null) {
		if (!selectedProject || !this.isSameProject(this.currentSelectedProject, selectedProject)) {
			this.workspaceFileTree = []
			this.workspaceFilesList = []
		}
		this.currentSelectedProject = selectedProject
	}

	hasFolder(fileId: string) {
		return this.workspaceFilesList.some(
			(file) => file.type === "directory" && file.file_id === fileId,
		)
	}

	/**
	 * Get filenames in a specific folder path
	 * @param folderPath - The folder path prefix to filter files
	 * @returns Array of filenames in the specified folder
	 */
	getFileNamesInFolder(folderPath: string): string[] {
		return this.workspaceFilesList
			.filter((item) => {
				// Filter out folders, keep only files
				if (item.type !== "file") return false

				// Check if file is in the specified folder path
				return item.file_key.startsWith(folderPath)
			})
			.map((file) => {
				// Extract filename from file_key (get the last part after the last slash)
				const lastSlashIndex = file.file_key.lastIndexOf("/")
				return lastSlashIndex !== -1
					? file.file_key.slice(lastSlashIndex + 1)
					: file.file_key
			})
	}

	/**
	 * Get folder data
	 * @param parent_id - Folder ID
	 * @returns Folder data
	 */
	getFolderData(parent_id: string | number | undefined): WorkspaceFolder | undefined {
		return this.workspaceFilesList.find(
			(item) => item.type === "directory" && item.file_id === parent_id,
		) as WorkspaceFolder | undefined
	}

	setWorkspaceFileTree(tree: AttachmentItem[]) {
		this.workspaceFileTree = this.excludeHiddenItems(tree)
		this.workspaceFilesList = this.excludeHiddenItems(this.flattenWorkspaceFileTree(tree))
	}

	addWorkspaceFile(file: AttachmentItem) {
		// Skip if file is hidden
		if (file.is_hidden) return

		const normalizedFile: AttachmentItem = {
			...file,
			type: file.type ?? (file.is_directory ? "directory" : "file"),
		}

		// Add to list
		this.workspaceFilesList.push(normalizedFile)

		// Add to tree
		if (normalizedFile.parent_id) {
			// Find parent in tree and add to its children
			const parent = this.findNodeInTree(this.workspaceFileTree, normalizedFile.parent_id)
			if (parent) {
				if (!parent.children) {
					parent.children = []
				}
				parent.children.push(normalizedFile)
			}
		} else {
			// Add to root level
			this.workspaceFileTree.push(normalizedFile)
		}
	}

	/**
	 * Find node in tree by file_id
	 */
	private findNodeInTree(tree: AttachmentItem[], fileId: string): AttachmentItem | null {
		for (const node of tree) {
			if (node.file_id === fileId) {
				return node
			}
			if (node.children) {
				const found = this.findNodeInTree(node.children, fileId)
				if (found) return found
			}
		}
		return null
	}

	flattenWorkspaceFileTree(tree: AttachmentItem[]) {
		return tree.reduce((acc, item) => {
			acc.push(item)
			if (item.children) {
				acc.push(...this.flattenWorkspaceFileTree(item.children))
			}
			return acc
		}, [] as AttachmentItem[])
	}

	excludeHiddenItems(items: AttachmentItem[]): AttachmentItem[] {
		return items.filter((item) => !item.is_hidden)
	}

	hasProjectFile(fileId: string) {
		const matches = this.workspaceFilesList.filter((file) => file.file_id === fileId)
		const hasMatch = matches.some((file) => file.type === "file")
		return hasMatch
	}
}

const projectFilesStore = new ProjectFilesStore()

export default projectFilesStore
