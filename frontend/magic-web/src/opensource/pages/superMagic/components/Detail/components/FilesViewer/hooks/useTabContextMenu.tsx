import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import type { MenuProps } from "antd"
import type { TabItem } from "../types"
import FlexBox from "@/opensource/components/base/FlexBox"

export interface TabContextMenuState {
	visible: boolean
	position: { x: number; y: number }
	tabId: string | null
}

export interface TabContextMenuActions {
	closeFileTab: (tabId: string) => void
	closeOtherTabs: (tabId: string) => void
	closeTabsToRight: (tabId: string) => void
	clearAllTabs: () => void
	refreshTab: (tabId: string) => void
}

export interface UseTabContextMenuProps {
	tabs: TabItem[]
	actions: TabContextMenuActions
}

export function useTabContextMenu({ tabs, actions }: UseTabContextMenuProps) {
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
		const hasTabsToRight = tabIndex < tabs.length - 1
		const hasOtherTabs = tabs.length > 1

		return [
			{
				key: "refresh",
				label: t("fileViewer.tabs.refresh"),
				onClick: () => {
					actions.refreshTab(tabId)
					hideContextMenu()
				},
			},
			{
				key: "close",
				label: t("fileViewer.tabs.close"),
				onClick: () => {
					actions.closeFileTab(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeOthers",
				label: (
					<FlexBox align="center" justify="space-between" className="min-w-[160px]">
						<span>{t("fileViewer.tabs.closeOthers")}</span>
						{/* <ShortcutKey
							keys={tabOperations[ShortcutActions.CLOSE_OTHER_TABS].keys}
							className={styles.shortcutKey}
						/> */}
					</FlexBox>
				),
				disabled: !hasOtherTabs,
				onClick: () => {
					actions.closeOtherTabs(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeToRight",
				label: t("fileViewer.tabs.closeToRight"),
				disabled: !hasTabsToRight,
				onClick: () => {
					actions.closeTabsToRight(tabId)
					hideContextMenu()
				},
			},
			{
				key: "closeAll",
				label: t("fileViewer.tabs.closeAll"),
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
