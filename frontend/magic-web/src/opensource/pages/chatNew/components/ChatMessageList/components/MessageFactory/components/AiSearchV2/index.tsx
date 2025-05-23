// React 相关
import { useMemo, useRef } from "react"
import { observer } from "mobx-react-lite"

// 类型导入
import type {
	AggregateAISearchCardContentV2,
	AggregateAISearchCardSearch,
} from "@/types/chat/conversation_message"
import type { TimelineProps } from "antd"
import {
	AggregateAISearchCardDataType,
	AggregateAISearchCardDeepLevel,
	AggregateAISearchCardV2Status,
} from "@/types/chat/conversation_message"
import { StreamStatus } from "@/types/request"

// UI 组件库
import { ConfigProvider, Flex, Timeline } from "antd"
import MagicCollapse from "@/opensource/components/base/MagicCollapse"
import MagicIcon from "@/opensource/components/base/MagicIcon"

// 图标
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"

// 工具函数/Hooks
import { useBoolean, useMemoizedFn, useSize, useUpdateEffect } from "ahooks"
import { camelCase, isEmpty, keyBy } from "lodash-es"
import { resolveToString } from "@dtyq/es6-template-strings"
import { useTranslation } from "react-i18next"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import { useTheme } from "antd-style"

// 样式
import useStyles from "./styles"

// 常量
import { TimeLineDotStatus } from "./const"

// 本地组件
import TimeLineDot from "./components/TimeLineDot"
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
import MagicCitationProvider from "../Markdown/EnhanceMarkdown/components/MagicCitation/Provider"

const configProviderTheme = {
	components: {
		Collapse: {
			motionDurationMid: "0.25s",
		},
	},
}

interface MagicAggregateAISearchCardV2Props {
	content?: AggregateAISearchCardContentV2
}

const TimelineCollapsePanelKey = "timeline"

