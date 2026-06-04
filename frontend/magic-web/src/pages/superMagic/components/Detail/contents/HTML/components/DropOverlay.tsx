/**
 * DropOverlay
 * A transparent overlay rendered on top of the iframe when a user is dragging
 * an image over the editor. It captures drag events (since the iframe blocks them)
 * and shows a subtle visual indicator that the drop zone is active.
 *
 * Rendered when a global drag is detected. Always has pointer-events: auto to
 * intercept drag events over the iframe area. Shows visual feedback (border/tint)
 * when the cursor is directly over this component.
 */

import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css }) => ({
	overlay: css`
		position: absolute;
		inset: 0;
		z-index: 100;
		pointer-events: auto;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;
	`,
	inactive: css`
		background-color: transparent;
		border: 2px dashed transparent;
	`,
	active: css`
		background-color: rgba(22, 119, 255, 0.04);
		border: 2px dashed rgba(22, 119, 255, 0.3);
		border-radius: 4px;
	`,
	hint: css`
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: rgba(22, 119, 255, 0.7);
		font-size: 14px;
		font-weight: 500;
		pointer-events: none;
		user-select: none;
	`,
}))

interface DropOverlayProps {
	visible: boolean
	onDragEnter: (e: React.DragEvent) => void
	onDragOver: (e: React.DragEvent) => void
	onDragLeave: (e: React.DragEvent) => void
	onDrop: (e: React.DragEvent) => void
}

export function DropOverlay({
	visible,
	onDragEnter,
	onDragOver,
	onDragLeave,
	onDrop,
}: DropOverlayProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	return (
		<div
			className={cx(styles.overlay, visible ? styles.active : styles.inactive)}
			onDragEnter={onDragEnter}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{visible && <span className={styles.hint}>{t("htmlEditor.dropOverlay.hint")}</span>}
		</div>
	)
}
