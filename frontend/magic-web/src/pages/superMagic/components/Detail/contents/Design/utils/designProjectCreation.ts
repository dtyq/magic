import { SuperMagicApi } from "@/apis"
import type { SaveFileContentResponse } from "@/apis/modules/superMagic"
import type { DesignData } from "../types"
import { compressCanvasData, MAGIC_PROJECT_VERSION_V3 } from "./magicProjectCompression"

export const DESIGN_PROJECT_CONFIG_FILE_NAME = "magic.project.js"

interface CreateDesignProjectFilesOptions {
	projectId: string
	folderName: string
	parentId?: string | number
}

interface CreatedFileResponse {
	file_id?: string | number
	id?: string | number
	[key: string]: unknown
}

interface NormalizedCreatedFileResponse extends Omit<CreatedFileResponse, "file_id" | "id"> {
	file_id: string
	id?: string
}

export type DesignProjectCreationOutcome = "confirmed" | "failed" | "ambiguous"

export class DesignProjectCreationError extends Error {
	constructor(
		message: string,
		readonly outcome: Exclude<DesignProjectCreationOutcome, "confirmed">,
		readonly context?: {
			projectId: string
			parentId?: string | number
			folder?: NormalizedCreatedFileResponse
			magicProjectFile?: NormalizedCreatedFileResponse
		},
	) {
		super(message)
		this.name = "DesignProjectCreationError"
	}
}

export interface CreatedDesignProjectFiles {
	folder: NormalizedCreatedFileResponse
	magicProjectFile: NormalizedCreatedFileResponse
	parentId?: string | number
	saveResponse: SaveFileContentResponse
	outcome: "confirmed"
}

export function createEmptyDesignProjectData(name: string): DesignData {
	return {
		version: MAGIC_PROJECT_VERSION_V3,
		type: "design",
		name,
		canvas: {
			elements: [],
		},
	}
}

export function generateEmptyDesignProjectContent(name: string): string {
	const designData = createEmptyDesignProjectData(name)
	const config = {
		version: designData.version,
		type: designData.type,
		name: designData.name,
		canvas: compressCanvasData(designData.canvas),
	}

	return `window.magicProjectConfig = ${JSON.stringify(config, null, "\t")};`
}

function normalizeCreatedFile(
	file: CreatedFileResponse,
	fileId: string | number,
): NormalizedCreatedFileResponse {
	return {
		...file,
		file_id: String(fileId),
		id: file.id === undefined || file.id === null ? undefined : String(file.id),
	}
}

export async function createDesignProjectFiles({
	projectId,
	folderName,
	parentId,
}: CreateDesignProjectFilesOptions): Promise<CreatedDesignProjectFiles> {
	let folderResponse: CreatedFileResponse
	try {
		folderResponse = (await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: parentId,
			file_name: folderName,
			is_directory: true,
		})) as CreatedFileResponse
	} catch (error) {
		throw new DesignProjectCreationError(
			error instanceof Error ? error.message : "文件夹创建失败",
			"ambiguous",
			{ projectId, parentId },
		)
	}

	const folderId = folderResponse?.file_id ?? folderResponse?.id
	if (!folderId) {
		throw new DesignProjectCreationError("文件夹创建失败", "failed", {
			projectId,
			parentId,
		})
	}
	const folder = normalizeCreatedFile(folderResponse, folderId)

	let magicProjectFileResponse: CreatedFileResponse
	try {
		magicProjectFileResponse = (await SuperMagicApi.createFile({
			project_id: projectId,
			parent_id: folder.file_id,
			file_name: DESIGN_PROJECT_CONFIG_FILE_NAME,
			is_directory: false,
		})) as CreatedFileResponse
	} catch (error) {
		throw new DesignProjectCreationError(
			error instanceof Error ? error.message : "文件创建结果未知",
			"ambiguous",
			{ projectId, parentId, folder },
		)
	}

	const magicProjectFileId = magicProjectFileResponse?.file_id ?? magicProjectFileResponse?.id
	if (!magicProjectFileId) {
		throw new DesignProjectCreationError("文件创建失败", "failed", {
			projectId,
			parentId,
			folder,
		})
	}
	const magicProjectFile = normalizeCreatedFile(magicProjectFileResponse, magicProjectFileId)

	let saveResponse: SaveFileContentResponse
	try {
		saveResponse = (await SuperMagicApi.saveFileContent([
			{
				file_id: String(magicProjectFile.file_id),
				content: generateEmptyDesignProjectContent(folderName),
			},
		])) as SaveFileContentResponse
	} catch (error) {
		throw new DesignProjectCreationError(
			error instanceof Error ? error.message : "文件内容保存结果未知",
			"ambiguous",
			{ projectId, parentId, folder, magicProjectFile },
		)
	}

	const savedFile = saveResponse?.success_files?.find(
		(file) => String(file.file_id) === String(magicProjectFile.file_id),
	)
	if (!savedFile) {
		throw new DesignProjectCreationError("文件内容保存失败", "failed", {
			projectId,
			parentId,
			folder,
			magicProjectFile,
		})
	}

	return {
		folder,
		magicProjectFile,
		parentId,
		saveResponse,
		outcome: "confirmed",
	}
}
