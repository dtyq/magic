import { useId, useState, type ReactNode } from "react"
import { CircleHelp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { ContextMenuItem } from "../../primitives/shadcn/context-menu"
import { usePortalContainer } from "../../primitives/custom/PortalContainerContext"
import { formatShortcut } from "../../../runtime/shared/lib/index"
import { cn } from "../../../runtime/shared/lib/utils"
import type { MenuOption } from "./types"
import styles from "./index.module.css"

interface MenuActionItemProps {
	iconNode: ReactNode
	option: MenuOption
	isDisabled: boolean
	isClickEnabled: boolean
}

export function MenuActionItem({
	option,
	iconNode,
	isDisabled,
	isClickEnabled,
}: MenuActionItemProps) {
	const [open, setOpen] = useState(false)
	const helpId = useId()
	const portalContainer = usePortalContainer()
	const item = (
		<ContextMenuItem
			key={option.id}
			disabled={isDisabled}
			aria-describedby={option.help ? helpId : undefined}
			onFocus={(event) => {
				// 键盘沿用菜单项焦点，鼠标只在问号上触发提示；不额外嵌套按钮。
				if (option.help && event.currentTarget.matches(":focus-visible")) setOpen(true)
			}}
			onBlur={() => setOpen(false)}
			onClick={(e) => {
				if (!isClickEnabled) {
					e.preventDefault()
					e.stopPropagation()
					return
				}
				setOpen(false)
				option.onClick?.()
			}}
			className={cn(
				option.variant === "destructive" ? styles.menuItemDelete : undefined,
				styles.menuItem,
			)}
		>
			{/* <div className={styles.menuItemIcon}>{renderIcon()}</div> */}
			<div className={styles.menuItemIcon}>{iconNode}</div>
			{option.help && (
				<span id={helpId} className="sr-only">
					{option.help}
				</span>
			)}
			{option.description ? (
				<div className={styles.menuItemText}>
					<div className={styles.menuItemLabel}>{option.label}</div>
					<div className={styles.menuItemDescription}>{option.description}</div>
				</div>
			) : (
				<div className={styles.menuItemLabel}>{option.label}</div>
			)}
			{option.help && (
				<TooltipTrigger asChild>
					<span
						className="ml-auto inline-flex shrink-0 items-center text-muted-foreground"
						tabIndex={-1}
						aria-hidden
						onPointerDown={(event) => {
							// 问号只提供说明；阻止指针操作进入菜单选择，避免误触删除。
							event.preventDefault()
							event.stopPropagation()
						}}
						onClick={(event) => {
							event.preventDefault()
							event.stopPropagation()
						}}
						onPointerUp={(event) => {
							// Radix 可在抬起指针时合成菜单点击，必须同时阻止这个选择入口。
							event.preventDefault()
							event.stopPropagation()
						}}
					>
						<CircleHelp size={16} />
					</span>
				</TooltipTrigger>
			)}
			{option.rightContentRender ? (
				<div className={styles.menuItemRightContent}>{option.rightContentRender()}</div>
			) : (
				<div className={styles.menuItemShortcut}>
					{option.shortcut?.modifiers?.map((item) => {
						return (
							<div key={item} className={styles.menuItemShortcutItem}>
								{formatShortcut(item)}
							</div>
						)
					})}
					{option.shortcut?.key && (
						<div className={styles.menuItemShortcutItem}>
							{option.shortcut.key.toUpperCase()}
						</div>
					)}
				</div>
			)}
		</ContextMenuItem>
	)
	if (!option.help) return item
	return (
		<Tooltip open={open} onOpenChange={setOpen}>
			{item}
			{/* 提示使用画布局部容器，避开菜单滚动裁切，层级高于菜单的 1002。 */}
			<TooltipContent
				container={portalContainer}
				zIndex={1003}
				side="right"
				sideOffset={4}
				className="max-w-[min(20rem,var(--radix-tooltip-content-available-width,100vw))] whitespace-normal break-words text-left"
			>
				{option.help}
			</TooltipContent>
		</Tooltip>
	)
}
