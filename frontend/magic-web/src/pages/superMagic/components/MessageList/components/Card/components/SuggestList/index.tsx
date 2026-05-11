import { observer } from "mobx-react-lite"
import { SUGGESTION_STATUS, isSuggestionReady } from "@/pages/superMagic/stores/suggestion-types"
import { X } from "lucide-react"
import { SuggestItem } from "./SuggestItem"
import { useSuggestions } from "./useSuggestions"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useTranslation } from "react-i18next"

interface SuggestListProps {
	/** 消息 id（app_message_id），建议缓存按此粒度 */
	messageId: string
	/** 任务 id，用作后端请求的 relation_id */
	taskId: string
	/** 话题 id（缺失时不会记录已点击） */
	topicId?: string
	/** 仅最新一轮展示全局关闭入口 */
	showCloseAction?: boolean
	/* 关闭追问建议 */
	closeSuggestions?: () => void
}

function SuggestList({
	messageId,
	taskId,
	topicId,
	showCloseAction = false,
	closeSuggestions,
}: SuggestListProps) {
	const { t } = useTranslation("super")
	const { meta } = useSuggestions({ messageId, taskId, topicId })

	const handleSuggestionClick = useMemoizedFn((message: string) => {
		pubsub.publish(PubSubEvents.Append_Suggestion_To_Editor, message)
	})

	if (!meta) return null
	if (meta.status === SUGGESTION_STATUS.FAILED) return null
	if (!isSuggestionReady(meta.status)) return null

	const suggestions = meta.suggestions || []
	if (!suggestions.length) return null

	return (
		<div className="flex flex-col gap-2 py-2" data-testid="suggest-list">
			{suggestions.map((item, index) => (
				<SuggestItem
					key={`${index}-${item}`}
					index={index}
					item={item}
					onClick={handleSuggestionClick}
				/>
			))}
			{showCloseAction && (
				<button
					type="button"
					className="mt-1 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					data-testid="follow-up-suggestions-close"
					onClick={closeSuggestions}
				>
					<X className="size-3 shrink-0" strokeWidth={2} />
					<span>{t("ui.followUpSuggestionsClose")}</span>
				</button>
			)}
		</div>
	)
}

export default observer(SuggestList)
