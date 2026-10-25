import { useEffect, useRef, useState } from "react"
import userFilesStore from "@/stores/userFiles"
import {
	USER_PROJECT_MEMORIES_PATH,
	getMemoryProjectId,
} from "../../LongTremMemory/components/memoryTreeNodeUtils"

/** 只读已有记忆目录的项目名单；名称和目录请求共用 UserFilesStore 的缓存。 */
export function useUserMemoryProjects(projectId: string | null | undefined, enabled: boolean) {
	const identity = userFilesStore.currentIdentityKey
	const mutationVersion = userFilesStore.mutationVersion
	const [rootId, setRootId] = useState<string>()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const [loaded, setLoaded] = useState(false)
	const [refreshVersion, setRefreshVersion] = useState(0)
	const appliedRefresh = useRef(0)
	useEffect(() => {
		// 侧栏首次展开、大面板进入记忆视图时才启用；不预读未选项目的记忆内容。
		if (!enabled) return
		let cancelled = false
		const force = refreshVersion !== appliedRefresh.current
		setLoading(true)
		setError(false)
		void (async () => {
			const root = await userFilesStore.findPath(USER_PROJECT_MEMORIES_PATH)
			if (cancelled || identity !== userFilesStore.currentIdentityKey) return
			const files = root ? await userFilesStore.loadDirectory(root.id, force) : []
			if (cancelled || identity !== userFilesStore.currentIdentityKey) return
			const ids = files.flatMap((file) => {
				const id = file.is_directory ? getMemoryProjectId(file.name) : null
				return id && id !== projectId ? [id] : []
			})
			setRootId(root?.id)
			setLoaded(true)
			await userFilesStore.loadProjectNames(ids, force)
			if (!cancelled && identity === userFilesStore.currentIdentityKey) {
				appliedRefresh.current = refreshVersion
			}
		})()
			.catch(() => {
				if (!cancelled) setError(true)
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [identity, projectId, mutationVersion, enabled, refreshVersion])
	const projects = rootId
		? userFilesStore.getChildren(rootId).flatMap((file) => {
				const id = file.is_directory ? getMemoryProjectId(file.name) : null
				return id && id !== projectId ? [{ id, fileId: file.id }] : []
			})
		: []
	return {
		projects,
		loading,
		error,
		loaded,
		refresh: () => setRefreshVersion((value) => value + 1),
	}
}
