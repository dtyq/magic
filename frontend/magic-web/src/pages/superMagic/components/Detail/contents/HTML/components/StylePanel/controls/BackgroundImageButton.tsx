import { observer } from "mobx-react-lite"
import { useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { MagicTooltip } from "@/components/base"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { ContextToolbarItemMotion, SelectedElementInfo } from "../types"
import { STYLE_PANEL_STYLES } from "../styles"

function BackgroundImageIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			className={className}
			aria-hidden="true"
			focusable="false"
			data-testid="html-style-panel-background-image-icon"
		>
			<path
				d="M7 5h9a2 2 0 0 1 2 2"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
				opacity="0.4"
			/>
			<rect
				x="4.5"
				y="6.5"
				width="15"
				height="13"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<circle cx="14.5" cy="10.8" r="1.15" fill="currentColor" opacity="0.7" />
			<path
				d="m6.5 17 3.3-3.4 2.7 2.6 2-2 3 2.8"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

interface BackgroundImageButtonProps {
	selectedElement: SelectedElementInfo | null
	editorRef: React.RefObject<HTMLEditorV2Ref>
	disabled?: boolean
	itemMotion?: ContextToolbarItemMotion
}

/** Quick access to set or replace a selected container's background image. */
export const BackgroundImageButton = observer(function BackgroundImageButton({
	selectedElement,
	editorRef,
	disabled = false,
	itemMotion,
}: BackgroundImageButtonProps) {
	const { t } = useTranslation("super")
	const isImageElement =
		selectedElement?.isImageElement === true ||
		selectedElement?.tagName?.toLowerCase() === "img"
	const hasBackgroundImage = Boolean(
		selectedElement &&
		!isImageElement &&
		/\burl\(/i.test(selectedElement.computedStyles.backgroundImage || ""),
	)
	const isImageActionInProgressRef = useRef(false)

	const handleSetBackgroundImage = useCallback(async () => {
		if (isImageActionInProgressRef.current || !editorRef.current || !selectedElement) return

		try {
			isImageActionInProgressRef.current = true
			await editorRef.current.runImageAction({ action: "set-element-background-image" })
		} catch (error) {
			console.error("[StylePanel] Failed to set background image:", error)
		} finally {
			setTimeout(() => {
				isImageActionInProgressRef.current = false
			}, 300)
		}
	}, [editorRef, selectedElement])

	if (!selectedElement || isImageElement) return null

	const label = t(
		hasBackgroundImage
			? "stylePanel.replaceBackgroundImage"
			: "stylePanel.uploadBackgroundImage",
	)
	const button = (
		<MagicTooltip title={label} contentZIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}>
			<span>
				<Button
					variant="ghost"
					size="sm"
					disabled={disabled}
					onClick={() => void handleSetBackgroundImage()}
					className={`h-7 px-2 ${STYLE_PANEL_STYLES.toolbarButton}`}
					data-testid="html-style-panel-background-image-button"
					aria-label={label}
				>
					<BackgroundImageIcon className="h-[18px] w-[18px]" />
				</Button>
			</span>
		</MagicTooltip>
	)

	return itemMotion ? itemMotion(button) : button
})
