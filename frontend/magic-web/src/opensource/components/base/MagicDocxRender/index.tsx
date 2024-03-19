import { memo, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { IconAlertCircle } from "@tabler/icons-react"
import { Spin } from "antd"
import { useTranslation } from "react-i18next"

// Types
import type { MagicDocxRenderProps } from "./types"

// Styles
import { useStyles } from "./styles"

// Hooks
import { useMagicDocxRender } from "./hooks/useMagicDocxRender"
import { useKeyboardControls } from "./hooks/useKeyboardControls"
import { useTouchGestures } from "./hooks/useTouchGestures"
import { useContainerSize } from "./hooks/useContainerSize"

// Components
import Toolbar from "./components/Toolbar"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"

/**
 * MagicDocxRender - A component for previewing docx files with interactive features
 *
 * @param props - Component props
 * @returns JSX.Element
 */
function MagicDocxRender(props: MagicDocxRenderProps) {
	const {
		height,
		width,
		className,
		style,
		showToolbar = true,
		enableKeyboard = true,
		enableTouchGestures = true,
		darkMode = false,
		showDownload = true,
		showFullscreen = true,
		showReload = true,
	} = props

	const { t } = useTranslation("component")
	const { styles } = useStyles()
	const { state, containerRef, viewerRef, contentRef, handlers } = useMagicDocxRender(props)
	const { isCompactMode } = useContainerSize({ containerRef })
	const isMobile = useIsMobile()

	// Container styles - handle percentage heights properly
	const containerStyles = {
		height,
		width: width || "100%",
		minHeight: height === "100%" ? "100%" : "200px",
	}

	// Combine class names
	const containerClassName = `${styles.container} ${darkMode ? "dark-mode" : ""} ${
		className || ""
	}`

	// Keyboard controls
	useKeyboardControls({
		enableKeyboard,
		goToPrevSection: handlers.goToPrevSection,
		goToNextSection: handlers.goToNextSection,
		zoomIn: handlers.zoomIn,
		zoomOut: handlers.zoomOut,
		resetZoom: handlers.resetZoom,
		toggleFullscreen: handlers.toggleFullscreen,
	})

	// Touch gestures
	useTouchGestures({
		scale: state.scale,
		setScale: (scale) => handlers.setZoomScale(scale * 100),
		minScale: props.minScale || 0.3,
		maxScale: props.maxScale || 3.0,
		enabled: enableTouchGestures,
		viewerRef,
		setIsStabilizing: () => undefined,
	})

	// Pre-computed layout decisions
	const scaledContentWidth = contentRef.current?.scrollWidth
		? contentRef.current.scrollWidth * state.scale
		: 0
	const viewerWidth = viewerRef.current?.clientWidth || 0
	const hasHorizontalOverflow = scaledContentWidth > viewerWidth
	const [textAlign, setTextAlign] = useState<"center" | "left">("center")

	useEffect(() => {
		// Always use left alignment on mobile to prevent content cutoff
		// Allow horizontal scrolling to view full content
		if (isMobile || viewerWidth < 768) {
			setTextAlign("left")
		} else {
			// Desktop: center when no overflow, left when overflow
			setTextAlign(hasHorizontalOverflow ? "left" : "center")
		}
	}, [isMobile, state.scale, hasHorizontalOverflow, viewerWidth])

	// Render loading state
	if (state.loading) {
		return (
			<div className={containerClassName} style={{ ...containerStyles, ...style }}>
				<div className={styles.loadingContainer}>
					<Spin
						size="large"
						tip={t("magicDocxRender.status.loading")}
						className={styles.loadingSpinner}
					/>
				</div>
			</div>
		)
	}

	// Render error state
	if (state.error) {
		return (
			<div className={containerClassName} style={{ ...containerStyles, ...style }}>
				<div className={styles.errorContainer}>
					<IconAlertCircle className={styles.errorIcon} />
					<div className={styles.errorMessage}>
						{t("magicDocxRender.error.failedToLoad")}
					</div>
					<div className={styles.errorDescription}>{state.error.message}</div>
					<button onClick={handlers.reload} className={styles.retryButton} type="button">
						{t("magicDocxRender.status.retry")}
					</button>
				</div>
			</div>
		)
	}

	// Render docx content with toolbar
	return (
		<div
			ref={containerRef}
			className={containerClassName}
			style={{ ...containerStyles, ...style }}
		>
			{showToolbar && (
				<Toolbar
					scale={state.scale}
					minScale={props.minScale || 0.3}
					maxScale={props.maxScale || 3.0}
					scaleStep={props.scaleStep || 0.1}
					currentSection={state.currentSection}
					totalSections={state.totalSections}
					isCompactMode={isCompactMode}
					zoomIn={handlers.zoomIn}
					zoomOut={handlers.zoomOut}
					setZoomScale={handlers.setZoomScale}
					reload={handlers.reload}
					downloadFile={handlers.downloadFile}
					toggleFullscreen={handlers.toggleFullscreen}
					goToSection={handlers.goToSection}
					goToPrevSection={handlers.goToPrevSection}
					goToNextSection={handlers.goToNextSection}
					styles={styles}
					showDownload={showDownload}
					showFullscreen={showFullscreen}
					showReload={showReload}
				/>
			)}

			<div
				ref={viewerRef}
				className={styles.viewer}
				style={{
					opacity: state.isAutoScaling ? 0.7 : 1,
					transition: "opacity 0.2s ease-in-out",
					overflowX: hasHorizontalOverflow ? "auto" : "hidden",
					overflowY: "auto",
					textAlign,
					WebkitOverflowScrolling: isMobile ? "touch" : undefined,
				}}
			>
				<div
					ref={contentRef}
					className={styles.content}
					style={{
						transform: `scale(${state.scale})`,
						transformOrigin:
							isMobile || viewerWidth < 768
								? "top left"
								: hasHorizontalOverflow
									? "top left"
									: "top center",
						transition: state.isStabilizing ? "none" : "transform 0.2s ease",
					}}
				/>
			</div>
		</div>
	)
}

MagicDocxRender.displayName = "MagicDocxRender"

const MemoizedMagicDocxRender = memo(observer(MagicDocxRender))

export default MemoizedMagicDocxRender
export type { MagicDocxRenderProps } from "./types"
