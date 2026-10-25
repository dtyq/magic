import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import type { CropConfig } from "../../../runtime/document/types"
import {
	computeReferenceImageCroppedDisplayLayout,
	getPersistedSourceCrop,
} from "../../../runtime/resources/image/imageCropUtils"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useReferenceImageUrls } from "../../../app/hooks/resources/useReferenceImageUrls"
import chromeStyles from "../shell/chrome.module.css"
import { getFullscreenMediaFileLabel } from "../shell/getFullscreenMediaFileLabel"
import styles from "../shell/shell.module.css"

const IMAGE_FULLSCREEN_LAYOUT = {
	insetPx: 80,
	panelMaxWidthPx: 1200,
	modeSwitcherReservePx: 52,
} as const satisfies { insetPx: number; panelMaxWidthPx: number; modeSwitcherReservePx: number }

const CHROME_IDLE_HIDE_MS = 3000

type ImageFullscreenViewMode = "original" | "cropped"

const overlayInsetStyle: CSSProperties = {
	padding: IMAGE_FULLSCREEN_LAYOUT.insetPx,
}

function computeImagePanelPixelSize(
	aspectWidth: number,
	aspectHeight: number,
	reservedHeight = 0,
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
	const maxH = Math.max(200, window.innerHeight - viewportGutter - reservedHeight)
	const scale = Math.min(maxW / aw, maxH / ah)
	return { width: aw * scale, height: ah * scale }
}

function getCropSignature(crop: CropConfig | undefined): string {
	if (!crop) return ""
	return [
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		crop.displayWidth ?? "",
		crop.displayHeight ?? "",
	].join(":")
}

interface ImageFullscreenOverlayProps {
	path: string
	fileName?: string
	crop?: CropConfig
	/** 直接可用的预览 URL；传入后跳过画布 ImageResourceManager 解析。 */
	src?: string
	isOpen: boolean
	onClose: () => void
	closeAriaLabel?: string
}

