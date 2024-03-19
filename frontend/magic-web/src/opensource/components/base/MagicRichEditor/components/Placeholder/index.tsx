import { memo, useState, useEffect } from "react"
import { useStyles } from "./styles"

export interface PlaceholderProps {
	/**
	 * 占位符文本
	 */
	placeholder: string
	/**
	 * 是否显示占位符
	 */
	show: boolean
	/**
	 * 打字机效果的打字速度（毫秒/字符）
	 * @default 80
	 */
	typingSpeed?: number
	/**
	 * 是否启用打字机效果
	 * @default true
	 */
	enableTypingEffect?: boolean
}

/**
 * 富文本编辑器占位符组件
 *
 * 用于在编辑器为空时显示提示文本
 * 根据编辑器的焦点状态显示不同的颜色
 * 支持打字机动画效果
 */
const Placeholder = memo(
	({ placeholder, show, typingSpeed = 80, enableTypingEffect = true }: PlaceholderProps) => {
		const { styles } = useStyles()
		const [displayedText, setDisplayedText] = useState("")
		const [currentIndex, setCurrentIndex] = useState(0)

		// 打字机效果实现
		useEffect(() => {
			// 如果不显示或不启用打字机效果，直接显示完整文本
			if (!show || !enableTypingEffect) {
				setDisplayedText(placeholder)
				setCurrentIndex(placeholder.length)
				return
			}

			// 重置状态，准备开始新的打字动画
			setDisplayedText("")
			setCurrentIndex(0)
		}, [show, placeholder, enableTypingEffect])

		useEffect(() => {
			// 如果不显示、不启用打字机效果或已经显示完整，则不执行动画
			if (!show || !enableTypingEffect || currentIndex >= placeholder.length) {
				return
			}

			const timer = setTimeout(() => {
				setDisplayedText((prev) => prev + placeholder[currentIndex])
				setCurrentIndex((prev) => prev + 1)
			}, typingSpeed)

			return () => clearTimeout(timer)
		}, [currentIndex, placeholder, show, typingSpeed, enableTypingEffect])

		// 如果不显示占位符则直接返回null
		if (!show) return null

		return (
			<div
				className={styles.placeholder}
				data-testid="rich-editor-placeholder"
				style={{
					position: "absolute",
					top: -2 /* 微调后的垂直位置 */,
					left: "0.1em" /* 微调后的水平位置 */,
					padding: "0.15em" /* 添加内边距 */,
					pointerEvents: "none",
					zIndex: 0,
					color: "#bfbfbf",
				}}
			>
				{enableTypingEffect ? displayedText : placeholder}
				{/* 打字光标效果 */}
				{enableTypingEffect && currentIndex < placeholder.length && (
					<span
						style={{
							display: "inline-block",
							width: "1px",
							height: "1em",
							backgroundColor: "#bfbfbf",
							marginLeft: "2px",
							animation: "blink 1s step-end infinite",
						}}
					/>
				)}
			</div>
		)
	},
)

export default Placeholder
