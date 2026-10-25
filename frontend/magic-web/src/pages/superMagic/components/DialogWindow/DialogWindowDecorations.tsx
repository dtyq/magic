import type { DialogWindowFrame } from "@/pages/superMagic/hooks/useDialogWindowFrame"
import { DialogResizeGuide, type DialogResizeGuideProps } from "./DialogResizeGuide"
import { DialogResizeGrip, type DialogResizeGripProps } from "./DialogResizeGrip"

export interface DialogWindowDecorationsProps {
	frame?: DialogWindowFrame
	guideProps?: Partial<DialogResizeGuideProps>
	gripProps?: Partial<DialogResizeGripProps>
	resizeGuide?: {
		visible?: boolean
		onDismiss?: () => void
	}
	resizable?: boolean
	onRestoreRecommendedSize?: () => void
}

export function DialogWindowDecorations({
	frame,
	guideProps,
	gripProps,
	resizeGuide,
	resizable,
	onRestoreRecommendedSize,
}: DialogWindowDecorationsProps) {
	const isResizable = resizable ?? Boolean(frame?.windowOptions.resizable)
	const guideVisible =
		resizeGuide?.visible ??
		guideProps?.visible ??
		Boolean(isResizable && frame?.resizeGuideVisible)
	const guideDismiss =
		resizeGuide?.onDismiss ?? guideProps?.onDismiss ?? frame?.dismissResizeGuide
	const restoreRecommendedSize =
		onRestoreRecommendedSize ??
		guideProps?.onRestoreRecommendedSize ??
		frame?.restoreRecommendedSize

	if (!isResizable) return null

	return (
		<>
			<DialogResizeGuide
				frame={frame}
				visible={guideVisible}
				onDismiss={guideDismiss}
				onRestoreRecommendedSize={restoreRecommendedSize}
				{...guideProps}
			/>
			<DialogResizeGrip
				frame={frame}
				visible={isResizable}
				active={guideVisible}
				{...gripProps}
			/>
		</>
	)
}

export default DialogWindowDecorations
