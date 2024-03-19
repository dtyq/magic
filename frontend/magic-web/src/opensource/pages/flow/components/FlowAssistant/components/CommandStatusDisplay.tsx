import React from "react"
import { Spin } from "antd"
import { IconCheck, IconX } from "@tabler/icons-react"
import { useStyles } from "../styles"
import MagicMarkdown from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown"

export interface CommandStatus {
	type: string
	status: "pending" | "executing" | "completed" | "failed"
	message?: string
}

interface CommandStatusDisplayProps {
	commandStatus: CommandStatus[]
	content?: string
}

/**
 * 命令状态显示组件
 * 用于展示命令执行的状态和相关信息
 */
const CommandStatusDisplay: React.FC<CommandStatusDisplayProps> = ({ commandStatus, content }) => {
	const { styles, cx } = useStyles()

	return (
		<div className={styles.messageContentWrapper}>
			{content ? <MagicMarkdown content={content} /> : null}
			<div className={styles.commandStatusContainer}>
				{commandStatus.map((cmd) => {
					let statusClassName = ""
					if (cmd.status === "executing") {
						statusClassName = styles.executing
					} else if (cmd.status === "completed") {
						statusClassName = styles.completed
					} else if (cmd.status === "failed") {
						statusClassName = styles.failed
					}

					return (
						<div
							key={`${cmd.type}-${cmd.status}-${cmd.message?.substring(0, 10) || ""}`}
							className={cx(styles.commandStatusItem, statusClassName)}
						>
							{cmd.status === "executing" && (
								<Spin size="small" style={{ marginRight: 8 }} />
							)}
							{cmd.status === "completed" && (
								<IconCheck size={16} style={{ marginRight: 8 }} />
							)}
							{cmd.status === "failed" && (
								<IconX size={16} style={{ marginRight: 8 }} />
							)}
							<span>{cmd.message}</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default CommandStatusDisplay
