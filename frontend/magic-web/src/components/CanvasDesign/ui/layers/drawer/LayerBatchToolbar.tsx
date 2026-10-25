import { ChevronDown } from "lucide-react"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useElementMenu } from "../../panels/menu/ElementMenuContext"
import { Button } from "../../primitives/shadcn/button"
import styles from "./index.module.css"

export interface LayerBatchToolbarProps {
	selectedIds: string[]
}

/**
 * Attachment-list style batch entry: one button opens the shared element menu
 * (same items as multi-select right-click on canvas/layers).
 * Only mounts when there is a selection (no disabled empty state).
 */
export default function LayerBatchToolbar({ selectedIds }: LayerBatchToolbarProps) {
	const { t } = useCanvasDesignI18n()
	const { openMenuAt } = useElementMenu()

	if (selectedIds.length === 0) return null

	const handleOpenBatchMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
		const rect = event.currentTarget.getBoundingClientRect()
		// Anchor near the button top so the context menu appears above the footer.
		openMenuAt(selectedIds[0], rect.left + rect.width / 2, rect.top, "layers")
	}

	return (
		<div className={styles.layersBatchToolbar}>
			<Button
				type="button"
				variant="default"
				className={styles.layersBatchOperationsButton}
				data-testid="layers-batch-operations-button"
				onClick={handleOpenBatchMenu}
			>
				<span>{t("layers.batch.title", "批量操作")}</span>
				<ChevronDown size={16} strokeWidth={1.5} />
			</Button>
		</div>
	)
}
