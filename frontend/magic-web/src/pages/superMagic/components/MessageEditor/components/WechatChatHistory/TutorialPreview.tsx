import { lazy, Suspense } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import { resolveEffectiveOverlayZIndex, useCurrentOverlayZIndex } from "@/utils/overlayZIndex"

// 仅在点击教程时加载完整图片查看器，保留原有缩放、适应窗口和拖动交互。
const MagicImagePreview = lazy(() => import("@/components/base/MagicImagePreview"))

export interface TutorialImage {
	src: string
	title: string
	alt: string
}

interface TutorialPreviewProps {
	images: readonly TutorialImage[]
	index: number
	onIndexChange: (index: number) => void
	onClose: () => void
	trigger: HTMLButtonElement | null
}

export default function TutorialPreview({
	images,
	index,
	onIndexChange,
	onClose,
	trigger,
}: TutorialPreviewProps) {
	const { t } = useTranslation("super")
	const parentZIndex = useCurrentOverlayZIndex()
	// 教程可能从 Dialog 或手机 Sheet 打开；共用浮层栈负责层级，卸载时由 Hook 释放。
	const layer = useOverlayZIndex({
		open: true,
		zIndex: resolveEffectiveOverlayZIndex(parentZIndex),
	})
	const image = images[index]

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="flex h-[min(880px,92dvh)] w-[min(1280px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
				style={{ zIndex: layer.contentZIndex }}
				overlayStyle={{ zIndex: layer.overlayZIndex }}
				aria-describedby={undefined}
				onInteractOutside={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					trigger?.focus()
				}}
			>
				<div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
					<DialogTitle className="text-sm">{image.title}</DialogTitle>
					<div className="flex shrink-0 items-center gap-3">
						<span className="text-xs text-muted-foreground">
							{index + 1} / {images.length}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-8"
							aria-label={t("wechatChat.close")}
							onClick={onClose}
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					</div>
				</div>
				<div className="min-h-0 flex-1">
					<Suspense fallback={<div className="size-full animate-pulse bg-muted" />}>
						<MagicImagePreview
							src={image.src}
							rootClassName="h-full w-full"
							toolContainerClassName="max-w-[calc(100%-1rem)] flex-wrap justify-center"
							iconSize={16}
							onPrev={() => index > 0 && onIndexChange(index - 1)}
							onNext={() => index < images.length - 1 && onIndexChange(index + 1)}
							prevDisabled={index === 0}
							nextDisabled={index === images.length - 1}
						>
							<img
								src={image.src}
								alt={image.alt}
								draggable={false}
								className="block size-full object-contain"
							/>
						</MagicImagePreview>
					</Suspense>
				</div>
			</DialogContent>
		</Dialog>
	)
}
