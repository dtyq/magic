import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import userFilesStore from "@/stores/userFiles"
import magicToast from "@/components/base/MagicToaster/utils"
import type { FileManagerLocationSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import { resolveFileReference } from "../../../services/userFileReferenceResolver"

/** 恢复时只补齐目标的父链；读取失败保留原位置，确认失效后才退回可访问的祖先。 */
export function useUserFileManagerDirectory({
	enabled,
	directoryId,
	rootId,
	initialState,
	onDirectoryChange,
}: {
	enabled: boolean
	directoryId?: string
	rootId?: string
	initialState?: FileManagerLocationSnapshot
	onDirectoryChange: (id: string) => void
}) {
	const { t } = useTranslation("super")
	const identity = userFilesStore.currentIdentityKey
	const mutationVersion = userFilesStore.mutationVersion
	const key = `${identity}:${rootId ?? ""}:${directoryId ?? ""}`
	const [result, setResult] = useState<{ key: string; error: boolean }>()
	const [retry, setRetry] = useState(0)
	const saved = useRef(initialState)
	saved.current = initialState
	const navigate = useMemoizedFn(onDirectoryChange)
	useEffect(() => {
		if (!enabled) return
		const controller = new AbortController()
		const current = () =>
			!controller.signal.aborted && identity === userFilesStore.currentIdentityKey
		setResult(undefined)
		void (async () => {
			const root = await userFilesStore.getRoot()
			if (!current()) return
			const baseId = rootId ?? root.id
			await userFilesStore.loadTree(baseId)
			if (!current()) return
			const targetId = directoryId || baseId
			const resolveDirectory = async (id: string): Promise<boolean> => {
				if (!current()) return false
				if (id === baseId) return true
				let file = userFilesStore.files.get(id)
				if (!file || !userFilesStore.getPath(id).length) {
					const result = await resolveFileReference({ file_id: id }, controller.signal)
					if (
						!current() ||
						result.status !== "resolved" ||
						result.reference.space_type !== "user" ||
						!result.reference.is_directory
					)
						return false
					file =
						(await userFilesStore.findPath(
							result.reference.space_relative_path.split("/").filter(Boolean),
						)) ?? undefined
				}
				if (!current() || !file?.is_directory || file.id !== id) return false
				if (
					baseId !== root.id &&
					!userFilesStore.getPath(id).some((parent) => parent.id === baseId)
				)
					return false
				await userFilesStore.loadTree(id)
				return current()
			}
			if (!(await resolveDirectory(targetId))) {
				if (!current()) return
				let fallback = baseId
				for (const ancestor of [...(saved.current?.ancestorIds ?? [])].reverse()) {
					if (await resolveDirectory(ancestor)) {
						fallback = ancestor
						break
					}
				}
				if (!current()) return
				navigate(fallback)
				magicToast.info(t("fileManager.restoredDirectoryUnavailable"))
				return
			}
			if (current()) setResult({ key, error: false })
		})().catch(() => {
			if (current()) setResult({ key, error: true })
		})
		return () => controller.abort()
	}, [enabled, identity, key, directoryId, rootId, mutationVersion, retry, navigate, t])
	return {
		ready: result?.key === key && !result.error,
		error: result?.key === key && result.error,
		retry: () => setRetry((value) => value + 1),
	}
}
