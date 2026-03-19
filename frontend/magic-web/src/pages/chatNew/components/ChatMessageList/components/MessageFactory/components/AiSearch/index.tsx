import { useMemo, useRef } from "react"
import type {
	AggregateAISearchCardContent,
	AggregateAISearchCardSearch,
} from "@/types/chat/conversation_message"
import {
	AggregateAISearchCardDataType,
	AggregateAISearchCardDeepLevel,
} from "@/types/chat/conversation_message"
import type { TimelineProps } from "antd"
import { ConfigProvider, Flex, Timeline } from "antd"
import MagicCollapse from "@/components/base/MagicCollapse"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"

import MagicIcon from "@/components/base/MagicIcon"
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { useBoolean, useMemoizedFn, useSize, useUpdateEffect } from "ahooks"
import { isEmpty } from "lodash-es"
import MagicMarkdown from "@/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown"
import MagicCitationProvider from "@/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown/components/MagicCitation/Provider"
import { observer } from "mobx-react-lite"
import ErrorContent from "@/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/ErrorContent"
import TimeLineDot from "./components/TimeLineDot"
import useStyles from "./styles"
import { TimeLineDotStatus } from "./const"
import EventTable from "./components/EventTable"
import SearchKeywords from "./components/SearchKeywords"
import SearchingQuestion from "./components/SearchQuestion"
import Searching from "./components/title/Searching"
import Reading from "./components/title/Reading"
import Summarizing from "./components/title/Summarizing"
import Result from "./components/title/Result"
import MindMap from "./components/MindMap"
import Reasoning from "./components/title/Reasoning"
import Markdown from "../Markdown"
import SourceItem from "./components/SourceItem"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import { useTheme } from "antd-style"

const configProviderTheme = {
	components: {
		Collapse: {
			motionDurationMid: "0.25s",
		},
	},
}

interface MagicAggregateAISearchCardProps {
	content?: AggregateAISearchCardContent
	reasoningContent?: string
	isStreaming?: boolean
	isReasoningStreaming?: boolean
}

const TimelineCollapsePanelKey = "timeline"

