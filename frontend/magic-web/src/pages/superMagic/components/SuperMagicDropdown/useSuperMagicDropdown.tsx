import SuperMagicDropdown from "./SuperMagicDropdown"
import { useState, useRef, useEffect, useCallback } from "react"
import {
	createEventHandler,
	createSmartEventHandler,
	observeDropdownMenu,
	adjustPositionForBoundary,
	getViewportSize,
	type Position,
	type DropdownSizeConfig,
} from "./utils"
import { type SuperMagicDropdownProps, type UseSuperMagicDropdownReturn } from "./types"
import { MenuProps } from "antd"
import { useIsMobile } from "@/hooks/useIsMobile"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

// 检查事件是否来自输入框或编辑元素
const isFromEditableElement = (event: React.MouseEvent<HTMLElement>): boolean => {
	const target = event.target as HTMLElement

	// 检查事件目标是否为可编辑元素
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
		return true
	}

	// 检查是否为 contentEditable 元素
	if (target.contentEditable === "true") {
		return true
	}

	// 检查父元素链中是否有可编辑元素
	let currentElement = target.parentElement
	while (currentElement && currentElement !== document.body) {
		if (
			currentElement.tagName === "INPUT" ||
			currentElement.tagName === "TEXTAREA" ||
			currentElement.contentEditable === "true" ||
			currentElement.classList.contains("ant-input") // Ant Design 输入框
		) {
			return true
		}
		currentElement = currentElement.parentElement
	}

	return false
}

