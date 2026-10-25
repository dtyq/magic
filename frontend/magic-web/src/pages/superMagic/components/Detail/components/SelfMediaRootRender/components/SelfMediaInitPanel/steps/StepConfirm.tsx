import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import superMagicService from "@/pages/superMagic/services"
import type { SelfMediaInitData } from "../types"
import { ALL_PLATFORMS, STYLE_PRESETS } from "../types"
import {
	navigateToBatchTopic,
	sendArticleBatch,
	type ArticleBatchTopicItem,
} from "../../../services/selfMediaBatchSend"
import { prefillSelfMediaMagicProjectIndex, type AttachmentNode } from "../../../services"
import { ensureArticlePostAssetDirectories } from "../../../services/selfMediaPostPaths"
import { CheckCircle, Bookmark } from "lucide-react"
import InlineVoiceButton from "../components/ui/InlineVoiceButton"
import { ConfirmBrandSummary, StepConfirmArticleList, StepConfirmHeader } from "./StepConfirmBlocks"
import StepConfirmModelSettings from "./StepConfirmModelSettings"
import StepConfirmProgressScreen, { type GenerationPhase } from "./StepConfirmProgressScreen"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

export interface StepConfirmFooterAction {
	label: string
	onClick: () => void
	disabled?: boolean
	disabledReason?: string
}

interface StepConfirmProps {
	data: SelfMediaInitData
	selectedProject?: { id: string } | null
	folderFileId?: string
	folderPath?: string
	attachmentList?: AttachmentNode[]
	onSaveTemplate?: (name: string) => Promise<void>
	onArchiveDraft?: () => Promise<void>
	onGenerateFailed?: () => void
	onBackHome?: () => void
	onFooterActionChange?: (action: StepConfirmFooterAction | null) => void
	onExecutionLockedChange?: (locked: boolean) => void
}

