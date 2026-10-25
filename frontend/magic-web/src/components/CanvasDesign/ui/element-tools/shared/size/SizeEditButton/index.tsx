import { useCallback, useLayoutEffect, useMemo, useState } from "react"
import IconButton from "../../../../primitives/custom/IconButton/index"
import { Popover, PopoverContent, PopoverTrigger } from "../../../../primitives/shadcn/popover"
import { Button } from "../../../../primitives/shadcn/button"
import { Scaling } from "lucide-react"
import styles from "./index.module.css"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import SizeSelect from "../SizeSelect/index"
import Size from "../Size/index"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

export default function SizeEditButton() {
	const { t } = useCanvasDesignI18n()
	const [open, setOpen] = useState(false)
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const tool = useElementToolResolution()

	const selectedElement = selectedElements[0] ?? null

	const [draftWidth, setDraftWidth] = useState(0)
	const [draftHeight, setDraftHeight] = useState(0)
	const [draftLocked, setDraftLocked] = useState(false)
	/** 打开弹层时的快照，用于判断是否与画布元素一致 */
	const [openBaseline, setOpenBaseline] = useState<{
		width: number
		height: number
		aspectRatioLocked: boolean
	} | null>(null)

	useLayoutEffect(() => {
		if (!open) {
			setOpenBaseline(null)
			return
		}
		if (!selectedElement) {
			setOpenBaseline(null)
			return
		}

		const width = Math.round(selectedElement.width || 0)
		const height = Math.round(selectedElement.height || 0)
		const aspectRatioLocked = selectedElement.interactionConfig?.aspectRatioLocked ?? false

		setOpenBaseline({ width, height, aspectRatioLocked })
		setDraftWidth(width)
		setDraftHeight(height)
		setDraftLocked(aspectRatioLocked)
	}, [open, selectedElement])

	const hasDraftChanges = useMemo(() => {
		if (!openBaseline) return false
		return (
			draftWidth !== openBaseline.width ||
			draftHeight !== openBaseline.height ||
			draftLocked !== openBaseline.aspectRatioLocked
		)
	}, [openBaseline, draftWidth, draftHeight, draftLocked])

	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next)
	}, [])

	const handleCancel = useCallback(() => {
		setOpen(false)
	}, [])

	const handleConfirm = useCallback(() => {
		if (!selectedElement || !canvas || !hasDraftChanges) {
			setOpen(false)
			return
		}
		if (tool) {
			void tool.execute({
				width: draftWidth,
				height: draftHeight,
				aspectRatioLocked: draftLocked,
			})
		} else {
			canvas.elementManager.update(selectedElement.id, {
				width: draftWidth,
				height: draftHeight,
				interactionConfig: {
					...selectedElement.interactionConfig,
					aspectRatioLocked: draftLocked,
				},
			})
		}
		setOpen(false)
	}, [selectedElement, canvas, draftWidth, draftHeight, draftLocked, hasDraftChanges, tool])

	const handleDraftPreset = useCallback((width: number, height: number) => {
		setDraftWidth(width)
		setDraftHeight(height)
	}, [])

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger className={styles.sizeEditTrigger}>
				<div>
					<IconButton className={styles.sizeEditButton}>
						<Scaling size={16} />
						<span className={styles.buttonText}>
							{t("elementTools.sizeEdit.title", "编辑尺寸")}
						</span>
					</IconButton>
				</div>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="start"
				sideOffset={8}
				className="w-[230px] p-3"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<div className={styles.popoverInner}>
					<SizeSelect
						fullWidth
						draftWidth={draftWidth}
						draftHeight={draftHeight}
						onDraftPreset={handleDraftPreset}
					/>
					<Size
						fullWidth
						controlled={{
							width: draftWidth,
							height: draftHeight,
							aspectRatioLocked: draftLocked,
							onWidthChange: setDraftWidth,
							onHeightChange: setDraftHeight,
							onToggleLock: () => setDraftLocked((v) => !v),
						}}
					/>
					<div className={styles.actions}>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className={styles.actionButton}
							onClick={handleCancel}
						>
							{t("common.cancel", "取消")}
						</Button>
						<Button
							type="button"
							size="sm"
							className={styles.actionButton}
							disabled={!hasDraftChanges}
							onClick={handleConfirm}
						>
							{t("common.ok", "确定")}
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
