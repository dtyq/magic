import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
	ArrowDown,
	ArrowUp,
	Copy,
	CornerDownRight,
	ImagePlus,
	ImageUp,
	Trash2,
	Type,
} from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { MagicTooltip } from "@/components/base"
import { useTranslation } from "react-i18next"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { DomTreeNode } from "../../../iframe-bridge/types/messages"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"
import { EditorDropdownMenuContent } from "../../EditorFloating"
import { STYLE_PANEL_STYLES } from "../styles"
import type { ContextToolbarItemMotion } from "../types"
import {
	getDomTreeNodeDisplayLabel,
	getDomTreeSemanticLabel,
	getTextInsertPlacementLabel,
	getSemanticKey,
	type InsertPlacement,
	type TextInsertRequest,
} from "../../DOMTreePanel/domTreeModel"

interface ElementActionsProps {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	disabled?: boolean
	/** Optional per-button enter transition used by the contextual toolbar. */
	itemMotion?: ContextToolbarItemMotion
}

function findNodeBySelector(node: DomTreeNode, selector: string): DomTreeNode | null {
	if (node.selector === selector) return node
	for (const child of node.children) {
		const match = findNodeBySelector(child, selector)
		if (match) return match
	}
	return null
}

interface NodeContext {
	node: DomTreeNode
	parent: DomTreeNode | null
	index: number
}

function findNodeContextBy(
	node: DomTreeNode,
	matches: (node: DomTreeNode) => boolean,
	parent: DomTreeNode | null = null,
): NodeContext | null {
	if (matches(node)) {
		return {
			node,
			parent,
			index: parent?.children.findIndex((child) => child.nodeId === node.nodeId) ?? -1,
		}
	}
	for (const child of node.children) {
		const match = findNodeContextBy(child, matches, node)
		if (match) return match
	}
	return null
}

function findNodeContext(
	node: DomTreeNode,
	selector: string,
	parent: DomTreeNode | null = null,
): NodeContext | null {
	return findNodeContextBy(node, (candidate) => candidate.selector === selector, parent)
}

function findNodeContextById(
	node: DomTreeNode,
	nodeId: string,
	parent: DomTreeNode | null = null,
): NodeContext | null {
	return findNodeContextBy(node, (candidate) => candidate.nodeId === nodeId, parent)
}

interface AddElementButtonProps {
	icon: React.ReactNode
	label: string
	tooltip?: string
	testId: string
	disabled: boolean
	onClick: () => void
}

function AddElementButton({
	icon,
	label,
	tooltip = label,
	testId,
	disabled,
	onClick,
}: AddElementButtonProps) {
	return (
		<MagicTooltip title={tooltip} contentZIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}>
			<span className="inline-flex">
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled}
					onClick={onClick}
					className={`h-7 w-7 px-0 ${STYLE_PANEL_STYLES.toolbarButton}`}
					data-testid={testId}
					aria-label={label}
				>
					{icon}
				</Button>
			</span>
		</MagicTooltip>
	)
}

interface AddElementMenuProps {
	type: "text" | "image"
	icon: React.ReactNode
	label: string
	testId: string
	disabled: boolean
	canInsertInside: boolean
	canInsertSibling: boolean
	onInsert: (type: "text" | "image", placement: InsertPlacement) => void
}

