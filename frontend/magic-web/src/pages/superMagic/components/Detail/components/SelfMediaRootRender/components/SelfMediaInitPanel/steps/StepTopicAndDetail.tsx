import { useState, useCallback } from "react"
import type { ArticleDetail, SelfMediaInitGlobalSettings } from "../types"
import {
	generateTopics,
	generateTopicsWithDetails,
	parseOutlineFromText,
	reconcileCardCountWithOutline,
} from "../../../services/selfMediaAiGenerate"
import { buildDefaultArticleFolderName } from "../../../services/selfMediaPromptBuilder"
import type { GeneratedTopic } from "../../../services/selfMediaAiGenerate"
import type { SelfMediaPlatform } from "../../../../../types"
import type { SelfMediaFileStorageService } from "../../../services/SelfMediaFileStorageService"
import { cn } from "@/utils/cn"
import AiTopicAssistant from "../components/ai/AiTopicAssistant"
import ArticleCard from "../components/article/ArticleCard"
import StepTopicArticleNavigator from "./StepTopicArticleNavigator"
import StepTopicHero from "./StepTopicHero"
import StepTopicWorkspaceHeader from "./StepTopicWorkspaceHeader"
import "./StepTopicAndDetail.css"

interface StepTopicAndDetailProps {
	articles: ArticleDetail[]
	onChange: (articles: ArticleDetail[]) => void
	onArticleUpdate: (index: number, article: ArticleDetail) => void
	globalSettings: SelfMediaInitGlobalSettings
	onPersistDraft?: () => void
	fileStorageService?: SelfMediaFileStorageService | null
}

function createEmptyArticle(index: number): ArticleDetail {
	return {
		title: "",
		folderName: buildDefaultArticleFolderName("", index),
		style: "professional",
		outline: [],
		cardCount: 6,
		materials: [],
		notes: "",
		platform: "rednote",
	}
}

function createArticleFromTopic(topic: GeneratedTopic, index: number): ArticleDetail {
	return {
		title: topic.title,
		folderName: buildDefaultArticleFolderName(topic.title, index),
		style: "professional",
		outline: [],
		cardCount: 6,
		materials: [],
		notes: "",
		description: topic.description,
		platform: "rednote",
	}
}

