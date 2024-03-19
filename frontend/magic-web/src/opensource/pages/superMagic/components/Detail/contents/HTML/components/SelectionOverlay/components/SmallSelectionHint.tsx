import { useState, useEffect } from "react"
import { Info } from "lucide-react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import type { ElementRect } from "../types"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"

interface SmallSelectionHintProps {
	show: boolean
	rect: ElementRect
}

/**
 * Hint displayed when selection box is too small
 * Guides users to use style panel or zoom controls
 * Has a small delay to avoid showing immediately on selection
 */
export function SmallSelectionHint({ show, rect }: SmallSelectionHintProps) {
	const { t } = useTranslation("super")
	const [delayedShow, setDelayedShow] = useState(false)

	// Delay showing hint by 800ms to avoid flashing on quick selections
	useEffect(() => {
		if (show) {
			const timer = setTimeout(() => {
				setDelayedShow(true)
			}, 800)
			return () => {
				clearTimeout(timer)
				setDelayedShow(false)
			}
		}
		setDelayedShow(false)
		return undefined
	}, [show])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			setDelayedShow(false)
		}
	}, [])

	if (!delayedShow) return null

	// Calculate hint position (above the rotate handle)
	// Rotate handle is at rect.top - 32px, add spacing to show above it
	const hintTop = Math.max(10, rect.top - 78)
	const hintLeft = rect.left + rect.width / 2 - rect.width / 2

	return (
		<motion.div
			initial={{ opacity: 0, y: -4, scale: 0.95 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -4, scale: 0.95 }}
			transition={{ duration: 0.15, ease: "easeOut" }}
			className="pointer-events-none fixed flex items-start gap-1.5 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg"
			style={{
				top: `${hintTop}px`,
				left: `${hintLeft}px`,
				transform: "translateX(-50%)",
				zIndex: HTML_EDITOR_Z_INDEX.OVERLAY.SELECTION_HIGHLIGHT + 10,
				maxWidth: "240px",
				minWidth: "180px",
			}}
		>
			<Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
			<div className="leading-tight">{t("stylePanel.smallSelectionHint")}</div>
		</motion.div>
	)
}