function AddElementMenu({
	type,
	icon,
	label,
	testId,
	disabled,
	canInsertInside,
	canInsertSibling,
	onInsert,
}: AddElementMenuProps) {
	const { t } = useTranslation("super")
	const [open, setOpen] = useState(false)
	const menuTestId = testId.replace(/-button$/, "")
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<MagicTooltip
				title={label}
				disabled={open}
				contentZIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}
			>
				<span className="inline-flex">
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							disabled={disabled}
							className={`h-7 w-7 px-0 ${STYLE_PANEL_STYLES.toolbarButton}`}
							data-testid={testId}
							aria-label={label}
							onClick={() => {
								if (!open) setOpen(true)
							}}
						>
							{icon}
						</Button>
					</DropdownMenuTrigger>
				</span>
			</MagicTooltip>
			<EditorDropdownMenuContent
				align="start"
				className="w-48"
				data-testid={`${menuTestId}-menu`}
			>
				<DropdownMenuLabel>{label}</DropdownMenuLabel>
				{canInsertSibling ? (
					<DropdownMenuItem
						onSelect={() => onInsert(type, "before")}
						data-testid={`${menuTestId}-before-item`}
					>
						<ArrowUp className="h-4 w-4" />
						{t("stylePanel.domTree.insertBefore")}
					</DropdownMenuItem>
				) : null}
				{canInsertInside ? (
					<DropdownMenuItem
						onSelect={() => onInsert(type, "inside")}
						data-testid={`${menuTestId}-inside-item`}
					>
						<CornerDownRight className="h-4 w-4" />
						{t("stylePanel.domTree.insertInside")}
					</DropdownMenuItem>
				) : null}
				{canInsertSibling ? (
					<DropdownMenuItem
						onSelect={() => onInsert(type, "after")}
						data-testid={`${menuTestId}-after-item`}
					>
						<ArrowDown className="h-4 w-4" />
						{t("stylePanel.domTree.insertAfter")}
					</DropdownMenuItem>
				) : null}
			</EditorDropdownMenuContent>
		</DropdownMenu>
	)
}

/**
 * Element action buttons (delete, duplicate)
 * Displayed in the style panel toolbar
 */
