import StatusIcon from "@/pages/superMagic/components/MessageHeader/components/StatusIcon"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { IconCircleCheck, IconHourglassEmpty } from "@tabler/icons-react"
import { useStyles } from "./style"
import { useMemo } from "react"

interface TaskStatusIconProps {
	status: TaskStatus
	size?: number
}

function TaskStatusIcon({ status, size = 18 }: TaskStatusIconProps) {
	const iconSize = size
	const { styles } = useStyles()
	const uniqueId = useMemo(() => Math.random().toString(36).substr(2, 9), [])

	switch (status) {
		case "finished":
			return <IconCircleCheck size={iconSize} stroke={1} className={styles.finishedIcon} />
		case "running":
			return (
				<svg width={iconSize} height={iconSize} viewBox="0 0 20 20">
					<defs>
						<linearGradient
							id={`runningGradient-${uniqueId}`}
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#33D6C0" />
							<stop offset="25%" stopColor="#5083FB" />
							<stop offset="50%" stopColor="#336DF4" />
							<stop offset="75%" stopColor="#4752E6" />
							<stop offset="100%" stopColor="#8D55ED" />
						</linearGradient>
					</defs>
					{/* Outer circle */}
					<circle cx="10" cy="10" r="8" fill="#EEF3FD" />
					{/* Middle circle with animation */}
					<circle
						cx="10"
						cy="10"
						r="6"
						fill="#D3DFFB"
						style={{
							animation: "statusPulse 1.5s infinite",
							transformOrigin: "center",
						}}
					/>
					{/* Inner circle with gradient */}
					<circle cx="10" cy="10" r="5" fill={`url(#runningGradient-${uniqueId})`} />
					<style>{`
						@keyframes statusPulse {
							0% {
								transform: scale(1);
								opacity: 0.9;
							}
							50% {
								transform: scale(1.6);
								opacity: 0.4;
							}
							100% {
								transform: scale(1);
								opacity: 0;
							}
						}
					`}</style>
				</svg>
			)
		case "error":
			return <StatusIcon status={status} size={iconSize} />
		case "waiting":
		default:
			return <IconHourglassEmpty size={iconSize} stroke={1} className={styles.waitingIcon} />
	}
}

export default TaskStatusIcon
