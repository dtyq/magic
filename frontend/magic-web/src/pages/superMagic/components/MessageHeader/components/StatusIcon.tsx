import React from "react"
import type { ProjectStatus, TaskStatus, WorkspaceStatus } from "../../../pages/Workspace/types"
import { createStyles, cx } from "antd-style"

interface StatusIconProps {
	status?: WorkspaceStatus | ProjectStatus | TaskStatus
	size?: number
	className?: string
	customFill?: boolean
}

const useStyles = createStyles(({ css }) => ({
	statusIcon: css`
		flex-shrink: 0;
	`,
}))

function StatusIcon({ status, size = 16, className, customFill = false }: StatusIconProps) {
	const iconSize = size // 统一使用16px大小
	const uniqueId = React.useMemo(() => Math.random().toString(36).substr(2, 9), [])
	const { styles } = useStyles()
	switch (status) {
		case "running":
			return (
				<svg
					width={iconSize}
					height={iconSize}
					viewBox="0 0 16 16"
					className={cx(styles.statusIcon, className)}
					style={{ overflow: "visible" }}
				>
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
					<circle cx="8" cy="8" r="8" fill="#3B82F6" opacity="0.1" />
					{/* Middle circle with animation */}
					<circle
						cx="8"
						cy="8"
						r="6.22"
						fill="#3B82F6"
						opacity="0.2"
						style={{
							animation: "statusPulse 1.5s infinite",
							transformOrigin: "center",
						}}
					/>
					{/* Inner circle with gradient */}
					<circle cx="8" cy="8" r="4.445" fill={`url(#runningGradient-${uniqueId})`} />
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
		case "finished":
			return (
				<svg
					width={iconSize}
					height={iconSize}
					viewBox="0 0 16 16"
					className={cx(styles.statusIcon, className)}
				>
					<defs>
						<linearGradient
							id={`finishedGradient-${uniqueId}`}
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#8DF796" />
							<stop offset="100%" stopColor="#15B610" />
						</linearGradient>
					</defs>
					<circle
						cx="8"
						cy="8"
						r="5.335"
						fill={`url(#finishedGradient-${uniqueId})`}
						stroke="#DAFFC2"
						strokeWidth="1"
					/>
				</svg>
			)
		case "error":
			return (
				<svg
					width={iconSize}
					height={iconSize}
					viewBox="0 0 16 16"
					className={cx(styles.statusIcon, className)}
				>
					<defs>
						<linearGradient
							id={`errorGradient-${uniqueId}`}
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#FFB5A5" />
							<stop offset="100%" stopColor="#FF4120" />
						</linearGradient>
					</defs>
					<circle
						cx="8"
						cy="8"
						r="5.335"
						fill={`url(#errorGradient-${uniqueId})`}
						stroke="#FFDFD5"
						strokeWidth="1"
					/>
				</svg>
			)
		case "waiting":
		default:
			return (
				<svg
					width={iconSize}
					height={iconSize}
					viewBox="0 0 16 16"
					className={cx(styles.statusIcon, className)}
				>
					<defs>
						<linearGradient
							id={`waitingGradient-${uniqueId}`}
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#F5F5F5" />
							<stop offset="100%" stopColor="#DDDDDD" />
						</linearGradient>
					</defs>
					<circle
						cx="8"
						cy="8"
						r="6"
						stroke="#E5E7EB"
						strokeWidth="1"
						{...(!customFill && { fill: `url(#waitingGradient-${uniqueId})` })}
					/>
				</svg>
			)
	}
}

export default StatusIcon