export default function StepTopicAndDetail({
	articles,
	onChange,
	onArticleUpdate,
	globalSettings,
	onPersistDraft,
	fileStorageService,
}: StepTopicAndDetailProps) {
	const [activeIndex, setActiveIndex] = useState(0)
	const [slideDirection, setSlideDirection] = useState<"left" | "right">("left")
	const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null)
	const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
	const [focusTitleRequest, setFocusTitleRequest] = useState(0)

	// Clamp activeIndex when articles count changes
	const safeActiveIndex = Math.min(Math.max(0, activeIndex), Math.max(0, articles.length - 1))

	const handleAdd = useCallback(() => {
		const newArticle = createEmptyArticle(articles.length)
		onChange([...articles, newArticle])
		setActiveIndex(articles.length) // Focus on the newly added article
		setSlideDirection("left")
		setFocusTitleRequest((request) => request + 1)
	}, [articles, onChange])

	const handleRemove = useCallback(
		(index: number) => {
			const updated = articles.filter((_, i) => i !== index)
			onChange(updated)
			setPendingRemoveIndex(null)
			setActiveIndex((currentIndex) => {
				if (updated.length === 0) return 0
				if (index < currentIndex) return currentIndex - 1
				if (index === currentIndex) return Math.min(currentIndex, updated.length - 1)
				return currentIndex
			})
			if (updated.length > 0) {
				setFocusTitleRequest((request) => request + 1)
			}
		},
		[articles, onChange],
	)

	const handlePrevArticle = useCallback(() => {
		if (safeActiveIndex > 0) {
			setSlideDirection("right")
			setActiveIndex(safeActiveIndex - 1)
		}
	}, [safeActiveIndex])

	const handleNextArticle = useCallback(() => {
		if (safeActiveIndex < articles.length - 1) {
			setSlideDirection("left")
			setActiveIndex(safeActiveIndex + 1)
		}
	}, [safeActiveIndex, articles.length])

	const handleSelectArticle = useCallback(
		(index: number) => {
			setSlideDirection(index > safeActiveIndex ? "left" : "right")
			setActiveIndex(index)
		},
		[safeActiveIndex],
	)

	const handleAiGenerate = useCallback(
		async (params: {
			direction?: string
			referenceFiles?: { content?: string }[]
			model?: string
			count: number
			generateWithDetails: boolean
			signal: AbortSignal
		}): Promise<boolean> => {
			const referenceText =
				params.referenceFiles
					?.map((f) => f.content)
					.filter(Boolean)
					.join("\n\n") || undefined

			if (params.generateWithDetails) {
				const topics = await generateTopicsWithDetails({
					global: globalSettings,
					count: params.count,
					direction: params.direction,
					referenceText,
					model: params.model,
					signal: params.signal,
				})

				if (topics.length > 0) {
					const newArticles: ArticleDetail[] = topics.map((topic, offset) => {
						const outline = topic.outline ? parseOutlineFromText(topic.outline) : []
						const platform = (topic.platform as SelfMediaPlatform) || "rednote"
						const articleIndex = articles.length + offset
						return {
							title: topic.title,
							folderName: buildDefaultArticleFolderName(topic.title, articleIndex),
							style: topic.style || "professional",
							visualPreset: topic.visualPreset || "none",
							outline,
							cardCount: reconcileCardCountWithOutline(
								platform,
								topic.cardCount,
								outline,
								topic.outline,
							),
							materials: [],
							notes: "",
							description: topic.description || "",
							platform,
						}
					})
					onChange([...articles, ...newArticles])
					setActiveIndex(articles.length) // focus on first newly generated topic
					setFocusTitleRequest((request) => request + 1)
					return true
				}
				return false
			} else {
				const topics = await generateTopics({
					global: globalSettings,
					count: params.count,
					direction: params.direction,
					referenceText,
					model: params.model,
					signal: params.signal,
				})

				if (topics.length > 0) {
					const newArticles = topics.map((topic, offset) =>
						createArticleFromTopic(topic, articles.length + offset),
					)
					onChange([...articles, ...newArticles])
					setActiveIndex(articles.length) // focus on first newly generated topic
					setFocusTitleRequest((request) => request + 1)
					return true
				}
				return false
			}
		},
		[globalSettings, articles, onChange],
	)

	return (
		<div className="mx-auto max-w-5xl space-y-6 px-3 py-5 sm:px-4 sm:py-7">
			<StepTopicHero articleCount={articles.length} onAdd={handleAdd} />

			<AiTopicAssistant onGenerate={handleAiGenerate} />

			{articles.length > 0 ? (
				<div data-self-media-topic-container>
					<div
						className="grid min-h-[550px] grid-cols-1 items-start gap-6"
						data-self-media-topic-layout
						data-topic-navigator-collapsed={isLeftCollapsed}
					>
						<StepTopicArticleNavigator
							articles={articles}
							activeIndex={safeActiveIndex}
							collapsed={isLeftCollapsed}
							pendingRemoveIndex={pendingRemoveIndex}
							onCollapsedChange={setIsLeftCollapsed}
							onSelectArticle={handleSelectArticle}
							onAdd={handleAdd}
							onRequestRemove={setPendingRemoveIndex}
							onCancelRemove={() => setPendingRemoveIndex(null)}
							onConfirmRemove={handleRemove}
						/>

						<div
							className="relative flex select-text flex-col space-y-5"
							data-self-media-topic-workspace
						>
							<StepTopicWorkspaceHeader
								article={articles[safeActiveIndex]}
								activeIndex={safeActiveIndex}
								articleCount={articles.length}
								canPrev={safeActiveIndex > 0}
								canNext={safeActiveIndex < articles.length - 1}
								focusTitleRequest={focusTitleRequest}
								onArticleUpdate={(updated) =>
									onArticleUpdate(safeActiveIndex, updated)
								}
								onPrev={handlePrevArticle}
								onNext={handleNextArticle}
							/>

							<div className="w-full min-w-0 flex-1">
								<div
									key={safeActiveIndex}
									className={cn(
										"w-full rounded-b-none rounded-t-[28px] bg-white/95 p-5 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_20px_60px_rgba(47,43,36,0.08)]",
										slideDirection === "left"
											? "duration-300 animate-in fade-in slide-in-from-right-4"
											: "duration-300 animate-in fade-in slide-in-from-left-4",
									)}
								>
									<ArticleCard
										index={safeActiveIndex}
										article={articles[safeActiveIndex]}
										globalSettings={globalSettings}
										onUpdate={(updated) =>
											onArticleUpdate(safeActiveIndex, updated)
										}
										onRemove={() => handleRemove(safeActiveIndex)}
										onPersistDraft={onPersistDraft}
										fileStorageService={fileStorageService}
										hideHeader={true}
										alwaysExpanded={true}
										showFolderField={false}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	)
}
