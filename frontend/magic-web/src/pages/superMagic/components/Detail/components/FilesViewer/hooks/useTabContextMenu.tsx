import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import type { MenuProps } from "antd"
import {
	ArrowLeftToLine,
	ArrowRightToLine,
	Copy,
	Folder,
	Info,
	ListX,
	LocateFixed,
	RefreshCw,
	Square,
	Star,
	X,
} from "lucide-react"
import type { TabFileContext, TabItem } from "../types"
import FlexBox from "@/components/base/FlexBox"
import { isWebsiteTab } from "../utils/websiteTabs"

export interface TabContextMenuState {
	visible: boolean
	position: { x: number; y: number }
	tabId: string | null
}

export interface TabContextMenuActions {
	closeFileTab: (tabId: string) => void
	closeOtherTabs: (tabId: string) => void
	closeTabsToLeft?: (tabId: string) => void
	closeTabsToRight: (tabId: string) => void
	clearAllTabs: () => void
	refreshTab: (tabId: string) => void
	addWebsiteToCommon?: (tab: TabItem) => void
	showFileInfo?: (tabId: string) => void
	copyFileName?: (tabId: string) => void
	copyFilePath?: (tabId: string) => void
	locateFile?: (tabId: string) => void
}

export interface UseTabContextMenuProps {
	tabs: TabItem[]
	actions: TabContextMenuActions
	getFileContext?: (tabId: string) => TabFileContext | undefined
}

