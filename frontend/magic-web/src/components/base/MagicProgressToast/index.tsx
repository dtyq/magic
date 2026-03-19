import { memo } from "react"
import type { CSSProperties } from "react"
import { createStyles } from "antd-style"
import { Button } from "antd"
import { IconCircleCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

export interface MagicProgressToastProps {
	/** 是否显示进度条 */
	visible?: boolean
	/** 进度值 0-100 */
	progress?: number
	/** 显示的文本 */
	text?: string
	/** 进度条位置 */
	position?: "top" | "center" | "bottom"
	/** 自定义样式 */
	style?: CSSProperties
	/** 自定义类名 */
	className?: string
	/** z-index 层级 */
	zIndex?: number
	/** 宽度 */
	width?: number | string
	/** 是否显示百分比 */
	showPercentage?: boolean
	/** 进度条高度 */
	progressHeight?: number
	/** 动画持续时间（毫秒） */
	animationDuration?: number
	/** 是否已完成 */
	isCompleted?: boolean
	/** 完成状态下的操作按钮 */
	actions?: Array<{
		text: string
		type?: "primary" | "default" | "link" | "text"
		onClick: () => void
		style?: CSSProperties
	}>
}

const useStyles = createStyles(({ token }) => {
	return {
		container: {
			position: "fixed" as const,
			left: "50%",
			transform: "translateX(-50%)",
			backgroundColor: "#fff",
			borderRadius: 8,
			boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
			padding: "10px",
			border: "1px solid #e5e7eb",
			display: "flex",
			alignItems: "center",
			gap: 12,
			minHeight: 32,
		},

		completedContainer: {
			padding: "5px",
			fontSize: 12,
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
		},

		actionsContainer: {
			width: "218px",
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
			padding: 0,
			margin: 0,
		},

		actionButton: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			height: 32,
			borderRadius: 6,
			fontSize: 12,
			fontWeight: 400,
			padding: 0,
			margin: 0,
		},

		primaryButton: {
			backgroundColor: "#315CEC",
			color: "#fff",
			border: "none",
			"&:hover": {
				backgroundColor: "#4c7bff !important",
				color: "#fff !important",
			},
		},

		defaultButton: {
			backgroundColor: "#f5f5f5",
			color: "#666",
			border: "none",
			"&:hover": {
				backgroundColor: "#e8e8e8 !important",
				color: "#666 !important",
			},
		},

		topPosition: {
			top: `calc(${token.safeAreaInsetTop} + 50px)`,
		},

		centerPosition: {
			top: "50%",
			transform: "translate(-50%, -50%)",
		},

		bottomPosition: {
			bottom: 40,
		},

		text: {
			fontSize: 12,
			color: token.magicColorUsages?.text?.[1] || token.colorText,
			fontWeight: 400,
			whiteSpace: "nowrap" as const,
		},

		progressContainer: {
			flex: 1,
			position: "relative" as const,
			backgroundColor: "#f3f4f6",
			borderRadius: 4,
			overflow: "hidden" as const,
		},

		progressBar: {
			position: "absolute" as const,
			left: 0,
			top: 0,
			backgroundColor: token.magicColorUsages?.primary?.default || token.colorPrimary,
			borderRadius: 4,
			transition: "width 0.3s ease",
		},

		percentage: {
			fontSize: 12,
			fontWeight: 400,
			minWidth: 36,
			textAlign: "right" as const,
			color: token.magicColorUsages?.text?.[1] || token.colorText,
		},
		icon: {
			flexShrink: 0, // 防止在flex容器中被压缩
			width: 15, // 匹配IconCircleCheck的size属性
			height: 15,
		},
	}
})

function MagicProgressToast(props: MagicProgressToastProps) {
	const {
		visible = false,
		progress = 0,
		text = "正在处理",
		position = "top",
		style,
		className,
		zIndex = 9999,
		width = 265,
		showPercentage = true,
		progressHeight = 4,
		animationDuration = 300,
		isCompleted = false,
		actions = [],
	} = props

	const { styles, cx } = useStyles()

	// 检测当前语言是否为英文
	const { i18n } = useTranslation()
	const isEnglish = i18n.language === "en_US" || i18n.language === "en"

	if (!visible) return null

	const getPositionClass = () => {
		switch (position) {
			case "center":
				return styles.centerPosition
			case "bottom":
				return styles.bottomPosition
			default:
				return styles.topPosition
		}
	}

	const containerStyle: CSSProperties = {
		...style,
		zIndex,
		width: isEnglish ? "320px" : typeof width === "number" ? `${width}px` : width,
	}

	const progressBarStyle: CSSProperties = {
		height: `${progressHeight}px`,
		width: `${Math.min(Math.max(progress, 0), 100)}%`,
		transitionDuration: `${animationDuration}ms`,
	}

	const progressContainerStyle: CSSProperties = {
		height: `${progressHeight}px`,
	}

	// 如果已完成，显示完成状态的UI
	if (isCompleted) {
		return (
			<div
				className={cx(getPositionClass(), styles.container, styles.completedContainer)}
				style={containerStyle}
			>
				{/* 成功图标 */}
				<IconCircleCheck size={24} stroke={1.5} color="#52c41a" className={styles.icon} />

				{/* 完成文本 */}
				<span className={styles.text}>{text}</span>

				{/* 操作按钮 */}
				{actions.length > 0 && (
					<>
						{actions.map((action, index) => (
							<Button
								key={index}
								className={cx(styles.actionsContainer)}
								onClick={action.onClick}
								type={action.type}
								style={action.style}
							>
								<span className={styles.actionButton}>{action.text}</span>
							</Button>
						))}
					</>
				)}
			</div>
		)
	}

	// 正常进度状态的UI
	return (
		<div className={cx(styles.container, getPositionClass(), className)} style={containerStyle}>
			{/* 文本提示 */}
			<span className={styles.text}>{text}</span>

			{/* 进度条容器 */}
			<div className={styles.progressContainer} style={progressContainerStyle}>
				{/* 进度条填充部分 */}
				<div className={styles.progressBar} style={progressBarStyle} />
			</div>

			{/* 进度百分比 */}
			{showPercentage && <span className={styles.percentage}>{Math.round(progress)}%</span>}
		</div>
	)
}

export default memo(MagicProgressToast)
