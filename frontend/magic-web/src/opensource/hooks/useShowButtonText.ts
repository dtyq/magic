import { useState, useEffect } from "react"

/**
 * 自定义 hook，用于检测屏幕宽度是否大于等于 1400px
 * 主要用于控制按钮文本的显示/隐藏
 *
 * @returns {boolean} 当屏幕宽度 >= 1400px 时返回 true，否则返回 false
 */
export function useShowButtonText(minWidth: number = 1400): boolean {
	const [showButtonText, setShowButtonText] = useState(() => window.innerWidth >= minWidth)

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`)

		const handleChange = (e: MediaQueryListEvent) => {
			setShowButtonText(e.matches)
		}

		// Set initial value
		setShowButtonText(mediaQuery.matches)

		// Add listener
		mediaQuery.addEventListener("change", handleChange)

		// Cleanup
		return () => {
			mediaQuery.removeEventListener("change", handleChange)
		}
	}, [])

	return showButtonText
}
