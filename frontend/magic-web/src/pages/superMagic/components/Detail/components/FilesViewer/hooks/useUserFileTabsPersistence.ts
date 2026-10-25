import { useEffect, useRef, useState, type Dispatch, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import {
	UserFileTabsRepository,
	type CachedUserTab,
	type UserFileTabsRecord,
} from "@/services/superMagic/repositories/UserFileTabsRepository"
import type { UserFileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "@/pages/superMagic/services/userFileReferenceResolver"
import { USER_FILE_PREVIEW_POLICY } from "@/pages/superMagic/components/UserSpace/services/userSpaceFileService"
import type { TabAction, TabItem } from "../types"
import { TabActionType } from "../types"
import {
	canRestoreTab,
	convertFileToTabItem,
	createTabRestoreState,
	mergeUserFileTabs,
	recordTabRestoreAction,
} from "../utils/tabUtils"
import { createFileManagerTab } from "../utils/fileManagerTabs"

interface Options {
	enabled: boolean
	identityKey: string | null
	tabsRef: RefObject<TabItem[]>
	dispatchTabs: Dispatch<TabAction>
	onRestoreActive: () => void
}

function cachedTabId(tab: CachedUserTab): string {
	return tab.type === "file_manager" ? tab.id : tab.fileId
}

/** 只适配持久化；标签、预览组件、关闭保护仍由 FilesViewer 和原 reducer 持有。 */
export function useUserFileTabsPersistence({
	enabled,
	identityKey,
	tabsRef,
	dispatchTabs,
	onRestoreActive,
}: Options) {
	const repository = useRef(new UserFileTabsRepository()).current
	const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)
	const positions = useRef(new Map<string, number>())
	const restoreState = useRef(createTabRestoreState())
	const readSucceeded = useRef(false)
	const managerState = useRef<UserFileManagerSnapshot>()
	const saveQueue = useRef(Promise.resolve())
	const isUserTab = useMemoizedFn(
		(tab: TabItem) =>
			tab.userIdentityKey === identityKey &&
			(tab.fileData.space_type === "user" || tab.fileManager?.spaceType === "user"),
	)
	const restoredActive = useMemoizedFn(onRestoreActive)

	// 读取期间的新点击优先；明确关闭的标签不能被迟到的恢复结果重新打开。
	const recordAction = useMemoizedFn((action: TabAction) => {
		recordTabRestoreAction(restoreState.current, action, tabsRef.current || [])
	})

	const mergeWithUserTabs = useMemoizedFn(
		(otherTabs: TabItem[], userTabs = (tabsRef.current || []).filter(isUserTab)) =>
			mergeUserFileTabs(
				otherTabs,
				userTabs,
				restoreState.current.interacted ? undefined : Object.fromEntries(positions.current),
			),
	)

	useEffect(() => {
		setLoadedIdentity(null)
		positions.current.clear()
		restoreState.current = createTabRestoreState()
		readSucceeded.current = false
		managerState.current = undefined
		if (!enabled || !identityKey) return
		const controller = new AbortController()
		const isCurrent = () =>
			!controller.signal.aborted && identityKey === getFileReferenceIdentityKey()
		void (async () => {
			try {
				const record = await repository.get(identityKey)
				if (!isCurrent()) return
				const cachedTabs = record?.tabs || []
				positions.current = new Map(cachedTabs.map((tab) => [cachedTabId(tab), tab.order]))
				if (
					!restoreState.current.interacted &&
					record?.fileManagerState?.identityKey === identityKey
				)
					managerState.current = record.fileManagerState

				// 本地记录先恢复标签位置；鉴权和文件详情的网络耗时不参与排序。
				const recovered = cachedTabs.flatMap((cached): TabItem[] => {
					const id = cachedTabId(cached)
					if (!id || !canRestoreTab(restoreState.current, id)) return []
					if (cached.type === "file_manager") {
						const tab = createFileManagerTab(
							{ spaceType: "user", view: managerState.current?.view ?? "files" },
							cached.title,
						)
						return [
							{
								...tab,
								userIdentityKey: identityKey,
								fileManagerState: managerState.current,
								active: false,
								active_at: cached.activeAt,
							},
						]
					}
					const tab = convertFileToTabItem(
						{
							file_id: cached.fileId,
							file_name: cached.title,
							file_extension: cached.title.includes(".")
								? cached.title.split(".").pop()
								: "",
							space_type: "user",
							display_config: { previewPolicy: { ...USER_FILE_PREVIEW_POLICY } },
						},
						undefined,
						{ active: false, active_at: cached.activeAt },
					)
					return tab ? [{ ...tab, userIdentityKey: identityKey, isLoading: true }] : []
				})
				const activateId = !restoreState.current.interacted
					? record?.activeTabId
					: undefined
				const hasRestoredActive = recovered.some((tab) => tab.id === activateId)
				if (hasRestoredActive) restoredActive()
				dispatchTabs({
					type: TabActionType.RESTORE_USER_FILE_TABS,
					payload: {
						tabs: recovered,
						userIdentityKey: identityKey,
						userTabPositions: restoreState.current.interacted
							? undefined
							: Object.fromEntries(positions.current),
						restoredActiveTabId: hasRestoredActive ? activateId : undefined,
					},
				})
				readSucceeded.current = true
				setLoadedIdentity(identityKey)

				await Promise.all(
					recovered
						.filter((tab) => tab.type !== "file_manager")
						.map(async (tab) => {
							try {
								const result = await resolveFileReference(
									{ file_id: tab.fileData.file_id },
									controller.signal,
								)
								if (!isCurrent()) return
								dispatchTabs({
									type: TabActionType.SYNC_USER_FILE_REFERENCES,
									payload: {
										userFileResults: { [tab.fileData.file_id]: result },
									},
								})
							} catch {
								// 网络失败不删除记录；原预览器继续按 ID 加载，原刷新动作可以重新鉴权。
								if (!isCurrent()) return
								const currentTab = tabsRef.current?.find(
									(current) => current.id === tab.id,
								)
								if (currentTab)
									dispatchTabs({
										type: TabActionType.UPDATE_TAB,
										payload: { tab: { ...currentTab, isLoading: false } },
									})
							}
						}),
				)
			} catch (error) {
				// 读不到本地缓存时禁止用初始空列表覆盖它。
				if (isCurrent()) {
					console.error("Failed to restore user file tabs", error)
					setLoadedIdentity(identityKey)
				}
			}
		})()
		return () => controller.abort()
	}, [enabled, identityKey, repository, tabsRef, dispatchTabs, restoredActive])

	const setFileManagerState = useMemoizedFn((state: UserFileManagerSnapshot) => {
		if (state.identityKey === identityKey) managerState.current = state
	})
	const getFileManagerState = useMemoizedFn(() =>
		managerState.current?.identityKey === identityKey ? managerState.current : undefined,
	)

	const save = useMemoizedFn(
		async (
			preservePositions: boolean,
			snapshot: TabItem[] = tabsRef.current || [],
			fileManagerState: UserFileManagerSnapshot | undefined = getFileManagerState(),
		) => {
			if (
				!enabled ||
				!identityKey ||
				loadedIdentity !== identityKey ||
				!readSucceeded.current ||
				identityKey !== getFileReferenceIdentityKey()
			)
				return
			const persistable = snapshot.filter(
				(tab) => tab.fileData.display_config?.previewPolicy?.persistTab !== false,
			)
			const tabs = persistable.flatMap((tab, order): CachedUserTab[] => {
				if (!isUserTab(tab)) return []
				const common = {
					title: tab.fileData.file_name,
					order: preservePositions ? (positions.current.get(tab.id) ?? order) : order,
					activeAt: tab.active_at || tab.create_at || 0,
				}
				return tab.type === "file_manager"
					? [{ ...common, type: "file_manager", id: tab.id }]
					: [{ ...common, type: "file", fileId: tab.fileData.file_id }]
			})
			positions.current = new Map(tabs.map((tab) => [cachedTabId(tab), tab.order]))
			const record: UserFileTabsRecord = {
				id: identityKey,
				tabs,
				activeTabId: persistable.find((tab) => tab.active && isUserTab(tab))?.id,
				fileManagerState,
			}
			// 同一身份的连续操作按捕获顺序写入，较慢的旧保存不能覆盖较新的关闭或排序。
			const write = saveQueue.current
				.catch(() => undefined)
				.then(() => repository.put(record))
			saveQueue.current = write
			await write
		},
	)

	return {
		loaded: Boolean(identityKey && loadedIdentity === identityKey),
		save,
		mergeWithUserTabs,
		recordAction,
		getFileManagerState,
		setFileManagerState,
	}
}
