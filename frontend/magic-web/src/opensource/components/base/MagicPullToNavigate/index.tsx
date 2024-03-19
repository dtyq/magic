import { memo, forwardRef } from "react"
import { createStyles } from "antd-style"
import PullToNavigateAnimation from "./animations/PullToNavigateAnimation"
import usePullToNavigate from "./hooks/usePullToNavigate"

interface MagicPullToNavigateProps {
	/** Children content */
	children: React.ReactNode
	/** Callback function when navigation is triggered */
	onNavigate?: () => Promise<void> | void
	/** Callback function before navigation is triggered */
	onNavigateBefore?: () => void
	/** Callback function after navigation is triggered */
	onNavigateAfter?: () => void
	/** Callback function when pull starts */
	onStart?: () => void
	/** Callback function when pull ends */
	onEnd?: (success: boolean) => void
	/** Whether pull to navigate is disabled */
	disabled?: boolean
	/** Custom text for different states */
	texts?: {
		pullDown?: string
		releaseToNavigate?: string
		navigating?: string
	}
	/** Custom threshold for triggering navigation */
	threshold?: number
	/** Maximum pull distance */
	maxDistance?: number
	/** Resistance factor for pull distance calculation */
	resistance?: number
	/** Whether to respect scrollable children elements */
	respectScrollableChildren?: boolean
	/** Custom className for the container */
	className?: string
	/** Custom style for the container */
	style?: React.CSSProperties
	/** Custom content configuration for the pull animation */
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

const useStyles = createStyles(({ css, token }, { isActive }: { isActive: boolean }) => ({
	container: css`
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		touch-action: pan-y;
		background: ${token.magicColorScales?.brand?.[0] || token.colorBgContainer || "#ffffff"};
	`,
	pullIndicator: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		pointer-events: none;
		overflow: hidden;
	`,
	content: css`
		flex: 1;
		width: 100%;
		overflow-x: hidden;
		overflow-y: visible;
		z-index: 10;
		-webkit-overflow-scrolling: touch;
		position: relative;
		touch-action: pan-y;
		transition: transform 0.2s ease-out;
		will-change: transform;

		${isActive
			? `
		border-radius: 12px 12px 0px 0px;
		background: transparent;
		box-shadow: 0px 0px 30px 0px rgba(0, 0, 0, 0.1);`
			: ""}
	`,
}))

const MagicPullToNavigate = memo(
	forwardRef<HTMLDivElement, MagicPullToNavigateProps>(
		(
			{
				children,
				onNavigate,
				onNavigateBefore,
				onNavigateAfter,
				onStart,
				onEnd,
				disabled = false,
				texts,
				threshold = 80,
				maxDistance = 200,
				resistance = 0.8,
				respectScrollableChildren = false,
				className,
				style,
				customContent,
			},
			ref,
		) => {
			const {
				isActive,
				pullDistance,
				rawPullDistance,
				isRefreshing,
				isExiting,
				setContainer,
			} = usePullToNavigate({
				onRefresh: onNavigate,
				onNavigateBefore,
				onNavigateAfter,
				onStart,
				onEnd,
				threshold,
				maxDistance,
				disabled,
				resistance,
				respectScrollableChildren,
			})

			const { styles, cx } = useStyles({ isActive })

			// Calculate content transform - content follows finger movement or exit animation
			const contentTransform = (() => {
				if (isExiting) {
					// Exit animation: move to 100% of viewport height
					return "translateY(100%)"
				}
				if (isActive) {
					// Normal pull: follow finger
					return `translateY(${rawPullDistance}px)`
				}
				// Default: no transform
				return "translateY(0px)"
			})()

			// Calculate pull indicator height - shows in the empty space above content
			const pullIndicatorHeight = (() => {
				if (isExiting) {
					// During exit animation, fill the entire viewport
					return window.innerHeight
				}
				if (isActive) {
					// Normal pull: follow finger
					return rawPullDistance
				}
				// Default: no height
				return 0
			})()

			return (
				<div
					ref={(node) => {
						// Set both refs
						if (ref) {
							if (typeof ref === "function") {
								ref(node)
							} else {
								;(ref as React.MutableRefObject<HTMLElement | null>).current = node
							}
						}
						// Set container ref for touch events
						setContainer(node)
					}}
					className={cx(styles.container, className)}
					style={style}
				>
					{/* Pull indicator - shows custom UI in the empty space */}
					<div
						className={styles.pullIndicator}
						style={{
							height: pullIndicatorHeight,
							transition: isExiting
								? "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
								: isActive
									? "none"
									: "height 0.2s ease-out",
						}}
					>
						<PullToNavigateAnimation
							isActive={isActive}
							pullDistance={rawPullDistance}
							percentage={pullDistance}
							isRefreshing={isRefreshing}
							isExiting={isExiting}
							texts={texts}
							threshold={threshold}
							customContent={customContent}
						/>
					</div>

					{/* Main content - follows finger movement */}
					<div
						className={styles.content}
						style={{
							transform: contentTransform,
							transition: isExiting
								? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
								: isActive
									? "none"
									: "transform 0.2s ease-out",
						}}
					>
						{children}
					</div>
				</div>
			)
		},
	),
)

MagicPullToNavigate.displayName = "MagicPullToNavigate"

export default MagicPullToNavigate