export default function ImageFullscreenOverlay(props: ImageFullscreenOverlayProps) {
	const { path, fileName, crop, src: previewSrc, isOpen, onClose, closeAriaLabel } = props
	const { t } = useCanvasDesignI18n()

	const hideChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [isClient, setIsClient] = useState(false)
	const [chromeVisible, setChromeVisible] = useState(false)

	const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
	const [hasError, setHasError] = useState(false)
	const [isRefreshingUrl, setIsRefreshingUrl] = useState(false)
	const urlRetryAttemptedRef = useRef(false)
	const urlRetryGenerationRef = useRef(0)

	const [panelSize, setPanelSize] = useState<{
		width: number
		height: number
	} | null>(null)
	const [viewMode, setViewMode] = useState<ImageFullscreenViewMode>(crop ? "cropped" : "original")

	const imgRef = useRef<HTMLImageElement | null>(null)
	const cropSignature = useMemo(() => getCropSignature(crop), [crop])
	const hasCrop = Boolean(crop)

	const { fullUrl, lowUrl, imageInfo, isLoading, refreshFullUrl } = useReferenceImageUrls(path, {
		eagerFullUrl: true,
		enabled: isOpen,
	})
	const src = previewSrc ?? fullUrl ?? lowUrl
	const sourceSize = useMemo(() => {
		if (imageInfo?.naturalWidth && imageInfo.naturalHeight) {
			return {
				width: imageInfo.naturalWidth,
				height: imageInfo.naturalHeight,
			}
		}
		return naturalSize
	}, [imageInfo, naturalSize])

	useEffect(() => {
		urlRetryAttemptedRef.current = false
		urlRetryGenerationRef.current += 1
		setNaturalSize(null)
		setHasError(false)
		setIsRefreshingUrl(false)
		return () => {
			urlRetryGenerationRef.current += 1
		}
	}, [isOpen, path, refreshFullUrl])

	useEffect(() => {
		setViewMode(hasCrop ? "cropped" : "original")
	}, [cropSignature, hasCrop, path])

	const handleImageError = useCallback(async () => {
		if (!isOpen) return
		if (urlRetryAttemptedRef.current) {
			setHasError(true)
			return
		}
		// 浏览器 img 不暴露 HTTP 状态，签名过期和网络失败都只尝试一次换链。
		// 关闭或切换图片后，旧请求不能改变当前面板的加载/失败状态。
		urlRetryAttemptedRef.current = true
		const generation = urlRetryGenerationRef.current
		setIsRefreshingUrl(true)
		setNaturalSize(null)
		try {
			const nextUrl = await refreshFullUrl()
			if (urlRetryGenerationRef.current !== generation) return
			setHasError(!nextUrl)
		} catch {
			if (urlRetryGenerationRef.current === generation) setHasError(true)
		} finally {
			if (urlRetryGenerationRef.current === generation) setIsRefreshingUrl(false)
		}
	}, [isOpen, refreshFullUrl])

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

	const effectiveCrop = useMemo(() => {
		if (!crop || !sourceSize) return null
		const persistedCrop = getPersistedSourceCrop(crop, sourceSize)
		if (persistedCrop.width <= 0 || persistedCrop.height <= 0) return null

		const isFullImageCrop =
			Math.abs(persistedCrop.x) < 0.5 &&
			Math.abs(persistedCrop.y) < 0.5 &&
			Math.abs(persistedCrop.width - sourceSize.width) < 0.5 &&
			Math.abs(persistedCrop.height - sourceSize.height) < 0.5

		return isFullImageCrop ? null : persistedCrop
	}, [crop, sourceSize])

	const activeViewMode: ImageFullscreenViewMode = effectiveCrop ? viewMode : "original"

	useLayoutEffect(() => {
		if (!isOpen || !sourceSize) {
			setPanelSize(null)
			return
		}

		const displaySize =
			activeViewMode === "cropped" && effectiveCrop
				? { width: effectiveCrop.width, height: effectiveCrop.height }
				: sourceSize
		const reserveHeight = effectiveCrop ? IMAGE_FULLSCREEN_LAYOUT.modeSwitcherReservePx : 0
		const updatePanelSize = () => {
			setPanelSize(
				computeImagePanelPixelSize(displaySize.width, displaySize.height, reserveHeight),
			)
		}

		updatePanelSize()
		window.addEventListener("resize", updatePanelSize)
		return () => window.removeEventListener("resize", updatePanelSize)
	}, [activeViewMode, effectiveCrop, isOpen, sourceSize])

	useLayoutEffect(() => {
		const img = imgRef.current
		if (!img || !src || hasError) return
		if (!img.complete) return
		applyNaturalSizeFromImage(img)
	}, [applyNaturalSizeFromImage, hasError, src])

	const croppedImageLayout = useMemo<CSSProperties | null>(() => {
		if (activeViewMode !== "cropped" || !effectiveCrop || !sourceSize || !panelSize) {
			return null
		}
		return computeReferenceImageCroppedDisplayLayout(
			panelSize.width,
			panelSize.height,
			sourceSize.width,
			sourceSize.height,
			effectiveCrop,
		)
	}, [activeViewMode, effectiveCrop, sourceSize, panelSize])

	const isImageLayoutPending = Boolean(
		src &&
		!hasError &&
		(!naturalSize ||
			!sourceSize ||
			!panelSize ||
			(activeViewMode === "cropped" && effectiveCrop && !croppedImageLayout)),
	)
	const showLoading = isRefreshingUrl || (!src && isLoading) || isImageLayoutPending
	const showError = hasError || (!src && !isLoading)
	const showCropModeSwitcher = Boolean(effectiveCrop)
	const originalImageLabel = t("mediaResourceFullscreenPreview.originalImage", "原图")
	const croppedImageLabel = t("mediaResourceFullscreenPreview.croppedImage", "裁剪图")

	const topChromeClassName = [
		chromeStyles.layer,
		chromeStyles.topBar,
		chromeVisible ? chromeStyles.layerVisible : chromeStyles.layerHidden,
	].join(" ")

	const fileLabel = getFullscreenMediaFileLabel(path, fileName)

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
				{showLoading ? (
					<div className={styles.loadingOnly}>
						{src && !hasError && !isRefreshingUrl ? (
							<img
								ref={imgRef}
								className={styles.video}
								src={src}
								alt={fileLabel}
								draggable={false}
								style={{
									position: "absolute",
									width: 1,
									height: 1,
									opacity: 0,
									pointerEvents: "none",
								}}
								onLoad={(event) => {
									applyNaturalSizeFromImage(event.currentTarget)
								}}
								onError={handleImageError}
							/>
						) : null}
						<div className={styles.spinner} />
					</div>
				) : showError ? (
					<div className={styles.errorState}>
						{t("mediaResourceFullscreenPreview.imageLoadFailed", "图片加载失败")}
					</div>
				) : panelSize ? (
					<div className={styles.readyStack}>
						{showCropModeSwitcher ? (
							<div
								className={styles.cropModeTabs}
								role="tablist"
								aria-label={t(
									"mediaResourceFullscreenPreview.viewMode",
									"图片显示模式",
								)}
								onClick={(event) => event.stopPropagation()}
								onPointerDown={(event) => event.stopPropagation()}
							>
								<span
									className={[
										styles.cropModeIndicator,
										activeViewMode === "cropped"
											? styles.cropModeIndicatorCropped
											: "",
									]
										.filter(Boolean)
										.join(" ")}
								/>
								<button
									type="button"
									role="tab"
									aria-selected={activeViewMode === "original"}
									className={[
										styles.cropModeButton,
										activeViewMode === "original"
											? styles.cropModeButtonActive
											: "",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={() => setViewMode("original")}
								>
									{originalImageLabel}
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={activeViewMode === "cropped"}
									className={[
										styles.cropModeButton,
										activeViewMode === "cropped"
											? styles.cropModeButtonActive
											: "",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={() => setViewMode("cropped")}
								>
									{croppedImageLabel}
								</button>
							</div>
						) : null}
						<div
							className={styles.panel}
							style={{ width: panelSize.width, height: panelSize.height }}
							onClick={(event) => event.stopPropagation()}
						>
							<div
								className={styles.player}
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
											<span
												className={chromeStyles.fileName}
												title={fileLabel}
											>
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
											t(
												"mediaResourceFullscreenPreview.close",
												"关闭全屏预览",
											)
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
										alt={fileLabel}
										draggable={false}
										style={
											activeViewMode === "cropped"
												? (croppedImageLayout ?? undefined)
												: undefined
										}
										onLoad={(event) => {
											applyNaturalSizeFromImage(event.currentTarget)
										}}
										onError={handleImageError}
									/>
								) : null}
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>,
		document.body,
	)
}
