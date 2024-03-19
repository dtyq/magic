import { IconAlignLeft, IconAlignCenter, IconAlignRight } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

/**
 * Alignment options for images
 */
type AlignType = "left" | "center" | "right" | null

/**
 * Props for AlignmentToolbar component
 */
interface AlignmentToolbarProps {
	/** Current alignment value */
	align: AlignType
	/** Callback when alignment changes */
	onAlignChange: (align: "left" | "center" | "right") => void
	/** Whether the toolbar should be visible */
	visible?: boolean
}

/**
 * AlignmentToolbar component for setting image alignment
 * Displays three buttons: left, center, right alignment
 */
export function AlignmentToolbar({
	align: alignProp = "left",
	onAlignChange,
	visible = true,
}: AlignmentToolbarProps) {
	const { t } = useTranslation("tiptap")

	const align = alignProp || "left"

	if (!visible) return null

	return (
		<>
			<button
				type="button"
				className={`project-image-node__alignment-button ${
					align === "left" ? "project-image-node__alignment-button--active" : ""
				}`}
				onClick={() => onAlignChange("left")}
				aria-label={t("projectImage.alignment.left")}
				title={t("projectImage.alignment.left")}
			>
				<IconAlignLeft size={16} />
			</button>
			<button
				type="button"
				className={`project-image-node__alignment-button ${
					align === "center" ? "project-image-node__alignment-button--active" : ""
				}`}
				onClick={() => onAlignChange("center")}
				aria-label={t("projectImage.alignment.center")}
				title={t("projectImage.alignment.center")}
			>
				<IconAlignCenter size={16} />
			</button>
			<button
				type="button"
				className={`project-image-node__alignment-button ${
					align === "right" ? "project-image-node__alignment-button--active" : ""
				}`}
				onClick={() => onAlignChange("right")}
				aria-label={t("projectImage.alignment.right")}
				title={t("projectImage.alignment.right")}
			>
				<IconAlignRight size={16} />
			</button>
		</>
	)
}
