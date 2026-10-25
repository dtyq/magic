/**
 * AiInputBox - 可复用的 AI 输入框组件
 *
 * 布局：
 * ┌──────────────────────────────────────────┐
 * │ textarea                                 │
 * ├──────────────────────────────────────────┤
 * │ [📎上传参考资料] [files...]  [🎤] [AI润色]│
 * └──────────────────────────────────────────┘
 */

import { useState, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Mic, Sparkles, Square } from "lucide-react"
import { cn } from "@/utils/cn"
import { useVoiceInput } from "@/components/business/VoiceInput/hooks"
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import AiActionButton from "./AiActionButton"
import ReferenceFilePicker from "../picker/ReferenceFilePicker"
import { polishText } from "../../../../services/selfMediaAiGenerate"
import type { ReferenceFileValue } from "../../types"

interface AiInputBoxProps {
	value: string
	onChange: (value: string) => void
	/** 润色时传递的上下文信息 */
	polishContext?: string
	placeholder?: string
	rows?: number
	className?: string
	/** 标签文字 */
	label?: string
	/** 工具栏下方的提示文字 */
	hint?: string
	/** 外部控制模型选择（共享） */
	model?: string
	onModelChange?: (model: string) => void
	onBlur?: () => void
	/** 参考资料文件列表（支持上传和选择项目文件） */
	referenceFiles?: ReferenceFileValue[]
	onReferenceFilesChange?: (files: ReferenceFileValue[]) => void
}

export default function AiInputBox({
	value,
	onChange,
	polishContext,
	placeholder = "随便说说你的想法，口语化也没关系…",
	rows = 3,
	className,
	label,
	hint,
	model,
	onModelChange,
	onBlur,
	referenceFiles,
	onReferenceFilesChange,
}: AiInputBoxProps) {
	const { t } = useTranslation("super")
	const [isPolishing, setIsPolishing] = useState(false)
	const [internalModel, setInternalModel] = useState<string>("")
	const abortRef = useRef<AbortController | null>(null)
	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	const selectedModel = model ?? internalModel
	const setSelectedModel = onModelChange ?? setInternalModel

	// ─── 语音输入（复用 useVoiceInput + 权限处理） ─────────────────────────
	const { handlePermissionError } = useMicrophonePermission()

	const { status: voiceStatus, toggleRecording } = useVoiceInput({
		onResult: (text) => {
			if (text.startsWith('sult":{"additions":{"log_id":')) {
				return
			}
			onChangeRef.current(text)
		},
		onError: (error) => {
			try {
				handlePermissionError(error)
			} catch {
				// 非权限错误，静默处理
			}
		},
	})

	const isListening =
		voiceStatus === "recording" || voiceStatus === "processing" || voiceStatus === "connecting"

	const handleToggleVoice = useCallback(async () => {
		try {
			await toggleRecording()
		} catch (error) {
			try {
				handlePermissionError(error as Error)
			} catch {
				// 非权限错误，静默处理
			}
		}
	}, [toggleRecording, handlePermissionError])

	// ─── AI 润色 ──────────────────────────────────────────────────────────
	const handlePolish = useCallback(async () => {
		if (!value.trim() || isPolishing) return

		setIsPolishing(true)
		abortRef.current = new AbortController()

		try {
			const result = await polishText({
				text: value,
				context: polishContext,
				model: selectedModel || undefined,
				signal: abortRef.current.signal,
			})
			if (result) {
				onChange(result)
			}
		} catch {
			// 用户取消或网络错误，静默处理
		} finally {
			setIsPolishing(false)
			abortRef.current = null
		}
	}, [value, isPolishing, polishContext, selectedModel, onChange])

	return (
		<div className={cn("space-y-1.5", className)}>
			{label && (
				<label
					className="mb-1 block text-xs font-semibold"
					data-testid="ai-input-box-label"
				>
					{label}
				</label>
			)}

			{/* Unified field: textarea + toolbar */}
			<div className="overflow-hidden rounded-lg border bg-card shadow-xs transition-all focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
				{/* Textarea area */}
				<Textarea
					className="min-h-0 resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
					placeholder={placeholder}
					rows={rows}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={onBlur}
				/>

				{/* Bottom toolbar: reference files left, actions right */}
				<div className="flex items-center border-t bg-muted/30 px-3 py-1.5">
					{onReferenceFilesChange && (
						<ReferenceFilePicker
							value={referenceFiles || []}
							onChange={onReferenceFilesChange}
							compact
						/>
					)}
					<span className="flex-1" />
					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className={cn(
								"size-7",
								isListening && "animate-pulse text-destructive",
							)}
							onClick={handleToggleVoice}
							title={isListening ? "停止录音" : "语音输入"}
						>
							{isListening ? <Square size={14} /> : <Mic size={14} />}
						</Button>
						<AiActionButton
							modelValue={selectedModel}
							onModelChange={setSelectedModel}
							loading={isPolishing}
							disabled={!value.trim()}
							onClick={handlePolish}
							label={
								<>
									<Sparkles size={12} />
									<span>{t("selfMedia.polish")}</span>
								</>
							}
							loadingLabel={
								<>
									<svg
										className="h-3 w-3 animate-spin"
										viewBox="0 0 12 12"
										fill="none"
									>
										<circle
											cx="6"
											cy="6"
											r="5"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeDasharray="20 10"
										/>
									</svg>
									<span>{t("selfMedia.polishing")}</span>
								</>
							}
							variant="outline"
							size="sm"
						/>
					</div>
				</div>
			</div>

			{hint && <p className="px-1 text-[11px] text-muted-foreground">{hint}</p>}
		</div>
	)
}
