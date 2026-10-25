import * as React from "react"
import { FolderPlus, ImagePlus, ListPlus, Plus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { Popover, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { HTML_EDITOR_Z_INDEX, TAILWIND_Z_INDEX_CLASSES } from "../../constants/z-index"
import type { InsertPlacement } from "./domTreeModel"
import { EditorDropdownMenuContent, EditorPopoverContent } from "../EditorFloating"

export const ActionTooltip = React.forwardRef<
	HTMLElement,
	{
		label: React.ReactNode
		children: React.ReactElement
		side?: "top" | "right" | "bottom" | "left"
	}
>(({ label, children, side = "top" }, ref) => {
	if (label == null || label === "") return children
	const isDisabled =
		React.isValidElement<{ disabled?: boolean }>(children) && children.props.disabled === true
	const trigger = isDisabled ? (
		<span className="inline-flex min-w-0" tabIndex={0} aria-disabled="true">
			{children}
		</span>
	) : (
		React.cloneElement(children, { ref })
	)

	return (
		<Tooltip>
			<TooltipTrigger asChild>{trigger}</TooltipTrigger>
			<TooltipContent
				side={side}
				sideOffset={6}
				className={cn(
					TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP,
					"max-w-72 whitespace-normal break-words",
				)}
				zIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}
			>
				{label}
			</TooltipContent>
		</Tooltip>
	)
})
ActionTooltip.displayName = "ActionTooltip"

export function NodeDetailsPopover({
	children,
	content,
}: {
	children: React.ReactElement
	content: React.ReactNode
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<span
					className="inline-flex min-w-0 max-w-[34%] shrink-0 cursor-help"
					onClick={(event) => event.stopPropagation()}
				>
					{children}
				</span>
			</PopoverTrigger>
			<EditorPopoverContent
				side="top"
				align="start"
				sideOffset={6}
				className={cn(
					"w-fit max-w-72 border-0 bg-foreground px-3 py-2 text-background shadow-lg",
				)}
			>
				{content}
			</EditorPopoverContent>
		</Popover>
	)
}

interface AddNodeMenuProps {
	mode: "inside" | "sibling"
	open: boolean
	disabled: boolean
	onOpenChange: (open: boolean) => void
	onAddText: (placement: InsertPlacement) => void
	onAddImage: (placement: InsertPlacement) => void
	label: string
	testIdPrefix: string
	nodeId: string
}

export function AddNodeMenu({
	mode,
	open,
	disabled,
	onOpenChange,
	onAddText,
	onAddImage,
	label,
	testIdPrefix,
	nodeId,
}: AddNodeMenuProps) {
	const { t } = useTranslation("super")
	const isInside = mode === "inside"
	const Icon = isInside ? FolderPlus : ListPlus

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<ActionTooltip label={label}>
				<span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
					<DropdownMenuTrigger asChild>
						<Button
							size="icon"
							variant="ghost"
							className="h-5 w-5 rounded-sm active:scale-[0.96]"
							disabled={disabled}
							aria-label={label}
							data-testid={`${testIdPrefix}-button`}
							data-node-id={nodeId}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation()
								// Radix opens from pointerdown. Keep a click fallback for
								// programmatic and keyboard activation without toggling twice.
								if (!open) onOpenChange(true)
							}}
						>
							<Icon className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
				</span>
			</ActionTooltip>
			<EditorDropdownMenuContent
				align="end"
				className="w-56"
				data-testid={`${testIdPrefix}-menu`}
				data-node-id={nodeId}
			>
				<DropdownMenuLabel>{label}</DropdownMenuLabel>
				{isInside ? (
					<>
						<DropdownMenuItem
							onSelect={() => onAddText("inside")}
							data-testid={`${testIdPrefix}-text-inside-item`}
							data-node-id={nodeId}
						>
							<Plus className="h-4 w-4" />
							{t("stylePanel.domTree.addText")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => onAddImage("inside")}
							data-testid={`${testIdPrefix}-image-inside-item`}
							data-node-id={nodeId}
						>
							<ImagePlus className="h-4 w-4" />
							{t("stylePanel.domTree.addImage")}
						</DropdownMenuItem>
					</>
				) : (
					<>
						<DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
							{t("stylePanel.domTree.insertBefore")}
						</DropdownMenuLabel>
						<DropdownMenuItem
							onSelect={() => onAddText("before")}
							data-testid={`${testIdPrefix}-text-before-item`}
							data-node-id={nodeId}
						>
							<Plus className="h-4 w-4" />
							{t("stylePanel.domTree.addTextBefore")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => onAddImage("before")}
							data-testid={`${testIdPrefix}-image-before-item`}
							data-node-id={nodeId}
						>
							<ImagePlus className="h-4 w-4" />
							{t("stylePanel.domTree.addImageBefore")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
							{t("stylePanel.domTree.insertAfter")}
						</DropdownMenuLabel>
						<DropdownMenuItem
							onSelect={() => onAddText("after")}
							data-testid={`${testIdPrefix}-text-after-item`}
							data-node-id={nodeId}
						>
							<Plus className="h-4 w-4" />
							{t("stylePanel.domTree.addTextAfter")}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => onAddImage("after")}
							data-testid={`${testIdPrefix}-image-after-item`}
							data-node-id={nodeId}
						>
							<ImagePlus className="h-4 w-4" />
							{t("stylePanel.domTree.addImageAfter")}
						</DropdownMenuItem>
					</>
				)}
			</EditorDropdownMenuContent>
		</DropdownMenu>
	)
}
