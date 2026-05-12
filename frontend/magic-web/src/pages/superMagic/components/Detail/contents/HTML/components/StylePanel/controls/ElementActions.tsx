import { useCallback, useRef } from "react"
import { Trash2, Copy, ImageUp, Plus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { MagicTooltip } from "@/components/base"
import { useTranslation } from "react-i18next"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"

interface ElementActionsProps {
	editorRef: React.RefObject<HTMLEditorV2Ref>
	disabled?: boolean
}

/**
 * Element action buttons (delete, duplicate)
 * Displayed in the style panel toolbar
 */
export function ElementActions({ editorRef, disabled = false }: ElementActionsProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()

	// Refs to prevent duplicate operations
	const isDeleteInProgressRef = useRef(false)
	const isDuplicateInProgressRef = useRef(false)
	const isReplaceImageInProgressRef = useRef(false)
	const isInsertImageInProgressRef = useRef(false)

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
		if (isReplaceImageInProgressRef.current) {
			console.log("[StylePanel] Replace image already in progress, ignoring")
			return
		}

		if (!editorRef?.current) {
			console.warn("[StylePanel] No editor ref")
			return
		}

		try {
			isReplaceImageInProgressRef.current = true
			await editorRef.current.runImageAction({
				action: "replace-element-image",
			})
		} catch (error) {
			console.error("[StylePanel] Failed to replace image:", error)
		} finally {
			setTimeout(() => {
				isReplaceImageInProgressRef.current = false
			}, 300)
		}
	}, [editorRef])

	const handleInsertImage = useCallback(async () => {
		if (isInsertImageInProgressRef.current) {
			console.log("[StylePanel] Insert image already in progress, ignoring")
			return
		}

		if (!editorRef?.current) {
			console.warn("[StylePanel] No editor ref")
			return
		}

		try {
			isInsertImageInProgressRef.current = true
			await editorRef.current.runImageAction({
				action: "insert-floating-image",
			})
		} catch (error) {
			console.error("[StylePanel] Failed to insert image:", error)
		} finally {
			setTimeout(() => {
				isInsertImageInProgressRef.current = false
			}, 300)
		}
	}, [editorRef])

	const selectors = stylePanelStore.getSelectedSelectors()
	const hasSingleSelection = selectors.length === 1
	const isSingleImageSelected =
		hasSingleSelection && stylePanelStore.selectedElement?.tagName?.toLowerCase() === "img"

	return (
		<div className="contents" data-testid="html-style-panel-element-actions">
			<MagicTooltip title={t("stylePanel.insertImage")}>
				<span>
					<Button
						variant="ghost"
						size="sm"
						disabled={disabled}
						onClick={handleInsertImage}
						className="h-7 px-2"
						data-testid="html-style-panel-insert-image-button"
					>
						<Plus className="h-4 w-4" />
					</Button>
				</span>
			</MagicTooltip>

			<MagicTooltip title={t("stylePanel.replaceImage")}>
				<span>
					<Button
						variant="ghost"
						size="sm"
						disabled={disabled || !isSingleImageSelected}
						onClick={handleReplaceImage}
						className="h-7 px-2"
						data-testid="html-style-panel-replace-image-button"
					>
						<ImageUp className="h-4 w-4" />
					</Button>
				</span>
			</MagicTooltip>

			{/* Duplicate button */}
			<MagicTooltip title={t("stylePanel.duplicateElement")}>
				<span>
					<Button
						variant="ghost"
						size="sm"
						disabled={disabled || !hasSingleSelection}
						onClick={handleDuplicate}
						className="h-7 px-2"
						data-testid="html-style-panel-duplicate-button"
					>
						<Copy className="h-4 w-4" />
					</Button>
				</span>
			</MagicTooltip>

			{/* Delete button */}
			<MagicTooltip title={t("stylePanel.deleteElement")}>
				<span>
					<Button
						variant="ghost"
						size="sm"
						disabled={disabled || !hasSingleSelection}
						onClick={handleDelete}
						className="h-7 px-2 hover:bg-destructive/10 hover:text-destructive"
						data-testid="html-style-panel-delete-button"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</span>
			</MagicTooltip>
		</div>
	)
}
