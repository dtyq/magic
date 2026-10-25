import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ChevronRight,
	Copy,
	ClipboardPaste,
	ImagePlus,
	MousePointer2,
	Plus,
	Scissors,
	Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuShortcut,
} from "@/components/shadcn-ui/context-menu"
import { cn } from "@/utils/cn"
import type { DomTreeNode } from "../../iframe-bridge/types/messages"
import { TAILWIND_Z_INDEX_CLASSES } from "../../constants/z-index"

type InsertPlacement = "before" | "inside" | "after"

function isSelectableNode(node: DomTreeNode): boolean {
	if (node.canSelect !== undefined) return node.canSelect
	return (
		node.editable ||
		node.disabledReason === "根节点不可移动或删除" ||
		["html", "body"].includes(node.tagName.toLowerCase())
	)
}

interface Props {
	node: DomTreeNode
	semanticLabel: string
	nodeHint: string
	isExpanded: boolean
	isBusy: boolean
	canInsertInside: boolean
	canInsertSibling: boolean
	canMoveBefore: boolean
	canMoveAfter: boolean
	onSelect: () => void
	onCopy: () => void
	onCut: () => void
	onPaste: () => void
	onDuplicate: () => void
	onToggleExpanded: () => void
	onMoveBefore: () => void
	onMoveAfter: () => void
	onAddText: (placement: InsertPlacement) => void
	onAddImage: (placement: InsertPlacement) => void
	onDelete: () => void
	canPaste: boolean
}

const ITEM_CLASS = "h-8 rounded-[3px] px-2 text-xs"
const LABEL_CLASS =
	"px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"

