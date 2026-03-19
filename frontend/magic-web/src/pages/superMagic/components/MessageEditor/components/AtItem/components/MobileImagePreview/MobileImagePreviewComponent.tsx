import { memo, useState, useImperativeHandle, forwardRef, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useImageZoom } from "./hooks/useImageZoom"
import { useImagePreviewAnimation } from "./hooks/useImagePreviewAnimation"
import { ScaleIndicator } from "./components/ScaleIndicator"
import { CloseButton } from "./components/CloseButton"
import { useStyles } from "./styles"
import { useFileUrl } from "@/pages/superMagic/hooks/useFileUrl"
import useObjectUrl from "../../hooks/useObjectURL"
import { MobileImagePreviewProps, MobileImagePreviewRef } from "./types"

function MobileImagePreviewComponent(
	{ src, alt, visible = false, onClose }: MobileImagePreviewProps,
	ref: React.Ref<MobileImagePreviewRef>,
) {
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()

	// State management
	const [internalVisible, setInternalVisible] = useState(false)
	const [imageSrc, setImageSrc] = useState("")
	const [fileId, setFileId] = useState("")
	const [file, setFile] = useState<File | null>(null)
	const [imageAlt, setImageAlt] = useState("")
	const [showScaleIndicator, setShowScaleIndicator] = useState(false)

	const { fileUrl } = useFileUrl({ file_id: fileId })
	const fileUrl2 = useObjectUrl(file) || ""

	// Refs
	const imageRef = useRef<HTMLImageElement>(null)
	const wrapperRef = useRef<HTMLDivElement>(null)

	const isVisible = visible || internalVisible

	// Animation management
	const { isClosing, isInteractive, handleClose, handleShow } = useImagePreviewAnimation({
		isVisible,
		onClose: () => {
			setInternalVisible(false)
			onClose?.()
		},
	})

	// Zoom functionality
	const {
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
		resetZoom,
		getCurrentScale,
		canCloseOnBackgroundClick,
	} = useImageZoom(imageRef, wrapperRef, {
		isInteractive,
		onScaleChange: (scale) => {
			setShowScaleIndicator(true)
			setTimeout(() => setShowScaleIndicator(false), 1000)
		},
	})

	// Handle body scroll lock when preview is open
	useEffect(() => {
		if (isVisible && isMobile) {
			const originalStyle = window.getComputedStyle(document.body).overflow
			document.body.style.overflow = "hidden"

			return () => {
				document.body.style.overflow = originalStyle
			}
		}
	}, [isVisible, isMobile])

	// Handle escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isVisible) {
				handleClose()
			}
		}

		if (isVisible) {
			document.addEventListener("keydown", handleEscape)
			return () => document.removeEventListener("keydown", handleEscape)
		}
	}, [isVisible, handleClose])

	// Reset zoom when closing or showing new image
	useEffect(() => {
		if (!isVisible || isClosing) {
			resetZoom()
		}
	}, [isVisible, isClosing, resetZoom])

	// Imperative API
	useImperativeHandle(ref, () => ({
		show: ({ src, alt = "", file_id, file }) => {
			setImageSrc(src || "")
			setFileId(file_id || "")
			setFile(file || null)
			setImageAlt(alt)
			setInternalVisible(true)
			handleShow()
			resetZoom()
		},
		hide: () => {
			handleClose()
		},
	}))

	// Handle overlay click
	const handleOverlayClick = (e: React.MouseEvent) => {
		// Only close when clicking on overlay background and not zoomed in
		if (e.target === e.currentTarget && canCloseOnBackgroundClick()) {
			handleClose()
		}
	}

	// Handle image load
	const handleImageLoad = () => {
		resetZoom()
	}

	// Only show on mobile devices
	if (!isMobile || (!isVisible && !isClosing)) {
		return null
	}

	const currentScale = getCurrentScale()

	const previewContent = (
		<div
			className={cx(styles.overlay, {
				visible: isVisible && !isClosing,
			})}
			onClick={handleOverlayClick}
		>
			<div className={styles.container}>
				<div
					ref={wrapperRef}
					className={styles.imageWrapper}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					{(src || imageSrc || fileUrl || fileUrl2) && (
						<img
							ref={imageRef}
							src={src || imageSrc || fileUrl || fileUrl2}
							alt={alt || imageAlt}
							className={cx(styles.image, { interactive: isInteractive })}
							draggable={false}
							onLoad={handleImageLoad}
						/>
					)}
				</div>

				<ScaleIndicator scale={currentScale} visible={showScaleIndicator} />

				<CloseButton visible={isVisible} isClosing={isClosing} onClick={handleClose} />
			</div>
		</div>
	)

	// Render to portal for proper z-index stacking
	return createPortal(previewContent, document.body)
}

export default memo(forwardRef(MobileImagePreviewComponent))
