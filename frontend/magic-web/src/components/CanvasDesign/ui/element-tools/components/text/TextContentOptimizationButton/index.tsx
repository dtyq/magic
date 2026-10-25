import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { Copy, LoaderCircle, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useFloatingComponent } from "../../../../../app/hooks/layout/useFloatingComponent"
import { useOverflowChange } from "../../../../../app/hooks/layout/useOverflowChange"
import { useHostUiLocale } from "../../../../../app/providers/HostUiLocaleProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useElementToolState } from "../../../../../app/providers/ElementToolStateProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import type {
	CompleteImagePromptRequest,
	CompleteTextContentRequest,
} from "../../../../../public/magic-types"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { getActiveContent } from "../../../../../runtime/document/elementContent"
import type { TextElementContent } from "../../../../../runtime/document/types"
import {
	extractPlainTextFromRichText,
	isRichTextContentEmpty,
} from "../../../../../runtime/text/richText"
import IconButton from "../../../../primitives/custom/IconButton"
import { Button } from "../../../../primitives/shadcn/button"
import { Popover, PopoverContent, PopoverTrigger } from "../../../../primitives/shadcn/popover"
import useElementToolPopoverAlign from "../../../shared/hooks/useElementToolPopoverAlign"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"
import { useTextToolController } from "../useTextToolController"
import {
	buildRichTextContentFromPlainText,
	normalizeOptimizedTextLineBreaks,
} from "./richTextContentOptimization"
import { buildTextContentOptimizationPrompt } from "./textContentOptimizationPrompt"
import styles from "./index.module.css"

interface TextContentOptimizationToolState {
	requestKey: string
	status: "loading" | "success" | "error"
	optimizedText?: string
	errorMessage?: string
}

