import { memo, useMemo } from "react"
import { createStyles, cx } from "antd-style"
import topicEmptyIcon from "../../assets/svg/topic-status-empty.svg"
import topicRunningIcon from "../../assets/svg/topic-status-running.svg"
import topicFinishedIcon from "../../assets/svg/topic-status-success.svg"
import type { Thread } from "../../pages/Workspace/types"

interface TopicIconProps {
	size?: number
	status?: Thread["task_status"]
	className?: string
	style?: React.CSSProperties
}

const useStyles = createStyles(() => ({
	topicIcon: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 4,
		overflow: "hidden",
	},
	image: {
		width: "100%",
		height: "100%",
	},
}))

export default memo(function TopicIcon({ size = 24, status, className, style }: TopicIconProps) {
	const { styles } = useStyles()

	const image = useMemo(() => {
		switch (status) {
			case "running":
				return topicRunningIcon
			case "finished":
				return topicFinishedIcon
			default:
				return topicEmptyIcon
		}
	}, [status])

	return (
		<div
			className={cx(className, styles.topicIcon)}
			style={{
				width: size,
				height: size,
				...style,
			}}
		>
			<img src={image} alt="" className={styles.image} />
		</div>
	)
})