const MagicAggregateAISearchCard = observer(
	({
		content,
		reasoningContent,
		isStreaming,
		isReasoningStreaming,
	}: MagicAggregateAISearchCardProps) => {
		const { fontSize } = useFontSize()
		const { t } = useTranslation("interface")
		const { magicColorUsages } = useTheme()

		const summaryRef = useRef<HTMLDivElement>(null)

		const size = useSize(summaryRef)

		/** 总结内容 */
		const llmResponse = content?.llm_response

		/** 是否搜索结束 */
		const isSearchingFinish = useMemo(() => {
			if (content?.finish) return true

			switch (content?.search_deep_level) {
				case AggregateAISearchCardDeepLevel.Simple:
					return Boolean(llmResponse)
				case AggregateAISearchCardDeepLevel.Deep:
					if (isEmpty(content?.associate_questions)) return false
					return (
						Object.values(content?.associate_questions ?? {}).every(
							(item) => item.llm_response,
						) && Boolean(reasoningContent || llmResponse)
					)
				default:
					return false
			}
		}, [
			content?.associate_questions,
			content?.finish,
			content?.search_deep_level,
			llmResponse,
			reasoningContent,
		])

		const { styles } = useStyles({
			fontSize,
			isSearchingFinish,
			hasLlmResponse: content?.finish,
		})

		const isSimpleSearch = useMemo(() => {
			return (
				!content?.search_deep_level ||
				content?.search_deep_level === AggregateAISearchCardDeepLevel.Simple
			)
		}, [content?.search_deep_level])

		const [collapsed, { setFalse, setTrue }] = useBoolean(!(content?.finish || isSimpleSearch))

		/** 是否在深度搜索中 */
		const isSearching = useMemo(() => {
			if (content?.finish) return false

			return (
				isEmpty(content?.associate_questions) ||
				Object.keys(content?.associate_questions ?? {}).every(
					(id) => !content?.search?.[id],
				)
			)
		}, [content?.associate_questions, content?.finish, content?.search])

		/** 是否在深度阅读中 */
		const isReading = useMemo(() => {
			if (content?.finish) return false

			return (
				!isSearching &&
				!Object.values(content?.associate_questions ?? {}).every(
					(item) => item.llm_response,
				)
			)
		}, [content?.associate_questions, content?.finish, isSearching])

		/** 是否在总结中 */
		// const isSummarizing = useMemo(() => {
		// 	if (content?.finish) return false

		// 	return !isReading && isNil(llmResponse)
		// }, [content?.finish, isReading, llmResponse])

		const allPages = useMemo(
			() =>
				Array.from(Object.values(content?.search ?? {}))
					.flat()
					.reduce((prev, cur) => {
						if (prev.find((item) => item.url === cur.url)) return prev
						prev.push(cur)
						return prev
					}, [] as AggregateAISearchCardSearch[]),
			[content?.search],
		)

		/** 问题搜索区域标题 */
		const titleContent = useMemo(() => {
			if (isSearching)
				return (
					<Searching
						deepLevel={content?.search_deep_level}
						hasAssociateQuestions={!isEmpty(content?.associate_questions)}
					/>
				)
			if (isReading) {
				return <Reading deepLevel={content?.search_deep_level} allPages={allPages} />
			}

			if (isReasoningStreaming) {
				return <Reasoning />
			}

			if (!content?.finish) {
				return <Summarizing />
			}

			return (
				<Result
					deepLevel={content?.search_deep_level}
					pageLength={allPages.length}
					associateQuestions={content?.associate_questions}
				/>
			)
		}, [
			allPages,
			content?.associate_questions,
			content?.finish,
			content?.search_deep_level,
			isReading,
			isReasoningStreaming,
			isSearching,
		])

		const collapseItems = useMemo(() => {
			if (!content) return []

			const datas = []

			// 如果有事件，则显示事件
			if (content.event && content.event.length > 0) {
				datas.push({
					key: AggregateAISearchCardDataType.Event,
					label: (
						<Flex align="center" gap={10}>
							{t("chat.aggregate_ai_search_card.relatedEvents")}
							<span className={styles.labelCount}>{content.event.length}</span>
						</Flex>
					),
					children: <EventTable events={content.event} />,
				})
			}

			const allSearch = content.search?.["0"]

			// 如果搜索结果不为空，并且搜索结束，则显示搜索结果
			if (allSearch?.length > 0 && content.event && content.mind_map && content.finish) {
				datas.push({
					key: AggregateAISearchCardDataType.Search,
					label: (
						<Flex align="center" gap={10}>
							{t("chat.aggregate_ai_search_card.search")}
							<span className={styles.labelCount}>{allSearch.length}</span>
						</Flex>
					),
					children: (
						<ol className={styles.sourceList} data-testid="sourceList">
							{allSearch?.map((item) => (
								<li key={`${item.id}_${item.index}`}>
									<SourceItem
										name={item.name}
										url={item.url}
										datePublished={item.datePublished}
									/>
								</li>
							))}
						</ol>
					),
				})
			}

			return datas
		}, [content, t, styles.labelCount, styles.sourceList])

		useUpdateEffect(() => {
			if (!isReading) {
				setFalse()
			}
		}, [isReading])

		useUpdateEffect(() => {
			if (content?.search_deep_level === 2 && !content.finish) {
				setTrue()
			}
		}, [content?.search_deep_level])

		const timelineItems = useMemo(() => {
			if (content?.search_deep_level !== 2) {
				const keywords = Array.from(Object.values(content?.associate_questions ?? {})).map(
					(i) => i.title,
				)
				return [
					{
						key: "searching_page",
						dot: (
							<TimeLineDot
								status={
									content?.finish || keywords.length
										? TimeLineDotStatus.SUCCESS
										: TimeLineDotStatus.PENDING
								}
							/>
						),
						children: (
							<Flex vertical gap={6} className={styles.timelineItem}>
								{t("chat.aggregate_ai_search_card.search_page")}
								<SearchKeywords items={keywords} />
							</Flex>
						),
					},
					!isSearching
						? {
							key: "reading_page",
							dot: (
								<TimeLineDot
									status={
										llmResponse
											? TimeLineDotStatus.SUCCESS
											: TimeLineDotStatus.PENDING
									}
								/>
							),
							children: (
								<Flex vertical gap={6} className={styles.timelineItem}>
									<span className={styles.questionReadCount}>
										{t("chat.aggregate_ai_search_card.read_page", {
											number: allPages?.length || 0,
										})}
									</span>
									{allPages?.map((item) => {
										return (
											<Flex key={item.id} gap={8} align="center">
												<SourceItem key={item.id} {...item} />
											</Flex>
										)
									})}
								</Flex>
							),
						}
						: null,
				].filter(Boolean) as TimelineProps["items"]
			}

			return Object.entries(content?.associate_questions ?? {}).map(([id, item], index) => {
				const status = item.llm_response
					? TimeLineDotStatus.SUCCESS
					: TimeLineDotStatus.PENDING

				const isPending = !content.finish && !isSearchingFinish && !item.llm_response

				// const searchCount = null
				const searchCount = content?.search?.[id]

				return {
					key: id,
					dot: <TimeLineDot status={status} />,
					children: (
						<Flex
							vertical
							gap={6}
							className={styles.timelineItem}
							style={{
								// @ts-ignore
								"--index": index,
							}}
						>
							<span
								className={styles.questionTitle}
								style={{
									fontWeight: isPending ? 600 : 400,
									color: isPending
										? magicColorUsages.text[0]
										: magicColorUsages.text[2],
								}}
							>
								<MagicMarkdown content={item.title} />
							</span>
							<SearchKeywords items={item.search_keywords} />
							<div className={styles.questionReadCount}>
								{isPending || !searchCount ? (
									<SearchingQuestion searchArray={searchCount} />
								) : (
									resolveToString(
										t("chat.aggregate_ai_search_card.questionReadCount"),
										{
											count: item.page_count ?? 0,
										},
									)
								)}
							</div>
						</Flex>
					),
				}
			})
		}, [
			allPages,
			content?.associate_questions,
			content?.finish,
			content?.search,
			content?.search_deep_level,
			isSearching,
			isSearchingFinish,
			llmResponse,
			magicColorUsages.text,
			styles.questionReadCount,
			styles.questionTitle,
			styles.timelineItem,
			t,
		])

		const questionItems = useMemo(
			() => [
				{
					key: TimelineCollapsePanelKey,
					label: titleContent,
					children:
						timelineItems && timelineItems.length > 0 ? (
							<Timeline className={styles.timeline} items={timelineItems} />
						) : null,
				},
			],
			[titleContent, timelineItems, styles.timeline],
		)

		const onTimelineCollapseChange = useMemoizedFn((keys: string[]) => {
			if (keys.includes(TimelineCollapsePanelKey)) {
				setTrue()
			} else {
				setFalse()
			}
		})

		if (!content) return null

		if (content.error) {
			return <ErrorContent />
		}

		return (
			<MagicCitationProvider sources={content.search?.["0"]}>
				<ConfigProvider theme={configProviderTheme}>
					<Flex vertical className={styles.container}>
						<Flex
							vertical
							className={styles.timelineContainer}
							style={{
								background: content?.finish
									? magicColorUsages.primaryLight.default
									: "transparent",
							}}
						>
							{/* 顶部问题搜索区域 */}
							<MagicCollapse
								className={styles.questionCollapse}
								style={
									content.finish
										? {
											// 避免展开情况，撑开宽度
											maxWidth: size?.width,
										}
										: {
											margin: "-10px",
											// 避免展开情况，撑开宽度
											maxWidth: "unset",
										}
								}
								expandIcon={({ isActive }) => (
									<MagicIcon
										color="currentColor"
										component={isActive ? IconChevronUp : IconChevronDown}
									/>
								)}
								activeKey={collapsed ? [TimelineCollapsePanelKey] : []}
								items={questionItems}
								onChange={onTimelineCollapseChange}
							/>
						</Flex>
						{/* 总结区域 */}
						<div className={styles.summary} ref={summaryRef}>
							{reasoningContent || llmResponse ? (
								<Markdown
									content={llmResponse}
									reasoningContent={reasoningContent}
									isStreaming={isStreaming}
									isReasoningStreaming={isReasoningStreaming}
								/>
							) : null}
							{llmResponse && content?.mind_map ? (
								<MindMap
									data={content.mind_map}
									pptData={content.ppt}
									className={styles.mindmap}
								/>
							) : null}
						</div>
						{/* 思维导图、事件、搜索来源 */}
						<MagicCollapse className={styles.collapse} items={collapseItems} />
					</Flex>
				</ConfigProvider>
			</MagicCitationProvider>
		)
	},
)

export default MagicAggregateAISearchCard
