import { MagicFSApi, SuperMagicApi } from "@/apis"
import { getFileContentsByIds } from "@/pages/superMagic/utils/api"
import type { PersonaResearchStore } from "../store/research-store"
import type { PersonaFile, ResearchFileRef } from "../types"
import { createProjectTextFile, deleteProjectFile } from "./projectFileWriter"
import { PERSONAS_DIR, parsePersonaFile } from "./researchFiles"

/**
 * Writes personas the user creates or edits in the persona library.
 *
 * The agent remains the main writer of personas/. The page writes only whole persona files it
 * created or that the user is editing, using the same file APIs as other editors:
 * new files go through projectFileWriter (create → save → confirm → refresh); edits check the
 * revision first so an agent write in between is never overwritten.
 *
 * | Outcome   | Meaning                                                                 |
 * | saved     | the server confirmed the content                                         |
 * | conflict  | the file changed after the form opened (usually the agent appended data) |
 * | failed    | the write did not happen or could not be confirmed                       |
 */
export type PersonaWriteOutcome = "saved" | "conflict" | "failed"

/** Server error code for a stale expected_revision (same as the PPT editor). */
const REVISION_CONFLICT_CODE = 51152

const serialize = (persona: PersonaFile) => `${JSON.stringify(persona, null, 2)}\n`

export async function createPersonaFile(
	store: PersonaResearchStore,
	persona: PersonaFile,
): Promise<PersonaWriteOutcome> {
	const saved = await createProjectTextFile(
		store,
		PERSONAS_DIR,
		`${persona.id}.json`,
		serialize(persona),
	)
	return saved ? "saved" : "failed"
}

/**
 * Saves an edit only when the file still holds what the form was opened with.
 * Example: the form opened at revision 3; a study then appended evidence (revision 4) →
 * "conflict", nothing is written, and the caller reloads the latest persona.
 */
export async function updatePersonaFile(
	store: PersonaResearchStore,
	ref: ResearchFileRef<PersonaFile>,
	persona: PersonaFile,
): Promise<PersonaWriteOutcome> {
	if (store.isReadOnly) return "failed"
	try {
		const info = await MagicFSApi.getFileInfo(ref.fileId)
		const revision = info?.file?.version
		const { successes } = await getFileContentsByIds([ref.fileId], {
			responseType: "text",
			forceRefresh: true,
			access: store.fileAccess,
		})
		const current = parsePersonaFile(successes.get(ref.fileId))
		if (!current.ok || typeof revision !== "number") return "failed"
		if (JSON.stringify(current.data) !== JSON.stringify(ref.data)) return "conflict"
		const response = await SuperMagicApi.saveFileContent([
			{ file_id: ref.fileId, content: serialize(persona), expected_revision: revision },
		])
		const failure = response?.error_files?.find((file) => String(file.file_id) === ref.fileId)
		if (failure) return failure.error_code === REVISION_CONFLICT_CODE ? "conflict" : "failed"
		if (!response?.success_files?.some((file) => String(file.file_id) === ref.fileId)) {
			return "failed"
		}
	} catch {
		return "failed"
	}
	await store.refreshAttachments().catch(() => undefined)
	return "saved"
}

/** Deletes the persona file; studies that already used it keep their transcripts. */
export function deletePersonaFile(
	store: PersonaResearchStore,
	ref: ResearchFileRef<PersonaFile>,
): Promise<boolean> {
	return deleteProjectFile(store, ref.fileId)
}
