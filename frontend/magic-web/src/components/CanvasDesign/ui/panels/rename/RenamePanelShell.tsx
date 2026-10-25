import type { KeyboardEventHandler, ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import useCanvasSelectionFloatingPanel from "../../../app/hooks/layout/useCanvasSelectionFloatingPanel"
import styles from "./index.module.css"

interface RenamePanelShellProps {
	elementId: string
	onClose: () => void
	isCloseBlocked?: boolean
	children: ReactNode
	footer?: ReactNode
	onKeyDown?: KeyboardEventHandler<HTMLDivElement>
}

/**
 * Rename panels share the same Canvas anchored surface. Keeping the lifecycle
 * and positioning here prevents each media variant from drifting away from
 * the history panel's close and pan forwarding behavior.
 */
export default function RenamePanelShell({
	elementId,
	onClose,
	isCloseBlocked = false,
	children,
	footer,
	onKeyDown,
}: RenamePanelShellProps) {
	const { t } = useCanvasDesignI18n()
	const { setRefs } = useCanvasSelectionFloatingPanel({
		id: "element-rename-overlay",
		elementId,
		onClose,
		closeOnSelectionChange: true,
		isCloseBlocked,
	})

	return (
		<div
			ref={setRefs}
			className={styles.renamePanel}
			data-canvas-ui-component
			role="dialog"
			aria-label={t("rename.title", "重命名")}
			onKeyDown={onKeyDown}
		>
			<div className={styles.renameHeader}>
				<h2 className={styles.renameTitle}>{t("rename.title", "重命名")}</h2>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className={styles.renameCloseButton}
					disabled={isCloseBlocked}
					aria-label={t("rename.close", "关闭")}
					onClick={onClose}
				>
					<X size={16} />
				</Button>
			</div>
			<div className={styles.renameDivider} />
			{children}
			{footer}
		</div>
	)
}
