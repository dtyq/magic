import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Download } from "lucide-react"
import ProgressIndicator from "@/components/base/MagicProgressToast/ProgressIndicator"
import { cn } from "@/utils/cn"
import { DraggableCore } from "react-draggable"
import { useDownloadToastDrag } from "../hooks/useDownloadToastDrag"
import SmartTooltip from "@/components/other/SmartTooltip"

interface DownloadProgressToastProps {
	progress?: number
	text?: string
	description?: string
	cancelText?: string
	onCancel?: () => void
	showPercentage?: boolean
}

function DownloadProgressToast({
	progress = 0,
	text,
	description,
	cancelText,
	onCancel,
	showPercentage = true,
}: DownloadProgressToastProps) {
	const { t } = useTranslation("super")
	const { anchorRef, nodeRef, position, dragging, onStart, onDrag, onStop } =
		useDownloadToastDrag()
	const resolvedText = text ?? t("topicFiles.downloading")
	const resolvedCancelText = cancelText ?? t("common.cancel")
	const normalizedProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0

	return (
		<div
			ref={anchorRef}
			className="pointer-events-none w-max min-w-[min(360px,calc(100vw-24px))] max-w-[min(440px,calc(100vw-24px))]"
		>
			<DraggableCore
				nodeRef={nodeRef}
				cancel="button, a, input, textarea, select, [role='button']"
				onStart={onStart}
				onDrag={onDrag}
				onStop={onStop}
			>
				<div
					ref={nodeRef}
					className={cn(
						"pointer-events-auto min-w-0 select-none rounded-xl border border-border bg-popover px-3.5 py-2.5 text-popover-foreground shadow-md",
						dragging ? "cursor-grabbing" : "cursor-grab",
					)}
					style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
					onPointerDown={(event) => event.stopPropagation()}
				>
					<div className="flex items-center gap-2">
						<div className="flex min-w-0 shrink items-center gap-2">
							<span className="shrink-0 text-primary">
								<ProgressIndicator
									value={normalizedProgress}
									icon={<Download />}
									label={resolvedText}
								/>
							</span>
							<SmartTooltip
								disabled={dragging}
								placement="bottom"
								className={cn(
									"download-progress-label min-w-0 text-[13px] leading-5",
									description && "font-medium",
								)}
							>
								{resolvedText}
							</SmartTooltip>
						</div>
						{/* 长文件名先扩宽再省略，各视口保持单行；进度条和取消不被文案挤走。 */}
						<div
							className="h-1 w-20 min-w-20 shrink-0 grow overflow-hidden rounded-full bg-primary/10 max-md:w-16 max-md:min-w-16"
							aria-hidden
						>
							<div
								className="h-full rounded-full bg-primary"
								style={{ width: `${normalizedProgress}%` }}
							/>
						</div>
						{(showPercentage || onCancel) && (
							<div className="flex shrink-0 items-center gap-2">
								{showPercentage && (
									<span className="text-xs tabular-nums text-muted-foreground">
										{Math.round(normalizedProgress)}%
									</span>
								)}
								{onCancel && (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										// 22px 视觉按钮保留 44px 触控高度，扩展命中区不参与布局，避免手机卡片增高。
										className="relative h-[22px] shrink-0 rounded-[5px] border border-destructive/15 bg-destructive/5 px-1.5 text-xs font-normal text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive [@media(pointer:coarse)]:before:absolute [@media(pointer:coarse)]:before:-inset-x-1 [@media(pointer:coarse)]:before:top-1/2 [@media(pointer:coarse)]:before:h-11 [@media(pointer:coarse)]:before:-translate-y-1/2 [@media(pointer:coarse)]:before:content-['']"
										onClick={onCancel}
									>
										{resolvedCancelText}
									</Button>
								)}
							</div>
						)}
					</div>
					{description && (
						<div className="mt-[7px] text-xs leading-[19px] text-muted-foreground [overflow-wrap:anywhere]">
							{description}
						</div>
					)}
				</div>
			</DraggableCore>
		</div>
	)
}

export default memo(DownloadProgressToast)
