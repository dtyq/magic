import { Drawer, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { IconMessage2Cog } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { MessageReceiveType } from "@/opensource/types/chat"
import { observer } from "mobx-react-lite"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import UserSetting from "./components/UserSetting"
import GroupSetting from "./components/GroupSetting"
import AiSetting from "./components/AiSetting"
import { useStyles } from "./style"

const ChatSetting = observer(() => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const [open, setOpen] = useState(true)

	const { currentConversation: conversation } = conversationStore

	const onClose = useMemoizedFn(() => {
		setOpen(false)

		// 保留关闭动画
		setTimeout(() => {
			conversationStore.toggleSettingOpen()
		}, 200)
	})

	const title = useMemo(() => {
		if (!conversation) return null
		switch (conversation?.receive_type) {
			case MessageReceiveType.Group:
				return t("chat.groupSetting.title")
			case MessageReceiveType.User:
			case MessageReceiveType.Ai:
				return t("chat.setting")
			default:
				return null
		}
	}, [conversation, t])

	const Render = useMemo(() => {
		if (!conversation) return null

		switch (conversation?.receive_type) {
			case MessageReceiveType.Group:
				return <GroupSetting />
			case MessageReceiveType.User:
				return <UserSetting />
			case MessageReceiveType.Ai:
				return <AiSetting conversation={conversation} />
			default:
				return null
		}
	}, [conversation])

	if (!conversation) {
		return null
	}
	return (
		<Drawer
			open={open}
			closable
			onClose={onClose}
			title={
				<Flex align="center" gap={8}>
					<MagicIcon
						color="currentColor"
						className={styles.icon}
						stroke={2}
						size={26}
						component={IconMessage2Cog}
					/>
					{title}
				</Flex>
			}
			maskClosable
			classNames={{
				header: styles.header,
				mask: styles.mask,
				body: styles.body,
			}}
		>
			{Render}
			{/* <MagicButton
				onClick={async () => {
					// 从网络获取 9 张随机图片，正方形
					const testImageUrls = Array.from({ length: 9 }).map((_, i) => {
						return `https://picsum.photos/200/200?random=${i}`
					})
					const result = await drawGroupAvatar(testImageUrls, {
						size: 100,
						gap: 10,
						borderRadius: 10,
						col: 3,
					})
					console.log("result", result)
				}}
			>
				111
			</MagicButton> */}
		</Drawer>
	)
})

export default ChatSetting
