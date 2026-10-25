/**
 * AiTopicAssistant - AI 选题助手面板
 */

import { useState, useCallback, useRef, useEffect, useId } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import AiActionButton from "./AiActionButton"
import AiTopicGeneratingCard from "./AiTopicGeneratingCard"
import ReferenceFilePicker from "../picker/ReferenceFilePicker"
import InlineVoiceButton from "../ui/InlineVoiceButton"
import type { ReferenceFileValue } from "../../types"

interface AiTopicAssistantProps {
	/** 是否禁用（如外部条件不满足） */
	disabled?: boolean
	/** 生成完成回调，传入方向/参考文件/模型/数量/是否含详情 */
	onGenerate: (params: {
		direction?: string
		referenceFiles?: ReferenceFileValue[]
		model?: string
		count: number
		generateWithDetails: boolean
		signal: AbortSignal
	}) => Promise<boolean>
}

export default observer(function AiTopicAssistant({ disabled, onGenerate }: AiTopicAssistantProps) {
	const [aiGenerating, setAiGenerating] = useState(false)
	const [aiDirection, setAiDirection] = useState("")
	const [aiError, setAiError] = useState("")
	const [topicModel, setTopicModel] = useState("")
	const [topicCount, setTopicCount] = useState(5)
	const [referenceFiles, setReferenceFiles] = useState<ReferenceFileValue[]>([])
	const [generateWithDetails, setGenerateWithDetails] = useState(true)
	const [lastGeneratedTopicCount, setLastGeneratedTopicCount] = useState<number | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const { t } = useTranslation("super")
	const topicCountHintId = useId()
	const topicCountLabel = t("detail.selfMedia.initPanel.stepTopic.generateCount")
	const topicCountInputLabel = t(
		"detail.selfMedia.initPanel.stepTopic.generateCountInputLabel",
		"生成数量",
	)
	const topicCountUnit = t("detail.selfMedia.initPanel.stepTopic.generateCountUnit")
	const topicCountHint = t(
		"detail.selfMedia.initPanel.stepTopic.generateCountHint",
		"建议一次生成 3-5 个，便于挑选",
	)
	const clearGeneratedStatus = useCallback(() => {
		setLastGeneratedTopicCount(null)
	}, [])

	const handleGenerate = useCallback(async () => {
		if (disabled) return
		setAiGenerating(true)
		setAiError("")
		setLastGeneratedTopicCount(null)

		const controller = new AbortController()
		abortRef.current = controller

		try {
			const success = await onGenerate({
				direction: aiDirection || undefined,
				referenceFiles: referenceFiles.length > 0 ? referenceFiles : undefined,
				model: topicModel || undefined,
				count: topicCount,
				generateWithDetails,
				signal: controller.signal,
			})
			if (!success) {
				setAiError(t("detail.selfMedia.initPanel.stepTopic.errorEmpty"))
			} else {
				setLastGeneratedTopicCount(topicCount)
			}
		} catch (err) {
			if ((err as Error).name !== "AbortError") {
				setAiError(t("detail.selfMedia.initPanel.stepTopic.errorNetwork"))
			}
		} finally {
			setAiGenerating(false)
			abortRef.current = null
		}
	}, [
		disabled,
		aiDirection,
		referenceFiles,
		topicModel,
		topicCount,
		generateWithDetails,
		onGenerate,
		t,
	])

	const handleAbort = useCallback(() => {
		abortRef.current?.abort()
		setAiGenerating(false)
	}, [])

	const [generatingStep, setGeneratingStep] = useState(0)

	// 控制生成中的文本变化
	useEffect(() => {
		if (aiGenerating) {
			setGeneratingStep(0)
			const timer = setInterval(() => {
				setGeneratingStep((prev) => Math.min(prev + 1, 3))
			}, 2500)
			return () => clearInterval(timer)
		}
	}, [aiGenerating])

	const generatingTexts = [
		t("detail.selfMedia.initPanel.stepTopic.generatingStep1", "深度思考领域特征..."),
		t("detail.selfMedia.initPanel.stepTopic.generatingStep2", "挖掘爆款选题角度..."),
		t("detail.selfMedia.initPanel.stepTopic.generatingStep3", "构思核心大纲框架..."),
		t("detail.selfMedia.initPanel.stepTopic.generatingStep4", "打磨最终输出细节..."),
	]

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-[28px] bg-white/95 p-5 shadow-[inset_0_1px_rgba(255,255,255,0.85),0_20px_60px_rgba(47,43,36,0.08)] transition-all duration-300 ease-in-out sm:p-6",
				aiGenerating &&
					"shadow-[inset_0_1px_rgba(255,255,255,0.85),0_22px_64px_rgba(24,24,27,0.12)]",
			)}
			data-self-media-motion="topic-assistant"
		>
			<div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" />

			<div className="relative mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2.5">
					<span className="text-sm font-[780] text-[#18181b]">
						{t(
							"detail.selfMedia.initPanel.stepTopic.aiAssistantTitle",
							"让 AI 帮我策划选题与大纲",
						)}
					</span>
					{aiGenerating ? (
						<Badge className="rounded-full bg-[#18181b] text-white hover:bg-[#18181b]">
							<span className="relative flex h-1.5 w-1.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffd637] opacity-75" />
								<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ffd637]" />
							</span>
							{t("detail.selfMedia.initPanel.stepTopic.generating", {
								defaultValue: "AI 策划中",
							})}
						</Badge>
					) : lastGeneratedTopicCount !== null ? (
						<Badge className="rounded-full bg-[#e7f7ef] text-[#13714a] hover:bg-[#e7f7ef]">
							<Check className="size-3" />
							{t("detail.selfMedia.initPanel.stepTopic.generatedStatus", {
								count: lastGeneratedTopicCount,
								defaultValue: "已生成 {{count}} 个选题",
							})}
						</Badge>
					) : (
						<Badge className="rounded-full bg-[#ffd637] text-[#18181b] hover:bg-[#ffd637]">
							{t("detail.selfMedia.initPanel.stepTopic.ready", "待策划")}
						</Badge>
					)}
				</div>
			</div>

			{aiGenerating ? (
				<AiTopicGeneratingCard
					generatingTexts={generatingTexts}
					generatingStep={generatingStep}
					stopLabel={t("detail.selfMedia.initPanel.stepTopic.stopBtn", "停止")}
					onAbort={handleAbort}
				/>
			) : (
				<>
					<div className="relative mb-5">
						<div className="group flex w-full flex-col overflow-hidden rounded-[22px] bg-[#f4f4f5] transition-all duration-300 focus-within:ring-[3px] focus-within:ring-[#18181b]/10">
							<div className="relative min-h-[88px] px-4 py-3">
								<Textarea
									rows={3}
									className="min-h-[88px] resize-none border-0 bg-transparent p-0 pr-7 text-sm shadow-none placeholder:text-[#a1a1aa] focus-visible:ring-0"
									placeholder={t(
										"detail.selfMedia.initPanel.stepTopic.directionPlaceholder",
									)}
									value={aiDirection}
									onChange={(e) => {
										clearGeneratedStatus()
										setAiDirection(e.target.value)
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault()
											handleGenerate()
										}
									}}
								/>
								<InlineVoiceButton
									value={aiDirection}
									onResult={(value) => {
										clearGeneratedStatus()
										setAiDirection(value)
									}}
									variant="textarea"
									className="text-zinc-400 hover:text-zinc-900"
								/>
							</div>
							{/* Bottom toolbar: reference files + upload trigger */}
							<div className="flex w-full items-center border-t border-white/70 bg-white/55 px-3 py-1.5">
								<ReferenceFilePicker
									className="w-full"
									value={referenceFiles}
									onChange={(files) => {
										clearGeneratedStatus()
										setReferenceFiles(files)
									}}
									onError={setAiError}
									compact
								/>
							</div>
						</div>
					</div>

					{/* Error Box */}
					{aiError && (
						<div className="mb-4 flex items-center gap-2 rounded-[18px] bg-[#ff776c]/10 px-3 py-2 text-xs font-semibold text-[#b42318]">
							<div className="h-1.5 w-1.5 rounded-full bg-[#ff776c]" />
							<p>{aiError}</p>
						</div>
					)}

					<div className="mb-4 h-px bg-[#e4e4e7]" />

					{/* Bottom Toolbar */}
					<div className="flex flex-col gap-4 transition-all duration-300 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2">
							<p className="flex items-center gap-2 text-xs font-semibold text-[#71717a]">
								<span>{topicCountLabel}</span>
								<Input
									type="number"
									min={1}
									max={20}
									aria-label={topicCountInputLabel}
									aria-describedby={topicCountHintId}
									title={topicCountHint}
									className="h-8 w-14 rounded-full border-0 bg-[#f4f4f5] text-center text-xs font-semibold shadow-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/10"
									value={topicCount}
									onChange={(e) => {
										clearGeneratedStatus()
										setTopicCount(
											Math.max(
												1,
												Math.min(20, parseInt(e.target.value) || 1),
											),
										)
									}}
								/>
								<span id={topicCountHintId} className="sr-only">
									{topicCountHint}
								</span>
								<span>{topicCountUnit}</span>
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<label className="flex cursor-pointer select-none items-center gap-2 rounded-full bg-[#f4f4f5] px-3 py-2 text-xs font-semibold text-[#52525b] transition-all duration-200 hover:bg-[#eeeeef] hover:text-[#18181b]" data-testid="ai-topic-assistant-label">
								<Checkbox
									checked={generateWithDetails}
									className="size-4 rounded-full border-[#d4d4d8] bg-white shadow-none transition-all focus-visible:ring-[#18181b]/10 data-[state=checked]:border-[#18181b] data-[state=checked]:bg-[#18181b] data-[state=checked]:text-white"
									onCheckedChange={(checked) => {
										clearGeneratedStatus()
										setGenerateWithDetails(checked === true)
									}}
								/>
								<span>
									{t("detail.selfMedia.initPanel.stepTopic.generateWithDetails")}
								</span>
							</label>
							<AiActionButton
								modelValue={topicModel}
								onModelChange={(model) => {
									clearGeneratedStatus()
									setTopicModel(model)
								}}
								loading={false}
								disabled={disabled}
								onClick={handleGenerate}
								variant="accent"
								label={t("detail.selfMedia.initPanel.stepTopic.generateBtn")}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	)
})
