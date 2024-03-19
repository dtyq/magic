import { memo, useMemo, useRef, useState, useCallback, useEffect } from "react"
import { ProgressBar } from "antd-mobile"
import { IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { useStyles } from "../../styles"
import { processSvgContent, isSvgContent } from "@/opensource/utils/svgProcessor"
import { ImagePreviewInfo } from "@/opensource/types/chat/preview"

interface ImageViewerProps {
	src?: string
	loading?: boolean
	progress?: number
	onClose: () => void
	info?: Partial<ImagePreviewInfo>
	renderActionBar?: () => React.ReactElement
}

interface Transform {
	x: number
	y: number
	scale: number
}

interface SwipeState {
	isSwipeToClose: boolean
	startY: number
	currentY: number
	opacity: number
}

function ImageViewer({
	src,
	loading,
	progress = 0,
	onClose,
	info,
	renderActionBar,
}: ImageViewerProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const containerRef = useRef<HTMLDivElement>(null)
	const imageRef = useRef<HTMLImageElement | HTMLDivElement>(null)

	// Transform state
	const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
	const [isTransitioning, setIsTransitioning] = useState(false)

	// Swipe to close state
	const [swipeState, setSwipeState] = useState<SwipeState>({
		isSwipeToClose: false,
		startY: 0,
		currentY: 0,
		opacity: 1,
	})

	// Touch state
	const touchRef = useRef({
		lastTouchCount: 0,
		lastDistance: 0,
		lastCenter: { x: 0, y: 0 },
		startTransform: { x: 0, y: 0, scale: 1 },
		lastTapTime: 0,
		isDragging: false,
		initialTouchY: 0,
		initialTouchX: 0,
		swipeDirection: null as "vertical" | "horizontal" | null,
	})

	// Reset all states when src changes
	const resetAllStates = useMemoizedFn(() => {
		// Reset transform state
		setTransform({ x: 0, y: 0, scale: 1 })

		// Reset transition state
		setIsTransitioning(false)

		// Reset swipe state
		setSwipeState({
			isSwipeToClose: false,
			startY: 0,
			currentY: 0,
			opacity: 1,
		})

		// Reset touch state
		touchRef.current = {
			lastTouchCount: 0,
			lastDistance: 0,
			lastCenter: { x: 0, y: 0 },
			startTransform: { x: 0, y: 0, scale: 1 },
			lastTapTime: 0,
			isDragging: false,
			initialTouchY: 0,
			initialTouchX: 0,
			swipeDirection: null,
		}
	})

	// Reset states when src changes
	useEffect(() => {
		resetAllStates()
	}, [src, resetAllStates])

	// Cleanup states when component unmounts
	useEffect(() => {
		return () => {
			// Reset all states on unmount to ensure clean state
			resetAllStates()
		}
	}, [resetAllStates])

	// Get distance between two touches
	const getDistance = useCallback((touches: React.TouchList): number => {
		if (touches.length < 2) return 0
		const touch1 = touches[0]
		const touch2 = touches[1]
		return Math.sqrt(
			Math.pow(touch2.clientX - touch1.clientX, 2) +
				Math.pow(touch2.clientY - touch1.clientY, 2),
		)
	}, [])

	// Get center point between two touches
	const getCenter = useCallback((touches: React.TouchList): { x: number; y: number } => {
		if (touches.length === 1) {
			return { x: touches[0].clientX, y: touches[0].clientY }
		}
		if (touches.length >= 2) {
			return {
				x: (touches[0].clientX + touches[1].clientX) / 2,
				y: (touches[0].clientY + touches[1].clientY) / 2,
			}
		}
		return { x: 0, y: 0 }
	}, [])

	// Reset transform to default
	const resetTransform = useMemoizedFn(() => {
		setIsTransitioning(true)
		setTransform({ x: 0, y: 0, scale: 1 })
		setTimeout(() => setIsTransitioning(false), 300)
	})

	// Constrain transform values
	const constrainTransform = useCallback((newTransform: Transform): Transform => {
		const { scale, x, y } = newTransform
		const minScale = 1
		const maxScale = 4

		// Constrain scale
		const constrainedScale = Math.max(minScale, Math.min(maxScale, scale))

		// If scale is at minimum, center the image
		if (constrainedScale === 1) {
			return { x: 0, y: 0, scale: 1 }
		}

		// Get container and image dimensions
		const container = containerRef.current
		if (!container) return { ...newTransform, scale: constrainedScale }

		const containerRect = container.getBoundingClientRect()
		const scaledImageWidth = containerRect.width * constrainedScale
		const scaledImageHeight = containerRect.height * constrainedScale

		// Calculate max translation
		const maxX = Math.max(0, (scaledImageWidth - containerRect.width) / 2)
		const maxY = Math.max(0, (scaledImageHeight - containerRect.height) / 2)

		const constrainedX = Math.max(-maxX, Math.min(maxX, x))
		const constrainedY = Math.max(-maxY, Math.min(maxY, y))

		return {
			x: constrainedX,
			y: constrainedY,
			scale: constrainedScale,
		}
	}, [])

	// Handle touch start
	const handleTouchStart = useMemoizedFn((e: React.TouchEvent) => {
		const touches = e.touches
		const touchCount = touches.length

		touchRef.current.lastTouchCount = touchCount
		touchRef.current.startTransform = { ...transform }
		touchRef.current.swipeDirection = null

		if (touchCount === 1) {
			const touch = touches[0]
			const now = Date.now()
			const timeDiff = now - touchRef.current.lastTapTime
			touchRef.current.lastTapTime = now

			// Record initial touch position for swipe detection
			touchRef.current.initialTouchY = touch.clientY
			touchRef.current.initialTouchX = touch.clientX

			// Double tap detection
			if (timeDiff < 300 && timeDiff > 50) {
				setIsTransitioning(true)

				if (transform.scale > 1.1) {
					// Reset to original size
					setTransform({ x: 0, y: 0, scale: 1 })
				} else {
					// Zoom in to 2x
					const container = containerRef.current
					if (container) {
						const rect = container.getBoundingClientRect()
						const centerX = touch.clientX - rect.left - rect.width / 2
						const centerY = touch.clientY - rect.top - rect.height / 2

						// Calculate zoom position with proper constraints
						const newTransform = constrainTransform({
							x: -centerX * 0.5,
							y: -centerY * 0.5,
							scale: 2,
						})
						setTransform(newTransform)
					}
				}

				setTimeout(() => setIsTransitioning(false), 300)
				return
			}

			touchRef.current.isDragging = true
			touchRef.current.lastCenter = getCenter(touches)
		} else if (touchCount === 2) {
			touchRef.current.isDragging = false
			touchRef.current.lastDistance = getDistance(touches)
			touchRef.current.lastCenter = getCenter(touches)
		}
	})

	// Handle touch move
	const handleTouchMove = useMemoizedFn((e: React.TouchEvent) => {
		const touches = e.touches
		const touchCount = touches.length

		if (touchCount === 1 && touchRef.current.isDragging) {
			const center = getCenter(touches)
			const deltaX = center.x - touchRef.current.lastCenter.x
			const deltaY = center.y - touchRef.current.lastCenter.y

			// Determine swipe direction if not set
			if (!touchRef.current.swipeDirection) {
				const totalDeltaX = Math.abs(center.x - touchRef.current.initialTouchX)
				const totalDeltaY = Math.abs(center.y - touchRef.current.initialTouchY)

				if (totalDeltaX > 20 || totalDeltaY > 20) {
					touchRef.current.swipeDirection =
						totalDeltaY > totalDeltaX ? "vertical" : "horizontal"
				}
			}

			// Handle swipe to close (only when scale is 1 and swiping down)
			if (transform.scale <= 1 && touchRef.current.swipeDirection === "vertical") {
				const currentY = center.y - touchRef.current.initialTouchY

				// Only allow downward swipe to close
				if (currentY > 0) {
					const maxSwipeDistance = 300 // Maximum swipe distance
					const normalizedDistance = Math.min(currentY / maxSwipeDistance, 1)
					const opacity = Math.max(0.3, 1 - normalizedDistance * 0.7)

					setSwipeState({
						isSwipeToClose: true,
						startY: touchRef.current.initialTouchY,
						currentY: center.y,
						opacity,
					})
					return // Don't handle as normal drag
				}
			}

			// Normal drag behavior for scaled images or horizontal movement
			if (transform.scale > 1) {
				// Apply drag without constraints during movement for smooth experience
				const newTransform = {
					...transform,
					x: transform.x + deltaX,
					y: transform.y + deltaY,
				}

				setTransform(newTransform)
			}

			touchRef.current.lastCenter = center
		} else if (touchCount === 2) {
			// Two finger pinch/zoom
			const distance = getDistance(touches)
			const center = getCenter(touches)

			if (touchRef.current.lastDistance > 0) {
				// Calculate scale change based on distance difference
				const scaleChange = distance / touchRef.current.lastDistance

				// Ensure scale change is reasonable (prevent extreme jumps)
				const clampedScaleChange = Math.max(0.5, Math.min(2.0, scaleChange))

				const newScale = transform.scale * clampedScaleChange

				// Apply scale constraints
				const constrainedScale = Math.max(1, Math.min(4, newScale))

				// Calculate zoom center offset only if we're actually scaling
				if (Math.abs(clampedScaleChange - 1) > 0.01) {
					const container = containerRef.current
					if (container) {
						const rect = container.getBoundingClientRect()
						const zoomCenterX = center.x - rect.left - rect.width / 2
						const zoomCenterY = center.y - rect.top - rect.height / 2

						// Calculate new position based on zoom center
						const newX =
							transform.x + (zoomCenterX - transform.x) * (1 - clampedScaleChange)
						const newY =
							transform.y + (zoomCenterY - transform.y) * (1 - clampedScaleChange)

						setTransform({
							x: newX,
							y: newY,
							scale: constrainedScale,
						})
					}
				}
			}

			// Always update tracking values
			touchRef.current.lastDistance = distance
			touchRef.current.lastCenter = center
		}
	})

	// Handle touch end
	const handleTouchEnd = useMemoizedFn((e: React.TouchEvent) => {
		touchRef.current.isDragging = false
		touchRef.current.swipeDirection = null

		// Handle swipe to close
		if (swipeState.isSwipeToClose) {
			const swipeDistance = swipeState.currentY - swipeState.startY
			const threshold = 150 // Minimum distance to trigger close

			if (swipeDistance > threshold) {
				// Reset all states before closing to ensure clean state for next open
				resetAllStates()
				// Close the preview
				onClose()
			} else {
				// Reset swipe state with animation
				setIsTransitioning(true)
				setSwipeState({
					isSwipeToClose: false,
					startY: 0,
					currentY: 0,
					opacity: 1,
				})
				setTimeout(() => setIsTransitioning(false), 300)
			}
			return
		}

		// Only apply constraints if transform is actually out of bounds
		const constrainedTransform = constrainTransform(transform)

		// Check if constraints are actually needed
		const needsConstraint =
			Math.abs(constrainedTransform.x - transform.x) > 0.1 ||
			Math.abs(constrainedTransform.y - transform.y) > 0.1 ||
			Math.abs(constrainedTransform.scale - transform.scale) > 0.01

		if (needsConstraint) {
			setIsTransitioning(true)
			setTransform(constrainedTransform)
			setTimeout(() => setIsTransitioning(false), 300)
		}
	})

	// Enhanced SVG detection logic based on PC version
	const ImageNode = useMemo(() => {
		if (!src) return null

		// Use enhanced SVG detection from utility
		const fileExt = info?.ext?.ext
		const isSvg = isSvgContent(src, fileExt)

		const imageStyle = {
			transform: swipeState.isSwipeToClose
				? `translate3d(${transform.x}px, ${
						transform.y + (swipeState.currentY - swipeState.startY)
					}px, 0) scale(${transform.scale})`
				: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
			transition: isTransitioning
				? "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
				: "none",
			transformOrigin: "center center",
		}

		if (isSvg) {
			try {
				const svgResult = processSvgContent(src)

				if (!svgResult.isValid) {
					console.warn("SVG processing warning:", svgResult.error)
					// Fallback to image tag if SVG is invalid
					return (
						<img
							ref={imageRef as React.RefObject<HTMLImageElement>}
							src={src}
							alt=""
							className={styles.image}
							style={imageStyle}
						/>
					)
				}

				return (
					<div
						ref={imageRef as React.RefObject<HTMLDivElement>}
						className={styles.svgContainer}
						style={imageStyle}
						dangerouslySetInnerHTML={{ __html: svgResult.content }}
					/>
				)
			} catch (error) {
				console.warn("Error rendering SVG:", error)
				// Fallback to image tag if SVG processing fails
				return (
					<img
						ref={imageRef as React.RefObject<HTMLImageElement>}
						src={src}
						alt=""
						className={styles.image}
						style={imageStyle}
					/>
				)
			}
		}

		return (
			<img
				ref={imageRef as React.RefObject<HTMLImageElement>}
				src={src}
				alt=""
				className={styles.image}
				style={imageStyle}
			/>
		)
	}, [
		src,
		info?.ext?.ext,
		swipeState.isSwipeToClose,
		swipeState.currentY,
		swipeState.startY,
		transform.x,
		transform.y,
		transform.scale,
		isTransitioning,
		styles.image,
		styles.svgContainer,
	])

	const containerStyle = {
		transition: isTransitioning ? "background-color 0.3s ease" : "none",
	}

	if (!src) {
		return (
			<div className={styles.container} style={containerStyle}>
				<div className={styles.imageContainer}>
					<div className={styles.imageViewer}>
						<button className={styles.closeButton} onClick={onClose} type="button">
							<IconX />
						</button>
						<div className={styles.emptyContainer}>
							<div>{t("chat.NoContent", { ns: "message" })}</div>
						</div>
					</div>
				</div>
				{renderActionBar && (
					<div className={styles.actionBarContainer}>{renderActionBar()}</div>
				)}
			</div>
		)
	}

	return (
		<div className={styles.container} style={containerStyle}>
			{/* Image viewer area */}
			<div className={styles.imageContainer}>
				<div
					ref={containerRef}
					className={styles.imageViewer}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					{/* Close button */}
					<button className={styles.closeButton} onClick={onClose} type="button">
						<IconX />
					</button>

					{/* Image content */}
					{ImageNode}

					{/* Loading overlay */}
					{loading && (
						<div className={styles.loadingContainer}>
							<div className={styles.progressContainer}>
								<ProgressBar
									percent={progress}
									style={{
										"--fill-color": "#1677ff",
										"--track-color": "rgba(255, 255, 255, 0.3)",
										width: "200px",
									}}
								/>
								<div className={styles.progressText}>{progress}%</div>
							</div>
							<div className={styles.progressText}>
								{t("chat.imagePreview.hightImageConverting", { num: progress })}
							</div>
							<div className={styles.progressText}>
								{t("chat.imagePreview.convertingCloseTip")}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Action bar at bottom */}
			{renderActionBar && (
				<div className={styles.actionBarContainer}>{renderActionBar()}</div>
			)}
		</div>
	)
}

export default memo(ImageViewer)
