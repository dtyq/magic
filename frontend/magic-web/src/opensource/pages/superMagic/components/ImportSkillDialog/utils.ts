import { loadJSZip } from "@/opensource/lib/jszip"
import {
	processDroppedItems,
	type DropItem,
} from "@/opensource/pages/superMagic/components/TopicFilesButton/utils/file-system"

const ZIP_MIME_TYPE = "application/zip"
const DEFAULT_ARCHIVE_NAME = "skill-package"

export const IMPORT_SKILL_DROP_ERROR = {
	EMPTY_FOLDER: "empty-folder",
	MULTIPLE_ITEMS: "multiple-items",
} as const

export type ImportSkillDropErrorCode =
	(typeof IMPORT_SKILL_DROP_ERROR)[keyof typeof IMPORT_SKILL_DROP_ERROR]

export class ImportSkillDropError extends Error {
	code: ImportSkillDropErrorCode

	constructor(code: ImportSkillDropErrorCode) {
		super(code)
		this.name = "ImportSkillDropError"
		this.code = code
	}
}

function ensureZipFileName(name?: string) {
	const trimmedName = name?.trim() || DEFAULT_ARCHIVE_NAME
	return trimmedName.toLowerCase().endsWith(".zip") ? trimmedName : `${trimmedName}.zip`
}

function getArchiveEntryPath(file: File) {
	const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
	return relativePath?.trim() || file.name
}

function getFolderNameFromFiles(files: File[]) {
	const firstRelativePath = (files[0] as File & { webkitRelativePath?: string })
		.webkitRelativePath
	const [folderName] = firstRelativePath?.split("/").filter(Boolean) ?? []
	return folderName || DEFAULT_ARCHIVE_NAME
}

async function createSkillArchiveFromFiles(files: File[], folderName?: string): Promise<File> {
	if (files.length === 0) {
		throw new ImportSkillDropError(IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER)
	}

	const JSZip = await loadJSZip()
	const zip = new JSZip()

	for (const file of files) {
		zip.file(getArchiveEntryPath(file), file)
	}

	const archiveName = ensureZipFileName(folderName)
	const zipBlob = await zip.generateAsync({ type: "blob" })

	return new File([zipBlob], archiveName, {
		type: ZIP_MIME_TYPE,
		lastModified: Date.now(),
	})
}

export async function createSkillArchiveFromFolder(folder: DropItem): Promise<File> {
	if (folder.files.length === 0) {
		throw new ImportSkillDropError(IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER)
	}

	return createSkillArchiveFromFiles(folder.files, folder.name)
}

export async function createSkillArchiveFromSelectedFolderFiles(files: File[]): Promise<File> {
	return createSkillArchiveFromFiles(files, getFolderNameFromFiles(files))
}

export async function resolveDroppedSkillImportFile(
	dataTransfer: DataTransfer,
): Promise<File | null> {
	const { standaloneFiles, folders } = await processDroppedItems(dataTransfer)
	const droppedItemCount = standaloneFiles.length + folders.length

	if (droppedItemCount === 0) {
		return null
	}

	if (droppedItemCount > 1) {
		throw new ImportSkillDropError(IMPORT_SKILL_DROP_ERROR.MULTIPLE_ITEMS)
	}

	if (folders.length === 1) {
		return createSkillArchiveFromFolder(folders[0])
	}

	return standaloneFiles[0] ?? null
}
