import type { TabAction, TabItem } from "../types"
import { TabActionType } from "../types"
import { DetailType } from "../../../types"
import { handleDuplicateTabNames, mergeUserFileTabs, restoreTabOrder } from "../utils/tabUtils"
import { PLAYBACK_TAB_ID } from "../utils/tabConstants"

export function tabReducer(state: TabItem[], action: TabAction): TabItem[] {
	const now = Date.now()

	switch (action.type) {
		case TabActionType.ADD_TAB: {
			const incomingTab = action.payload?.tab
			if (!incomingTab) return state

			const existingTabIndex = state.findIndex((tab) => tab.id === incomingTab.id)
			if (existingTabIndex !== -1) {
				const shouldUsePendingAttachmentSyncTab =
					incomingTab.fileData?.display_config?.previewPolicy?.awaitAttachmentSync ===
					true
				if (incomingTab.active === false) return state
				const shouldReplaceFileData =
					Boolean(incomingTab.fileData?.recycleBin) ||
					incomingTab.type === "file_manager" ||
					incomingTab.fileData?.space_type === "user" ||
					incomingTab.fileData?.display_config?.type === DetailType.SelfMedia ||
					shouldUsePendingAttachmentSyncTab

				return state.map((tab) => {
					if (tab.id !== incomingTab.id) return { ...tab, active: false }

					return {
						...tab,
						active: true,
						active_at: now,
						fileManager: incomingTab.fileManager ?? tab.fileManager,
						fileManagerAreaRequest: incomingTab.fileManagerAreaRequest,
						fileManagerState: incomingTab.fileManagerState ?? tab.fileManagerState,
						returnTabId: incomingTab.returnTabId ?? tab.returnTabId,
						title: shouldReplaceFileData ? incomingTab.title : tab.title,
						fileData: shouldReplaceFileData
							? incomingTab.fileData
							: {
									...tab.fileData,
									htmlNavigation: incomingTab.fileData.htmlNavigation,
								},
						closeable:
							tab.closeable === false || incomingTab.closeable === false
								? false
								: true,
						isDeleted: shouldUsePendingAttachmentSyncTab ? false : tab.isDeleted,
						isLoading: shouldUsePendingAttachmentSyncTab ? true : tab.isLoading,
						display_config: shouldReplaceFileData
							? incomingTab.display_config
							: tab.display_config,
						filePath: shouldReplaceFileData
							? incomingTab.fileData.relative_file_path || incomingTab.filePath
							: tab.fileData.relative_file_path || tab.filePath,
					}
				})
			}

			const newTab = {
				...incomingTab,
				active: incomingTab.active !== false,
				filePath: incomingTab.fileData.relative_file_path || incomingTab.filePath,
				create_at: now,
				active_at: now,
			}
			return handleDuplicateTabNames(state, newTab)
		}

		case TabActionType.REMOVE_TAB: {
			const tabId = action.payload?.tabId
			if (!tabId) return state
			if (state.find((tab) => tab.id === tabId)?.closeable === false) return state
			if (state.length === 1) return []

			const filteredTabs = state.filter((tab) => tab.id !== tabId)
			const removedTab = state.find((tab) => tab.id === tabId)
			if (!removedTab?.active || filteredTabs.length === 0) return filteredTabs

			const mostRecentTab = filteredTabs.reduce((mostRecent, current) => {
				const currentActiveAt = current.active_at || current.create_at || 0
				const mostRecentActiveAt = mostRecent.active_at || mostRecent.create_at || 0
				return currentActiveAt > mostRecentActiveAt ? current : mostRecent
			})

			return filteredTabs.map((tab) => ({
				...tab,
				active: tab.id === mostRecentTab.id,
				active_at: tab.id === mostRecentTab.id ? now : tab.active_at,
			}))
		}

		case TabActionType.SWITCH_TAB: {
			const tabId = action.payload?.tabId
			if (!tabId) return state

			return state.map((tab) => ({
				...tab,
				active: tab.id === tabId,
				active_at: tab.id === tabId ? now : tab.active_at,
			}))
		}

		case TabActionType.UPDATE_TAB: {
			const incomingTab = action.payload?.tab
			if (!incomingTab) return state
			return state.map((tab) =>
				tab.id === incomingTab.id ? { ...tab, ...incomingTab } : tab,
			)
		}

		case TabActionType.CLEAR_TABS: {
			if (action.payload?.force) return []

			const protectedTabs = state.filter((tab) => tab.closeable === false)
			if (protectedTabs.length === 0) return []

			const activeProtectedTab = protectedTabs.find((tab) => tab.active)
			const tabToActivate =
				activeProtectedTab ||
				protectedTabs.reduce((latest, tab) =>
					(tab.active_at || tab.create_at || 0) >
					(latest.active_at || latest.create_at || 0)
						? tab
						: latest,
				)

			return protectedTabs.map((tab) => ({
				...tab,
				active: tab.id === tabToActivate.id,
			}))
		}

		case TabActionType.CLOSE_OTHER_TABS: {
			const tabId = action.payload?.tabId
			if (!tabId || !state.some((tab) => tab.id === tabId)) return state

			return state
				.filter((tab) => tab.id === tabId || tab.closeable === false)
				.map((tab) => ({
					...tab,
					active: tab.id === tabId,
					active_at: tab.id === tabId ? now : tab.active_at,
				}))
		}

		case TabActionType.CLOSE_TABS_TO_RIGHT: {
			const tabId = action.payload?.tabId
			if (!tabId) return state
			const targetIndex = state.findIndex((tab) => tab.id === tabId)
			if (targetIndex === -1) return state

			return state.filter((tab, index) => index <= targetIndex || tab.closeable === false)
		}

		case TabActionType.SYNC_TABS_DATA:
			return action.payload?.tabs || state

		case TabActionType.RESTORE_PROJECT_TABS: {
			// 项目缓存和个人缓存到达顺序无关；只能合并最新 reducer 状态，不能用旧 ref 整体替换。
			const restored = restoreTabOrder(
				mergeUserFileTabs(state, action.payload?.tabs || []),
				action.payload?.tabOrder,
			)
			if (!action.payload?.restoreActive) return restored
			const requestedId = action.payload.restoredActiveTabId
			const activeId = restored.some((tab) => tab.id === requestedId)
				? requestedId
				: (restored.find((tab) => tab.active)?.id ?? restored[0]?.id)
			return restored.map((tab) => ({ ...tab, active: tab.id === activeId }))
		}

		case TabActionType.RESTORE_USER_FILE_TABS: {
			const identity = action.payload?.userIdentityKey
			if (!identity) return state
			const current = state.filter(
				(tab) => tab.userIdentityKey === undefined || tab.userIdentityKey === identity,
			)
			const positions = action.payload?.userTabPositions
			const incoming = action.payload?.tabs || []
			// 在 reducer 内合并最新状态，避免异步读取结束时覆盖同一批次刚打开的标签。
			const isUserFile = (tab: TabItem) =>
				tab.userIdentityKey === identity &&
				(tab.fileData.space_type === "user" || tab.fileManager?.spaceType === "user")
			const restored = positions
				? mergeUserFileTabs(
						current.filter((tab) => !isUserFile(tab)),
						[...current.filter(isUserFile), ...incoming],
						positions,
					)
				: mergeUserFileTabs(current, incoming)
			const activeId = action.payload?.restoredActiveTabId
			return activeId && restored.some((tab) => tab.id === activeId)
				? restored.map((tab) => ({ ...tab, active: tab.id === activeId }))
				: restored
		}

		case TabActionType.REORDER_TABS: {
			const fromIndex = action.payload?.fromIndex
			const toIndex = action.payload?.toIndex
			if (fromIndex === undefined || toIndex === undefined) return state
			if (state[fromIndex]?.id === PLAYBACK_TAB_ID) return state
			if (state[0]?.id === PLAYBACK_TAB_ID && toIndex === 0) return state
			if (
				fromIndex === toIndex ||
				fromIndex < 0 ||
				toIndex < 0 ||
				fromIndex >= state.length ||
				toIndex >= state.length
			) {
				return state
			}

			const reorderedState = [...state]
			const [movedTab] = reorderedState.splice(fromIndex, 1)
			reorderedState.splice(toIndex, 0, movedTab)
			return reorderedState
		}

		case TabActionType.SYNC_USER_FILE_REFERENCES: {
			const results = action.payload?.userFileResults
			if (!results) return state
			return state.map((tab) => {
				const result = results[tab.fileData.file_id]
				if (!result || tab.fileData.space_type !== "user") return tab
				if (result.status !== "resolved")
					return { ...tab, isDeleted: true, isLoading: false }
				const reference = result.reference
				if (reference.space_type !== "user" || reference.is_directory)
					return { ...tab, isDeleted: true, isLoading: false }
				return {
					...tab,
					title: reference.file_name,
					filePath: reference.space_relative_path,
					isDeleted: false,
					isLoading: false,
					fileData: {
						...tab.fileData,
						...reference,
						file_reference: reference,
						filename: reference.file_name,
						display_filename: reference.file_name,
						relative_file_path: reference.space_relative_path,
					},
				}
			})
		}

		case TabActionType.DEACTIVATE_ALL:
			return state.map((tab) => ({ ...tab, active: false }))

		default:
			return state
	}
}
