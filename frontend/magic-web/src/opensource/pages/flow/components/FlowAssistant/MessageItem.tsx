import type React from "react"
import { Avatar, Spin, Button, Space } from "antd"
import { IconReload } from "@tabler/icons-react"
import { useStyles } from "./styles"
import AnimatedLoading, { loadingContainerStyle } from "./components/AnimatedLoading"
import type { CommandStatus } from "./components/CommandStatusDisplay"
import CommandStatusDisplay from "./components/CommandStatusDisplay"
import MagicMarkdown from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown"
import { useCommandDetection } from "./hooks/useCommandDetection"
import USER_AVATAR_URL from "./static/user.jpg"
import ASSISTANT_AVATAR_URL from "./static/assistant.jpg"

export interface MessageProps {
	id: string
	role: "user" | "assistant"
	content: string
	status?: "loading" | "done" | "error"
	commandStatus?: CommandStatus[]
	isCollectingCommand?: boolean
	confirmOperation?: {
		type: string
		message: string
		data?: any
	}
	onConfirm?: (operationType: string, data?: any) => void
	onCancel?: (operationType: string) => void
	onRetry?: (messageId: string) => void
}

function MessageItem(props: MessageProps): React.ReactElement {
	const {
		id,
		role,
		content,
		status,
		commandStatus,
		isCollectingCommand,
		confirmOperation,
		onConfirm,
		onCancel,
		onRetry,
	} = props
	const { styles, cx } = useStyles()
	const { detectCommands, processCommandMarkers } = useCommandDetection()

	// 渲染确认操作按钮
	const renderConfirmButtons = () => {
		if (!confirmOperation) return null

		return (
			<div className={styles.confirmButtonsContainer}>
				<Space>
					<Button
						type="primary"
						onClick={() => onConfirm?.(confirmOperation.type, confirmOperation.data)}
					>
						确认
					</Button>
					<Button onClick={() => onCancel?.(confirmOperation.type)}>取消</Button>
				</Space>
			</div>
		)
	}

	// 渲染消息内容
	const renderContent = (): React.ReactNode => {
		// 处理内容中的命令标记，确保不显示JSON
		let displayContent = content || ""

		// 检测命令标记
		const { hasCommands, commandCount } = detectCommands(displayContent)
		if (hasCommands) {
			console.log("MessageItem发现命令标记:", id, "命令数量:", commandCount)
		}

		// 指令收集阶段显示自定义动画Loading
		if (isCollectingCommand) {
			// 如果没有内容，显示普通的Spin组件
			if (!displayContent) {
				return (
					<div className={loadingContainerStyle}>
						<Spin size="small" />
					</div>
				)
			}

			// 处理命令标记
			displayContent = processCommandMarkers(displayContent, true)

			// 有内容时显示自定义动画
			return (
				<>
					<MagicMarkdown content={displayContent} />
					<AnimatedLoading />
				</>
			)
		}

		// 当不在收集命令状态时，处理命令标记
		if (hasCommands) {
			displayContent = processCommandMarkers(displayContent, false)
		}

		// 如果消息为空，才显示普通loading状态
		if (!displayContent && status === "loading") {
			console.log(`Message ${id} rendering empty loading state`)
			return (
				<div className={loadingContainerStyle}>
					<Spin size="small" />
				</div>
			)
		}

		// 错误状态处理 - 显示错误消息和重试按钮
		if (status === "error") {
			return (
				<div className={styles.messageContentWrapper}>
					<MagicMarkdown content={displayContent} />
				</div>
			)
		}

		// 如果消息有内容但仍在加载中，不显示loading状态，只显示内容
		if (displayContent && status === "loading") {
			return (
				<div className={styles.messageContentWrapper}>
					<MagicMarkdown content={displayContent} />
					{renderConfirmButtons()}
				</div>
			)
		}

		// 如果有命令状态，使用CommandStatusDisplay组件显示
		if (commandStatus && commandStatus.length > 0) {
			return (
				<>
					<CommandStatusDisplay commandStatus={commandStatus} content={displayContent} />
					{renderConfirmButtons()}
				</>
			)
		}

		// 正常消息内容或空内容
		return (
			<div className={styles.messageContentWrapper}>
				{displayContent ? <MagicMarkdown content={displayContent} /> : null}
				{renderConfirmButtons()}
			</div>
		)
	}

	// 根据消息角色使用不同的布局和样式
	if (role === "user") {
		return (
			<div className={styles.userMessageItem}>
				<div className={styles.userMessageRow}>
					<div className={cx(styles.messageContent, styles.user)}>{renderContent()}</div>
					<Avatar src={USER_AVATAR_URL} className={styles.userAvatar} />
				</div>
			</div>
		)
	}

	// 助理消息
	return (
		<div className={styles.assistantMessageItem}>
			<div className={styles.assistantMessageRow}>
				<Avatar src={ASSISTANT_AVATAR_URL} className={styles.avatar} />
				<div
					className={cx(styles.messageContent, styles.assistant, {
						[styles.errorText]: status === "error",
					})}
				>
					{renderContent()}
				</div>
				{status === "error" && onRetry && (
					<Button
						type="text"
						danger
						icon={<IconReload size={16} />}
						className={styles.retryButton}
						onClick={() => onRetry?.(id)}
						title="重试"
					/>
				)}
			</div>
		</div>
	)
}

export default MessageItem
