import { SwipeAction } from "antd-mobile"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import { IconMessageTopic } from "@/opensource/enhance/tabler/icons-react"
import { IconEdit, IconTrash, IconInputAi, IconX } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import TopicStore from "@/opensource/stores/chatNew/topic"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import Topic from "@/opensource/models/chat/topic"
import { useTranslation } from "react-i18next"
import chatTopicService from "@/opensource/services/chat/topic"
import { useBoolean, useMemoizedFn } from "ahooks"
import { Badge } from "antd"
import { useState } from "react"
import RenameModal from "@/opensource/pages/chatNew/components/topic/ExtraSection/components/RenameModal"
import { getUserName } from "@/opensource/utils/modules/chat"
import UserInfoStore from "@/opensource/stores/userInfo"
import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import { MagicButton } from "@dtyq/magic-admin/components"
import FlexBox from "@/opensource/components/base/FlexBox"
import { cx } from "antd-style"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface AiTopicPopupProps {
	open: boolean
	onClose: () => void
}

const AiTopicPopup = observer(function AiTopicPopup({ open, onClose }: AiTopicPopupProps) {
	const { styles } = useStyles()
	const { t } = useTranslation()

	// Get topics from store
	const topics: Topic[] = TopicStore.topicList

	const [morePanelOpen, { setTrue: setMorePanelOpenTrue, setFalse: setMorePanelOpenFalse }] =
		useBoolean(false)
	const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)

	const [
		renameModalOpen,
		{ setTrue: setRenameModalOpenTrue, setFalse: setRenameModalOpenFalse },
	] = useBoolean(false)

	const handleMore = useMemoizedFn((topic: Topic) => {
		setSelectedTopic(topic)
		setMorePanelOpenTrue()
	})

	const handleCreateTopic = useMemoizedFn(() => {
		chatTopicService.createTopic()
	})

	const handleDelete = (topic: Topic) => {
		console.log("Delete action for:", topic.name)
		// Remove topic using service
		chatTopicService.removeTopic(topic.id)
	}

	const handleSmartRename = useMemoizedFn(() => {
		if (selectedTopic) {
			chatTopicService.getAndSetMagicTopicName?.(selectedTopic.id, true).finally(() => {
				setMorePanelOpenFalse()
			})
		} else {
			setMorePanelOpenFalse()
		}
	})

	const handleRename = useMemoizedFn((renameTopicValue: string) => {
		if (selectedTopic && renameTopicValue !== selectedTopic?.name) {
			chatTopicService
				.updateTopic?.(selectedTopic?.id, renameTopicValue)
				.then(() => {
					setRenameModalOpenFalse()
				})
				.catch((err) => {
					if (err?.message) {
						magicToast.error(err?.message)
					}
				})
		} else {
			setRenameModalOpenFalse()
		}
	})

	const handleDeleteTopic = useMemoizedFn(() => {
		if (selectedTopic) {
			handleDelete(selectedTopic)
		}
		setMorePanelOpenFalse()
	})

	const rightActions = (topic: Topic) => [
		{
			key: "more",
			text: t("chat.topic.popup.more", { ns: "interface" }),
			color: "primary",
			onClick: () => handleMore(topic),
		},
		{
			key: "delete",
			text: t("chat.topic.popup.delete", { ns: "interface" }),
			color: "danger",
			onClick: () => handleDelete(topic),
		},
	]

	const moreMenuConfig = [
		{
			key: "smartRename",
			text: t("chat.topic.popup.smartRename", { ns: "interface" }),
			color: "primary",
			icon: IconInputAi,
			onClick: handleSmartRename,
		},
		{
			key: "rename",
			text: t("chat.topic.popup.rename", { ns: "interface" }),
			color: "primary",
			icon: IconEdit,
			onClick: setRenameModalOpenTrue,
		},
		{
			key: "delete",
			text: t("chat.topic.popup.delete", { ns: "interface" }),
			color: "danger",
			icon: IconTrash,
			onClick: handleDeleteTopic,
		},
	]

	const handleTopicClick = useMemoizedFn((topic: Topic) => {
		chatTopicService.setCurrentConversationTopic(topic.id)
		onClose()
	})

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			bodyClassName={styles.body}
			bodyStyle={{
				borderTopLeftRadius: "8px",
				borderTopRightRadius: "8px",
				minHeight: "40vh",
				maxHeight: "80vh",
			}}
		>
			<FlexBox vertical gap={0} className={styles.container}>
				{/* Topic list header - following Figma design */}
				<div className={styles.header}>
					<div className={styles.iconWrapper}>
						<MagicIcon component={IconMessageTopic} size={18} color="currentColor" />
					</div>
					<h3 className={styles.headerTitle}>
						{t("chat.topic.popup.count", { ns: "interface", count: topics.length })}
					</h3>
					<div className={styles.closeButton} onClick={onClose}>
						<MagicIcon component={IconX} size={24} color="currentColor" />
					</div>
				</div>

				{/* Main topic list container */}
				<div className={styles.topicList}>
					{topics.map((topic) => (
						<SwipeAction
							className={styles.swipeAction}
							key={topic.id}
							rightActions={rightActions(topic)}
						>
							<div
								className={cx(styles.itemContent, {
									active:
										topic.id ===
										ConversationStore.currentConversation?.current_topic_id,
								})}
								onClick={() => handleTopicClick(topic)}
							>
								<div className={styles.itemIcon}>
									<Badge
										count={
											ConversationStore.currentConversation?.topic_unread_dots.get(
												topic.id,
											) ?? 0
										}
										size="small"
									>
										<MagicIcon component={IconMessageTopic} size={24} />
									</Badge>
								</div>
								<p className={styles.itemTitle}>
									{topic.name || t("chat.topic.newTopic", { ns: "interface" })}
								</p>
							</div>
						</SwipeAction>
					))}
				</div>
				{/* Add new topic item following Figma design */}
				<div className={styles.createTopicButtonWrapper}>
					<MagicButton
						className={styles.createTopicButton}
						block
						onClick={() => handleCreateTopic()}
					>
						{t("chat.topic.popup.createNewTopic", { ns: "interface" })}
					</MagicButton>
				</div>
			</FlexBox>

			{/* Topic actions menu popup */}
			<MagicPopup
				visible={morePanelOpen}
				onClose={setMorePanelOpenFalse}
				bodyStyle={{
					borderTopLeftRadius: "8px",
					borderTopRightRadius: "8px",
				}}
			>
				{/* Selected topic header */}
				<FlexBox gap={8} align="center" className={styles.topicHeaderWrapper}>
					<div className={styles.topicIconWrapper}>
						<MagicIcon component={IconMessageTopic} size={30} color="currentColor" />
					</div>
					<FlexBox vertical gap={4} className={styles.topicHeader}>
						<p className={styles.topicTitleText}>
							{"# "}
							{selectedTopic?.name || t("chat.topic.newTopic", { ns: "interface" })}
							{" #"}
						</p>
						<p className={styles.topicSubtitle}>
							{t("chat.topic.popup.topicWith", {
								ns: "interface",
								name: getUserName(
									UserInfoStore.get(
										ConversationStore.currentConversation?.receive_id ?? "",
									),
								),
							})}
						</p>
					</FlexBox>
				</FlexBox>

				{/* Topic action menu items */}
				<div>
					{moreMenuConfig.map((item) => (
						<FlexBox
							align="center"
							gap={4}
							key={item.key}
							className={cx(styles.actionItem, {
								[styles.deleteText]: item.color === "danger",
							})}
							onClick={item.onClick}
						>
							<MagicIcon
								component={item.icon}
								size={18}
								className={item.color === "danger" ? styles.deleteIcon : ""}
								color="currentColor"
							/>
							<span>{item.text}</span>
						</FlexBox>
					))}
				</div>

				{/* Cancel action button */}
				<div className={styles.cancelButtonWrapper}>
					<MagicButton
						className={styles.cancelButton}
						block
						onClick={setMorePanelOpenFalse}
					>
						{t("chat.topic.popup.cancel", { ns: "interface" })}
					</MagicButton>
				</div>

				{/* Rename Modal */}
				<RenameModal
					initialValue={selectedTopic?.name ?? ""}
					open={renameModalOpen}
					onClose={setRenameModalOpenFalse}
					onOk={handleRename}
				/>
			</MagicPopup>
		</MagicPopup>
	)
})

export default AiTopicPopup
