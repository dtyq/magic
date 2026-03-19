import MagicDropdown from "@/components/base/MagicDropdown"
import MagicModal from "@/components/base/MagicModal"
import type { ConversationTopic } from "@/types/chat/topic"
import { useBoolean, useMemoizedFn } from "ahooks"
import { MenuProps } from "antd"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import chatTopicService from "@/services/chat/topic"
import { ChatDomId } from "@/pages/chatNew/constants"
import RenameModal from "./RenameModal"
import magicToast from "@/components/base/MagicToaster/utils"

interface TopicMenuProps {
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

const TopicMenu = function TopicMenu({ children, topic }: TopicMenuProps) {
	const { t } = useTranslation("interface")

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

	const [renameModalOpen, setRenameModalOpen] = useState(false)
	const onCancel = useMemoizedFn(() => {
		setRenameModalOpen(false)
	})

	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)
	const onOk = useMemoizedFn((renameTopicValue: string) => {
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
						magicToast.error(err?.message)
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
				MagicModal.confirm({
					title: t("chat.topic.menu.delete_topic"),
					content: t("chat.topic.menu.delete_topic_content", {
						name: topic.name || t("chat.topic.newTopic"),
					}),
					onOk: () => {
						chatTopicService.removeTopic?.(topic.id).then(() => {
							setLoadingFalse()
						})
					},
					onCancel: () => {
						setLoadingFalse()
					},
					centered: true,
					okText: t("common.confirm"),
					cancelText: t("common.cancel"),
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
				getPopupContainer={() => {
					// TODO: 后续需要改成根据路由名来判断
					if (location.pathname.includes("super")) {
						return (
							document.getElementById(ChatDomId.SuperMagicChatContainer) ||
							document.body
						)
					} else if (location.pathname.includes("chat")) {
						return document.getElementById(ChatDomId.ChatContainer) || document.body
					}
					return document.body
				}}
			>
				{Children}
			</MagicDropdown>
			<RenameModal
				initialValue={topic.name.slice(0, MAX_NAME_LENGTH)}
				open={renameModalOpen}
				onClose={onCancel}
				onOk={onOk}
			/>
		</>
	)
}

export default TopicMenu
