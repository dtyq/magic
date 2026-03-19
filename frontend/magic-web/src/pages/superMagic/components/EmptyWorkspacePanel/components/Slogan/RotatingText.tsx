import React, { useEffect, useState, useMemo, useRef, memo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/lib/utils"

// Design constants from Figma (Magic---SuperMagic-Shadcn)
const DESIGN_TOKENS = {
	fontSize: {
		mobile: "20px",
		desktop: "36px", // text/4xl/font-size
	},
	colors: {
		foreground: "#0a0a0a", // base/foreground
		white: "#ffffff", // tailwind colors/base/white
		gradientStart: "#315cec", // palette/brand/--semi-brand-5
		gradientEnd: "#6431e5", // palette/violet/--semi-violet-5
	},
} as const

export interface RotatingTextProps {
	/** 静态前缀文本 */
	prefix?: string
	/** 动态切换的文本数组 */
	texts: string[]
	/** 切换间隔时间（毫秒） */
	interval?: number
	/** 字符间的交错延迟（秒） */
	staggerDelay?: number
	/** 是否自动播放 */
	autoPlay?: boolean
}

const RotatingText: React.FC<RotatingTextProps> = ({
	prefix = "",
	texts,
	interval = 3000,
	staggerDelay = 0.03,
	autoPlay = true,
}) => {
	const isMobile = useIsMobile()
	const [currentIndex, setCurrentIndex] = useState(0)
	const wrapperRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLSpanElement>(null)
	const [animateWidth, setAnimateWidth] = useState<number | "auto">("auto")
	const isFirstMount = useRef(true)
	const [isInitialized, setIsInitialized] = useState(false)
	const [windowWidth, setWindowWidth] = useState(() =>
		typeof window !== "undefined" ? window.innerWidth : 1280,
	)

	// 将文本分割为字符数组，并预计算延迟
	const currentTextChars = useMemo(() => {
		const text = texts[currentIndex] || ""
		let chars: string[] = []

		// 使用 Intl.Segmenter 支持 emoji 和中文字符（Safari 14.1+）
		if (typeof Intl !== "undefined" && Intl.Segmenter) {
			const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" })
			chars = Array.from(segmenter.segment(text), (segment) => segment.segment)
		} else {
			// 降级处理：使用 Array.from
			chars = Array.from(text)
		}

		// 标记空格并预计算非空格字符索引
		const charsWithSpace = chars.map((char) => ({
			char,
			isSpace: char === " " || char === "\u00A0",
		}))

		// 预计算所有非空格字符的位置（避免在 map 中重复 filter）
		const nonSpaceIndices: number[] = []
		charsWithSpace.forEach((item, idx) => {
			if (!item.isSpace) {
				nonSpaceIndices.push(idx)
			}
		})

		const totalNonSpaceCount = nonSpaceIndices.length

		// 为每个字符添加预计算的延迟
		return charsWithSpace.map((item, index) => {
			if (item.isSpace) {
				return { ...item, delay: 0 }
			}
			// 找到当前字符在非空格字符中的索引
			const nonSpaceIndex = nonSpaceIndices.indexOf(index)
			// 从右到左的延迟
			const delayFromRight = (totalNonSpaceCount - 1 - nonSpaceIndex) * staggerDelay
			return { ...item, delay: delayFromRight }
		})
	}, [texts, currentIndex, staggerDelay])

	// 初始渲染后，立即测量并设置实际宽度
	useEffect(() => {
		if (!isFirstMount.current) return

		// 立即测量内容宽度
		const measureWidth = () => {
			if (contentRef.current && wrapperRef.current) {
				const contentWidth = contentRef.current.scrollWidth
				const wrapperStyle = window.getComputedStyle(wrapperRef.current)
				const paddingLeft = parseFloat(wrapperStyle.paddingLeft)
				const paddingRight = parseFloat(wrapperStyle.paddingRight)
				const initialWidth = contentWidth + paddingLeft + paddingRight

				setAnimateWidth(initialWidth)
				isFirstMount.current = false

				// 延迟启用动画，确保初始宽度设置完成后才启用过渡效果
				setTimeout(() => {
					setIsInitialized(true)
				}, 50)
			}
		}

		// 使用双重 RAF 确保内容已完全渲染
		requestAnimationFrame(() => {
			requestAnimationFrame(measureWidth)
		})
	}, [])

	// 在切换时锁定当前宽度
	useEffect(() => {
		// 跳过初始渲染
		if (isFirstMount.current) {
			return
		}

		// 锁定当前宽度
		if (wrapperRef.current) {
			const currentWidth = wrapperRef.current.offsetWidth
			setAnimateWidth(currentWidth)
		}
	}, [currentIndex])

	// 旧文本退出完成后，获取新文本宽度并触发动画
	const handleExitComplete = () => {
		// 使用单次 RAF + setTimeout 组合，比双重 RAF 更可靠且性能更好
		requestAnimationFrame(() => {
			// 微任务确保 DOM 更新和布局计算完成
			setTimeout(() => {
				if (contentRef.current && wrapperRef.current) {
					// 使用 scrollWidth 获取包含溢出内容的完整宽度
					const contentWidth = contentRef.current.scrollWidth
					// 获取 wrapper 的 padding（getComputedStyle 会触发强制重排，但不可避免）
					const wrapperStyle = window.getComputedStyle(wrapperRef.current)
					const paddingLeft = parseFloat(wrapperStyle.paddingLeft)
					const paddingRight = parseFloat(wrapperStyle.paddingRight)
					// 总宽度 = 内容宽度 + 左右 padding
					const newWidth = contentWidth + paddingLeft + paddingRight
					setAnimateWidth(newWidth)
				}
			}, 0)
		})
	}

	// 监听窗口大小变化（带防抖）
	useEffect(() => {
		let timeoutId: NodeJS.Timeout

		const handleResize = () => {
			// 防抖：300ms 内只执行最后一次
			clearTimeout(timeoutId)
			timeoutId = setTimeout(() => {
				setWindowWidth(window.innerWidth)
			}, 300)
		}

		window.addEventListener("resize", handleResize)
		return () => {
			window.removeEventListener("resize", handleResize)
			clearTimeout(timeoutId)
		}
	}, [])

	// 计算是否需要换行显示（基于文本宽度）
	const isNeedWrap = useMemo(() => {
		// 计算父元素的实际可用宽度
		const deviceWidth = windowWidth
		const parentMaxWidth = 1280
		const parentWidthPercent = 0.9
		const actualParentWidth = Math.min(parentMaxWidth, deviceWidth * parentWidthPercent)

		// 创建临时测量元素
		const measureElement = document.createElement("div")
		measureElement.style.position = "absolute"
		measureElement.style.visibility = "hidden"
		measureElement.style.whiteSpace = "nowrap"
		measureElement.style.display = "inline-flex"
		measureElement.style.alignItems = "center"
		measureElement.style.gap = "14px"
		document.body.appendChild(measureElement)

		// 测量静态前缀宽度
		const prefixSpan = document.createElement("span")
		prefixSpan.style.fontSize = isMobile
			? DESIGN_TOKENS.fontSize.mobile
			: DESIGN_TOKENS.fontSize.desktop
		prefixSpan.style.fontWeight = "600"
		prefixSpan.textContent = prefix
		measureElement.appendChild(prefixSpan)
		const prefixWidth = prefixSpan.offsetWidth

		// 找出最长的文本
		const longestText = texts.reduce((longest, current) => {
			return current.length > longest.length ? current : longest
		}, "")

		// 测量最长文本的动态文本框宽度
		const dynamicSpan = document.createElement("span")
		dynamicSpan.style.fontSize = isMobile
			? DESIGN_TOKENS.fontSize.mobile
			: DESIGN_TOKENS.fontSize.desktop
		dynamicSpan.style.fontWeight = "600"
		dynamicSpan.style.padding = isMobile ? "4px 14px" : "0px 14px"
		dynamicSpan.style.borderRadius = "12px"
		dynamicSpan.textContent = longestText
		measureElement.appendChild(dynamicSpan)
		const dynamicWidth = dynamicSpan.offsetWidth

		// 清理临时元素
		document.body.removeChild(measureElement)

		// 计算总宽度（前缀 + gap + 动态文本）
		const totalWidth = prefixWidth + 14 + dynamicWidth

		// 判断是否需要换行
		return totalWidth > actualParentWidth
	}, [prefix, texts, windowWidth, isMobile])

	// 自动切换逻辑
	useEffect(() => {
		if (!autoPlay || texts.length <= 1) return

		const timer = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % texts.length)
		}, interval)

		return () => clearInterval(timer)
	}, [autoPlay, texts.length, interval])

	return (
		<div
			className={cn(
				isNeedWrap
					? "inline-flex flex-col items-center justify-center gap-2.5"
					: "flex items-center justify-center gap-2",
			)}
		>
			{/* 静态前缀文本 */}
			<span
				className={cn(
					"inline-block whitespace-nowrap font-medium",
					isMobile ? "text-[20px]" : "text-4xl",
				)}
				style={{ color: DESIGN_TOKENS.colors.foreground }}
			>
				{prefix}
			</span>

			{/* 动态文本容器 - 最外层使用 motion.div 负责宽度动画和样式 */}
			<motion.div
				ref={wrapperRef}
				className={cn(
					"relative flex items-center overflow-hidden rounded-[12px]",
					"backface-hidden transform-gpu",
					isMobile ? "h-[28px] px-3.5" : "h-[54px] px-2.5",
				)}
				style={{
					backgroundImage: `linear-gradient(135.7deg, ${DESIGN_TOKENS.colors.gradientStart} 18.884%, ${DESIGN_TOKENS.colors.gradientEnd} 76.71%)`,
				}}
				initial={{ width: "auto" }}
				animate={{ width: animateWidth }}
				transition={
					isInitialized
						? {
							type: "spring",
							damping: 25,
							stiffness: 300,
						}
						: { duration: 0 }
				}
			>
				<AnimatePresence mode="wait" initial={false} onExitComplete={handleExitComplete}>
					<motion.span
						ref={contentRef}
						key={currentIndex}
						className={cn(
							"flex items-center whitespace-nowrap font-medium",
							isMobile ? "text-[20px]" : "text-4xl",
						)}
						style={{ color: DESIGN_TOKENS.colors.white }}
						initial={{ opacity: 1 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 1 }}
					>
						{currentTextChars.map((item, index) => {
							const { char, isSpace, delay } = item
							// 为每个字符生成唯一的 key
							const uniqueKey = `text${currentIndex}-${index}-${char}`

							// 如果是空格，直接渲染，不添加动画
							if (isSpace) {
								return (
									<span key={uniqueKey} className="inline-block whitespace-pre">
										{char}
									</span>
								)
							}

							// 使用预计算的 delay
							// 首次渲染时只使用 opacity 动画，避免 y 偏移影响宽度测量
							const isFirstRender = currentIndex === 0 && !isInitialized
							return (
								<motion.span
									key={uniqueKey}
									className="inline-block will-change-transform"
									initial={
										isFirstRender
											? { y: 0, opacity: 0 }
											: { y: "100%", opacity: 0 }
									}
									animate={{
										y: 0,
										opacity: 1,
										transition: {
											type: "spring",
											damping: 25,
											stiffness: 300,
											delay,
										},
									}}
									exit={{
										y: "-100%",
										opacity: 0,
										transition: {
											type: "spring",
											damping: 25,
											stiffness: 300,
											delay,
										},
									}}
								>
									{char}
								</motion.span>
							)
						})}
					</motion.span>
				</AnimatePresence>
			</motion.div>
		</div>
	)
}
export default memo(RotatingText)
