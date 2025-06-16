import PageContainer from "@/opensource/components/base/PageContainer"
import { useMemo, useState } from "react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicSearch from "@/opensource/components/base/MagicSearch"
import { IconMessageTopic } from "@/enhance/tabler/icons-react"
import { MessageReceiveType } from "@/types/chat"
import { useDebounce, useMemoizedFn } from "ahooks"
import type { ConversationTopic } from "@/types/chat/topic"
import Divider from "@/opensource/components/other/Divider"
import { observer } from "mobx-react-lite"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import topicStore from "@/opensource/stores/chatNew/topic"
import { Virtuoso } from "react-virtuoso"
import conversationService from "@/opensource/services/chat/conversation/ConversationService"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"
import TopicTip from "./components/TopicTip"
import { CreateTopicItem, NormalTopicItem, PlaceholderTopicItem } from "./components/TopicItem"

const PlaceholderId = "placeholder-topic"

type ItemType =
	| typeof PlaceholderId
	| (ConversationTopic & {
			isActive: boolean
	  })

/**
 * 话题面板
 */
const TopicExtraSection = observer(() => {
	const { styles } = useStyles()
	const { t } = useTranslation()
	const { currentConversation: conversation } = conversationStore

	const currentTopicId = conversationStore.currentConversation?.current_topic_id

	const { topicList } = topicStore

	const isAiConversation = conversation?.receive_type === MessageReceiveType.Ai

	const [searchValue, setSearchValue] = useState("")
	const debouncedSearchValue = useDebounce(searchValue, { wait: 500 })
	const filterList = useMemo(() => {
		if (!debouncedSearchValue) return topicList
		return topicList.filter((topic) => topic.name.includes(debouncedSearchValue))
	}, [topicList, debouncedSearchValue])

	const handleClose = useMemoizedFn(() => {
		if (!conversation) return
		conversationService.updateTopicOpen(conversation, false)
	})

	const topicListItems = useMemo<ItemType[]>(() => {
		console.log("topicListItems ====> ", topicList)
		if (!topicList || topicList.length === 0) {
			if (isAiConversation) return [PlaceholderId]
			return [] as any
		}
		return filterList.map((topic) => {
			return {
				...topic,
				isActive: topic.id === currentTopicId,
			}
		})
	}, [topicList, filterList, isAiConversation, currentTopicId])

	const classNames = useMemo(
		() => ({
			body: styles.body,
			header: styles.header,
		}),
		[styles.body, styles.header],
	)

	const onSearchValueChange = useMemoizedFn((e) => setSearchValue(e.target.value))

	const titleNode = useMemo(() => {
		return `${t("chat.topic.topic", { ns: "interface" })} ${topicListItems?.length ?? ""}`
	}, [t, topicListItems?.length])

	const iconNode = useMemo(() => {
		return (
			<MagicIcon
				color="currentColor"
				className={styles.icon}
				stroke={2}
				size={26}
				component={IconMessageTopic}
			/>
		)
	}, [styles.icon])

	if (!conversation) return null

	return (
		<PageContainer
			title={titleNode}
			icon={iconNode}
			closeable
			onClose={handleClose}
			className={styles.container}
			classNames={classNames}
		>
			<MagicSearch
				className={styles.search}
				value={searchValue}
				onChange={onSearchValueChange}
			/>
			<TopicTip />
			{isAiConversation ? <CreateTopicItem /> : null}
			<Divider direction="horizontal" />
			<Virtuoso
				className={styles.topicList}
				totalCount={topicListItems.length}
				data={topicListItems}
				itemContent={(_, topic) => {
					if (topic === PlaceholderId) {
						return <PlaceholderTopicItem />
					}
					return <NormalTopicItem {...topic} />
				}}
			/>
		</PageContainer>
	)
})

export default TopicExtraSection
