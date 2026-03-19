import { useCallback, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Undo2, Redo2 } from "lucide-react"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"

interface HistoryActionsProps {
	editorRef: React.RefObject<HTMLEditorV2Ref>
}

/**
 * History actions component for undo/redo operations
 * Uses MobX observer to automatically react to history state changes
 */
export const HistoryActions = observer(function HistoryActions({ editorRef }: HistoryActionsProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()

	// Get history state from store (automatically reactive with observer)
	const { canUndo, canRedo } = stylePanelStore.historyState

	const handleUndo = useCallback(async () => {
		if (editorRef.current) {
			try {
				await editorRef.current.undo()
			} catch (error) {
				console.error("Undo failed:", error)
			}
		}
	}, [editorRef])

	const handleRedo = useCallback(async () => {
		if (editorRef.current) {
			try {
				await editorRef.current.redo()
			} catch (error) {
				console.error("Redo failed:", error)
			}
		}
	}, [editorRef])

	// Keyboard shortcuts for undo/redo
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			// Ignore if user is typing in an input/textarea/contenteditable
			if (
				event.target instanceof HTMLInputElement ||
				event.target instanceof HTMLTextAreaElement ||
				(event.target instanceof HTMLElement && event.target.isContentEditable)
			) {
				return
			}

			const isMac = navigator.platform.toUpperCase().includes("MAC")
			const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

			// Cmd/Ctrl + Z for undo
			if (ctrlOrCmd && event.key === "z" && !event.shiftKey && canUndo) {
				event.preventDefault()
				handleUndo()
				return
			}

			// Cmd/Ctrl + Shift + Z for redo
			// Also support Cmd/Ctrl + Y for redo on Windows/Linux
			if (
				canRedo &&
				((ctrlOrCmd && event.key === "z" && event.shiftKey) ||
					(ctrlOrCmd && event.key === "y" && !isMac))
			) {
				event.preventDefault()
				handleRedo()
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleUndo, handleRedo, canUndo, canRedo])

	return (
		<div className="flex items-center gap-0.5">
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={handleUndo}
							disabled={!canUndo}
						>
							<Undo2 className="h-4 w-4" />
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.undo")}</TooltipContent>
			</TooltipPrimitive.Root>
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={handleRedo}
							disabled={!canRedo}
						>
							<Redo2 className="h-4 w-4" />
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{t("stylePanel.redo")}</TooltipContent>
			</TooltipPrimitive.Root>
		</div>
	)
})
