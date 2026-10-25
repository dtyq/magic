import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useSize } from "ahooks"
import { LoaderCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import type { MediaPreviewCrop, MediaPreviewImageActions, MediaPreviewImageResource } from "./types"

const MagicImagePreview = lazy(() => import("@/components/base/MagicImagePreview"))

interface Props {
	fileName: string
	resourceKey: string
	actions: MediaPreviewImageActions
	container?: HTMLElement | null
	crop?: MediaPreviewCrop
	sourceSize?: { width: number; height: number }
	onClose: () => void
	onRestoreFocus: () => void
}

/** 只在弹层挂载时读原图；续期保留查看器，关闭只取消自己的消费。 */
export function MediaPreviewImageDialog({
	fileName,
	resourceKey,
	actions,
	container,
	crop,
	sourceSize,
	onClose,
	onRestoreFocus,
}: Props) {
	const { t } = useTranslation("super")
	const [resource, setResource] = useState<MediaPreviewImageResource | null>(null)
	const [failed, setFailed] = useState(false)
	const [revision, setRevision] = useState(0)
	const [naturalSize, setNaturalSize] = useState(sourceSize)
	const viewportRef = useRef<HTMLDivElement>(null)
	const viewportSize = useSize(viewportRef)
	// 裁剪区域先适应弹层，再交给既有查看器缩放；原图像素与裁剪坐标保持同一比例。
	const cropScale =
		crop && viewportSize
			? Math.min(1, viewportSize.width / crop.width, viewportSize.height / crop.height)
			: 1
	const loadRef = useRef(actions.load)
	loadRef.current = actions.load
	const recoveredRef = useRef(false)

	useEffect(() => {
		const controller = new AbortController()
		let timer: ReturnType<typeof setTimeout> | undefined
		const load = async (forceRefresh: boolean) => {
			try {
				const next = await loadRef.current({ signal: controller.signal, forceRefresh })
				if (controller.signal.aborted) return
				if (!next?.url) {
					setFailed(true)
					return
				}
				setResource(next)
				setFailed(false)
				if (next.refreshAt && next.refreshAt > Date.now())
					timer = setTimeout(() => void load(true), next.refreshAt - Date.now())
			} catch {
				if (!controller.signal.aborted) setFailed(true)
			}
		}
		void load(revision > 0)
		return () => {
			controller.abort()
			clearTimeout(timer)
		}
	}, [resourceKey, revision])

	const retry = () => {
		setFailed(false)
		setRevision((value) => value + 1)
	}
	const handleImageError = () => {
		if (recoveredRef.current) setFailed(true)
		else {
			recoveredRef.current = true
			retry()
		}
	}
	const image = resource ? (
		<img
			src={resource.url}
			alt={fileName}
			draggable={false}
			className="block"
			style={
				crop && naturalSize
					? {
							width: naturalSize.width * cropScale,
							height: naturalSize.height * cropScale,
							maxWidth: "none",
							transform: `translate(${-crop.x * cropScale}px, ${-crop.y * cropScale}px)`,
						}
					: { width: "100%", height: "100%", objectFit: "contain" }
			}
			onLoad={(event) =>
				setNaturalSize({
					width: event.currentTarget.naturalWidth,
					height: event.currentTarget.naturalHeight,
				})
			}
			onError={handleImageError}
		/>
	) : null

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				container={container ?? undefined}
				className="flex h-[calc(100dvh-48px)] w-[calc(100vw-48px)] !max-w-none flex-col gap-0 overflow-hidden p-0"
				aria-describedby={undefined}
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					onRestoreFocus()
				}}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
				onDoubleClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			>
				<DialogTitle className="truncate border-b px-4 py-3 pr-12 text-sm">
					{fileName}
				</DialogTitle>
				<div ref={viewportRef} className="relative min-h-0 flex-1">
					{resource && (
						<Suspense
							fallback={<LoaderCircle className="m-auto size-6 animate-spin" />}
						>
							<MagicImagePreview
								rootClassName="h-full w-full"
								contentKey={resourceKey}
								isAIImage={actions.isAIImage}
								onDownload={actions.onDownload}
							>
								{crop && naturalSize ? (
									<div
										className="overflow-hidden"
										style={{
											width: crop.width * cropScale,
											height: crop.height * cropScale,
										}}
									>
										{image}
									</div>
								) : (
									image
								)}
							</MagicImagePreview>
						</Suspense>
					)}
					{(!resource || failed) && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95">
							{failed ? (
								<>
									<p className="text-sm text-muted-foreground">
										{t("common.fileNotFoundOrLoadFailed")}
									</p>
									<Button
										onClick={() => {
											recoveredRef.current = false
											retry()
										}}
									>
										{t("filePreview.retry")}
									</Button>
								</>
							) : (
								<LoaderCircle
									className="size-6 animate-spin"
									aria-label={t("common.loading")}
								/>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
