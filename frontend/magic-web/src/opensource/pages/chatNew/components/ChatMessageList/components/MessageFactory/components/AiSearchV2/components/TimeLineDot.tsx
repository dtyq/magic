import { memo } from "react"
import { createStyles } from "antd-style"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconCheck } from "@tabler/icons-react"
import { TimeLineDotStatus } from "../const"
import DotSpreading from "./DotSpreading"

const useStyles = createStyles(({ css, token }) => {
	return {
		successDot: css`
			background-color: ${token.colorPrimary};
			border-radius: 50%;
			color: ${token.colorWhite};
			padding: 2px;
			flex-shrink: 0;
		`,
		pendingDot: css`
			flex-shrink: 0;

			@keyframes pulse {
				0% {
					transform: scale(0.5);
				}
				50% {
					transform: scale(2);
				}
				100% {
					transform: scale(0.5);
				}
			}

			width: 14px;
			height: 14px;
			border-radius: 50%;
			background-color: ${token.magicColorScales.brand[0]};

			&::before {
				display: block;
				content: "";
				width: 10px;
				height: 10px;
				position: relative;
				top: 2px;
				left: 2px;
				border-radius: 50%;
				background-color: ${token.colorPrimary};
			}
		`,
		waitingDot: css`
			flex-shrink: 0;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			border-radius: 100px;
			border: 1px solid ${token.colorBorder};
			background: ${token.colorBgContainer};
		`,
	}
})

export const SuccessDot = memo(({ style }: { style?: React.CSSProperties }) => {
	const { styles } = useStyles()
	return (
		<MagicIcon
			color="currentColor"
			component={IconCheck}
			size={14}
			className={styles.successDot}
			style={style}
		/>
	)
})

export const PendingDot = memo(({ style }: { style?: React.CSSProperties }) => {
	const { styles } = useStyles()
	return <div className={styles.pendingDot} style={style} />
})

export const WaitingDot = memo(({ style }: { style?: React.CSSProperties }) => {
	const { styles } = useStyles()
	return <div className={styles.waitingDot} style={style} />
})

const TimeLineDot = memo(
	({ status, style }: { status: TimeLineDotStatus; style?: React.CSSProperties }) => {
		switch (status) {
			case TimeLineDotStatus.SUCCESS:
				return <SuccessDot style={style} />
			case TimeLineDotStatus.PENDING:
				return <DotSpreading style={style} />
			case TimeLineDotStatus.WAITING:
				return <WaitingDot style={style} />
			default:
				return null
		}
	},
)

export default TimeLineDot
