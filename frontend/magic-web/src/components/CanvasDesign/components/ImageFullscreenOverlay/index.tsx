import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useReferenceImageUrls } from "../../hooks/useReferenceImageUrls"
import chromeStyles from "../FullscreenMediaShell/chrome.module.css"
import { getFullscreenMediaFileLabel } from "../FullscreenMediaShell/getFullscreenMediaFileLabel"
import styles from "../FullscreenMediaShell/shell.module.css"

const IMAGE_FULLSCREEN_LAYOUT = {
	insetPx: 80,
	panelMaxWidthPx: 1200,
} as const satisfies { insetPx: number; panelMaxWidthPx: number }

const CHROME_IDLE_HIDE_MS = 3000

const overlayInsetStyle: CSSProperties = {
	padding: IMAGE_FULLSCREEN_LAYOUT.insetPx,
}

function computeImagePanelPixelSize(
	aspectWidth: number,
	aspectHeight: number,
): {
	width: number
	height: number
} {
	const aw = Math.max(1, aspectWidth)
	const ah = Math.max(1, aspectHeight)
	const viewportGutter = IMAGE_FULLSCREEN_LAYOUT.insetPx * 2
	const maxW = Math.min(
		IMAGE_FULLSCREEN_LAYOUT.panelMaxWidthPx,
		Math.max(200, window.innerWidth - viewportGutter),
	)
	const maxH = Math.max(200, window.innerHeight - viewportGutter)
	const scale = Math.min(maxW / aw, maxH / ah)
	return { width: aw * scale, height: ah * scale }
}

interface ImageFullscreenOverlayProps {
	path: string
	title: string
	isOpen: boolean
	onClose: () => void
	closeAriaLabel?: string
}