export const ElementActions = observer(function ElementActions({
	editorRef,
	disabled = false,
	itemMotion,
}: ElementActionsProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()
	const historyIndex = stylePanelStore.historyState.currentIndex
	const selectors = stylePanelStore.getSelectedSelectors()
	const hasSingleSelection = selectors.length === 1
	const selectedSelector = hasSingleSelection ? selectors[0] : null
	const selectedPosition =
		stylePanelStore.selectedElement?.computedStyles?.position?.toLowerCase()
	const isOutOfDocumentFlow =
		hasSingleSelection && (selectedPosition === "absolute" || selectedPosition === "fixed")
	const isSingleImageSelected =
		hasSingleSelection && stylePanelStore.selectedElement?.tagName?.toLowerCase() === "img"

	// Refs to prevent duplicate operations
	const isDeleteInProgressRef = useRef(false)
	const isDuplicateInProgressRef = useRef(false)
	const isReplaceImageInProgressRef = useRef(false)
	const isInsertInProgressRef = useRef(false)
	const isMoveInProgressRef = useRef(false)
	const [textInsertRequest, setTextInsertRequest] = useState<TextInsertRequest | null>(null)
	const [textInput, setTextInput] = useState("")
	const [isTextInsertSubmitting, setIsTextInsertSubmitting] = useState(false)
	const [moveState, setMoveState] = useState({ canMoveUp: false, canMoveDown: false })
	const previousSelectedSelectorRef = useRef<string | null>(null)

	/**
	 * Handle delete element
	 * Only works in single-select mode
	 */
	const handleDelete = useCallback(async () => {
		// Prevent duplicate delete operations
		if (isDeleteInProgressRef.current) {
			console.log("[StylePanel] Delete already in progress, ignoring")
			return
		}

		// Get selected element (single-select only)
		const selectors = stylePanelStore.getSelectedSelectors()
		if (selectors.length !== 1) {
			console.warn("[StylePanel] Delete requires exactly one selected element")
			return
		}

		if (!editorRef?.current) {
			console.warn("[StylePanel] No editor ref")
			return
		}

		try {
			isDeleteInProgressRef.current = true
			console.log("[StylePanel] Deleting element:", selectors[0])
			await editorRef.current.deleteElement(selectors[0])
			console.log("[StylePanel] Element deleted successfully")
		} catch (error) {
			console.error("[StylePanel] Failed to delete element:", error)
		} finally {
			// Reset flag after operation completes
			setTimeout(() => {
				isDeleteInProgressRef.current = false
			}, 300)
		}
	}, [editorRef, stylePanelStore])

	/**
	 * Handle duplicate element
	 * Only works in single-select mode
	 */
	const handleDuplicate = useCallback(async () => {
		// Prevent duplicate duplicate operations
		if (isDuplicateInProgressRef.current) {
			console.log("[StylePanel] Duplicate already in progress, ignoring")
			return
		}

		// Get selected element (single-select only)
		const selectors = stylePanelStore.getSelectedSelectors()
		if (selectors.length !== 1) {
			console.warn("[StylePanel] Duplicate requires exactly one selected element")
			return
		}

		if (!editorRef?.current) {
			console.warn("[StylePanel] No editor ref")
			return
		}

		try {
			isDuplicateInProgressRef.current = true
			console.log("[StylePanel] Duplicating element:", selectors[0])
			await editorRef.current.duplicateElement(selectors[0])
			console.log("[StylePanel] Element duplicated successfully")
		} catch (error) {
			console.error("[StylePanel] Failed to duplicate element:", error)
		} finally {
			// Reset flag after operation completes
			setTimeout(() => {
				isDuplicateInProgressRef.current = false
			}, 300)
		}
	}, [editorRef, stylePanelStore])

	const handleReplaceImage = useCallback(async () => {
		if (isReplaceImageInProgressRef.current || !editorRef.current) return

		try {
			isReplaceImageInProgressRef.current = true
			await editorRef.current.runImageAction({ action: "replace-element-image" })
		} catch (error) {
			console.error("[StylePanel] Failed to replace image:", error)
		} finally {
			setTimeout(() => {
				isReplaceImageInProgressRef.current = false
			}, 300)
		}
	}, [editorRef])

	const handleInsert = useCallback(
		async (type: "text" | "image", placement: InsertPlacement) => {
			if (isInsertInProgressRef.current || !editorRef.current) return
			const selectors = stylePanelStore.getSelectedSelectors()
			if (selectors.length !== 1) return

			try {
				isInsertInProgressRef.current = true
				const tree = await editorRef.current.getDomTree()
				const selectedNode = tree?.root ? findNodeBySelector(tree.root, selectors[0]) : null
				if (!selectedNode) throw new Error("未找到当前选中的 DOM 节点")
				const context = tree?.root ? findNodeContext(tree.root, selectors[0]) : null
				let parentNodeId: string | undefined
				let index: number | undefined

				if (placement === "inside") {
					if (!selectedNode.canHaveChildren) throw new Error("当前元素不支持新增子元素")
					parentNodeId = selectedNode.nodeId
				} else {
					if (!context?.parent) throw new Error("当前元素没有可用的同级插入位置")
					parentNodeId = context.parent.nodeId
					index = context.index + (placement === "after" ? 1 : 0)
				}
				if (!parentNodeId) throw new Error("当前元素没有可用的插入位置")

				if (type === "text") {
					const semanticLabel = getDomTreeSemanticLabel(
						t,
						getSemanticKey(selectedNode.tagName),
					)
					setTextInput("")
					setTextInsertRequest({
						parentNodeId,
						index,
						targetLabel: getDomTreeNodeDisplayLabel(selectedNode, semanticLabel),
						placement,
					})
				} else {
					await editorRef.current.insertImageNode(parentNodeId, index)
				}
			} catch (error) {
				console.error("[StylePanel] Failed to insert DOM node:", error)
			} finally {
				isInsertInProgressRef.current = false
			}
		},
		[editorRef, stylePanelStore, t],
	)

	const closeTextInsertDialog = useCallback(() => {
		if (isTextInsertSubmitting) return
		setTextInsertRequest(null)
		setTextInput("")
	}, [isTextInsertSubmitting])

	const submitTextInsert = useCallback(async () => {
		const request = textInsertRequest
		const text = textInput.trim()
		if (!request || !text || isTextInsertSubmitting || !editorRef.current) return

		try {
			setIsTextInsertSubmitting(true)
			if (request.index === undefined) {
				await editorRef.current.insertTextNode(request.parentNodeId, text)
			} else {
				await editorRef.current.insertTextNode(request.parentNodeId, text, request.index)
			}
			setTextInsertRequest(null)
			setTextInput("")
		} catch (error) {
			console.error("[StylePanel] Failed to insert text node:", error)
		} finally {
			setIsTextInsertSubmitting(false)
		}
	}, [editorRef, isTextInsertSubmitting, textInput, textInsertRequest])

	const handleMove = useCallback(
		async (direction: -1 | 1) => {
			if (isMoveInProgressRef.current || !editorRef.current) return
			const selectors = stylePanelStore.getSelectedSelectors()
			if (selectors.length !== 1) return

			try {
				isMoveInProgressRef.current = true
				const tree = await editorRef.current.getDomTree()
				const context = tree?.root ? findNodeContext(tree.root, selectors[0]) : null
				if (!context?.parent || !context.node.canMove) return
				const targetIndex = direction < 0 ? context.index - 1 : context.index + 2
				if (targetIndex < 0 || targetIndex > context.parent.children.length) return
				await editorRef.current.moveDomNode(
					context.node.nodeId,
					context.parent.nodeId,
					targetIndex,
				)
				const nextTree = await editorRef.current.getDomTree()
				const nextContext = nextTree?.root
					? findNodeContextById(nextTree.root, context.node.nodeId)
					: null
				setCanAddInside(nextContext?.node.canHaveChildren === true)
				setCanAddSibling(Boolean(nextContext?.parent && nextContext.node.editable))
				setMoveState({
					canMoveUp: Boolean(nextContext?.node.canMove && nextContext.index > 0),
					canMoveDown: Boolean(
						nextContext?.node.canMove &&
						nextContext.parent &&
						nextContext.index >= 0 &&
						nextContext.index < nextContext.parent.children.length - 1,
					),
				})
			} catch (error) {
				console.error("[StylePanel] Failed to move DOM node:", error)
			} finally {
				isMoveInProgressRef.current = false
			}
		},
		[editorRef, stylePanelStore],
	)
	const [canAddInside, setCanAddInside] = useState(false)
	const [canAddSibling, setCanAddSibling] = useState(false)
	const renderItem = (children: ReactNode) => {
		if (!itemMotion) return children
		return itemMotion(children)
	}

	useEffect(() => {
		let cancelled = false
		const selectionChanged = previousSelectedSelectorRef.current !== selectedSelector
		previousSelectedSelectorRef.current = selectedSelector

		if (!selectedSelector || !editorRef.current) {
			setCanAddInside(false)
			setCanAddSibling(false)
			setMoveState({ canMoveUp: false, canMoveDown: false })
			return
		}

		// Keep the current action state while the DOM tree is refreshed after a
		// style update. Clearing it first makes the toolbar disappear briefly and
		// causes visible flicker during color changes. A new selection still resets
		// immediately because the previous node's capabilities are no longer valid.
		if (selectionChanged) {
			setCanAddInside(false)
			setCanAddSibling(false)
			setMoveState({ canMoveUp: false, canMoveDown: false })
		}

		void editorRef.current
			.getDomTree()
			.then((tree) => {
				if (cancelled || !tree?.root) return
				const context = findNodeContext(tree.root, selectedSelector)
				setCanAddInside(context?.node.canHaveChildren === true)
				setCanAddSibling(Boolean(context?.parent && context.node.editable))
				setMoveState({
					canMoveUp: Boolean(context?.node.canMove && context.index > 0),
					canMoveDown: Boolean(
						context?.node.canMove &&
						context.parent &&
						context.index >= 0 &&
						context.index < context.parent.children.length - 1,
					),
				})
			})
			.catch((error) => {
				if (!cancelled) {
					console.error("[StylePanel] Failed to read selected DOM node:", error)
				}
			})

		return () => {
			cancelled = true
		}
	}, [editorRef, historyIndex, selectedSelector])

	return (
		<>
			<div
				className="contents [&_button[data-slot=button][data-size=icon]]:w-7 [&_button]:h-7"
				data-testid="html-style-panel-element-actions"
			>
				{canAddInside || canAddSibling ? (
					<>
						{renderItem(
							<AddElementMenu
								type="text"
								icon={<Type className="h-4 w-4" />}
								label={t("stylePanel.domTree.addText")}
								testId="html-style-panel-add-element-button"
								disabled={disabled || !hasSingleSelection}
								canInsertInside={canAddInside}
								canInsertSibling={canAddSibling}
								onInsert={(type, placement) => void handleInsert(type, placement)}
							/>,
						)}
						{renderItem(
							<AddElementMenu
								type="image"
								icon={<ImagePlus className="h-4 w-4" />}
								label={t("stylePanel.domTree.addImage")}
								testId="html-style-panel-add-image-element-button"
								disabled={disabled || !hasSingleSelection}
								canInsertInside={canAddInside}
								canInsertSibling={canAddSibling}
								onInsert={(type, placement) => void handleInsert(type, placement)}
							/>,
						)}
					</>
				) : null}

				{isOutOfDocumentFlow ? null : (
					<>
						{renderItem(
							<AddElementButton
								icon={<ArrowUp className="h-4 w-4" />}
								label={t("stylePanel.domTree.moveUp")}
								tooltip={t("stylePanel.domTree.moveUp")}
								testId="html-style-panel-move-up-button"
								disabled={disabled || !hasSingleSelection || !moveState.canMoveUp}
								onClick={() => void handleMove(-1)}
							/>,
						)}
						{renderItem(
							<AddElementButton
								icon={<ArrowDown className="h-4 w-4" />}
								label={t("stylePanel.domTree.moveDown")}
								tooltip={t("stylePanel.domTree.moveDown")}
								testId="html-style-panel-move-down-button"
								disabled={disabled || !hasSingleSelection || !moveState.canMoveDown}
								onClick={() => void handleMove(1)}
							/>,
						)}
					</>
				)}

				{isSingleImageSelected
					? renderItem(
							<MagicTooltip
								title={t("stylePanel.replaceImage")}
								contentZIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}
							>
								<span>
									<Button
										variant="ghost"
										size="sm"
										disabled={disabled}
										onClick={() => void handleReplaceImage()}
										className={`h-7 px-2 ${STYLE_PANEL_STYLES.toolbarButton}`}
										data-testid="html-style-panel-replace-image-button"
									>
										<ImageUp className="h-4 w-4" />
									</Button>
								</span>
							</MagicTooltip>,
						)
					: null}

				{/* Duplicate button */}
				{renderItem(
					<MagicTooltip
						title={t("stylePanel.duplicateElement")}
						contentZIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}
					>
						<span>
							<Button
								variant="ghost"
								size="sm"
								disabled={disabled || !hasSingleSelection}
								onClick={handleDuplicate}
								className={`h-7 px-2 ${STYLE_PANEL_STYLES.toolbarButton}`}
								data-testid="html-style-panel-duplicate-button"
							>
								<Copy className="h-4 w-4" />
							</Button>
						</span>
					</MagicTooltip>,
				)}

				{/* Delete button */}
				{renderItem(
					<MagicTooltip
						title={t("stylePanel.deleteElement")}
						contentZIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}
					>
						<span>
							<Button
								variant="ghost"
								size="sm"
								disabled={disabled || !hasSingleSelection}
								onClick={handleDelete}
								className={`h-7 px-2 ${STYLE_PANEL_STYLES.toolbarButton} hover:bg-destructive/10 hover:text-destructive hover:shadow-sm`}
								data-testid="html-style-panel-delete-button"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</span>
					</MagicTooltip>,
				)}
			</div>
			<Dialog
				open={textInsertRequest !== null}
				onOpenChange={(open) => {
					if (!open) closeTextInsertDialog()
				}}
			>
				<DialogContent
					className="max-w-md gap-5 rounded-xl border-border/80 p-5 shadow-2xl"
					data-testid="html-style-panel-add-text-dialog"
				>
					<DialogHeader className="gap-1.5 text-left">
						<DialogTitle>{t("stylePanel.domTree.addTextDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("stylePanel.domTree.addTextDialog.description", {
								node: textInsertRequest?.targetLabel ?? "",
								placement: textInsertRequest
									? getTextInsertPlacementLabel(t, textInsertRequest.placement)
									: "",
							})}
						</DialogDescription>
					</DialogHeader>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault()
							void submitTextInsert()
						}}
					>
						<Input
							data-testid="html-style-panel-add-text-input"
							autoFocus
							value={textInput}
							onChange={(event) => setTextInput(event.target.value)}
							placeholder={t("stylePanel.domTree.addTextDialog.placeholder")}
							maxLength={500}
							aria-label={t("stylePanel.domTree.addTextDialog.inputLabel")}
						/>
						<DialogFooter>
							<Button
								data-testid="html-style-panel-add-text-cancel-button"
								type="button"
								variant="outline"
								disabled={isTextInsertSubmitting}
								onClick={closeTextInsertDialog}
							>
								{t("stylePanel.domTree.addTextDialog.cancel")}
							</Button>
							<Button
								data-testid="html-style-panel-add-text-confirm-button"
								type="submit"
								disabled={!textInput.trim() || isTextInsertSubmitting}
							>
								{t("stylePanel.domTree.addTextDialog.confirm")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
})
