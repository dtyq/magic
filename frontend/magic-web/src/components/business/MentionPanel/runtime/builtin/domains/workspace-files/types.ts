import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { WorkspaceFile, WorkspaceFolder } from "@/stores/projectFiles/types"

export interface WorkspaceFilesBuiltinIds {
	personalDrive: string
	organizationDrive: string
	projectFiles: string
}

export interface WorkspaceFilesStoreDependencies {
	projectFilesStore: ProjectFilesStore
}

export type WorkspaceEntry = WorkspaceFile | WorkspaceFolder