export default function ImageFullscreenOverlay(props: ImageFullscreenOverlayProps) {
	const { path, title, isOpen, onClose, closeAriaLabel } = props
	const { t } = useCanvasDesignI18n()

	const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isClient, setIsClient] = useState(false)
	const [chromeVisible, setChromeVisible] = useState(false)

	const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
	const [hasError, setHasError] = useState(false)

	const [panelSize, setPanelSize] = useState<{
		width: number
		height: number
	} | null>(null)

	const imgRef = useRef<HTMLImageElement | null>(null)

	const { fullUrl, thumbnailUrl, isLoading } = useReferenceImageUrls(path, {
		eagerFullUrl: true,
	})
	const src = fullUrl ?? thumbnailUrl

	useEffect(() => {
		setNaturalSize(null)
		setHasError(false)
	}, [path])

	useEffect(() => {
		if (!isOpen) {
			setHasError(false)
		}
	}, [isOpen])

	const clearHideChromeTimer = useCallback(() => {
		if (hideChromeTimerRef.current !== null) {
			clearTimeout(hideChromeTimerRef.current)
			hideChromeTimerRef.current = null
		}
	}, [])

	const scheduleHideChrome = useCallback(() => {
		clearHideChromeTimer()
		hideChromeTimerRef.current = setTimeout(() => {
			setChromeVisible(false)
		}, CHROME_IDLE_HIDE_MS)
	}, [clearHideChromeTimer])

	const handlePlayerMouseEnter = useCallback(() => {
		setChromeVisible(true)
		scheduleHideChrome()
	}, [scheduleHideChrome])

	const handlePlayerMouseMove = useCallback(() => {
		setChromeVisible(true)
		scheduleHideChrome()
	}, [scheduleHideChrome])

	const handlePlayerMouseLeave = useCallback(() => {
		clearHideChromeTimer()
		setChromeVisible(false)
	}, [clearHideChromeTimer])

	useEffect(() => {
		setIsClient(true)
	}, [])

	useEffect(() => {
		return () => clearHideChromeTimer()
	}, [clearHideChromeTimer])

	useEffect(() => {
		if (!isOpen) {
			clearHideChromeTimer()
			setChromeVisible(false)
			return
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose()
			}
		}

		const originalOverflow = document.body.style.overflow
		document.body.style.overflow = "hidden"
		window.addEventListener("keydown", handleKeyDown)

		return () => {
			document.body.style.overflow = originalOverflow
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [clearHideChromeTimer, isOpen, onClose])

	const applyNaturalSizeFromImage = useCallback((img: HTMLImageElement) => {
		const w = img.naturalWidth
		const h = img.naturalHeight
		if (w > 0 && h > 0) setNaturalSize({ width: w, height: h })
	}, [])

	useLayoutEffect(() => {
		if (!isOpen || !naturalSize) {
			setPanelSize(null)
			return
		}

		const aw = naturalSize.width
		const ah = naturalSize.height
		const updatePanelSize = () => {
			setPanelSize(computeImagePanelPixelSize(aw, ah))
		}

		updatePanelSize()
		window.addEventListener("resize", updatePanelSize)
		return () => window.removeEventListener("resize", updatePanelSize)
	}, [isOpen, naturalSize])

	useLayoutEffect(() => {
		const img = imgRef.current
		if (!img || !src || hasError) return
		if (!img.complete) return
		applyNaturalSizeFromImage(img)
	}, [applyNaturalSizeFromImage, hasError, src])

	const isImageDecodePending = Boolean(src && !hasError && !naturalSize)
	const showLoading = (!src && isLoading) || isImageDecodePending
	const showError = hasError || (!src && !isLoading)

	const topChromeClassName = [
		chromeStyles.layer,
		chromeStyles.topBar,
		chromeVisible ? chromeStyles.layerVisible : chromeStyles.layerHidden,
	].join(" ")

	const fileLabel = getFullscreenMediaFileLabel(path, title)

	if (!isClient || !isOpen) {
		return null
	}

	return createPortal(
		<div className={styles.overlayRoot} style={overlayInsetStyle} data-canvas-ui-component>
			<div
				className={styles.overlayBackdrop}
				role="presentation"
				onClick={onClose}
				aria-hidden
			/>
			<div className={styles.overlayContent}>
				<div
					className={styles.panel}
					style={
						panelSize
							? { width: panelSize.width, height: panelSize.height }
							: {
									width: "auto",
									height: "auto",
									minWidth: 280,
									minHeight: 160,
									background: "transparent",
									boxShadow: "none",
								}
					}
					onClick={(event) => event.stopPropagation()}
				>
					<div
						className={styles.player}
						style={isImageDecodePending ? { minWidth: 280, minHeight: 160 } : undefined}
						onMouseEnter={handlePlayerMouseEnter}
						onMouseMove={handlePlayerMouseMove}
						onMouseLeave={handlePlayerMouseLeave}
					>
						<div
							className={topChromeClassName}
							onClick={(event) => event.stopPropagation()}
							onPointerDown={(event) => event.stopPropagation()}
						>
							<div className={chromeStyles.topBarLeft}>
								{fileLabel ? (
									<span className={chromeStyles.fileName} title={fileLabel}>
										{fileLabel}
									</span>
								) : null}
							</div>
							<button
								type="button"
								className={styles.closeButton}
								onClick={(event) => {
									event.stopPropagation()
									onClose()
								}}
								aria-label={
									closeAriaLabel ??
									t("mediaResourceFullscreenPreview.close", "关闭全屏预览")
								}
							>
								<X size={20} />
							</button>
						</div>

						{src && !hasError ? (
							<img
								ref={imgRef}
								className={styles.video}
								src={src}
								alt={title}
								draggable={false}
								style={
									isImageDecodePending
										? {
												position: "absolute",
												width: 1,
												height: 1,
												opacity: 0,
												pointerEvents: "none",
											}
										: undefined
								}
								onLoad={(event) => {
									applyNaturalSizeFromImage(event.currentTarget)
								}}
								onError={() => setHasError(true)}
							/>
						) : null}

						{(showLoading || showError) && (
							<div className={styles.centerOverlay}>
								{showError ? (
									<div className={styles.errorState}>
										{t(
											"mediaResourceFullscreenPreview.imageLoadFailed",
											"图片加载失败",
										)}
									</div>
								) : (
									<div className={styles.spinner} />
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>,
		document.body,
	)
}
