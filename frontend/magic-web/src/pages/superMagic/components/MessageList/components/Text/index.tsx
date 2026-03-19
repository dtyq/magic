import Assistant from "@/pages/superMagic/assets/svg/assistant.svg"
import { userStore } from "@/models/user"
import { IconBan, IconChecks } from "@tabler/icons-react"
import { useStyles } from "./style"
import { observer } from "mobx-react-lite"
import Mentions from "./components/Mentions"
import UserText from "./components/UserText"
import MarkdownComponent from "./components/Markdown"
import { useMemoizedFn } from "ahooks"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { handleProjectFileMention } from "../../../MessageEditor/utils"
import { ProjectFileMentionData } from "@/components/business/MentionPanel/types"
import { useTranslation } from "react-i18next"
import { Topic } from "@/pages/superMagic/pages/Workspace/types"

interface TextProps {
	data: any
	selectedTopic?: Topic | null
	isUser: boolean
	isShare?: boolean
	hideHeader?: boolean
	isFinished?: boolean
	onSelectDetail?: (detail: any) => void
	isSuspended?: boolean
}

const formatTimestamp = (timestamp: string) => {
	const date = new Date(timestamp)
	const month = date.getMonth() + 1
	const day = date.getDate()
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	return `${month}/${day} ${hours}:${minutes}`
}

function Text(props: TextProps) {
	const {
		data,
		isUser,
		hideHeader = false,
		isFinished = false,
		onSelectDetail,
		isSuspended = false,
	} = props

	const { userInfo } = userStore.user
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const onFileClick = useMemoizedFn((_: string, item?: TiptapMentionAttributes) => {
		const result = handleProjectFileMention(item?.data as ProjectFileMentionData, t)
		onSelectDetail?.(result)
	})

	if (!data?.content && !data?.[data?.type]?.content) return null

	// 检查是否是"finished"类型
	// let isFinished = data?.status === "finished"
	// 确定文本内容的样式类名
	let textContentClass = styles.assistantText
	if (isFinished) {
		textContentClass = styles.finishedText
	} else if (isSuspended) {
		textContentClass = styles.suspendedText
	} else if (isUser) {
		textContentClass = styles.userText
	}

	return (
		<div
			className={cx(
				styles.textContainer,
				isUser ? styles.userContainer : styles.assistantContainer,
			)}
		>
			{!hideHeader && (
				<div
					className={styles.textHeader}
					style={isUser ? { justifyContent: "flex-end" } : {}}
				>
					{isUser ? (
						<>
							<span className={styles.timestamp}>
								{formatTimestamp(data?.send_timestamp)}
							</span>
							<img src={userInfo?.avatar} alt="avatar" className={styles.avatar} />
						</>
					) : (
						<>
							<img src={Assistant} alt="avatar" className={styles.avatar} />
							<span className={styles.timestamp}>
								{formatTimestamp(data?.send_timestamp)}
							</span>
						</>
					)}
				</div>
			)}

			<div className={`${styles.textContent} ${textContentClass}`}>
				{isSuspended ? <IconBan stroke={2} /> : null}
				{isFinished ? <IconChecks stroke={2} /> : null}
				{isUser && (
					<Mentions data={data} onFileClick={onFileClick} className={styles.atItems} />
				)}
				{isUser ? (
					<div className={cx(styles.githubMarkdown, "text-foreground")}>
						<UserText node={data} onFileClick={onFileClick} />
					</div>
				) : (
					<MarkdownComponent
						content={
							data?.content ||
							data?.[data?.type]?.content ||
							data?.[data?.type]?.text?.content ||
							data?.[data?.type]?.markdown?.content
						}
						className={cx(styles.githubMarkdown, "text-foreground")}
					/>
				)}
			</div>
		</div>
	)
}

export default observer(Text)
