import { useCallback, useRef } from "react"
import { Trash2, Copy } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { MagicTooltip } from "@/opensource/components/base"
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

	return (
		<>
			{/* Duplicate button */}
			<MagicTooltip title={t("stylePanel.duplicateElement")}>
				<span>
					<Button
						variant="ghost"
						size="sm"
						disabled={disabled}
						onClick={handleDuplicate}
						className="h-7 px-2"
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
						disabled={disabled}
						onClick={handleDelete}
						className="h-7 px-2 hover:bg-destructive/10 hover:text-destructive"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</span>
			</MagicTooltip>
		</>
	)
}