const MagicAggregateAISearchCardV2 = observer(({ content }: MagicAggregateAISearchCardV2Props) => {
	const { fontSize } = useFontSize()
	const { t } = useTranslation("interface")
	const { magicColorUsages } = useTheme()

	const summaryRef = useRef<HTMLDivElement>(null)

	const size = useSize(summaryRef)

	/** 总结内容 */
	const llmResponse = content?.summary?.content

	/** 是否搜索结束 */
	const isSearchingFinish = useMemo(() => {
		if (content?.stream_options?.status === StreamStatus.End) return true

		switch (content?.search_deep_level) {
			case AggregateAISearchCardDeepLevel.Simple:
				return Boolean(content?.summary?.reasoning_content || content?.summary?.content)
			case AggregateAISearchCardDeepLevel.Deep:
				if (isEmpty(content?.associate_questions)) return false

				const questionFinished =
					content?.stream_options?.steps_finished?.associate_questions

				return (
					questionFinished?.["question_0"]?.finished_reason === 0 &&
					content?.associate_questions["question_0"].every(
						(i) =>
							questionFinished?.[`question_${i.question_id}`]?.finished_reason === 0,
					)
				)
			default:
				return false
		}
	}, [
		content?.associate_questions,
		content?.search_deep_level,
		content?.stream_options?.status,
		content?.stream_options?.steps_finished?.associate_questions,
		content?.summary?.content,
		content?.summary?.reasoning_content,
	])

	const { styles } = useStyles({
		fontSize,
		isSearchingFinish,
		hasLlmResponse: content?.stream_options?.status === StreamStatus.End,
	})

	const isSimpleSearch = useMemo(() => {
		return (
			!content?.search_deep_level ||
			content?.search_deep_level === AggregateAISearchCardDeepLevel.Simple
		)
	}, [content?.search_deep_level])

	const [collapsed, { setFalse, setTrue }] = useBoolean(
		!(content?.stream_options?.status === StreamStatus.End || isSimpleSearch),
	)

	const allPages = content?.no_repeat_search_details
	const finish = content?.stream_options?.status === StreamStatus.End

	/** 问题搜索区域标题 */
	const titleContent = useMemo(() => {
		if (content?.status === AggregateAISearchCardV2Status.isSearching) {
			return (
				<Searching
					deepLevel={content?.search_deep_level}
					hasAssociateQuestions={!isEmpty(content?.associate_questions)}
				/>
			)
		}

		if (content?.status === AggregateAISearchCardV2Status.isReading) {
			return (
				<Reading
					deepLevel={content?.search_deep_level}
					allPages={
						content?.search_web_pages?.find((i) => i.question_id === "question_0")
							?.search
					}
				/>
			)
		}

		if (content?.status === AggregateAISearchCardV2Status.isReasoning) {
			return <Reasoning />
		}

		if (content?.status === AggregateAISearchCardV2Status.isSummarizing || !finish) {
			return <Summarizing />
		}

		return (
			<Result
				deepLevel={content?.search_deep_level}
				pageLength={allPages?.length}
				searchWebPages={content?.search_web_pages}
			/>
		)
	}, [
		allPages?.length,
		content?.associate_questions,
		content?.search_deep_level,
		content?.search_web_pages,
		content?.status,
		finish,
	])

	const collapseItems = useMemo(() => {
		const datas = []

		// 如果有事件，则显示事件
		if (content?.events && content?.events.length > 0) {
			datas.push({
				key: AggregateAISearchCardDataType.Event,
				label: (
					<Flex align="center" gap={10}>
						{t("chat.aggregate_ai_search_card.relatedEvents")}
						<span className={styles.labelCount}>{content.events.length}</span>
					</Flex>
				),
				children: <EventTable events={content.events} />,
			})
		}

		const allSearch = content?.no_repeat_search_details ?? []

		// 如果搜索结果不为空，并且搜索结束，则显示搜索结果
		if (allSearch.length > 0 && content?.stream_options?.status === StreamStatus.End) {
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
						{allSearch?.map((item, index) => (
							<li key={`${item.id}_${index}`}>
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
	}, [
		content?.events,
		content?.no_repeat_search_details,
		content?.stream_options?.status,
		styles.labelCount,
		styles.sourceList,
		t,
	])

	// 如果搜索结束，则折叠
	useUpdateEffect(() => {
		if (isSearchingFinish) {
			setFalse()
		}
	}, [isSearchingFinish])

	// 如果是深度搜索，且搜索未结束，则展开
	useUpdateEffect(() => {
		if (
			content?.search_deep_level === 2 &&
			content.stream_options?.status !== StreamStatus.End
		) {
			setTrue()
		}
	}, [content?.search_deep_level, content?.stream_options?.status])

	const timelineItems = useMemo(() => {
		if (content?.search_deep_level !== 2) {
			const keywords =
				content?.associate_questions?.["question_ 0"]?.map((i) => i.question) ?? []

			return [
				{
					key: "searching_page",
					dot: (
						<TimeLineDot
							status={
								content?.stream_options?.status === StreamStatus.End ||
								keywords.length
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
				content?.status !== AggregateAISearchCardV2Status.isSearching
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
												<SourceItem
													key={item.id}
													name={item.name}
													url={item.url}
													datePublished={item.datePublished}
												/>
											</Flex>
										)
									})}
								</Flex>
							),
					  }
					: null,
			].filter(Boolean) as TimelineProps["items"]
		}

		const titleMap = keyBy(content?.associate_questions?.["question_0"] ?? [], "question_id")
		const searchWebPages = keyBy(content?.search_web_pages ?? [], "question_id")

		return content?.associate_questions?.["question_0"]
			.map(({ question_id }, index) => {
				const questionId = question_id
				const item = content?.associate_questions?.[`question_${questionId}`]

				const status = item ? TimeLineDotStatus.SUCCESS : TimeLineDotStatus.PENDING

				const isPending =
					content.stream_options?.status !== StreamStatus.End && !isSearchingFinish

				// const searchCount = null
				const { page_count: searchCount = 0, search = [] } =
					searchWebPages?.[questionId] ?? {}

				return {
					key: questionId,
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
								{titleMap[questionId]?.question}
							</span>
							<SearchKeywords items={search?.map((i) => i.name)} />
							<div className={styles.questionReadCount}>
								{isPending || !searchCount ? (
									<SearchingQuestion searchArray={search?.map((i) => i.name)} />
								) : (
									resolveToString(
										t("chat.aggregate_ai_search_card.questionReadCount"),
										{
											count: search?.length ?? 0,
										},
									)
								)}
							</div>
						</Flex>
					),
				}
			})
			.filter(Boolean) as TimelineProps["items"]
	}, [
		allPages,
		content?.associate_questions,
		content?.search_deep_level,
		content?.search_web_pages,
		content?.status,
		content?.stream_options?.status,
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

	const normalizeSources = useMemo(() => {
		return content?.no_repeat_search_details?.map((i) =>
			Object.entries(i).reduce((acc, [key, value]) => {
				// @ts-ignore
				acc[camelCase(key)] = value
				return acc
			}, {} as AggregateAISearchCardSearch),
		)
	}, [content?.no_repeat_search_details])

	if (!content) return null

	return (
		<MagicCitationProvider sources={normalizeSources}>
			<ConfigProvider theme={configProviderTheme}>
				<Flex vertical className={styles.container}>
					<Flex
						vertical
						className={styles.timelineContainer}
						style={{
							background: finish
								? magicColorUsages.primaryLight.default
								: "transparent",
						}}
					>
						{/* 顶部问题搜索区域 */}
						<MagicCollapse
							className={styles.questionCollapse}
							style={
								finish
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
						{content.summary?.reasoning_content || llmResponse ? (
							<Markdown
								content={llmResponse}
								reasoningContent={content?.summary?.reasoning_content}
								isStreaming={
									content.status === AggregateAISearchCardV2Status.isSummarizing
								}
								isReasoningStreaming={
									content.status === AggregateAISearchCardV2Status.isReasoning
								}
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
})

export default MagicAggregateAISearchCardV2
