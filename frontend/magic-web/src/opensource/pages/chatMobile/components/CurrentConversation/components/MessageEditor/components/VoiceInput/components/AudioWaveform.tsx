import { memo, useEffect, useRef } from "react"
import { createStyles } from "antd-style"
import type { AudioWaveformData } from "../types"

const useStyles = createStyles(({ css }) => ({
	container: css`
		display: flex;
		align-items: center;
		justify-content: center;
	`,

	canvas: css`
		border-radius: 4px;
	`,
}))

interface AudioWaveformProps {
	data: AudioWaveformData
	className?: string
	color?: string
	backgroundColor?: string
	width?: number
	height?: number
	barWidth?: number
	barSpacing?: number
}

const AudioWaveform = memo(
	({
		data,
		className,
		color = "#315CEC",
		backgroundColor = "rgba(49, 92, 236, 0.1)",
		width = 300,
		height = 60,
		barWidth = 3,
		barSpacing = 2,
	}: AudioWaveformProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null)

		useEffect(() => {
			const canvas = canvasRef.current
			if (!canvas) return

			const ctx = canvas.getContext("2d")
			if (!ctx) return

			// 设置高DPI显示支持
			const dpr = window.devicePixelRatio || 1
			canvas.width = width * dpr
			canvas.height = height * dpr
			ctx.scale(dpr, dpr)

			// 设置画布样式尺寸
			canvas.style.width = `${width}px`
			canvas.style.height = `${height}px`

			// 清除画布
			ctx.clearRect(0, 0, width, height)

			// 根据设计稿，绘制密集的波形条
			const totalBars = Math.floor(width / (barWidth + barSpacing))
			const centerY = height / 2

			// 如果有实时数据，使用滑动窗口显示最近的数据
			const dataToShow =
				data.levels.length > totalBars ? data.levels.slice(-totalBars) : data.levels

			// 绘制波形条
			for (let i = 0; i < totalBars; i++) {
				const x = i * (barWidth + barSpacing)

				// 如果有实时数据，使用实时数据；否则使用低强度的背景条
				const hasRealData = dataToShow.length > 0 && i >= totalBars - dataToShow.length
				const dataIndex = hasRealData ? i - (totalBars - dataToShow.length) : -1
				const level = hasRealData ? dataToShow[dataIndex] : Math.random() * 15 + 5

				// 改进音量映射，使用对数缩放提高动态范围
				let normalizedLevel = hasRealData ? level : level * 0.3
				// 应用对数缩放，让微弱的声音也能清晰显示
				if (hasRealData && normalizedLevel > 0) {
					normalizedLevel = 20 * Math.log10((normalizedLevel + 1) / 101) + 100
					normalizedLevel = Math.max(normalizedLevel, 5) // 最小可见高度
				}

				// 计算条高，降低整体高度
				const barHeight = Math.max((normalizedLevel / 100) * height * 0.5, 2)

				// 使用不同颜色和透明度
				if (hasRealData) {
					// 实时数据使用渐变效果
					const gradient = ctx.createLinearGradient(
						0,
						centerY - barHeight / 2,
						0,
						centerY + barHeight / 2,
					)
					gradient.addColorStop(0, color)
					gradient.addColorStop(1, color + "80") // 添加透明度
					ctx.fillStyle = gradient
				} else {
					ctx.fillStyle = backgroundColor
				}

				// 绘制圆角矩形（兼容性处理）
				ctx.beginPath()
				if (ctx.roundRect) {
					ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, barWidth / 2)
				} else {
					// 兼容不支持roundRect的浏览器
					ctx.rect(x, centerY - barHeight / 2, barWidth, barHeight)
				}
				ctx.fill()
			}
		}, [data, width, height, barWidth, barSpacing, color, backgroundColor])

		const { styles, cx } = useStyles()

		return (
			<div className={cx(styles.container, className)}>
				<canvas
					ref={canvasRef}
					className={styles.canvas}
					style={{
						width: `${width}px`,
						height: `${height}px`,
					}}
				/>
			</div>
		)
	},
)

AudioWaveform.displayName = "AudioWaveform"

export default AudioWaveform
