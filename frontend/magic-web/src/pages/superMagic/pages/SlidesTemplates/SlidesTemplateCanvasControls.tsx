import { ChevronLeft, ChevronRight, ChevronUp, Minus, RotateCcw, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { TemplateCanvasDirection } from "./canvasLayout"
import { SLIDES_TEMPLATE_CANVAS_DEFAULT_SCALE } from "./canvasZoom"

interface SlidesTemplateCanvasControlsProps {
	canZoomIn: boolean
	canZoomOut: boolean
	onMove: (direction: TemplateCanvasDirection) => void
	onReset: () => void
	onZoomIn: () => void
	onZoomOut: () => void
	scale: number
}

const EDGE_BUTTON_CLASS_NAME =
	"size-10 rounded-full border border-white/15 bg-zinc-950/75 text-white opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-[opacity,background-color,border-color,transform] duration-150 hover:scale-105 hover:border-white/[0.28] hover:bg-zinc-950/[0.92] group-hover:opacity-100 focus-visible:opacity-100"

export default function SlidesTemplateCanvasControls({
	canZoomIn,
	canZoomOut,
	onMove,
	onReset,
	onZoomIn,
	onZoomOut,
	scale,
}: SlidesTemplateCanvasControlsProps) {
	const { t } = useTranslation("crew/create")
	const scaleLabel = `${Math.round(scale * 100)}%`

	return (
		<>
			<div className="group absolute left-0 top-1/2 z-20 flex h-36 w-16 -translate-y-1/2 items-center justify-center">
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className={EDGE_BUTTON_CLASS_NAME}
					aria-label={t("playbook.edit.presets.form.moveCanvasLeft")}
					onClick={() => onMove("left")}
					data-testid="slides-template-canvas-move-left"
				>
					<ChevronLeft className="size-5" />
				</Button>
			</div>
			<div className="group absolute right-0 top-1/2 z-20 flex h-36 w-16 -translate-y-1/2 items-center justify-center">
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className={EDGE_BUTTON_CLASS_NAME}
					aria-label={t("playbook.edit.presets.form.moveCanvasRight")}
					onClick={() => onMove("right")}
					data-testid="slides-template-canvas-move-right"
				>
					<ChevronRight className="size-5" />
				</Button>
			</div>
			<div className="group absolute left-1/2 top-0 z-20 flex h-16 w-36 -translate-x-1/2 items-center justify-center">
				<Button
					type="button"
					size="icon"
					variant="ghost"
					className={EDGE_BUTTON_CLASS_NAME}
					aria-label={t("playbook.edit.presets.form.moveCanvasUp")}
					onClick={() => onMove("up")}
					data-testid="slides-template-canvas-move-up"
				>
					<ChevronUp className="size-5" />
				</Button>
			</div>
			<div
				className="absolute bottom-6 right-6 z-20 flex items-center rounded-xl border border-white/10 bg-zinc-950/70 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl"
				data-slides-template-drag-block="true"
				data-testid="slides-template-canvas-zoom-controls"
			>
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					className="rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
					aria-label={t("playbook.edit.presets.form.zoomOutCanvas")}
					disabled={!canZoomOut}
					onClick={onZoomOut}
					data-testid="slides-template-canvas-zoom-out"
				>
					<Minus className="size-4" />
				</Button>
				<button
					type="button"
					className="min-w-14 rounded-lg px-2 py-1 text-xs font-medium tabular-nums text-white/85 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/50"
					aria-label={t("playbook.edit.presets.form.resetCanvasView")}
					onClick={onReset}
					data-testid="slides-template-canvas-scale"
				>
					{scaleLabel}
				</button>
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					className="rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
					aria-label={t("playbook.edit.presets.form.zoomInCanvas")}
					disabled={!canZoomIn}
					onClick={onZoomIn}
					data-testid="slides-template-canvas-zoom-in"
				>
					<Plus className="size-4" />
				</Button>
				<div className="mx-1 h-5 w-px bg-white/10" />
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					className={cn(
						"rounded-lg text-white/75 hover:bg-white/10 hover:text-white",
						scale === SLIDES_TEMPLATE_CANVAS_DEFAULT_SCALE && "text-white/45",
					)}
					aria-label={t("playbook.edit.presets.form.resetCanvasView")}
					onClick={onReset}
					data-testid="slides-template-canvas-reset"
				>
					<RotateCcw className="size-4" />
				</Button>
			</div>
		</>
	)
}
