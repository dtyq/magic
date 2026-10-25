import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import userFilesStore from "@/stores/userFiles"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { getFileReferenceIdentityKey } from "@/pages/superMagic/services/userFileReferenceResolver"
import {
	SAVED_HOLD_MS,
	type SaveConfirmationStage,
} from "../../Detail/contents/HTML/hooks/useSaveConfirmation"
import type { SeqResponse } from "@/types/request"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { mergeMemoryContent } from "../../LongTremMemory/services/memoryThreeWayMerge"
import {
	userSpaceFileService,
	UserFileConcurrentModificationError,
	type UserFileSnapshot,
} from "../services/userSpaceFileService"

export function useUserFileEditor(fileId: string, isEditMode: boolean, identityKey: string | null) {
	const { t } = useTranslation("super")
	const { t: memoryT } = useTranslation("super/longMemory")
	const fileAccess = useFileAccess()
	const [snapshot, setSnapshot] = useState<UserFileSnapshot | null>(null)
	const [draft, setDraft] = useState("")
	const [conflict, setConflict] = useState<UserFileSnapshot | null>(null)
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState(false)
	const [saving, setSaving] = useState(false)
	const [saveStage, setSaveStage] = useState<SaveConfirmationStage>("idle")
	const requestRef = useRef<AbortController | null>(null)
	const savingRef = useRef(false)
	const mounted = useRef(true)

	const isCurrent = useMemoizedFn(
		() => mounted.current && identityKey === getFileReferenceIdentityKey(),
	)
	const applySnapshot = useMemoizedFn((next: UserFileSnapshot) => {
		setSnapshot(next)
		setDraft(next.content)
		setConflict(null)
	})

	const load = useMemoizedFn(async () => {
		requestRef.current?.abort()
		const controller = new AbortController()
		requestRef.current = controller
		setLoading(true)
		setLoadError(false)
		try {
			const next = await userSpaceFileService.readStableSnapshot(
				fileId,
				controller.signal,
				fileAccess,
			)
			if (isCurrent() && !controller.signal.aborted) applySnapshot(next)
		} catch {
			if (isCurrent() && !controller.signal.aborted) setLoadError(true)
		} finally {
			if (isCurrent() && !controller.signal.aborted) setLoading(false)
		}
	})

	const refreshQuietly = useMemoizedFn(async () => {
		requestRef.current?.abort()
		const controller = new AbortController()
		requestRef.current = controller
		try {
			const next = await userSpaceFileService.readStableSnapshot(
				fileId,
				controller.signal,
				fileAccess,
			)
			if (isCurrent() && !controller.signal.aborted) applySnapshot(next)
		} catch {
			// Keep the current body if a background refresh fails.
		} finally {
			if (isCurrent() && !controller.signal.aborted) setLoading(false)
		}
	})

	useEffect(() => {
		mounted.current = true
		setSnapshot(null)
		setDraft("")
		void load()
		return () => {
			mounted.current = false
			requestRef.current?.abort()
		}
	}, [fileId, identityKey, isEditMode, load])

	useEffect(() => {
		if (saveStage !== "saved") return
		const timer = setTimeout(() => setSaveStage("idle"), SAVED_HOLD_MS)
		return () => clearTimeout(timer)
	}, [saveStage])

	useEffect(() => {
		// Reload the open preview only while it is not being edited.
		const handle = (seq: SeqResponse<SuperMagicFileChangeMessage>) => {
			const message = seq?.message
			if (!message || message.space_type !== "user" || isEditMode || savingRef.current) return
			const updated = (message.changes ?? []).some((change) => {
				const id = String(change.file_id || change.file?.file_id || "")
				return id === fileId && change.operation !== "delete"
			})
			if (updated) void refreshQuietly()
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_File_Change_Intermediate, handle)
		return () => pubsub.unsubscribe(PubSubEvents.Super_Magic_File_Change_Intermediate, handle)
	}, [fileId, isEditMode, refreshQuietly])

	useEffect(() => {
		userFilesStore.setFileEditing(fileId, isEditMode)
		return () => userFilesStore.setFileEditing(fileId, false)
	}, [fileId, isEditMode])

	/** 保存失败继续保留草稿；关闭 Tab 的保存回调必须收到异常，不能把冲突当作保存成功。 */
	const save = useMemoizedFn(async (revision = snapshot?.revision): Promise<void> => {
		if (!snapshot || revision === undefined || loading || savingRef.current || !isCurrent())
			throw new Error("User file is not ready")
		const savedDraft = draft
		const requestIdentity = identityKey
		savingRef.current = true
		setSaving(true)
		setSaveStage("saving")
		try {
			const result = await userSpaceFileService.saveFileContent(fileId, savedDraft, revision)
			if (!isCurrent() || requestIdentity !== getFileReferenceIdentityKey())
				throw new DOMException("Identity changed", "AbortError")
			setSnapshot({
				file: { ...snapshot.file, version: result.revision },
				revision: result.revision,
				content: savedDraft,
			})
			setConflict(null)
			if (userFilesStore.files.has(snapshot.file.parent_id))
				void userFilesStore
					.loadDirectory(snapshot.file.parent_id, true)
					.catch(() => undefined)
			setSaveStage("saved")
		} catch (error) {
			// Failures keep their error toast; never leave a saving/saved chip behind.
			setSaveStage("idle")
			if (isCurrent() && requestIdentity === getFileReferenceIdentityKey()) {
				if (error instanceof UserFileConcurrentModificationError) {
					try {
						const latest = await userSpaceFileService.readStableSnapshot(
							fileId,
							requestRef.current?.signal,
							fileAccess,
						)
						if (isCurrent() && requestIdentity === getFileReferenceIdentityKey())
							setConflict(latest)
					} catch {
						if (isCurrent()) magicToast.error(t("common.fileNotFoundOrLoadFailed"))
					}
				} else magicToast.error(t("common.saveFailed"))
			}
			throw error
		} finally {
			savingRef.current = false
			if (isCurrent()) setSaving(false)
		}
	})

	const merge = useMemoizedFn(() => {
		if (!snapshot || !conflict) return
		const merged = mergeMemoryContent(snapshot.content, draft, conflict.content, {
			local: memoryT("globalEditor.conflict.localLabel"),
			remote: memoryT("globalEditor.conflict.remoteLabel"),
		})
		setSnapshot(conflict)
		setDraft(merged.content)
		setConflict(null)
		magicToast.info(
			memoryT(
				merged.hasConflicts
					? "globalEditor.conflict.mergeHasConflicts"
					: "globalEditor.conflict.mergeReady",
			),
		)
	})

	return {
		snapshot,
		draft,
		setDraft: (value: string) => {
			if (!savingRef.current) setDraft(value)
		},
		conflict,
		setConflict,
		loading,
		loadError,
		saving,
		saveStage,
		load,
		save,
		merge,
		useLatest: () => {
			if (conflict) applySnapshot(conflict)
		},
	}
}
