import { useState, useCallback, useRef, useMemo, type PropsWithChildren } from "react"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "../ui/context-menu"
import { ElementMenuContext } from "./ElementMenuContext"
import { getMenuItems } from "./getMenuItems"
import { MenuItemRenderer } from "./MenuItemRenderer"
import type { MenuItem, MenuOption, MenuSource } from "./types"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import { useMagic } from "../../context/MagicContext"
import { useUpdateEffect } from "ahooks"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { ClipboardPaste } from "../ui/icons/index"
import { getShortcutDisplay } from "../../lib/index"

export function ElementMenuProvider(props: PropsWithChildren<unknown>) {
	const { children } = props
	const { t } = useCanvasDesignI18n()
	const [currentElementId, setCurrentElementId] = useState<string | null>(null)
	const [menuKey, setMenuKey] = useState(0)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isClickEnabled, setIsClickEnabled] = useState(false)
	const [isCanvasMenu, setIsCanvasMenu] = useState(false)
	const [canvasMenuPosition, setCanvasMenuPosition] = useState<{
		x: number
		y: number
	} | null>(null)
	const menuSource = useRef<MenuSource | null>(null)

	const triggerRef = useRef<HTMLDivElement>(null)

	const { canvas } = useCanvas()
	const { readonly, selectedElementIds } = useCanvasUI()
	const { methods, permissions } = useMagic()

	const MENU_WIDTH = 220

	// 监听菜单打开/关闭状态，控制 pan 和缩放
	// 只有当菜单是从画布打开时，才禁用 pan 和缩放
	useUpdateEffect(() => {
		if (!canvas) return
		if (isMenuOpen && menuSource.current === "canvas") {
			canvas.viewportController.disablePanZoom()
		} else {
			canvas.viewportController.enablePanZoom()
		}
	}, [isMenuOpen])

	// 处理元素选中逻辑（公共逻辑）
	const handleElementSelection = useCallback(
		(elementId: string) => {
			if (!canvas || readonly) return

			const isLocked = canvas.elementManager.getElementData(elementId)?.locked === true
			if (isLocked) return

			// 如果当前是多选状态，不改变选中状态
			if (selectedElementIds.length > 1) {
				// 多选状态下，如果右键的元素不在选中列表中，将其添加到选中列表
				if (!selectedElementIds.includes(elementId)) {
					canvas.selectionManager.select(elementId, true)
				}
			} else {
				// 单选或未选中状态，选中该元素
				canvas.selectionManager.select(elementId)
			}
		},
		[canvas, readonly, selectedElementIds],
	)

	// 触发菜单显示（公共逻辑）
	const triggerMenuDisplay = useCallback((x: number, y: number) => {
		requestAnimationFrame(() => {
			if (triggerRef.current) {
				const contextMenuEvent = new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
					clientX: x,
					clientY: y,
				})
				triggerRef.current.dispatchEvent(contextMenuEvent)
			}
		})
	}, [])

	// 清理菜单项：移除首尾分隔符和相邻的多个分隔符（递归处理子菜单）
	const cleanMenuItems = useCallback((items: MenuItem[]): MenuItem[] => {
		// 先过滤掉不可见的菜单项
		const visibleItems = items.filter((item) => {
			if ("type" in item && item.type === "separator") {
				return true
			}
			const option = item as MenuOption
			return !option.visible || option.visible()
		})

		if (visibleItems.length === 0) return []

		const cleaned: MenuItem[] = []
		let prevWasSeparator = false

		for (let i = 0; i < visibleItems.length; i++) {
			const item = visibleItems[i]
			const isSeparator = "type" in item && item.type === "separator"

			// 跳过首部的分隔符
			if (i === 0 && isSeparator) {
				continue
			}

			// 跳过尾部的分隔符
			if (i === visibleItems.length - 1 && isSeparator) {
				continue
			}

			// 跳过相邻的多个分隔符
			if (isSeparator && prevWasSeparator) {
				continue
			}

			// 如果是菜单项且有子菜单，递归清理子菜单
			if (!isSeparator) {
				const option = item as MenuOption
				if (option.children && option.children.length > 0) {
					cleaned.push({
						...option,
						children: cleanMenuItems(option.children),
					})
					prevWasSeparator = false
					continue
				}
			}

			cleaned.push(item)
			prevWasSeparator = isSeparator
		}

		// 再次检查并移除首尾的分隔符（可能在清理过程中又出现了）
		while (cleaned.length > 0) {
			const first = cleaned[0]
			const last = cleaned[cleaned.length - 1]
			const firstIsSeparator = "type" in first && first.type === "separator"
			const lastIsSeparator = "type" in last && last.type === "separator"

			if (firstIsSeparator) {
				cleaned.shift()
			} else if (lastIsSeparator) {
				cleaned.pop()
			} else {
				break
			}
		}

		return cleaned
	}, [])

	// 预计算元素菜单项数量（用于决定是否展开菜单）
	const getElementMenuItemsCount = useCallback(
		(elementId: string) =>
			canvas
				? cleanMenuItems(
						getMenuItems(
							canvas,
							selectedElementIds,
							elementId,
							methods,
							permissions,
							readonly,
							t,
						),
					).length
				: 0,
		[canvas, selectedElementIds, methods, permissions, readonly, t, cleanMenuItems],
	)

	// 打开菜单
	const openMenu = useCallback(
		(event: React.MouseEvent, elementId: string, source: MenuSource = "layers") => {
			event.preventDefault()
			event.stopPropagation()
			if (getElementMenuItemsCount(elementId) === 0) return
			handleElementSelection(elementId)
			menuSource.current = source
			setCurrentElementId(elementId)
			setMenuKey((prev) => prev + 1)
			triggerMenuDisplay(event.clientX, event.clientY)
		},
		[handleElementSelection, triggerMenuDisplay, getElementMenuItemsCount],
	)

	// 打开菜单（通过坐标）
	const openMenuByPosition = useCallback(
		(elementId: string, x: number, y: number, source: MenuSource = "canvas") => {
			if (getElementMenuItemsCount(elementId) === 0) return
			handleElementSelection(elementId)
			menuSource.current = source
			setCurrentElementId(elementId)
			setMenuKey((prev) => prev + 1)
			triggerMenuDisplay(x, y)
		},
		[handleElementSelection, triggerMenuDisplay, getElementMenuItemsCount],
	)

	// 获取画布空白区域的菜单项（只有粘贴项），position 用于预计算时传入即将使用的位置
	const getCanvasMenuItems = useCallback(
		(position?: { x: number; y: number }): MenuItem[] => {
			if (!canvas || readonly) return []

			const translate = (key: string, fallback: string) => {
				return t ? t(key, fallback) : fallback
			}
			const pastePosition = position ?? canvasMenuPosition

			// 只返回粘贴项
			return [
				{
					id: "paste",
					label: translate("menu.paste", "粘贴"),
					icon: ClipboardPaste,
					shortcut: getShortcutDisplay("edit.paste"),
					onClick: async () => {
						await canvas.userActionRegistry.execute("edit.paste", {
							pastePosition: pastePosition || undefined,
						})
					},
					visible: () => {
						return canvas.userActionRegistry.canExecute("edit.paste")
					},
				},
			]
		},
		[canvas, readonly, t, canvasMenuPosition],
	)

	// 获取菜单项
	const menuItems = useMemo(() => {
		if (!canvas) return []

		// 如果是画布空白区域的菜单，只返回粘贴项
		if (isCanvasMenu) {
			return getCanvasMenuItems()
		}

		const items = getMenuItems(
			canvas,
			selectedElementIds,
			currentElementId,
			methods,
			permissions,
			readonly,
			t,
		)
		return cleanMenuItems(items)
	}, [
		canvas,
		readonly,
		selectedElementIds,
		currentElementId,
		methods,
		permissions,
		t,
		cleanMenuItems,
		isCanvasMenu,
		getCanvasMenuItems,
	])

	// 处理菜单打开/关闭状态变化
	const handleMenuOpenChange = useCallback((open: boolean) => {
		setIsMenuOpen(open)
		if (open) {
			// 菜单打开时，延迟启用点击，防止右键拖动误触发
			setIsClickEnabled(false)
			setTimeout(() => {
				setIsClickEnabled(true)
			}, 150)
		} else {
			// 如果菜单关闭，清空当前元素 ID 和菜单来源
			menuSource.current = null
			setCurrentElementId(null)
			setIsCanvasMenu(false)
			setCanvasMenuPosition(null)
			setIsClickEnabled(false)
		}
	}, [])

	// 监听 Canvas 层的右键菜单事件
	useCanvasEvent(
		"element:contextmenu",
		useCallback(
			({ data }) => {
				const { elementId, x, y } = data
				setIsCanvasMenu(false)
				setCanvasMenuPosition(null)
				openMenuByPosition(elementId, x, y, "canvas")
			},
			[openMenuByPosition],
		),
		[openMenuByPosition],
	)

	// 监听画布空白区域的右键菜单事件
	useCanvasEvent(
		"canvas:contextmenu",
		useCallback(
			({ data }) => {
				const { x, y, canvasX, canvasY } = data
				const canvasItems = cleanMenuItems(getCanvasMenuItems({ x: canvasX, y: canvasY }))
				if (canvasItems.length === 0) return
				setIsCanvasMenu(true)
				setCanvasMenuPosition({ x: canvasX, y: canvasY })
				setCurrentElementId(null)
				menuSource.current = "canvas"
				setMenuKey((prev) => prev + 1)
				triggerMenuDisplay(x, y)
			},
			[triggerMenuDisplay, cleanMenuItems, getCanvasMenuItems],
		),
		[triggerMenuDisplay, cleanMenuItems, getCanvasMenuItems],
	)

	return (
		<ElementMenuContext.Provider value={{ openMenu }}>
			<ContextMenu key={menuKey} onOpenChange={handleMenuOpenChange}>
				<ContextMenuTrigger asChild>
					<div
						ref={triggerRef}
						style={{
							position: "absolute",
							width: 0,
							height: 0,
							pointerEvents: "none",
							visibility: "hidden",
						}}
					/>
				</ContextMenuTrigger>
				<ContextMenuContent className={`w-[${MENU_WIDTH}px]`} data-canvas-ui-component>
					{((isCanvasMenu && !!menuItems.length) ||
						(currentElementId && !!menuItems.length)) && (
						<MenuItemRenderer
							menuWidth={MENU_WIDTH}
							items={menuItems}
							isClickEnabled={isClickEnabled}
						/>
					)}
				</ContextMenuContent>
			</ContextMenu>
			{children}
		</ElementMenuContext.Provider>
	)
}
