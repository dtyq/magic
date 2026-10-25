import { SuperMagicApi } from "@/apis"
import type { PersonaResearchStore } from "../store/research-store"
import { getAttachmentPath } from "./researchFiles"

/**
 * Creates whole text files in a top-level directory of the research project (personas/,
 * templates/) with the same file APIs as other editors:
 * create file → save content → confirm success_files, then re-read the project file list so
 * the page shows the server's state instead of a local copy.
 *
 * Example: createProjectTextFile(store, "templates/", "brand.html", html) → true once the server
 * confirms; an unconfirmed write removes the empty file again and returns false.
 */

interface CreatedFile {
	file_id?: string | number
	id?: string | number
}

const createdId = (file: CreatedFile | undefined) => {
	const id = file?.file_id ?? file?.id
	return id === undefined || id === null ? null : String(id)
}

/** Directory id at the project root, created the first time a file is saved into it. */
async function ensureRootDir(store: PersonaResearchStore, projectId: string, dir: string) {
	const dirName = dir.replace(/\/$/, "")
	const existing = store.attachmentList.find(
		(item) => item.is_directory && getAttachmentPath(item).replace(/\/$/, "") === dirName,
	)
	if (existing?.file_id) return String(existing.file_id)
	const created = (await SuperMagicApi.createFile({
		project_id: projectId,
		file_name: dirName,
		is_directory: true,
	})) as CreatedFile
	return createdId(created)
}

export async function createProjectTextFile(
	store: PersonaResearchStore,
	dir: string,
	fileName: string,
	content: string,
): Promise<boolean> {
	const projectId = store.selectedProject?.id
	if (!projectId || store.isReadOnly) return false
	let fileId: string | null = null
	try {
		const dirId = await ensureRootDir(store, projectId, dir)
		if (!dirId) return false
		fileId = createdId(
			(await SuperMagicApi.createFile({
				project_id: projectId,
				parent_id: dirId,
				file_name: fileName,
				is_directory: false,
			})) as CreatedFile,
		)
		if (!fileId) return false
		const response = await SuperMagicApi.saveFileContent([{ file_id: fileId, content }])
		if (!response?.success_files?.some((file) => String(file.file_id) === fileId)) {
			throw new Error("project_file_save_unconfirmed")
		}
	} catch {
		// An empty file would show up as "not ready" or an empty template; remove it best-effort.
		if (fileId) {
			void SuperMagicApi.deleteFiles({ file_ids: [fileId], project_id: projectId }).catch(
				() => undefined,
			)
		}
		return false
	}
	await store.refreshAttachments().catch(() => undefined)
	return true
}

/** Deletes one project file and drops it from the local list without waiting for a refresh. */
export async function deleteProjectFile(
	store: PersonaResearchStore,
	fileId: string,
): Promise<boolean> {
	const projectId = store.selectedProject?.id
	if (!projectId || store.isReadOnly) return false
	try {
		await SuperMagicApi.deleteFiles({ file_ids: [fileId], project_id: projectId })
	} catch {
		return false
	}
	store.removeAttachmentsLocally([fileId])
	return true
}
