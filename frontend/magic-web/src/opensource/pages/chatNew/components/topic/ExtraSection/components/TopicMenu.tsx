import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import MagicModal from "@/opensource/components/base/MagicModal"
import type { ConversationTopic } from "@/types/chat/topic"
import { useBoolean, useMemoizedFn, useUpdateEffect } from "ahooks"
import { App, Form, Input, MenuProps, type DropdownProps } from "antd"
import { memo, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import chatTopicService from "@/opensource/services/chat/topic"
import { ChatDomId } from "@/opensource/pages/chatNew/constants"

interface TopicMenuProps extends Omit<DropdownProps, "children"> {
	children: React.ReactNode | ((loading?: boolean) => React.ReactNode)
	topic: ConversationTopic
}

const enum TopicMenuKey {
	AI_RENAME = "ai-rename",
	RENAME_TOPIC = "rename-topic",
	DELETE_TOPIC = "delete-topic",
}

/** 话题名称最大字数限制，数值由后端定 */
const MAX_NAME_LENGTH = 50

const TopicMenu = memo(function TopicMenu({ children, topic, ...props }: TopicMenuProps) {
	const { t } = useTranslation("interface")
	const { message } = App.useApp()

	const menuItems = useMemo(() => {
		return [
			{
				key: TopicMenuKey.AI_RENAME,
				label: t("chat.topic.menu.ai_rename"),
			},
			{
				key: TopicMenuKey.RENAME_TOPIC,
				label: t("chat.topic.menu.rename_topic"),
			},
			{
				key: TopicMenuKey.DELETE_TOPIC,
				label: t("chat.topic.menu.delete_topic"),
				danger: true,
			},
		]
	}, [t])

	const [renameTopicValue, setRenameTopicValue] = useState(topic.name)

	useUpdateEffect(() => {
		setRenameTopicValue(topic.name.slice(0, MAX_NAME_LENGTH))
	}, [topic.name])

	const [renameModalOpen, setRenameModalOpen] = useState(false)
	const onCancel = useMemoizedFn(() => {
		setRenameTopicValue(topic.name.slice(0, MAX_NAME_LENGTH))
		setRenameModalOpen(false)
	})

	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)
	const onOk = useMemoizedFn(() => {
		if (renameTopicValue !== topic.name) {
			setLoadingTrue()
			chatTopicService
				.updateTopic?.(topic.id, renameTopicValue)
				.then(() => {
					setLoadingFalse()
					setRenameModalOpen(false)
				})
				.catch((err) => {
					if (err?.message) {
						message.error(err?.message)
					}
				})
		} else {
			setRenameModalOpen(false)
		}
	})
	const handleClick = useMemoizedFn<Required<MenuProps>["onClick"]>((e) => {
		switch (e.key) {
			case TopicMenuKey.AI_RENAME:
				setLoadingTrue()
				chatTopicService.getAndSetMagicTopicName?.(topic.id, true).finally(() => {
					setLoadingFalse()
				})
				break
			case TopicMenuKey.RENAME_TOPIC:
				setRenameModalOpen(true)
				break
			case TopicMenuKey.DELETE_TOPIC:
				setLoadingTrue()
				chatTopicService.removeTopic?.(topic.id).then(() => {
					setLoadingFalse()
				})
				break
			default:
				break
		}
	})

	const Children = useMemo(() => {
		return typeof children === "function" ? children(loading) : children
	}, [children, loading])

	return (
		<>
			<MagicDropdown
				trigger={["click"]}
				menu={{
					items: menuItems,
					onClick: handleClick,
				}}
				getPopupContainer={() =>
					document.getElementById(ChatDomId.ChatContainer) || document.body
				}
				{...props}
			>
				{Children}
			</MagicDropdown>
			<MagicModal
				width={400}
				title={t("chat.topic.menu.rename_topic")}
				open={renameModalOpen}
				onCancel={onCancel}
				onOk={onOk}
				centered
			>
				<Form.Item label={t("chat.topic.menu.topicName")}>
					<Input
						value={renameTopicValue}
						onChange={(e) =>
							setRenameTopicValue(e.target.value.slice(0, MAX_NAME_LENGTH))
						}
						maxLength={MAX_NAME_LENGTH}
						showCount
					/>
				</Form.Item>
			</MagicModal>
		</>
	)
})

export default TopicMenu
