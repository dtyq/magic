import { memo, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import MagicLoading from "@/opensource/components/other/MagicLoading"
import { Flex } from "antd"

interface PullToNavigateAnimationProps {
	/** Whether the pull to navigate is active */
	isActive?: boolean
	/** Pull distance (0-100) */
	pullDistance?: number
	/** Raw pull distance in pixels */
	rawPullDistance?: number
	/** Pull percentage (0-100) */
	percentage?: number
	/** Whether currently navigating */
	isRefreshing?: boolean
	/** Whether in exit animation state */
	isExiting?: boolean
	/** Custom text for different states */
	texts?: {
		pullDown?: string
		releaseToNavigate?: string
		navigating?: string
	}
	/** Custom threshold for triggering navigation */
	threshold?: number
	/** Custom content configuration */
	customContent?: {
		/** Custom icon component or element */
		icon?: React.ComponentType<any> | React.ReactNode
		/** Custom render function for the entire content */
		render?: (props: {
			isActive: boolean
			pullDistance: number
			isRefreshing: boolean
			currentText: string
			iconScale: number
			iconRotation: number
			backgroundOpacity: number
		}) => React.ReactNode
		/** Custom container styles */
		containerStyle?: React.CSSProperties
		/** Custom container className */
		containerClassName?: string
		/** Whether to show default background */
		showDefaultBackground?: boolean
		/** Whether to show default loading ring */
		showDefaultLoadingRing?: boolean
	}
}

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: ${token.magicColorScales.brand[0]};
		position: relative;
		overflow: hidden;
		height: 100%;
		min-height: 80px;
	`,
	customContainer: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		position: relative;
		overflow: hidden;
		height: 100%;
		min-height: 80px;
	`,
	content: css`
		transform: translateY(-10px);
	`,
	iconContainer: css`
		position: relative;
		margin-bottom: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
	`,
	aiIcon: css`
		width: 40px;
		height: 40px;
		color: #ffffff;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
	`,
	magicLoadingContainer: css`
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
	`,
	progressText: css`
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #ffffff;
		font-size: 12px;
		font-weight: 600;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
		pointer-events: none;
		z-index: 1;
	`,
	text: css`
		color: ${token.magicColorUsages.text[3]};
		font-family: "PingFang SC";
		font-size: 12px;
		font-style: normal;
		font-weight: 400;
		line-height: 16px; /* 133.333% */
	`,
	backgroundEffect: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		opacity: 0;
		transition: opacity 0.3s ease;
	`,
}))

const PullToNavigateAnimation = memo(
	({
		isActive = false,
		pullDistance = 0,
		percentage = 0,
		isRefreshing = false,
		isExiting = false,
		texts,
		threshold = 80,
		customContent,
	}: PullToNavigateAnimationProps) => {
		const { styles, cx } = useStyles()
		const { t } = useTranslation("interface")

		// Use provided texts or fallback to internationalized defaults
		const defaultTexts = {
			pullDown: t("pullToNavigate.pullDownGeneric"),
			releaseToNavigate: t("pullToNavigate.releaseToNavigateGeneric"),
			navigating: t("pullToNavigate.navigatingGeneric"),
		}

		const finalTexts = { ...defaultTexts, ...texts }
		const [currentText, setCurrentText] = useState(finalTexts.pullDown)

		// Update text based on state
		useEffect(() => {
			if (isExiting || isRefreshing) {
				setCurrentText(finalTexts.navigating)
			} else if (percentage >= threshold) {
				setCurrentText(finalTexts.releaseToNavigate)
			} else {
				setCurrentText(finalTexts.pullDown)
			}
		}, [isRefreshing, isExiting, percentage, threshold, finalTexts])

		// Calculate animation values
		const iconScale = isExiting ? 1.5 : Math.min(1 + percentage / 200, 1.3)
		const iconRotation = isRefreshing || isExiting ? 360 : percentage * 2
		const backgroundOpacity = isExiting ? 0.6 : Math.min(percentage / 100, 0.4)

		// Calculate progress frame (0-100 maps to animation frames)
		const progressFrame = pullDistance

		// Don't render anything if not active and not exiting
		if (!isActive && !isExiting) {
			return null
		}

		// Render custom content if provided
		if (customContent?.render) {
			return (
				<div
					className={cx(
						customContent.showDefaultBackground !== false
							? styles.container
							: styles.customContainer,
						customContent.containerClassName,
					)}
					style={customContent.containerStyle}
				>
					{customContent.render({
						isActive,
						pullDistance,
						isRefreshing,
						currentText,
						iconScale,
						iconRotation,
						backgroundOpacity,
					})}
				</div>
			)
		}

		// Render default content
		const renderIcon = () => {
			if (customContent?.icon) {
				if (typeof customContent.icon === "function") {
					const IconComponent = customContent.icon
					return <IconComponent />
				}
				return customContent.icon
			}

			// Default: use MagicLoading with progress - smaller size
			return (
				<div className={styles.magicLoadingContainer}>
					<MagicLoading
						currentFrame={progressFrame}
						autoplay={false}
						style={{
							width: 48, // Increased to 48px
							height: 48, // Increased to 48px
						}}
					/>
				</div>
			)
		}

		return (
			<div
				className={cx(
					customContent?.showDefaultBackground !== false
						? styles.container
						: styles.customContainer,
					customContent?.containerClassName,
				)}
				style={customContent?.containerStyle}
			>
				{/* Background effect */}
				<div className={styles.backgroundEffect} style={{ opacity: backgroundOpacity }} />

				<Flex
					vertical
					gap={4}
					align="center"
					justify="center"
					style={{ transform: `translateY(-${24 - percentage / 10}px)` }}
				>
					{/* Icon container */}
					<div className={styles.iconContainer}>
						{isRefreshing || isExiting ? (
							// Show animated MagicLoading when refreshing or exiting - smaller size
							<MagicLoading
								style={{
									width: 48, // Increased to 48px
									height: 48, // Increased to 48px
									scale: 1.5,
								}}
							/>
						) : (
							// Show MagicLoading with progress control when pulling
							<motion.div
								animate={{
									scale: iconScale,
								}}
								transition={{
									type: "spring",
									stiffness: 300,
									damping: 30,
								}}
							>
								{renderIcon()}
							</motion.div>
						)}
					</div>

					{/* Text */}
					<motion.p
						className={styles.text}
						animate={{
							opacity: isActive ? 1 : 0,
							y: isActive ? 0 : 10,
						}}
						transition={{
							duration: 0.2,
						}}
					>
						{currentText}
					</motion.p>
				</Flex>
			</div>
		)
	},
)

PullToNavigateAnimation.displayName = "PullToNavigateAnimation"

export default PullToNavigateAnimation
