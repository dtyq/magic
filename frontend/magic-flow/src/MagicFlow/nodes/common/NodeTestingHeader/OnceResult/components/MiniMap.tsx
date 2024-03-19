import { NodeTestConfig } from "@/MagicFlow/context/NodeTesingContext/Context"
import clsx from "clsx"
import React, { useEffect, useRef, useState } from "react"
import styles from "../../index.module.less"
import { TestingResultRow } from "../../useTesting"
import { isComplexValue } from "../utils"

// 小地图导航组件
export const MiniMap = ({
	contentRef,
	inputList,
	outputList,
	debugLogs,
	allowDebug,
	testingResult,
}: {
	contentRef: React.RefObject<HTMLDivElement>
	inputList: TestingResultRow[]
	outputList: TestingResultRow[]
	debugLogs?: TestingResultRow[]
	allowDebug: boolean
	testingResult?: NodeTestConfig
}) => {
	const [scrollPosition, setScrollPosition] = useState(0)
	const [visibleRatio, setVisibleRatio] = useState(0.3) // 可视区域占整体内容的比例
	const [isDragging, setIsDragging] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const [itemPositions, setItemPositions] = useState<{ [key: string]: number }>({})
	const miniMapRef = useRef<HTMLDivElement>(null)

	// 计算每个项目在滚动容器中的相对位置
	useEffect(() => {
		const content = contentRef.current
		if (!content) return

		// 等待内容渲染完成
		setTimeout(() => {
			// 获取滚动容器中每个项的位置信息
			const items = content.querySelectorAll("[data-item-key]")
			const contentHeight = content.scrollHeight
			const positions: { [key: string]: number } = {}

			items.forEach((item) => {
				const key = item.getAttribute("data-item-key")
				if (key) {
					// 计算项目顶部相对于容器总高度的百分比位置
					const rect = item.getBoundingClientRect()
					const contentRect = content.getBoundingClientRect()
					const offsetTop = rect.top - contentRect.top + content.scrollTop
					positions[key] = offsetTop / contentHeight
				}
			})

			setItemPositions(positions)
		}, 50)
	}, [contentRef, inputList, outputList, debugLogs])

	// 监听滚动事件，更新小地图上的指示器位置
	useEffect(() => {
		const content = contentRef.current
		if (!content) return

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = content
			const ratio = clientHeight / scrollHeight
			// 修正：使用精确的百分比位置，而不是依赖滚动条位置
			const position = scrollTop / scrollHeight

			setScrollPosition(position)
			setVisibleRatio(ratio)
		}

		// 初始计算
		handleScroll()

		content.addEventListener("scroll", handleScroll)
		return () => {
			content.removeEventListener("scroll", handleScroll)
		}
	}, [contentRef])

	// 处理小地图上的点击和拖动
	const handleMiniMapInteraction = (e: React.MouseEvent | React.TouchEvent) => {
		const miniMap = miniMapRef.current
		const content = contentRef.current
		if (!miniMap || !content) return

		// 获取鼠标/触摸在小地图上的位置
		let clientY = 0
		if ("clientY" in e) {
			clientY = e.clientY // 鼠标事件
		} else {
			clientY = e.touches[0].clientY // 触摸事件
		}

		const { top, height } = miniMap.getBoundingClientRect()
		const relativePosition = (clientY - top) / height

		// 修正：直接设置到内容的对应百分比位置
		content.scrollTop = relativePosition * content.scrollHeight
	}

	// 跳转到指定键的位置
	const jumpToKey = (key: string) => {
		const content = contentRef.current
		if (!content || !itemPositions[key]) return

		const position = itemPositions[key]
		const scrollPosition = position * content.scrollHeight
		content.scrollTop = scrollPosition
	}

	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true)
		handleMiniMapInteraction(e)

		// 防止文本选择
		e.preventDefault()
	}

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging) {
			handleMiniMapInteraction(e)
		}
	}

	const handleMouseUp = () => {
		setIsDragging(false)
	}

	// 在组件挂载时添加全局事件监听
	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove as any)
			document.addEventListener("mouseup", handleMouseUp)
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove as any)
			document.removeEventListener("mouseup", handleMouseUp)
		}
	}, [isDragging])

	// 渲染数据项，突出显示复杂结构
	const renderItems = (items: TestingResultRow[], isError: boolean = false, section: string) => {
		return items?.map?.((item, index) => {
			const isComplex = isComplexValue(item.value)
			const itemKey = `${section}-${item.key}-${index}`
			// 计算相对位置
			const position = itemPositions[itemKey] || 0

			return (
				<div
					key={index}
					className={clsx(styles.miniItem, {
						[styles.miniError]: isError,
						[styles.miniComplex]: isComplex,
					})}
					title={item.key}
					style={{
						top: `${position * 100}%`,
						position: "absolute",
						width: "calc(100% - 8px)",
						left: "4px",
					}}
					onClick={(e) => {
						e.stopPropagation()
						jumpToKey(itemKey)
					}}
				>
					{/* 显示所有键名，不仅仅是复杂结构的 */}
					<span
						className={clsx(styles.miniItemKey, {
							[styles.miniItemKeyComplex]: isComplex,
						})}
						onClick={(e) => {
							e.stopPropagation()
							jumpToKey(itemKey)
						}}
					>
						{item.key}
					</span>
				</div>
			)
		})
	}

	// 创建内容的缩略预览元素
	const renderMiniContent = () => {
		// 计算每个部分的项目数量
		const inputCount = inputList?.length || 0
		const outputCount = outputList?.length || 0
		const debugCount = debugLogs?.length || 0

		// 计算每个部分应占的高度比例
		const totalItems = inputCount + outputCount + debugCount
		const inputRatio = totalItems > 0 ? inputCount / totalItems : 0
		const outputRatio = totalItems > 0 ? outputCount / totalItems : 0
		const debugRatio = totalItems > 0 ? debugCount / totalItems : 0

		return (
			<div className={styles.miniMapContent}>
				{/* 输入部分的缩略图，不显示标题 */}
				<div className={styles.miniSection} style={{ height: `${inputRatio * 100}%` }}>
					<div className={styles.miniItems}>{renderItems(inputList, false, "input")}</div>
				</div>

				{/* 输出部分的缩略图，不显示标题 */}
				<div className={styles.miniSection} style={{ height: `${outputRatio * 100}%` }}>
					<div className={styles.miniItems}>
						{renderItems(outputList, !testingResult?.success, "output")}
					</div>
				</div>

				{/* 调试日志部分的缩略图，不显示标题 */}
				{allowDebug && debugLogs && debugLogs.length > 0 && (
					<div className={styles.miniSection} style={{ height: `${debugRatio * 100}%` }}>
						<div className={styles.miniItems}>
							{renderItems(debugLogs, false, "debug")}
						</div>
					</div>
				)}
			</div>
		)
	}

	return (
		<div
			className={clsx(styles.miniMap, {
				[styles.miniMapHovered]: isHovered || isDragging,
			})}
			ref={miniMapRef}
			onMouseDown={handleMouseDown}
			onTouchStart={handleMiniMapInteraction as any}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* 显示内容缩略图 */}
			{renderMiniContent()}

			{/* 指示可视区域的指示器 */}
			<div
				className={styles.miniMapIndicator}
				style={{
					top: `${scrollPosition * 100}%`,
					height: `${visibleRatio * 100}%`,
					opacity: isDragging ? 0.8 : 0.5,
				}}
			/>
		</div>
	)
}
