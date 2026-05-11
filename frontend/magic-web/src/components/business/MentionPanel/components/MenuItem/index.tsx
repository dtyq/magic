import { memo } from "react"
import MagicIcon from "@/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"
import SmartTooltip from "@/components/other/SmartTooltip"
import FlexBox from "@/components/base/FlexBox"
import { Button } from "@/components/shadcn-ui/button"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import useGeistFont from "@/styles/fonts/geist"
import { MenuItemProps, MentionItemType } from "../../types"
import { useMentionItemRenderContextValue, useMentionItemRenderer } from "../../renderers/context"
import {
	getMentionItemSkillSourceLabel,
	shouldRenderMentionItemTypeDescription,
} from "../../renderers/shared/helpers"

const MenuItem = memo(function MenuItem(props: MenuItemProps) {
	const {
		item,
		selected = false,
		onClick,
		onDelete,
		className,
		style,
		isSearch,
		t,
		...restProps
	} = props

	useGeistFont()

	const renderer = useMentionItemRenderer(item.type)
	const filePreviewById = useMentionItemRenderContextValue()
	const rendererContext = {
		item,
		t,
		isSearch,
		platform: "desktop" as const,
		filePreviewById,
	}

	function renderDeleteButton() {
		if (!item.tags?.includes("history") || !onDelete) return null

		return (
			<div
				className="deleteButton flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-xs text-secondary-foreground opacity-100 transition-all duration-200 hover:bg-accent hover:text-foreground"
				onClick={(event) => {
					event.preventDefault()
					event.stopPropagation()
					onDelete(item)
				}}
				role="button"
				aria-label={`删除历史记录: ${item.name}`}
				tabIndex={-1}
			>
				<MagicIcon component={IconX} size={12} />
			</div>
		)
	}

	const hasRightArrow =
		!item.tags?.includes("history") &&
		(item.hasChildren || item.type === MentionItemType.FOLDER)

	function renderRightArrow() {
		if (!hasRightArrow) return null

		return (
			<Button
				variant="ghost"
				className={cn(
					"h-6 shrink-0 gap-0.5 rounded-full px-2 text-[10px] font-medium leading-none text-muted-foreground transition-all duration-150",
					"hover:bg-white hover:text-black group-hover/menu-item:bg-white group-hover/menu-item:text-black",
					selected && "bg-white text-black",
				)}
				tabIndex={-1}
				data-right-arrow
				data-testid="mention-panel-enter-folder-trigger"
			>
				<span
					className={cn(
						"max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-150",
						"group-hover/menu-item:mr-0.5 group-hover/menu-item:max-w-8 group-hover/menu-item:opacity-100",
						selected && "mr-0.5 max-w-8 opacity-100",
					)}
				>
					{t.navigationActions.enter}
				</span>
				<ChevronRight className="size-3.5 shrink-0" />
			</Button>
		)
	}

	function handleClick(event?: React.MouseEvent) {
		if (item.unSelectable) {
			event?.preventDefault()
			event?.stopPropagation()
			return
		}

		event?.preventDefault()
		onClick?.(event)
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		if (item.unSelectable) return
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			event.stopPropagation()
			onClick?.()
		}
	}

	if (item.type === MentionItemType.TITLE) {
		return (
			<FlexBox
				className="min-w-0 overflow-hidden p-1.5 font-['Geist'] text-[10px] font-normal leading-[13px] text-foreground"
				align="center"
				gap={4}
			>
				<span className="inline-flex shrink-0 items-center justify-center">
					{renderer.renderIcon?.(rendererContext)}
				</span>
				<div className="min-w-0 flex-1">
					<SmartTooltip
						className="block w-full min-w-0 text-[10px] font-normal leading-[13px] text-foreground"
						elementType="span"
					>
						{item.name}
					</SmartTooltip>
				</div>
			</FlexBox>
		)
	}

	if (item.type === MentionItemType.DIVIDER) return <div className="m-1.5 h-px bg-border" />

	const itemClassName = cn(
		"mb-0.5 flex min-h-8 cursor-pointer items-center gap-1 rounded-sm p-1.5 transition-all duration-150",
		hasRightArrow && "group/menu-item",
		"hover:bg-primary/10 hover:[&_.deleteButton]:opacity-100",
		selected && "bg-accent [&_.deleteButton]:opacity-100",
		className,
	)
	const typeDescription = renderer.getTypeDescription?.(rendererContext) ?? null
	const shouldRenderTypeDescription = shouldRenderMentionItemTypeDescription(rendererContext)
	const skillSourceLabel = getMentionItemSkillSourceLabel(rendererContext)

	return (
		<div
			className={itemClassName}
			style={{
				...style,
				...(item.unSelectable
					? {
							opacity: 0.5,
							cursor: "not-allowed",
							pointerEvents: "none" as const,
						}
					: {}),
			}}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role="option"
			aria-selected={selected}
			aria-disabled={item.unSelectable}
			aria-label={`${t.ariaLabels.menuItem}: ${item.name}`}
			tabIndex={selected && !item.unSelectable ? 0 : -1}
			data-testid="mention-panel-menu-item"
			{...restProps}
		>
			<div className="flex min-w-0 flex-1 items-center gap-1">
				<span className="inline-flex shrink-0 items-center justify-center">
					{renderer.renderIcon?.(rendererContext)}
				</span>
				<div className="min-w-0">
					<SmartTooltip
						className="block w-full min-w-0 text-xs leading-4 text-foreground"
						elementType="span"
					>
						{item.name}
					</SmartTooltip>
				</div>
				{renderer.renderTitleSuffix?.(rendererContext)}
			</div>

			{shouldRenderTypeDescription && (
				<div
					className="relative max-w-[50%] overflow-hidden whitespace-nowrap font-['Geist'] text-[10px] font-normal leading-[13px] text-muted-foreground"
					style={{ direction: "rtl", textOverflow: "ellipsis" }}
					data-testid={skillSourceLabel ? "mention-panel-skill-source" : undefined}
				>
					<span style={{ direction: "ltr", unicodeBidi: "bidi-override" }}>
						{typeDescription}
					</span>
				</div>
			)}
			{renderDeleteButton()}
			{renderRightArrow()}
		</div>
	)
})

MenuItem.displayName = "MenuItem"

export default MenuItem
