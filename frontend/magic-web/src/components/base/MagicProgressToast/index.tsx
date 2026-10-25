import { memo } from "react"
import type { CSSProperties, ReactNode } from "react"
import { createStyles } from "antd-style"
import { Button } from "antd"
import { IconCircleCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Files } from "lucide-react"
import ProgressIndicator from "./ProgressIndicator"

export interface MagicProgressToastProps {
	/** 是否显示进度条 */
	visible?: boolean
	/** 进度值 0-100 */
	progress?: number
	/** 显示的文本 */
	text?: string
	/** 调用方明确提供的名称或说明，保持正文原样 */
	description?: string
	/** 任务图标；由调用方按操作选择，不解析本地化文案 */
	icon?: ReactNode
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
			backgroundColor: token.colorBgElevated,
			borderRadius: 12,
			boxShadow: token.boxShadowSecondary,
			padding: "8px 12px",
			border: `1px solid ${token.colorBorderSecondary}`,
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap" as const,
			gap: 10,
			width: "max-content",
			maxWidth: "min(360px, calc(100vw - 24px))",
			color: token.colorPrimary,
		},

		completedContainer: {
			color: token.colorSuccess,
		},

		actionsContainer: {
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
			flexShrink: 0,
			height: 24,
			padding: "0 6px",
			margin: 0,
			"@media (pointer: coarse)": { minHeight: 44 },
		},

		actionButton: {
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
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
			fontSize: 13,
			color: token.magicColorUsages?.text?.[1] || token.colorText,
			fontWeight: 400,
			lineHeight: "20px",
			minWidth: 0,
			overflowWrap: "anywhere" as const,
		},
		status: {
			display: "flex",
			alignItems: "flex-start",
			gap: 10,
			flex: "1 1 auto",
			minWidth: 0,
		},
		withDescription: { padding: 12 },
		description: {
			flexBasis: "100%",
			marginTop: -3,
			fontSize: 12,
			lineHeight: "19px",
			color: token.colorTextSecondary,
			overflowWrap: "anywhere" as const,
		},

		progressContainer: {
			width: 100,
			flex: "0 0 100px",
			position: "relative" as const,
			backgroundColor: token.colorFillSecondary,
			borderRadius: 4,
			overflow: "hidden" as const,
		},
		fullProgress: { flex: "0 0 100%", width: "100%" },

		progressBar: {
			position: "absolute" as const,
			left: 0,
			top: 0,
			backgroundColor: token.magicColorUsages?.primary?.default || token.colorPrimary,
			borderRadius: 4,
			transition: "width 0.3s ease",
			"@media (prefers-reduced-motion: reduce)": { transition: "none !important" },
		},

		percentage: {
			fontSize: 12,
			fontWeight: 400,
			flexShrink: 0,
			fontVariantNumeric: "tabular-nums",
			textAlign: "right" as const,
			color: token.magicColorUsages?.text?.[1] || token.colorText,
		},
		icon: {
			flexShrink: 0, // 防止在flex容器中被压缩
			width: 20, // 匹配IconCircleCheck的size属性
			height: 20,
		},
	}
})

function MagicProgressToast(props: MagicProgressToastProps) {
	const {
		visible = false,
		progress = 0,
		text,
		description,
		icon = <Files />,
		position = "top",
		style,
		className,
		zIndex = 9999,
		width,
		showPercentage = true,
		progressHeight = 4,
		animationDuration = 300,
		isCompleted = false,
		actions = [],
	} = props

	const { styles, cx } = useStyles()

	const { t } = useTranslation("super")
	const resolvedText = text ?? t("feedback.processing")
	const normalizedProgress = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0

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
		...(width === undefined ? {} : { width }),
	}

	const progressBarStyle: CSSProperties = {
		height: `${progressHeight}px`,
		width: `${normalizedProgress}%`,
		transitionDuration: `${animationDuration}ms`,
	}

	const progressContainerStyle: CSSProperties = {
		height: `${progressHeight}px`,
	}

	// 如果已完成，显示完成状态的UI
	if (isCompleted) {
		return (
			<div
				className={cx(
					getPositionClass(),
					styles.container,
					styles.completedContainer,
					className,
				)}
				style={containerStyle}
			>
				{/* 成功图标 */}
				<IconCircleCheck size={20} stroke={2} className={styles.icon} />

				{/* 完成文本 */}
				<span className={styles.text}>{resolvedText}</span>

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
				{description && <div className={styles.description}>{description}</div>}
			</div>
		)
	}

	// 正常进度状态的UI
	return (
		<div
			className={cx(
				styles.container,
				getPositionClass(),
				description && styles.withDescription,
				className,
			)}
			style={containerStyle}
		>
			{/* 文本提示 */}
			<div className={styles.status}>
				<ProgressIndicator value={normalizedProgress} icon={icon} label={resolvedText} />
				<span className={styles.text} style={description ? { fontWeight: 500 } : undefined}>
					{resolvedText}
				</span>
			</div>

			{/* 进度条容器 */}
			<div
				className={cx(styles.progressContainer, description && styles.fullProgress)}
				style={{ ...progressContainerStyle, ...(description ? { order: 2 } : {}) }}
				aria-hidden
			>
				{/* 进度条填充部分 */}
				<div className={styles.progressBar} style={progressBarStyle} />
			</div>

			{/* 进度百分比 */}
			{showPercentage && (
				<span className={styles.percentage}>{Math.round(normalizedProgress)}%</span>
			)}
			{description && (
				<div className={styles.description} style={{ order: 1 }}>
					{description}
				</div>
			)}
		</div>
	)
}

export default memo(MagicProgressToast)
