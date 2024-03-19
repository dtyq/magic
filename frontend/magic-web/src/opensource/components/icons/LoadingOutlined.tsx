import { createStyles } from "antd-style"
import type { IconProps } from "@tabler/icons-react"
import { IconLoader2 } from "@tabler/icons-react"

const useStyles = createStyles(({ css }) => ({
	icon: css`
		display: inline-block;
		line-height: 0;
	`,
	spin: css`
		animation: loadingCircle 1s linear infinite;

		@keyframes loadingCircle {
			100% {
				transform: rotate(360deg);
			}
		}
	`,
}))

interface LoadingOutlinedProps extends IconProps {
	spin?: boolean
}

function LoadingOutlined({ spin, className, style, size = "1em", ...rest }: LoadingOutlinedProps) {
	const { styles, cx } = useStyles()

	return (
		<IconLoader2
			size={size}
			className={cx(styles.icon, spin && styles.spin, className)}
			style={style}
			{...rest}
		/>
	)
}

export default LoadingOutlined
