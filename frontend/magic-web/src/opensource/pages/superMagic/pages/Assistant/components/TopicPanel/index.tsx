import { Virtuoso } from "react-virtuoso"
import { useStyles } from "./styles"
import topicStore from "@/opensource/stores/chatNew/topic"
import {
	PlaceholderTopicItem,
	NormalTopicItem,
} from "@/opensource/pages/chatNew/components/topic/ExtraSection/components/TopicItem"
import { useMemo } from "react"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import { ConversationTopic } from "@/opensource/types/chat/topic"
import MagicSearch from "@/opensource/components/base/MagicSearch"
import useSearchValue from "./hooks/useSearchValue"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import FlexBox from "@/opensource/components/base/FlexBox"

const PlaceholderId = "placeholder-topic"

type ItemType =
	| typeof PlaceholderId
	| (ConversationTopic & {
			isActive: boolean
	  })

function TopicPanel() {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const { currentConversation, topicOpen } = ConversationStore

	const currentTopicId = currentConversation?.current_topic_id
	const { searchValue, debouncedSearchValue, onSearchValueChange } = useSearchValue()

	const { topicList } = topicStore
	const topicListItems = useMemo<ItemType[]>(() => {
		if (!topicList || topicList.length === 0) {
			return [PlaceholderId]
		}

		const filterList = debouncedSearchValue
			? topicList.filter((topic) =>
					(topic.name || t("chat.topic.newTopic")).includes(debouncedSearchValue),
				)
			: topicList

		return filterList.map((topic) => {
			return {
				...topic,
				isActive: topic.id === currentTopicId,
			}
		})
	}, [topicList, debouncedSearchValue, t, currentTopicId])

	if (!topicOpen) return null

	return (
		<div className={styles.container}>
			<FlexBox gap={8} vertical className={styles.header}>
				<div className={styles.headerTitle}>{t("chat.topic.historyTopic")}</div>
				<MagicSearch
					className={styles.search}
					value={searchValue}
					onChange={onSearchValueChange}
				/>
			</FlexBox>
			<div className={styles.list}>
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
			</div>
		</div>
	)
}

export default observer(TopicPanel)