export function useTabContextMenu({ tabs, actions, getFileContext }: UseTabContextMenuProps) {
	const { t } = useTranslation("super")
	const [contextMenuState, setContextMenuState] = useState<TabContextMenuState>({
		visible: false,
		position: { x: 0, y: 0 },
		tabId: null,
	})

	// 显示右键菜单
	const showContextMenu = (e: React.MouseEvent, tabId: string) => {
		e.preventDefault()
		e.stopPropagation()

		setContextMenuState({
			visible: true,
			position: { x: e.clientX, y: e.clientY },
			tabId,
		})
	}

	// 隐藏右键菜单
	const hideContextMenu = () => {
		setContextMenuState({
			visible: false,
			position: { x: 0, y: 0 },
			tabId: null,
		})
	}

	// 处理容器右键事件（通过冒泡实现）
	const handleContainerContextMenu = (e: React.MouseEvent) => {
		// 查找最近的 tab 元素
		const target = e.target as HTMLElement
		const tabElement = target.closest("[data-tab-id]") as HTMLElement

		if (tabElement) {
			const tabId = tabElement.getAttribute("data-tab-id")
			if (tabId) {
				// 直接更新菜单状态，无论当前是否已显示
				e.preventDefault()
				e.stopPropagation()

				setContextMenuState({
					visible: true,
					position: { x: e.clientX, y: e.clientY },
					tabId,
				})
			}
		}
	}

	// 生成右键菜单项
	const getContextMenuItems = (tabId: string): MenuProps["items"] => {
		const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
		const tab = tabs[tabIndex]
		if (!tab) return []
		const fileContext = getFileContext?.(tabId)
		const fileItems: MenuProps["items"] = fileContext
			? [
					{ type: "divider" },
					{
						key: "fileInfo",
						label: t("fileViewer.tabs.fileInfo"),
						icon: <Info size={16} />,
						disabled: !fileContext.canShowInfo || !actions.showFileInfo,
						onClick: () => {
							hideContextMenu()
							actions.showFileInfo?.(tabId)
						},
					},
					{
						key: "copyFileName",
						label: t("fileViewer.tabs.copyFileName"),
						icon: <Copy size={16} />,
						disabled: !fileContext.fileName || !actions.copyFileName,
						onClick: () => {
							hideContextMenu()
							actions.copyFileName?.(tabId)
						},
					},
					{
						key: "copyFilePath",
						label: t("fileViewer.tabs.copyFilePath"),
						icon: <Folder size={16} />,
						disabled: !fileContext.canCopyPath || !actions.copyFilePath,
						onClick: () => {
							hideContextMenu()
							actions.copyFilePath?.(tabId)
						},
					},
				]
			: []
		const hasCloseableTabs = tabs.some((item) => item.closeable !== false)
		const hasCloseableTabsToLeft = tabs
			.slice(0, tabIndex)
			.some((item) => item.closeable !== false)
		const hasCloseableTabsToRight = tabs
			.slice(tabIndex + 1)
			.some((item) => item.closeable !== false)
		const hasCloseableOtherTabs = tabs.some(
			(item) => item.id !== tabId && item.closeable !== false,
		)
		const canCloseTab = tab?.closeable !== false
		const websiteCommonItems: MenuProps["items"] =
			tab && isWebsiteTab(tab) && actions.addWebsiteToCommon
				? [
						{
							key: "addWebsiteToCommon",
							label: t("fileViewer.tabs.addWebsiteToCommon"),
							icon: <Star size={16} />,
							onClick: () => {
								actions.addWebsiteToCommon?.(tab)
								hideContextMenu()
							},
						},
					]
				: []

		return [
			...(tab?.type !== "file_manager"
				? [
						{
							key: "refresh",
							label: t("fileViewer.tabs.refresh"),
							icon: <RefreshCw size={16} />,
							onClick: () => {
								actions.refreshTab(tabId)
								hideContextMenu()
							},
						},
					]
				: []),
			...websiteCommonItems,
			...(fileContext?.canLocate && actions.locateFile
				? [
						{
							key: "locateFile",
							label: t("fileViewer.locateFile"),
							icon: <LocateFixed size={16} />,
							onClick: () => {
								hideContextMenu()
								actions.locateFile?.(tabId)
							},
						},
					]
				: []),
			...fileItems,
			{ type: "divider" },
			{
				key: "close",
				label: t("fileViewer.tabs.close"),
				icon: <X size={16} />,
				disabled: !canCloseTab,
				onClick: () => {
					actions.closeFileTab(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeOthers",
				icon: <Square size={16} />,
				label: (
					<FlexBox align="center" justify="space-between" className="min-w-[160px]">
						<span>{t("fileViewer.tabs.closeOthers")}</span>
						{/* <ShortcutKey
							keys={tabOperations[ShortcutActions.CLOSE_OTHER_TABS].keys}
							className={styles.shortcutKey}
						/> */}
					</FlexBox>
				),
				disabled: !hasCloseableOtherTabs,
				onClick: () => {
					actions.closeOtherTabs(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeToLeft",
				label: t("fileViewer.tabs.closeToLeft"),
				icon: <ArrowLeftToLine size={16} />,
				disabled: !hasCloseableTabsToLeft || !actions.closeTabsToLeft,
				onClick: () => {
					actions.closeTabsToLeft?.(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeToRight",
				label: t("fileViewer.tabs.closeToRight"),
				icon: <ArrowRightToLine size={16} />,
				disabled: !hasCloseableTabsToRight,
				onClick: () => {
					actions.closeTabsToRight(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeAll",
				label: t("fileViewer.tabs.closeAll"),
				icon: <ListX size={16} />,
				disabled: !hasCloseableTabs,
				onClick: () => {
					actions.clearAllTabs()
					hideContextMenu()
				},
			},
		]
	}

	// 监听全局点击事件，关闭右键菜单
	useEffect(() => {
		const handleGlobalClick = (e: Event) => {
			if (contextMenuState.visible) {
				// 检查是否是在 tab 元素上的右键事件
				const target = e.target as HTMLElement
				const isTabContextMenu = e.type === "contextmenu" && target.closest("[data-tab-id]")

				// 如果是 tab 上的右键事件，不关闭菜单（让 handleContainerContextMenu 处理）
				if (!isTabContextMenu) {
					hideContextMenu()
				}
			}
		}

		if (contextMenuState.visible) {
			document.addEventListener("click", handleGlobalClick)
			document.addEventListener("contextmenu", handleGlobalClick)
			return () => {
				document.removeEventListener("click", handleGlobalClick)
				document.removeEventListener("contextmenu", handleGlobalClick)
			}
		}
	}, [contextMenuState.visible])

	return {
		contextMenuState,
		handleContainerContextMenu,
		getContextMenuItems,
		hideContextMenu,
		showContextMenu,
	}
}
