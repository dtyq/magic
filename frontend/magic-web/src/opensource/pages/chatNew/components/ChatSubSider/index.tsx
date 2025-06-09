import type { CollapseProps } from "antd"
import { Flex } from "antd"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import MagicCollapse from "@/opensource/components/base/MagicCollapse"
import SubSiderContainer from "@/opensource/layouts/BaseLayout/components/SubSider"
import { titleWithCount } from "@/utils/modules/chat"
import MagicSegmented from "@/opensource/components/base/MagicSegmented"
import { observer } from "mobx-react-lite"
import conversationSiderbarStore from "@/opensource/stores/chatNew/conversationSidebar"
import type Conversation from "@/opensource/models/chat/conversation"
import { throttle } from "lodash-es"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import useStyles from "./style"
import ConversationItem from "./components/ConversationItem"
import { SegmentedKey } from "./constants"
import { useMemoizedFn } from "ahooks"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import EmptyFallback from "./components/EmptyFallback"
import { toJS } from "mobx"

const enum MessageGroupKey {
	Pinned = "Pinned",
	Single = "Single",
	Group = "Group",
}

/**
 * 聊天侧边栏
 */
const ChatSubSider = observer(() => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const [activeKey, setActiveKey] = useState<string | string[]>([
		MessageGroupKey.Pinned,
		MessageGroupKey.Single,
		MessageGroupKey.Group,
	])
	const [activeSegmentedKey, setActiveSegmentedKey] = useState<SegmentedKey>(SegmentedKey.Message)

	const {
		conversationSiderbarGroups: {
			top: topGroup,
			single: singleGroup,
			group: groupGroup,
			ai: aiGroup,
		},
	} = conversationSiderbarStore

	const conversationCount = Object.keys(conversationStore.conversations).length

	const options = useMemo(() => {
		return [
			{
				label: t("chat.subSider.message"),
				value: SegmentedKey.Message,
			},
			// {
			// 	label: t("chat.subSider.atMe"),
			// 	value: SegmentedKey.AtMe,
			// },
			{
				label: t("chat.subSider.aiBots"),
				value: SegmentedKey.AiBots,
			},
		]
	}, [t])

	const handleConversationItemClick = useMemoizedFn(
		throttle((conversation: Conversation) => {
			console.log("handleConversationItemClick", conversation.id)
			conversationService.switchConversation(conversation)
		}, 800),
	)

	if (conversationCount === 0) {
		return (
			<SubSiderContainer className={styles.container}>
				<MagicSegmented
					className={styles.segmented}
					value={activeSegmentedKey}
					options={options}
					block
					onChange={setActiveSegmentedKey}
				/>
				<Flex
					vertical
					gap={4}
					align="center"
					justify="center"
					className={styles.emptyFallback}
				>
					<EmptyFallback />
					<div className={styles.emptyFallbackText}>
						{t("chat.subSider.emptyFallbackText")}
					</div>
				</Flex>
			</SubSiderContainer>
		)
	}

	return (
		<SubSiderContainer className={styles.container}>
			<MagicSegmented
				className={styles.segmented}
				value={activeSegmentedKey}
				options={options}
				block
				onChange={setActiveSegmentedKey}
			/>
			<MagicCollapse
				activeKey={activeKey}
				onChange={setActiveKey}
				className={styles.collapse}
				items={
					[
						topGroup?.length
							? {
									label: (
										<span className={styles.collapseLabel}>
											{titleWithCount(
												t("chat.subSider.pinned"),
												topGroup?.length,
											)}
										</span>
									),
									children: (
										<Flex vertical gap={4}>
											{topGroup?.map((item) => (
												<ConversationItem
													key={item}
													conversationId={item}
													onClick={handleConversationItemClick}
												/>
											))}
										</Flex>
									),
									key: MessageGroupKey.Pinned,
							  }
							: undefined,
						singleGroup?.length
							? {
									label: (
										<span className={styles.collapseLabel}>
											{titleWithCount(
												t("chat.subSider.conversation"),
												singleGroup?.length,
											)}
										</span>
									),
									children: (
										<Flex vertical gap={4}>
											{singleGroup?.map((item) => (
												<ConversationItem
													key={item}
													conversationId={item}
													onClick={handleConversationItemClick}
												/>
											))}
										</Flex>
									),
									key: MessageGroupKey.Single,
							  }
							: undefined,
						groupGroup?.length
							? {
									label: (
										<span className={styles.collapseLabel}>
											{titleWithCount(
												t("chat.subSider.groupConversation"),
												groupGroup?.length,
											)}
										</span>
									),
									children: (
										<Flex vertical gap={4}>
											{groupGroup?.map((item) => (
												<ConversationItem
													key={item}
													conversationId={item}
													onClick={handleConversationItemClick}
												/>
											))}
										</Flex>
									),
									key: MessageGroupKey.Group,
							  }
							: undefined,
					].filter(Boolean) as CollapseProps["items"]
				}
				style={{ display: activeSegmentedKey === SegmentedKey.Message ? "block" : "none" }}
			/>
			{/* <MagicList
				active={currentConversationId}
				items={[]}
				className={styles.list}
				listItemComponent={ConversationItem}
				onItemClick={handleClickMessageItem}
				style={{ display: activeSegmentedKey === SegmentedKey.AtMe ? "flex" : "none" }}
			/> */}
			<Flex
				vertical
				gap={4}
				className={styles.list}
				style={{ display: activeSegmentedKey === SegmentedKey.AiBots ? "flex" : "none" }}
			>
				{aiGroup?.map((item) => (
					<ConversationItem
						key={item}
						conversationId={item}
						onClick={handleConversationItemClick}
					/>
				))}
			</Flex>
		</SubSiderContainer>
	)
})

export default ChatSubSider
