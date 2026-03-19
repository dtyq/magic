import { useState, useEffect, useCallback, useMemo } from "react"
import { useMemoizedFn } from "ahooks"

// Types
import type { PanelState } from "../types"

// Constants
import { createDefaultConfig } from "../constants"
import { I18nTexts } from "../i18n"

interface UsePanelLayoutProps {
	triggerRef?: React.RefObject<HTMLElement>
	currentState: PanelState
	t: I18nTexts
}

interface PanelLayoutStyle {
	position: "fixed"
	top?: number
	bottom?: number
	left?: number
	right?: number
	width: number
	height: number
	transformOrigin: string
	zIndex: number
}

/**
 * usePanelLayout - Panel layout and positioning management
 *
 * @param props - Layout configuration
 * @returns Layout styles and utilities
 */
export function usePanelLayout(props: UsePanelLayoutProps) {
	const { triggerRef, currentState, t } = props

	const defaultConfig = useMemo(() => {
		return createDefaultConfig(t)
	}, [t])

	// Layout state
	const [layoutStyle, setLayoutStyle] = useState<PanelLayoutStyle>({
		position: "fixed",
		top: 0,
		width: defaultConfig.width,
		height: defaultConfig.height,
		transformOrigin: "top left",
		zIndex: 1001,
	})

	// Use fixed height - no dynamic calculation needed
	const getFixedHeight = useCallback(() => {
		return defaultConfig.height
	}, [defaultConfig])

	// Calculate position relative to trigger
	const calculatePosition = useMemoizedFn(() => {
		if (!triggerRef?.current) {
			return
		}

		const triggerRect = triggerRef.current.getBoundingClientRect()

		const viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		}

		// Use fixed height
		const panelHeight = getFixedHeight()

		// Position horizontally (left aligned with trigger start for better character alignment)
		let left = triggerRect.left

		// Ensure panel stays within viewport horizontally
		if (left < 8) {
			left = 8
		} else if (left + defaultConfig.width > viewport.width - 8) {
			left = viewport.width - defaultConfig.width - 8
		}

		// Smart vertical positioning - choose up or down based on available space
		const spaceAbove = triggerRect.top
		const spaceBelow = viewport.height - triggerRect.bottom
		const padding = 4 // Reduced padding for closer positioning

		const verticalStyle: { top?: number; bottom?: number } = {}
		let transformOrigin = "top center"

		if (spaceBelow >= panelHeight + padding) {
			// Enough space below - expand downward
			verticalStyle.top = triggerRect.bottom + padding
			transformOrigin = "top center"
		} else if (spaceAbove >= panelHeight + padding) {
			// Not enough space below, but enough above - expand upward
			verticalStyle.bottom = viewport.height - triggerRect.top + padding
			transformOrigin = "bottom center"
		} else {
			// Limited space both directions - choose the larger space
			if (spaceBelow > spaceAbove) {
				// More space below - position as close as possible
				verticalStyle.top = triggerRect.bottom + 2
				transformOrigin = "top center"
			} else {
				// More space above - position as close as possible
				verticalStyle.bottom = viewport.height - triggerRect.top + 2
				transformOrigin = "bottom center"
			}
		}

		setLayoutStyle((prev) => {
			const newStyle = {
				...prev,
				left,
				...verticalStyle,
				// Clear the opposite positioning property
				...(verticalStyle.top !== undefined ? { bottom: undefined } : { top: undefined }),
				height: panelHeight,
				transformOrigin,
			}

			return newStyle
		})
	})

	// Update position when trigger or content changes
	useEffect(() => {
		calculatePosition()
	}, [calculatePosition, currentState])

	// Force recalculate position when layout is initialized
	useEffect(() => {
		// Add a small delay to ensure DOM is ready
		const timeoutId = setTimeout(() => {
			calculatePosition()
		}, 10)

		return () => clearTimeout(timeoutId)
	}, [calculatePosition])

	// Handle window resize
	useEffect(() => {
		const handleResize = () => {
			calculatePosition()
		}

		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	}, [calculatePosition])

	// Computed styles for different parts
	const computedStyles = useMemo(() => {
		const containerHeight = layoutStyle.height
		const searchHeaderHeight = defaultConfig.headerHeight // 30px search header
		const keyboardHintsHeight = 36 // 32px hints + 4px margin (reduced)
		const breadcrumbHeight = 16 // Reduced breadcrumb height
		const panelPadding = 4 // Reduced padding

		// Calculate available height for menu list
		const reservedHeight =
			searchHeaderHeight + keyboardHintsHeight + breadcrumbHeight + panelPadding
		const menuListHeight = Math.max(containerHeight - reservedHeight, 160)

		return {
			container: layoutStyle,
			menuList: {
				height: menuListHeight,
			},
		}
	}, [layoutStyle, defaultConfig])

	// No height animation needed for fixed height panel

	// Track expansion direction for animation classes
	const [expandDirection, setExpandDirection] = useState<"up" | "down">("down")

	// Update expand direction when layout changes
	useEffect(() => {
		if (layoutStyle.top !== undefined) {
			setExpandDirection("down")
		} else if (layoutStyle.bottom !== undefined) {
			setExpandDirection("up")
		}
	}, [layoutStyle.top, layoutStyle.bottom])

	return {
		layoutStyle: computedStyles.container,
		menuListStyle: computedStyles.menuList,
		expandDirection,
		calculatePosition,
		hasTriggerRef: !!triggerRef,
	}
}
