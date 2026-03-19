import type { HTMLAttributes } from "react"
import { memo } from "react"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => ({
	dotwave: css`
		@keyframes dotwave {
			0% {
				content: "";
			}

			33.3% {
				content: ".";
			}

			66.6% {
				content: "..";
			}
			100% {
				content: "...";
			}
		}

		&::after {
			content: "";
			width: 16px;
			display: inline-block;
			border-radius: 50%;
			animation: dotwave 1.4s infinite;
			white-space: nowrap;
		}
	`,
	gradient: css`
		position: relative;
		font-style: normal;
		font-weight: 400;
		line-height: 20px;
		letter-spacing: 0.25px;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		background-size: 200% 100%;
		animation: gradientAnimation 1.2s linear infinite;
		background-image: linear-gradient(90deg, #b5b5b5 35%, #060607 50%, #b5b5b5 65%);

		@keyframes gradientAnimation {
			0% {
				background-position: 200%;
			}

			100% {
				background-position: 0%;
			}
		}
	`,
}))

interface WithDotwaveAnimationProps extends HTMLAttributes<HTMLSpanElement> {
	gradientAnimation?: boolean
	dotwaveAnimation?: boolean
}

const TextAnimation = memo(
	({
		children,
		gradientAnimation = false,
		dotwaveAnimation = false,
		className,
		...rest
	}: WithDotwaveAnimationProps) => {
		const { styles, cx } = useStyles()

		return (
			<span
				className={cx(
					gradientAnimation && styles.gradient,
					dotwaveAnimation && styles.dotwave,
					className,
				)}
				{...rest}
			>
				{children}
			</span>
		)
	},
)

export default TextAnimation
