import { forwardRef, useMemo, type HTMLAttributes } from "react"
import { Upload } from "lucide-react"
import { useCanvasDesignI18n } from "../../../context/I18nContext"
import {
	REFERENCE_RESOURCE_DROP_STATUS,
	type ReferenceResourceDropDragEvents,
	type ReferenceResourceDropOverlayState,
} from "./useReferenceResourcePanelDataService"
import styles from "./ReferenceResourceDropSurface.module.css"

export type ReferenceResourceDropSurfaceProps = Omit<
	HTMLAttributes<HTMLDivElement>,
	"children" | "onDragEnter" | "onDragLeave" | "onDragOver" | "onDrop" | "onDropCapture"
> & {
	children: React.ReactNode
	dropOverlayState?: ReferenceResourceDropOverlayState
	dragEvents?: ReferenceResourceDropDragEvents
}

function getDropOverlayMessage({
	overlayState,
	t,
}: {
	overlayState?: ReferenceResourceDropOverlayState
	t: ReturnType<typeof useCanvasDesignI18n>["t"]
}) {
	switch (overlayState?.status) {
		case REFERENCE_RESOURCE_DROP_STATUS.ready:
			return t("dropOverlay.releaseToAddAttachment", "松开以添加附件")
		case REFERENCE_RESOURCE_DROP_STATUS.unsupportedType:
			return t("dropOverlay.unsupportedAttachment", "附件不支持")
		case REFERENCE_RESOURCE_DROP_STATUS.limitExceeded:
			return t("dropOverlay.referenceImageLimitReached", "参考图数量已达上限")
		case REFERENCE_RESOURCE_DROP_STATUS.notAvailable:
			return t("dropOverlay.referenceImageUnavailable", "当前不支持添加参考图")
		case REFERENCE_RESOURCE_DROP_STATUS.unknown:
			return t("dropOverlay.unsupportedAttachment", "附件不支持")
		default:
			return t("dropOverlay.releaseToAddAttachment", "松开以添加附件")
	}
}

export const ReferenceResourceDropSurface = forwardRef<
	HTMLDivElement,
	ReferenceResourceDropSurfaceProps
>(function ReferenceResourceDropSurface(props, ref) {
	const { children, className, style, dropOverlayState, dragEvents, ...rest } = props
	const { t } = useCanvasDesignI18n()

	const dropOverlayMessage = useMemo(
		() => getDropOverlayMessage({ overlayState: dropOverlayState, t }),
		[dropOverlayState, t],
	)

	const dragOverlayClassName = useMemo(() => {
		const classes = [styles.dragOverlay]
		const status = dropOverlayState?.status
		if (
			status === REFERENCE_RESOURCE_DROP_STATUS.unsupportedType ||
			status === REFERENCE_RESOURCE_DROP_STATUS.limitExceeded ||
			status === REFERENCE_RESOURCE_DROP_STATUS.unknown
		) {
			classes.push(styles.dragOverlayInvalid)
		}
		return classes.join(" ")
	}, [dropOverlayState?.status])

	const rootClassName = [styles.shell, className].filter(Boolean).join(" ")

	return (
		<div
			ref={ref}
			className={rootClassName}
			style={style}
			{...rest}
			onDropCapture={(event) => {
				if (dragEvents) {
					event.preventDefault()
				}
			}}
			onDragEnter={dragEvents?.onDragEnter}
			onDragLeave={dragEvents?.onDragLeave}
			onDragOver={dragEvents?.onDragOver}
			onDrop={dragEvents?.onDrop}
		>
			{children}
			{dropOverlayState?.visible && (
				<div
					className={dragOverlayClassName}
					data-testid="canvas-reference-editor-drop-overlay"
				>
					<div className={styles.dragOverlayContent}>
						<Upload size={18} />
						<span className={styles.dragOverlayMessage}>{dropOverlayMessage}</span>
					</div>
				</div>
			)}
		</div>
	)
})