export default function useSuperMagicDropdown<T = any>({
	width,
	getMenuItems,
	autoAdjustPlacement = true, // 新增配置项，默认启用智能 placement
	preferredPlacements,
	fallbackToAnyPlacement = true,
	fixedWidth = false,
	mobileProps,
	onOpenChange: onOpenChangeCallback,
}: SuperMagicDropdownProps<T>): UseSuperMagicDropdownReturn<T> {
	const [renderMenuItems, setRenderMenuItems] = useState<MenuProps["items"]>()
	const [open, setOpen] = useState(false)
	const [dropdownPosition, setDropdownPosition] = useState<Position>({
		top: 0,
		left: 0,
	})
	const isMobileDevice = useIsMobile()

	// 虚拟触发元素的 ref，用于保留原生动画效果
	const virtualTriggerRef = useRef<HTMLSpanElement>(null)

	// 使用 ref 来存储清理函数、初始位置和当前项数据，避免状态更新
	const observerCleanupRef = useRef<(() => void) | null>(null)
	const initialPositionRef = useRef<Position>({ top: 0, left: 0 })
	const currentItemDataRef = useRef<T | null>(null)

	// 处理菜单尺寸变化并调整位置
	const handleMenuSizeChange = useCallback((size: { width: number; height: number }) => {
		const viewport = getViewportSize()
		const adjustedPosition = adjustPositionForBoundary(
			initialPositionRef.current,
			size,
			viewport,
		)

		// 只有当位置需要调整时才更新
		setDropdownPosition((currentPosition) => {
			if (
				Math.abs(adjustedPosition.top - currentPosition.top) > 1 ||
				Math.abs(adjustedPosition.left - currentPosition.left) > 1
			) {
				return adjustedPosition
			}
			return currentPosition
		})
	}, [])

	// 开始监听菜单尺寸
	const startObservingMenuSize = useCallback(() => {
		// 清理之前的监听器
		if (observerCleanupRef.current) {
			observerCleanupRef.current()
			observerCleanupRef.current = null
		}

		// 开始新的监听
		observerCleanupRef.current = observeDropdownMenu(handleMenuSizeChange)
	}, [handleMenuSizeChange])

	// 停止监听菜单尺寸
	const stopObservingMenuSize = useCallback(() => {
		if (observerCleanupRef.current) {
			observerCleanupRef.current()
			observerCleanupRef.current = null
		}
	}, [])

	// 位置更新处理器 - 支持传入 itemData
	const handlePositionUpdate = useCallback(
		(position: Position, itemData: T) => {
			initialPositionRef.current = position
			currentItemDataRef.current = itemData
			setDropdownPosition(position)

			// 更新虚拟触发元素的位置
			if (virtualTriggerRef.current) {
				virtualTriggerRef.current.style.position = "fixed"
				virtualTriggerRef.current.style.top = `${position.top}px`
				virtualTriggerRef.current.style.left = `${position.left}px`
				virtualTriggerRef.current.style.width = "1px"
				virtualTriggerRef.current.style.height = "1px"
			}

			// 准备菜单项并打开下拉菜单 - 传入 itemData
			if (getMenuItems) {
				setRenderMenuItems(getMenuItems(itemData))
			}
			setOpen(true)

			// 调用外部回调 - 菜单打开时
			onOpenChangeCallback?.(true, itemData)

			startObservingMenuSize()
		},
		[getMenuItems, onOpenChangeCallback, startObservingMenuSize],
	)

	// 处理下拉菜单开关状态变化
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (nextOpen) {
				// 打开时的逻辑已经在 handlePositionUpdate 中处理
				return
			}

			// 关闭时清理
			setOpen(false)
			setRenderMenuItems(undefined)
			stopObservingMenuSize()

			// 调用外部回调
			onOpenChangeCallback?.(false, null)
			currentItemDataRef.current = null
		},
		[onOpenChangeCallback, stopObservingMenuSize],
	)

	// 强制关闭下拉菜单
	const forceCloseDropdown = useCallback(() => {
		if (open) {
			handleOpenChange(false)
		}
	}, [open, handleOpenChange])

	// 订阅全局关闭下拉菜单事件
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Close_All_Dropdowns, forceCloseDropdown)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Close_All_Dropdowns, forceCloseDropdown)
		}
	}, [forceCloseDropdown])

	// 注意：事件处理器现在在 onActionClick 和 onContextMenuClick 中动态创建

	const dropdownContent = (
		<SuperMagicDropdown
			open={open}
			trigger={["click"]}
			overlayStyle={
				fixedWidth
					? {
						width: `${width}px`,
						minWidth: `${width}px`,
						maxWidth: `${width}px`,
					}
					: { width }
			}
			placement="bottomLeft"
			menu={{
				items: renderMenuItems,
				style: fixedWidth
					? {
						width: `${width}px`,
						minWidth: `${width}px`,
						maxWidth: `${width}px`,
					}
					: undefined, // 也给 menu 设置宽度
			}}
			onOpenChange={handleOpenChange}
			mobileProps={mobileProps}
		>
			<span
				ref={virtualTriggerRef}
				style={{
					position: "fixed",
					top: dropdownPosition.top,
					left: dropdownPosition.left,
					width: "1px",
					height: "1px",
					pointerEvents: "none",
				}}
			/>
		</SuperMagicDropdown>
	)

	const onActionClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, itemData: T) => {
			// 动态生成 sizeConfig，包含当前的菜单项
			const dynamicSizeConfig: DropdownSizeConfig = {
				width,
				menuItems: getMenuItems ? getMenuItems(itemData) : undefined,
			}

			// 创建动态事件处理器
			const dynamicEventHandlers = autoAdjustPlacement
				? createSmartEventHandler<T>(handlePositionUpdate, dynamicSizeConfig, {
					preferredPlacements,
					fallbackToAnyPlacement,
				})
				: createEventHandler<T>(handlePositionUpdate, dynamicSizeConfig)

			dynamicEventHandlers.handleElementClick(event, "bottom-left", itemData)
		},
		[
			width,
			getMenuItems,
			autoAdjustPlacement,
			handlePositionUpdate,
			preferredPlacements,
			fallbackToAnyPlacement,
		],
	)

	const onContextMenuClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, itemData: T) => {
			if (isMobileDevice && isFromEditableElement(event)) {
				console.log("移动端检测到来自可编辑元素的 contextmenu 事件，已忽略")
				return
			}

			// 动态生成 sizeConfig，包含当前的菜单项
			const dynamicSizeConfig: DropdownSizeConfig = {
				width,
				menuItems: getMenuItems ? getMenuItems(itemData) : undefined,
			}

			// 创建动态事件处理器
			const dynamicEventHandlers = autoAdjustPlacement
				? createSmartEventHandler<T>(handlePositionUpdate, dynamicSizeConfig, {
					preferredPlacements,
					fallbackToAnyPlacement,
				})
				: createEventHandler<T>(handlePositionUpdate, dynamicSizeConfig)

			dynamicEventHandlers.handleContextMenu(event, itemData)
		},
		[
			isMobileDevice,
			width,
			getMenuItems,
			autoAdjustPlacement,
			handlePositionUpdate,
			preferredPlacements,
			fallbackToAnyPlacement,
		],
	)

	// 事件委托扩展内容
	const delegateProps = {
		onDropdownActionClick: onActionClick,
		onDropdownContextMenuClick: onContextMenuClick,
	}

	return {
		open,
		dropdownContent,
		delegateProps,
	}
}
