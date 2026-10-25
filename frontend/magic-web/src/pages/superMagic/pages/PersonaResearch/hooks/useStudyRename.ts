import { useEffect, useState, type KeyboardEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import { usePersonaResearchStore } from "../context"

/**
 * In-place study rename shared by the studio heading and the home list rows.
 *
 * | Input            | Result                                         |
 * | Enter / blur     | saves the trimmed name as the topic name       |
 * | Escape           | closes without saving                          |
 * | empty, unchanged | closes, keeps the current title                |
 * | save fails       | stays open with the draft so the user can retry|
 * An Enter that confirms an IME candidate never submits.
 */
export function useStudyRename(topicId: string, title: string) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	// null while showing the title; a string while the input is open.
	const [draft, setDraft] = useState<string | null>(null)
	const [isSaving, setIsSaving] = useState(false)
	const editable = !store.isReadOnly && !isReadOnlyProject(store.selectedProject?.user_role)

	// Switching studies discards an unsaved draft of the previous one.
	useEffect(() => setDraft(null), [topicId])

	const start = useMemoizedFn(() => {
		if (editable) setDraft(title)
	})

	const commit = useMemoizedFn(async () => {
		if (draft === null || isSaving) return
		const nextTitle = draft.trim()
		if (!nextTitle || nextTitle === title) {
			setDraft(null)
			return
		}
		setIsSaving(true)
		try {
			await store.renameStudy(topicId, nextTitle)
			setDraft(null)
		} catch (error) {
			console.error("Failed to rename research study:", error)
			toast.error(t("study.renameFailed"))
		} finally {
			setIsSaving(false)
		}
	})

	const onKeyDown = useMemoizedFn((event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return
		if (event.key === "Enter") {
			event.preventDefault()
			void commit()
		} else if (event.key === "Escape") {
			event.preventDefault()
			setDraft(null)
		}
	})

	return { draft, setDraft, isSaving, editable, start, commit, onKeyDown }
}