export default function StepConfirm({
	data,
	selectedProject,
	folderFileId,
	folderPath,
	attachmentList,
	onSaveTemplate,
	onArchiveDraft,
	onGenerateFailed,
	onBackHome,
	onFooterActionChange,
	onExecutionLockedChange,
}: StepConfirmProps) {
	const [sending, setSending] = useState(false)
	const [sent, setSent] = useState(false)
	const [batchTopics, setBatchTopics] = useState<ArticleBatchTopicItem[]>([])
	const [activeTopicId, setActiveTopicId] = useState<string | null>(null)
	const [createdTopicCount, setCreatedTopicCount] = useState(0)
	const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle")
	const [showTemplateNameInput, setShowTemplateNameInput] = useState(false)
	const [templateName, setTemplateName] = useState("")
	const [templateSaved, setTemplateSaved] = useState(false)
	const [selectedModelId, setSelectedModelId] = useState<string>("")
	const [selectedImageModelId, setSelectedImageModelId] = useState<string>("")
	const [selectedVideoModelId, setSelectedVideoModelId] = useState<string>("")
	const completeSummaryRef = useRef<HTMLDivElement>(null)
	const { t } = useTranslation("super")
	const fileApi = useFileApi()

	const projectId = selectedProject?.id || ""
	const isProjectReady = Boolean(projectId)

	const getStyleLabel = (value: string): string => {
		const preset = STYLE_PRESETS.find((p) => p.value === value)
		return preset ? t(preset.labelKey) : value
	}

	const getPlatformLabel = (value: string): string => {
		const platform = ALL_PLATFORMS.find((p) => p.value === value)
		return platform ? t(platform.labelKey) : value
	}

	const handleSwitchTopic = useCallback(
		(item: ArticleBatchTopicItem) => {
			if (!projectId) return
			setActiveTopicId(item.topicId)
			navigateToBatchTopic(projectId, item.topic)
		},
		[projectId],
	)

	const handleGenerate = useCallback(async () => {
		if (sending || sent || !projectId) return
		setSending(true)
		setGenerationPhase("archiving")
		setBatchTopics([])
		setActiveTopicId(null)
		setCreatedTopicCount(0)

		let isFirstTopic = true

		try {
			const selfMediaProjectDirectory = folderPath
				? {
						directoryId: folderFileId,
						directoryPath: folderPath,
						directoryName: folderPath.split("/").filter(Boolean).pop(),
					}
				: undefined
			await onArchiveDraft?.()
			const postTargets = await ensureArticlePostAssetDirectories({
				projectId,
				rootDirectoryId: folderFileId,
				rootPath: folderPath,
				articles: data.articles,
				existingNodes: attachmentList,
			})
			await prefillSelfMediaMagicProjectIndex({
				articles: data.articles,
				attachmentList,
				folderFileId,
				postTargets,
				fileApi,
			})
			setGenerationPhase("creating-topic")
			const created = await sendArticleBatch({
				articles: data.articles,
				globalSettings: data.global,
				selectedProject,
				modelId: selectedModelId || undefined,
				imageModelId: selectedImageModelId || undefined,
				videoModelId: selectedVideoModelId || undefined,
				selfMediaProjectDirectory,
				postTargets,
				onTopicCreated: (item) => {
					setBatchTopics((prev) => [...prev, item])
					if (isFirstTopic) {
						isFirstTopic = false
						setActiveTopicId(item.topicId)
						navigateToBatchTopic(projectId, item.topic)
					}
				},
				onProgress: (phase) => {
					setGenerationPhase(phase)
				},
			})

			if (created.length === 0) {
				throw new Error("No self-media creation topics were created")
			}

			setCreatedTopicCount(created.length)
			await superMagicService.topic.fetchTopics({
				projectId,
				isAutoSelect: false,
			})

			setSent(true)
		} catch (error) {
			onGenerateFailed?.()
			console.error("Failed to send batch:", error)
		} finally {
			setSending(false)
			setGenerationPhase("idle")
		}
	}, [
		fileApi,
		attachmentList,
		data.articles,
		data.global,
		folderFileId,
		folderPath,
		onArchiveDraft,
		onGenerateFailed,
		projectId,
		selectedImageModelId,
		selectedModelId,
		selectedProject,
		selectedVideoModelId,
		sending,
		sent,
	])

	const handleSaveTemplate = async () => {
		if (!templateName.trim() || !onSaveTemplate) return
		try {
			await onSaveTemplate(templateName.trim())
			setTemplateSaved(true)
			setShowTemplateNameInput(false)
		} catch {
			// silent
		}
	}

	useEffect(() => {
		if (!sent) return
		completeSummaryRef.current?.focus()
	}, [sent])

	useEffect(() => {
		onExecutionLockedChange?.(sent || sending)
	}, [onExecutionLockedChange, sending, sent])

	useEffect(() => {
		return () => onExecutionLockedChange?.(false)
	}, [onExecutionLockedChange])

	useEffect(() => {
		if (!onFooterActionChange) return

		if (sent || sending) {
			onFooterActionChange(null)
			return
		}

		const projectPendingHint = t("detail.selfMedia.initPanel.stepConfirm.projectPendingHint", {
			defaultValue: "项目准备完成后即可开始创作。",
		})

		onFooterActionChange({
			label: t("detail.selfMedia.initPanel.stepConfirm.startBtn", {
				count: data.articles.length,
			}),
			onClick: handleGenerate,
			disabled: !isProjectReady,
			disabledReason: isProjectReady ? undefined : projectPendingHint,
		})

		return () => onFooterActionChange(null)
	}, [
		data.articles.length,
		handleGenerate,
		isProjectReady,
		onFooterActionChange,
		sending,
		sent,
		t,
	])

	// Premium execution state screen (Sending / Completed)
	if (sent || sending) {
		return (
			<StepConfirmProgressScreen
				sent={sent}
				sending={sending}
				batchTopics={batchTopics}
				activeTopicId={activeTopicId}
				totalCount={data.articles.length}
				createdTopicCount={createdTopicCount}
				generationPhase={generationPhase}
				summaryRef={completeSummaryRef}
				onSwitchTopic={handleSwitchTopic}
				onBackHome={onBackHome}
				t={t}
			/>
		)
	}

	return (
		<div className="mx-auto flex min-h-full max-w-5xl flex-col px-3 sm:px-4">
			<div className="flex-1 space-y-5 py-6 pb-8 sm:py-8">
				<StepConfirmHeader articleCount={data.articles.length} t={t} />

				<StepConfirmArticleList
					articles={data.articles}
					getPlatformLabel={getPlatformLabel}
					getStyleLabel={getStyleLabel}
					t={t}
				/>

				<ConfirmBrandSummary global={data.global} t={t} />

				<StepConfirmModelSettings
					selectedModelId={selectedModelId}
					selectedImageModelId={selectedImageModelId}
					selectedVideoModelId={selectedVideoModelId}
					onModelChange={setSelectedModelId}
					onImageModelChange={setSelectedImageModelId}
					onVideoModelChange={setSelectedVideoModelId}
					t={t}
				/>

				{/* Save template — secondary utility below the review flow */}
				{onSaveTemplate && !templateSaved && (
					<section className="duration-200 animate-in fade-in">
						{showTemplateNameInput ? (
							<div className="flex flex-col gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_1px_rgba(255,255,255,0.82),0_14px_34px_rgba(24,24,27,0.07)]">
								<span className="text-xs font-medium text-muted-foreground">
									{t(
										"detail.selfMedia.initPanel.stepConfirm.templateNameLabel",
										"模板名称",
									)}
								</span>
								<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
									<div className="group relative flex-1">
										<Input
											type="text"
											className="h-10 rounded-full border-0 bg-[#f4f4f5] px-4 pr-9 text-xs font-semibold shadow-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/10"
											placeholder={t(
												"detail.selfMedia.initPanel.stepConfirm.templateNamePlaceholder",
												"输入模板名称",
											)}
											value={templateName}
											onChange={(e) => setTemplateName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleSaveTemplate()
											}}
											autoFocus
										/>
										<InlineVoiceButton
											value={templateName}
											onResult={setTemplateName}
										/>
									</div>
									<div className="flex shrink-0 gap-2">
										<Button
											type="button"
											size="sm"
											onClick={handleSaveTemplate}
											disabled={!templateName.trim()}
										>
											{t(
												"detail.selfMedia.initPanel.stepConfirm.saveTemplate",
												"保存",
											)}
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="rounded-full border-0 bg-[#f4f4f5] px-4 shadow-none hover:bg-[#e4e4e7]"
											onClick={() => setShowTemplateNameInput(false)}
										>
											{t("detail.selfMedia.initPanel.stepConfirm.cancel")}
										</Button>
									</div>
								</div>
							</div>
						) : (
							<Button
								type="button"
								variant="outline"
								className="h-12 w-full rounded-[24px] border-0 bg-white text-sm font-[760] shadow-[inset_0_1px_rgba(255,255,255,0.82),0_12px_30px_rgba(24,24,27,0.06)] hover:bg-[#f4f4f5]"
								onClick={() => setShowTemplateNameInput(true)}
							>
								<Bookmark size={13} className="text-[#71717a]" />
								<span>
									{t(
										"detail.selfMedia.initPanel.stepConfirm.saveAsTemplate",
										"保存当前设置为全新模板",
									)}
								</span>
							</Button>
						)}
					</section>
				)}

				{templateSaved && (
					<div className="flex items-center justify-center gap-2 rounded-[24px] bg-white py-3.5 text-sm font-[760] text-[#18181b] shadow-[inset_0_1px_rgba(255,255,255,0.82),0_12px_30px_rgba(24,24,27,0.06)] duration-300 animate-in fade-in">
						<CheckCircle size={14} />
						<span>
							{t(
								"detail.selfMedia.initPanel.stepConfirm.templateSaved",
								"模板保存成功",
							)}
						</span>
					</div>
				)}
			</div>
		</div>
	)
}