export function DOMTreeContextMenu({
	node,
	semanticLabel,
	nodeHint,
	isExpanded,
	isBusy,
	canInsertInside,
	canInsertSibling,
	canMoveBefore,
	canMoveAfter,
	onSelect,
	onCopy,
	onCut,
	onPaste,
	onDuplicate,
	onToggleExpanded,
	onMoveBefore,
	onMoveAfter,
	onAddText,
	onAddImage,
	onDelete,
	canPaste,
}: Props) {
	const { t } = useTranslation("super")
	const isMac =
		typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")
	const modifier = isMac ? "⌘" : "Ctrl"

	return (
		<ContextMenuContent
			data-testid="dom-tree-context-menu"
			data-node-id={node.nodeId}
			className={cn(
				"w-72 rounded-lg border-border/80 p-1.5 shadow-xl",
				TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.CONTEXT_MENU,
			)}
		>
			<ContextMenuLabel className="flex flex-col gap-1 px-2 py-1.5">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="shrink-0 rounded-sm border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
						{semanticLabel}
					</span>
					<span className="min-w-0 truncate font-mono text-xs text-foreground">
						{node.label}
					</span>
				</div>
				{node.textContent ? (
					<span className="truncate text-[11px] font-normal text-muted-foreground">
						{node.textContent}
					</span>
				) : null}
			</ContextMenuLabel>
			{nodeHint ? (
				<div className="px-2 pb-1 text-[10px] leading-4 text-muted-foreground">
					{nodeHint}
				</div>
			) : null}
			<ContextMenuSeparator />
			<ContextMenuItem
				data-testid="dom-tree-context-menu-select-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!isSelectableNode(node) || isBusy}
				onSelect={onSelect}
			>
				<MousePointer2 className="h-4 w-4" />
				{t("stylePanel.domTree.selectNode")}
			</ContextMenuItem>
			<ContextMenuItem
				data-testid="dom-tree-context-menu-copy-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!node.canMove || isBusy}
				onSelect={onCopy}
			>
				<Copy className="h-4 w-4" />
				{t("stylePanel.domTree.copyNode")}
				<ContextMenuShortcut>{modifier}C</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				data-testid="dom-tree-context-menu-cut-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!node.canMove || isBusy}
				onSelect={onCut}
			>
				<Scissors className="h-4 w-4" />
				{t("stylePanel.domTree.cutNode")}
				<ContextMenuShortcut>{modifier}X</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				data-testid="dom-tree-context-menu-paste-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!canPaste || isBusy || (!canInsertInside && !canInsertSibling)}
				onSelect={onPaste}
			>
				<ClipboardPaste className="h-4 w-4" />
				{t("stylePanel.domTree.pasteNode")}
				<ContextMenuShortcut>{modifier}V</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				data-testid="dom-tree-context-menu-duplicate-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!node.editable || !node.selector || isBusy}
				onSelect={onDuplicate}
			>
				<Copy className="h-4 w-4" />
				{t("stylePanel.domTree.duplicateNode")}
				<ContextMenuShortcut>{modifier}D</ContextMenuShortcut>
			</ContextMenuItem>
			{node.children.length > 0 ? (
				<ContextMenuItem
					data-testid="dom-tree-context-menu-toggle-item"
					data-node-id={node.nodeId}
					className={ITEM_CLASS}
					disabled={isBusy}
					onSelect={onToggleExpanded}
				>
					{isExpanded ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
					{t(
						isExpanded
							? "stylePanel.domTree.collapseNode"
							: "stylePanel.domTree.expand",
					)}
				</ContextMenuItem>
			) : null}
			<ContextMenuSeparator />
			<ContextMenuLabel className={LABEL_CLASS}>
				{t("stylePanel.domTree.reorder")}
			</ContextMenuLabel>
			<ContextMenuItem
				data-testid="dom-tree-context-menu-move-before-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!canMoveBefore || isBusy}
				onSelect={onMoveBefore}
			>
				<ArrowUp className="h-4 w-4" />
				{t("stylePanel.domTree.moveBeforePrevious")}
			</ContextMenuItem>
			<ContextMenuItem
				data-testid="dom-tree-context-menu-move-after-item"
				data-node-id={node.nodeId}
				className={ITEM_CLASS}
				disabled={!canMoveAfter || isBusy}
				onSelect={onMoveAfter}
			>
				<ArrowDown className="h-4 w-4" />
				{t("stylePanel.domTree.moveAfterNext")}
			</ContextMenuItem>
			{canInsertInside || canInsertSibling ? (
				<>
					<ContextMenuSeparator />
					<ContextMenuSub>
						<ContextMenuSubTrigger
							className={ITEM_CLASS}
							disabled={isBusy}
							data-testid="dom-tree-context-menu-insert-trigger"
							data-node-id={node.nodeId}
						>
							<Plus className="h-4 w-4" />
							{t("stylePanel.domTree.insert")}
						</ContextMenuSubTrigger>
						<ContextMenuSubContent
							data-testid="dom-tree-context-menu-insert-content"
							data-node-id={node.nodeId}
							className={cn(
								"w-64 rounded-lg border-border/80 p-1.5 shadow-xl",
								TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.CONTEXT_MENU,
							)}
						>
							{canInsertSibling ? (
								<>
									<ContextMenuLabel className={LABEL_CLASS}>
										{t("stylePanel.domTree.insertBefore")}
									</ContextMenuLabel>
									<ContextMenuItem
										data-testid="dom-tree-context-menu-add-text-before-item"
										data-node-id={node.nodeId}
										className={ITEM_CLASS}
										disabled={isBusy}
										onSelect={() => onAddText("before")}
									>
										<Plus className="h-4 w-4" />
										{t("stylePanel.domTree.addText")}
									</ContextMenuItem>
									<ContextMenuItem
										data-testid="dom-tree-context-menu-add-image-before-item"
										data-node-id={node.nodeId}
										className={ITEM_CLASS}
										disabled={isBusy}
										onSelect={() => onAddImage("before")}
									>
										<ImagePlus className="h-4 w-4" />
										{t("stylePanel.domTree.addImage")}
									</ContextMenuItem>
								</>
							) : null}
							{canInsertInside ? (
								<>
									{canInsertSibling ? <ContextMenuSeparator /> : null}
									<ContextMenuLabel className={LABEL_CLASS}>
										{t("stylePanel.domTree.insertInside")}
									</ContextMenuLabel>
									<ContextMenuItem
										data-testid="dom-tree-context-menu-add-text-inside-item"
										data-node-id={node.nodeId}
										className={ITEM_CLASS}
										disabled={isBusy}
										onSelect={() => onAddText("inside")}
									>
										<Plus className="h-4 w-4" />
										{t("stylePanel.domTree.addText")}
									</ContextMenuItem>
									<ContextMenuItem
										data-testid="dom-tree-context-menu-add-image-inside-item"
										data-node-id={node.nodeId}
										className={ITEM_CLASS}
										disabled={isBusy}
										onSelect={() => onAddImage("inside")}
									>
										<ImagePlus className="h-4 w-4" />
										{t("stylePanel.domTree.addImage")}
									</ContextMenuItem>
								</>
							) : null}
							{canInsertSibling ? (
								<>
									<ContextMenuSeparator />
									<ContextMenuLabel className={LABEL_CLASS}>
										{t("stylePanel.domTree.insertAfter")}
									</ContextMenuLabel>
									<ContextMenuItem
										data-testid="dom-tree-context-menu-add-text-after-item"
										data-node-id={node.nodeId}
										className={ITEM_CLASS}
										disabled={isBusy}
										onSelect={() => onAddText("after")}
									>
										<Plus className="h-4 w-4" />
										{t("stylePanel.domTree.addText")}
									</ContextMenuItem>
									<ContextMenuItem
										data-testid="dom-tree-context-menu-add-image-after-item"
										data-node-id={node.nodeId}
										className={ITEM_CLASS}
										disabled={isBusy}
										onSelect={() => onAddImage("after")}
									>
										<ImagePlus className="h-4 w-4" />
										{t("stylePanel.domTree.addImage")}
									</ContextMenuItem>
								</>
							) : null}
						</ContextMenuSubContent>
					</ContextMenuSub>
				</>
			) : null}
			<ContextMenuSeparator />
			<ContextMenuItem
				data-testid="dom-tree-context-menu-delete-item"
				data-node-id={node.nodeId}
				className={cn(ITEM_CLASS, "text-destructive")}
				variant="destructive"
				disabled={!node.canDelete || isBusy}
				onSelect={onDelete}
			>
				<Trash2 className="h-4 w-4" />
				{t("stylePanel.domTree.delete")}
				<ContextMenuShortcut>{t("stylePanel.domTree.shortcutDelete")}</ContextMenuShortcut>
			</ContextMenuItem>
		</ContextMenuContent>
	)
}