export default function TextContentOptimizationButton() {
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const hostUiLocale = useHostUiLocale()
	const { selectedTextElement, isEditingText } = useTextToolController()
	const tool = useElementToolResolution()
	const [open, setOpen] = useState(false)
	const [hasBodyScrollbar, setHasBodyScrollbar] = useState(false)
	const bodyRef = useRef<HTMLDivElement>(null)
	const completeTextContent = canvas?.magicConfigManager.config?.methods?.completeTextContent
	const completeImagePrompt = canvas?.magicConfigManager.config?.methods?.completeImagePrompt
	const selectedTextContent = selectedTextElement
		? getActiveContent<TextElementContent>(selectedTextElement)
		: undefined
	const currentText = useMemo(
		() => extractPlainTextFromRichText(selectedTextContent?.content),
		[selectedTextContent?.content],
	)
	const requestKey = useMemo(
		() =>
			buildTextContentOptimizationRequestKey({
				elementId: selectedTextElement?.id,
				contentId: tool?.target.contentId,
				text: currentText,
			}),
		[currentText, selectedTextElement?.id, tool?.target.contentId],
	)
	const { state: storedToolState, setState: setToolState } =
		useElementToolState<TextContentOptimizationToolState>(
			selectedTextElement?.id,
			ElementToolTypeEnum.TextContentOptimization,
		)
	const toolState = storedToolState?.requestKey === requestKey ? storedToolState : undefined
	const optimizedText = toolState?.status === "success" ? (toolState.optimizedText ?? "") : ""
	const errorMessage = toolState?.status === "error" ? (toolState.errorMessage ?? "") : ""
	const isGenerating = toolState?.status === "loading"
	const hasOptimizedText = Boolean(optimizedText)
	const isUnavailable = !completeTextContent && !completeImagePrompt
	const buttonDisabled = isGenerating || isUnavailable || isEditingText
	const buttonLabel = isEditingText
		? t("textContentOptimization.finishEditingFirst", "完成文本编辑后再优化")
		: isUnavailable
			? t("textContentOptimization.unavailable", "内容优化能力暂不可用")
			: t("textContentOptimization.trigger", "内容优化")
	const { containerRef: floatingRef } = useFloatingComponent({
		id: "text-content-optimization-popover",
		enableWheelForwarding: open && !hasBodyScrollbar,
		enablePointerPanForwarding: open,
	})
	const { align: popoverAlign, contentRef: popoverContentRef } = useElementToolPopoverAlign({
		open,
		floatingRef,
	})
	const latestRequestKeyRef = useRef(requestKey)
	const mountedRef = useRef(false)

	useOverflowChange({
		targetRef: bodyRef,
		axis: "y",
		enabled: open && hasOptimizedText && !isGenerating && !errorMessage,
		onOverflowChange: setHasBodyScrollbar,
	})

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	useEffect(() => {
		latestRequestKeyRef.current = requestKey
		setOpen(false)
	}, [requestKey])

	const openIfCurrent = useCallback((targetRequestKey: string) => {
		if (!mountedRef.current || latestRequestKeyRef.current !== targetRequestKey) return
		setOpen(true)
	}, [])

	const buildRequest = useCallback((): CompleteTextContentRequest | null => {
		if (!selectedTextElement || isRichTextContentEmpty(selectedTextContent?.content)) {
			return null
		}

		return {
			user_prompt: buildTextContentOptimizationPrompt({
				currentText,
				hostUiLocale,
			}),
		}
	}, [currentText, hostUiLocale, selectedTextElement])

	const requestOptimizedText = useCallback(
		async (request: CompleteTextContentRequest): Promise<string> => {
			if (completeTextContent) {
				const result = await completeTextContent(request)
				return String(result?.text ?? "").trim()
			}
			if (!completeImagePrompt) return ""
			// 兼容未接入 completeTextContent 的宿主，仍使用文本优化 prompt 走现有补全通道。
			const imagePromptRequest: CompleteImagePromptRequest = {
				user_prompt: request.user_prompt,
				model_id: request.model_id,
			}
			const result = await completeImagePrompt(imagePromptRequest)
			return String(result?.prompt ?? "").trim()
		},
		[completeImagePrompt, completeTextContent],
	)

	const generateOptimizedText = useCallback(async () => {
		if (isGenerating || isUnavailable) return
		const requestKeyAtStart = requestKey
		const request = buildRequest()
		if (!request?.user_prompt?.trim()) {
			setToolState({
				requestKey: requestKeyAtStart,
				status: "error",
				errorMessage: t("textContentOptimization.emptyInput", "请输入文本内容后再优化"),
			})
			openIfCurrent(requestKeyAtStart)
			return
		}

		setToolState({
			requestKey: requestKeyAtStart,
			status: "loading",
		})
		try {
			const text = normalizeOptimizedTextLineBreaks(
				await requestOptimizedText(request),
				currentText,
			)
			if (!text) {
				throw new Error(
					t("textContentOptimization.emptyResult", "AI 未生成有效文本，请重试"),
				)
			}
			setToolState({
				requestKey: requestKeyAtStart,
				status: "success",
				optimizedText: text,
			})
			openIfCurrent(requestKeyAtStart)
		} catch (error) {
			setToolState({
				requestKey: requestKeyAtStart,
				status: "error",
				errorMessage: getErrorMessage(
					error,
					t("textContentOptimization.failed", "内容优化失败，请重试"),
				),
			})
			openIfCurrent(requestKeyAtStart)
		}
	}, [
		buildRequest,
		currentText,
		isGenerating,
		isUnavailable,
		openIfCurrent,
		requestKey,
		requestOptimizedText,
		setToolState,
		t,
	])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				setOpen(false)
				return
			}
			if (hasOptimizedText || errorMessage) {
				setOpen(true)
				return
			}
			if (buttonDisabled) return
			void generateOptimizedText()
		},
		[buttonDisabled, errorMessage, generateOptimizedText, hasOptimizedText],
	)

	const handleApply = useCallback(() => {
		const text = optimizedText.trim()
		if (
			!selectedTextElement ||
			!text ||
			tool?.id !== ElementToolTypeEnum.TextContentOptimization
		)
			return
		const content = buildRichTextContentFromPlainText(
			text,
			selectedTextContent?.content,
			selectedTextContent?.defaultStyle,
		)
		void tool.execute?.({ action: "apply", content })
		setOpen(false)
	}, [
		optimizedText,
		selectedTextElement,
		selectedTextContent?.content,
		selectedTextContent?.defaultStyle,
		tool,
	])

	const handleCopy = useCallback(() => {
		const text = optimizedText.trim()
		if (!text) return
		void navigator.clipboard
			.writeText(text)
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [optimizedText, t])

	const handleMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.preventDefault()
	}, [])

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<div>
					<IconButton
						className={styles.triggerButton}
						disabled={buttonDisabled}
						aria-label={buttonLabel}
						data-testid="text-content-optimization-button"
						onMouseDown={handleMouseDown}
					>
						{isGenerating ? (
							<LoaderCircle size={16} className="animate-spin" />
						) : (
							<Sparkles size={16} />
						)}
						<span className={styles.triggerButtonText}>
							{t("textContentOptimization.trigger", "内容优化")}
						</span>
					</IconButton>
				</div>
			</PopoverTrigger>
			<PopoverContent
				ref={popoverContentRef}
				align={popoverAlign}
				side="top"
				sideOffset={6}
				collisionPadding={8}
				className={styles.content}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<div className={styles.header}>
					<p className={styles.title}>{t("textContentOptimization.title", "内容优化")}</p>
					{hasOptimizedText && !isGenerating && (
						<IconButton
							aria-label={t("messageHistory.copyPrompt", "复制")}
							className={styles.copyButton}
							title={t("messageHistory.copyPrompt", "复制")}
							onClick={handleCopy}
						>
							<Copy size={16} />
						</IconButton>
					)}
				</div>
				{isGenerating ? (
					<div className={styles.status}>
						<LoaderCircle size={16} className="animate-spin" />
						<span>{t("textContentOptimization.generating", "正在生成优化结果")}</span>
					</div>
				) : errorMessage ? (
					<div className={`${styles.status} ${styles.error}`}>{errorMessage}</div>
				) : (
					<div ref={bodyRef} className={styles.body}>
						{optimizedText}
					</div>
				)}
				{!isGenerating && (
					<div className={styles.actions}>
						{hasOptimizedText ? (
							<>
								<Button
									type="button"
									variant="outline"
									className={`${styles.actionButton} ${styles.secondaryActionButton}`}
									onClick={() => void generateOptimizedText()}
									disabled={isUnavailable}
								>
									<RefreshCw size={14} />
									{t("textContentOptimization.regenerate", "重新生成")}
								</Button>
								<Button
									type="button"
									className={`${styles.actionButton} ${styles.primaryActionButton}`}
									onClick={handleApply}
								>
									{t("textContentOptimization.apply", "应用")}
								</Button>
							</>
						) : (
							<Button
								type="button"
								className={`${styles.actionButton} ${styles.primaryActionButton}`}
								onClick={() => void generateOptimizedText()}
								disabled={isUnavailable}
							>
								<Sparkles size={14} />
								{errorMessage
									? t("textContentOptimization.retry", "重试")
									: t("textContentOptimization.generate", "内容优化")}
							</Button>
						)}
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) return error.message
	if (typeof error === "string" && error) return error
	return fallback
}

function buildTextContentOptimizationRequestKey(params: {
	elementId?: string
	contentId?: string
	text: string
}): string {
	return JSON.stringify({
		elementId: params.elementId ?? "",
		contentId: params.contentId ?? "",
		text: params.text,
	})
}
