import { memo, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { DownloadIcon } from "lucide-react"
import SlideSelectionDialog from "./SlideSelectionDialog"
import type { SlideItem } from "../PPTRender/PPTSidebar/types"
import ActionButton from "../CommonHeader/components/ActionButton"
import type { BeforeAction } from "../../utils/actionGuard"
import { runGuardedAction } from "../../utils/actionGuard"

interface ExportDropdownProps {
	showText?: boolean
	disabled?: boolean
	isExporting?: boolean
	supportPptx?: boolean
	supportSpecificPages?: boolean
	slides?: SlideItem[]
	hiddenSlides?: unknown
	onExportPptx?: () => void
	onExportSpecificPages?: (
		filePaths: string[],
		format: "source" | "pdf" | "pptx" | "image_png" | "image_jpeg",
		includeHiddenSlides?: boolean,
	) => void
	onGenerateScreenshot?: (index: number) => Promise<void>
	beforeAction?: BeforeAction
}

function ExportDropdown({
	showText = true,
	disabled = false,
	isExporting = false,
	supportPptx = true,
	supportSpecificPages = false,
	slides = [],
	hiddenSlides,
	onExportPptx,
	onExportSpecificPages,
	onGenerateScreenshot,
	beforeAction,
}: ExportDropdownProps) {
	const { t } = useTranslation("super")
	const [slideDialogOpen, setSlideDialogOpen] = useState(false)
	const isDisabled = disabled || isExporting

	const handlePrimaryClick = useCallback(() => {
		if (isDisabled) return
		void runGuardedAction(beforeAction, () => {
			if (supportSpecificPages && onExportSpecificPages) {
				setSlideDialogOpen(true)
				return
			}
			onExportPptx?.()
		})
	}, [beforeAction, isDisabled, onExportPptx, onExportSpecificPages, supportSpecificPages])

	function handleConfirmExport(
		filePaths: string[],
		format: "source" | "pdf" | "pptx" | "image_png" | "image_jpeg",
		includeHiddenSlides?: boolean,
	) {
		onExportSpecificPages?.(filePaths, format, includeHiddenSlides)
		setSlideDialogOpen(false)
	}

	return (
		<>
			{supportSpecificPages && onExportSpecificPages && (
				<SlideSelectionDialog
					open={slideDialogOpen}
					onOpenChange={setSlideDialogOpen}
					slides={slides}
					hiddenSlides={hiddenSlides}
					onConfirm={handleConfirmExport}
					isExporting={isExporting}
					onGenerateScreenshot={onGenerateScreenshot}
					supportPptx={supportPptx}
				/>
			)}
			<div className="inline-flex items-center" data-testid="export-dropdown-trigger">
				<span onClick={handlePrimaryClick} data-testid="export-dropdown-primary">
					<ActionButton
						icon={<DownloadIcon className="h-4 w-4" />}
						title={t("ppt.download")}
						text={t("ppt.download")}
						showText={showText}
						disabled={isDisabled}
					/>
				</span>
			</div>
		</>
	)
}

export default memo(ExportDropdown)
