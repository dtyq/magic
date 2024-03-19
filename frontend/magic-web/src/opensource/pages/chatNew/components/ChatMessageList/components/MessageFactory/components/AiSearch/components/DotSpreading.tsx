import { createStyles } from "antd-style"
import { memo } from "react"

const useStyles = createStyles(({ css }) => {
	return {
		circleContaier: css`
			position: relative;
			width: 14px;
			height: 14px;
		`,
		circle: css`
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background-color: #315cec;

			@keyframes expand {
				from {
					opacity: 1;
					transform: translate(-50%, -50%) scale(0);
				}

				to {
					opacity: 0;
					transform: translate(-50%, -50%) scale(3);
				}
			}

			&::after {
				content: "";
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				width: 100%;
				height: 100%;
				border-radius: 50%;
				background-color: #315cec90;
				animation: expand 2s ease-out infinite;
			}
		`,
	}
})

const DotSpreading = memo(({ style }: { style?: React.CSSProperties }) => {
	const { styles } = useStyles()
	return (
		<div className={styles.circleContaier} style={style}>
			<div className={styles.circle} />
		</div>
	)
})

export default DotSpreading
