import { useState, useCallback, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { ArticleDetail, SelfMediaInitGlobalSettings } from "../../types"
import { generateTopics } from "../../../../services/selfMediaAiGenerate"
import type { GeneratedTopic } from "../../../../services/selfMediaAiGenerate"
import ModelSelector from "../../components/picker/ModelSelector"
import ReferenceFilePicker from "../../components/picker/ReferenceFilePicker"
import InlineVoiceButton from "../../components/ui/InlineVoiceButton"
import type { ReferenceFileValue } from "../../types"

interface StepTopicListProps {
	articles: ArticleDetail[]
	onChange: (articles: ArticleDetail[]) => void
	globalSettings: SelfMediaInitGlobalSettings
	onCanProceed?: (can: boolean) => void
}

function createEmptyArticle(): ArticleDetail {
	return {
		title: "",
		folderName: "",
		style: "professional",
		outline: [],
		cardCount: 6,
		materials: [],
		notes: "",
		platform: "rednote",
	}
}

function createArticleFromTopic(topic: GeneratedTopic): ArticleDetail {
	return {
		title: topic.title,
		folderName: "",
		style: "professional",
		outline: [],
		cardCount: 6,
		materials: [],
		notes: topic.description,
		platform: "rednote",
	}
}

export default function StepTopicList({
	articles,
	onChange,
	globalSettings,
	onCanProceed,
}: StepTopicListProps & { onCanProceed?: (can: boolean) => void }) {
	const [aiGenerating, setAiGenerating] = useState(false)
	const [aiDirection, setAiDirection] = useState("")
	const [showAiPanel, setShowAiPanel] = useState(true)
	const [aiError, setAiError] = useState("")
	const [topicModel, setTopicModel] = useState("")
	const [topicCount, setTopicCount] = useState(5)
	const [referenceFile, setReferenceFile] = useState<ReferenceFileValue | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const { t } = useTranslation("super")

	const handleAdd = useCallback(() => {
		onChange([...articles, createEmptyArticle()])
	}, [articles, onChange])

	const handleRemove = useCallback(
		(index: number) => {
			onChange(articles.filter((_, i) => i !== index))
		},
		[articles, onChange],
	)

	const handleTitleChange = useCallback(
		(index: number, title: string) => {
			const updated = [...articles]
			updated[index] = { ...updated[index], title }
			onChange(updated)
		},
		[articles, onChange],
	)

	const handleFolderNameChange = useCallback(
		(index: number, folderName: string) => {
			const updated = [...articles]
			updated[index] = { ...updated[index], folderName }
			onChange(updated)
		},
		[articles, onChange],
	)

	const handleAiGenerate = useCallback(async () => {
		if (!globalSettings.author || !globalSettings.brandPosition) return
		setAiGenerating(true)
		setAiError("")

		const controller = new AbortController()
		abortRef.current = controller

		try {
			const topics = await generateTopics({
				global: globalSettings,
				count: topicCount,
				direction: aiDirection || undefined,
				referenceText: referenceFile?.content || undefined,
				model: topicModel || undefined,
				signal: controller.signal,
			})

			if (topics.length > 0) {
				const newArticles = topics.map(createArticleFromTopic)
				onChange([...articles, ...newArticles])
				setShowAiPanel(false)
			} else {
				setAiError(t("detail.selfMedia.initPanel.stepTopic.errorEmpty"))
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setAiError(t("detail.selfMedia.initPanel.stepTopic.errorNetwork"))
			}
		} finally {
			setAiGenerating(false)
			abortRef.current = null
		}
	}, [globalSettings, aiDirection, referenceFile, topicModel, topicCount, articles, onChange])

	const handleAbort = useCallback(() => {
		abortRef.current?.abort()
		setAiGenerating(false)
	}, [])

	useEffect(() => {
		if (onCanProceed) onCanProceed(articles.length > 0)
	}, [articles.length, onCanProceed])

	return (
		<div className="mx-auto max-w-xl">
			<div className="mb-6 text-center">
				<h2 className="mb-2 text-xl font-bold tracking-tight">
					{t("detail.selfMedia.initPanel.stepTopic.title")}
				</h2>
				<p className="text-sm text-muted-foreground">
					{t("detail.selfMedia.initPanel.stepTopic.subtitle")}
				</p>
			</div>

			{/* AI Generation Panel */}
			<div className="mb-6">
				{!showAiPanel ? (
					<button
						type="button"
						className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-primary/[0.02] px-4 py-4 text-sm font-medium text-primary transition-all hover:border-primary/50 hover:from-primary/10 hover:to-primary/5 hover:shadow-sm active:scale-[0.99]"
						onClick={() => setShowAiPanel(true)}
						data-testid="set-show-ai-panel"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							data-testid="step-topic-list-svg"
						>
							<path d="M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9" />
						</svg>
						{t("detail.selfMedia.initPanel.stepTopic.aiGenerateBtn")}
					</button>
				) : (
					<div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/[0.02] p-5 shadow-sm">
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="text-primary"
										data-testid="step-topic-list-svg-2"
									>
										<path d="M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9" />
									</svg>
								</div>
								<span className="text-sm font-semibold text-foreground">
									{t("detail.selfMedia.initPanel.stepTopic.aiAssistantTitle")}
								</span>
							</div>
							<button
								type="button"
								className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
								onClick={() => {
									setShowAiPanel(false)
									setAiError("")
								}}
								data-testid="set-show-ai-panel-2"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									data-testid="step-topic-list-svg-3"
								>
									<path d="M18 6 6 18M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div className="mb-3">
							<div className="group relative">
								<input
									type="text"
									className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-7 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
									placeholder={t(
										"detail.selfMedia.initPanel.stepTopic.directionPlaceholder",
									)}
									value={aiDirection}
									onChange={(e) => setAiDirection(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !aiGenerating) {
											handleAiGenerate()
										}
									}}
									disabled={aiGenerating}
									data-testid="set-ai-direction"
								/>
								<InlineVoiceButton value={aiDirection} onResult={setAiDirection} />
							</div>
						</div>

						<div className="mb-3">
							<ReferenceFilePicker
								value={referenceFile ? [referenceFile] : []}
								onChange={(files) => setReferenceFile(files[0] ?? null)}
								maxFiles={1}
								disabled={aiGenerating}
								onError={setAiError}
							/>
						</div>

						{aiError && <p className="mb-3 text-xs text-destructive">{aiError}</p>}

						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<p className="flex items-center gap-1 text-xs text-muted-foreground">
									<span>
										{t("detail.selfMedia.initPanel.stepTopic.generateCount")}
									</span>
									<input
										type="number"
										min={1}
										max={20}
										className="w-12 rounded border border-input bg-background px-1.5 py-0.5 text-center text-xs focus:border-primary focus:outline-none"
										value={topicCount}
										onChange={(e) =>
											setTopicCount(
												Math.max(
													1,
													Math.min(20, parseInt(e.target.value) || 1),
												),
											)
										}
										disabled={aiGenerating}
										data-testid="set-topic-count"
									/>
									<span>
										{t(
											"detail.selfMedia.initPanel.stepTopic.generateCountUnit",
										)}
									</span>
								</p>
								<ModelSelector value={topicModel} onChange={setTopicModel} />
							</div>
							{aiGenerating ? (
								<button
									type="button"
									className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80"
									onClick={handleAbort}
									data-testid="handle-abort"
								>
									<svg
										className="animate-spin"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										data-testid="step-topic-list-svg-4"
									>
										<path d="M21 12a9 9 0 1 1-6.219-8.56" />
									</svg>
									{t("detail.selfMedia.initPanel.stepTopic.stopBtn")}
								</button>
							) : (
								<button
									type="button"
									className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.97]"
									onClick={handleAiGenerate}
									data-testid="handle-ai-generate"
								>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										data-testid="step-topic-list-svg-5"
									>
										<path d="M12 2v4M16.2 7.8l2.9-2.9M18 12h4" />
									</svg>
									{t("detail.selfMedia.initPanel.stepTopic.generateBtn")}
								</button>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Topic list */}
			<div className="flex flex-col gap-3">
				{articles.map((article, index) => (
					<div
						key={index}
						className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background p-4 shadow-sm transition-all hover:border-border hover:shadow-md"
					>
						<span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary">
							{index + 1}
						</span>
						<div className="flex flex-1 flex-col gap-2">
							<div className="group relative">
								<input
									type="text"
									className="w-full rounded-lg border-0 bg-transparent px-1 py-1 pr-7 text-sm font-medium placeholder:text-muted-foreground/50 focus:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
									placeholder={t(
										"detail.selfMedia.initPanel.stepTopic.titlePlaceholder",
									)}
									value={article.title}
									onChange={(e) => handleTitleChange(index, e.target.value)}
									data-testid="handle-title-change"
								/>
								<InlineVoiceButton
									value={article.title}
									onResult={(text) => handleTitleChange(index, text)}
								/>
							</div>
							<div className="group relative">
								<input
									type="text"
									className="w-full rounded-lg border-0 bg-transparent px-1 py-0.5 pr-7 text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
									placeholder={t(
										"detail.selfMedia.initPanel.stepTopic.folderPlaceholder",
									)}
									value={article.folderName}
									onChange={(e) => handleFolderNameChange(index, e.target.value)}
									data-testid="handle-folder-name-change"
								/>
								<InlineVoiceButton
									value={article.folderName}
									onResult={(text) => handleFolderNameChange(index, text)}
								/>
							</div>
							{article.notes && (
								<p className="px-1 text-xs text-muted-foreground/80 line-clamp-1">
									{article.notes}
								</p>
							)}
						</div>
						<button
							type="button"
							className={cn(
								"mt-2 shrink-0 rounded-md p-1.5 text-muted-foreground/50 transition-all hover:bg-destructive/10 hover:text-destructive",
							)}
							onClick={() => handleRemove(index)}
							data-testid="handle-remove"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								data-testid="step-topic-list-svg-6"
							>
								<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
						</button>
					</div>
				))}
			</div>

			{/* Manual add button */}
			<button
				type="button"
				className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-3.5 text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/30 hover:text-primary"
				onClick={handleAdd}
				data-testid="handle-add"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					data-testid="step-topic-list-svg-7"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
				{t("detail.selfMedia.initPanel.stepTopic.addManual")}
			</button>

			{articles.length > 0 && (
				<p className="mt-4 text-center text-xs text-muted-foreground">
					{t("detail.selfMedia.initPanel.stepTopic.totalTopics", {
						count: articles.length,
					})}
				</p>
			)}
		</div>
	)
}
