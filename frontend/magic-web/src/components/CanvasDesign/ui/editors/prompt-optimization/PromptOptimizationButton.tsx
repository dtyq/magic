import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, LoaderCircle, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useFloatingComponent } from "../../../app/hooks/layout/useFloatingComponent"
import { useOverflowChange } from "../../../app/hooks/layout/useOverflowChange"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { CompleteImagePromptRequest } from "../../../public/magic-types"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/index"
import IconButton from "../../primitives/custom/IconButton"
import { Button } from "../../primitives/shadcn/button"
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/shadcn/popover"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../../primitives/shadcn/tooltip"
import { PromptPlaceholderPreviewText } from "../../panels/history/PromptPlaceholderPreviewText"
import { buildPreviewMediaResourceItem } from "../../panels/history/mediaPreviewItem"
import {
	decodePromptPlaceholdersWithLabels,
	resolvePromptPlaceholderDecodeLabels,
	resolvePromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenKind,
} from "../message/reference-assets/promptPlaceholderTokenConfig"
import styles from "./PromptOptimizationButton.module.css"

interface PromptOptimizationButtonProps {
	buildRequest: () => CompleteImagePromptRequest | null
	referencePrompt: string
	placeholderPaths?: Partial<Record<PromptPlaceholderTokenKind, string[]>>
	onApply: (prompt: string) => void
	onPreviewMediaResource?: (resource: MediaResourceFullscreenPreviewItem) => void
	isMediaResourcePreviewOpen?: boolean
	disabled?: boolean
}

export default function PromptOptimizationButton(props: PromptOptimizationButtonProps) {
	const {
		buildRequest,
		referencePrompt,
		placeholderPaths,
		onApply,
		onPreviewMediaResource,
		isMediaResourcePreviewOpen = false,
		disabled = false,
	} = props
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const [open, setOpen] = useState(false)
	const [optimizedPrompt, setOptimizedPrompt] = useState("")
	const [errorMessage, setErrorMessage] = useState("")
	const [isGenerating, setIsGenerating] = useState(false)
	const [hasBodyScrollbar, setHasBodyScrollbar] = useState(false)
	const bodyRef = useRef<HTMLDivElement>(null)
	const mediaPreviewDismissGuardRef = useRef(false)
	const hasSeenMediaPreviewOpenRef = useRef(false)
	const completeImagePrompt = canvas?.magicConfigManager.config?.methods?.completeImagePrompt
	const isUnavailable = !completeImagePrompt
	const hasOptimizedPrompt = Boolean(optimizedPrompt)
	const buttonDisabled = disabled || isGenerating || isUnavailable
	const tooltipLabel = isUnavailable
		? t("promptOptimization.unavailable", "提示词优化能力暂不可用")
		: t("promptOptimization.trigger", "优化提示词")
	const normalizedReferencePrompt = referencePrompt.trim()
	const promptPlaceholderTokenConfig = useMemo(() => resolvePromptPlaceholderTokenConfig(t), [t])
	const displayOptimizedPrompt = useMemo(
		() =>
			decodeOptimizedPromptPlaceholders(
				optimizedPrompt,
				placeholderPaths,
				promptPlaceholderTokenConfig,
			),
		[optimizedPrompt, placeholderPaths, promptPlaceholderTokenConfig],
	)
	const { containerRef: floatingRef } = useFloatingComponent({
		id: "prompt-optimization-popover",
		enableWheelForwarding: open && !hasBodyScrollbar,
		enablePointerPanForwarding: open,
	})

	useOverflowChange({
		targetRef: bodyRef,
		axis: "y",
		enabled: open && hasOptimizedPrompt && !isGenerating && !errorMessage,
		onOverflowChange: setHasBodyScrollbar,
	})

	useEffect(() => {
		setOptimizedPrompt("")
		setErrorMessage("")
	}, [normalizedReferencePrompt])

	useEffect(() => {
		if (isMediaResourcePreviewOpen) {
			hasSeenMediaPreviewOpenRef.current = true
			mediaPreviewDismissGuardRef.current = true
			return
		}
		if (hasSeenMediaPreviewOpenRef.current) {
			hasSeenMediaPreviewOpenRef.current = false
			mediaPreviewDismissGuardRef.current = false
		}
	}, [isMediaResourcePreviewOpen])

	const shouldKeepOpenForMediaPreview = useCallback(
		() => isMediaResourcePreviewOpen || mediaPreviewDismissGuardRef.current,
		[isMediaResourcePreviewOpen],
	)

	const generateOptimizedPrompt = useCallback(async () => {
		if (!completeImagePrompt || isGenerating) return
		const request = buildRequest()
		if (!request?.user_prompt?.trim()) {
			setOpen(true)
			setOptimizedPrompt("")
			setErrorMessage(t("promptOptimization.emptyInput", "请输入提示词或添加参考图后再优化"))
			return
		}

		setOptimizedPrompt("")
		setErrorMessage("")
		setIsGenerating(true)
		try {
			const result = await completeImagePrompt(request)
			const prompt = String(result?.prompt ?? "").trim()
			if (!prompt) {
				throw new Error(t("promptOptimization.emptyResult", "AI 未生成有效提示词，请重试"))
			}
			setOptimizedPrompt(prompt)
			setOpen(true)
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, t("promptOptimization.failed", "提示词优化失败，请重试")),
			)
			setOpen(true)
		} finally {
			setIsGenerating(false)
		}
	}, [buildRequest, completeImagePrompt, isGenerating, t])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				if (shouldKeepOpenForMediaPreview()) {
					setOpen(true)
					return
				}
				setOpen(false)
				return
			}
			if (hasOptimizedPrompt || errorMessage) {
				setOpen(true)
				return
			}
			void generateOptimizedPrompt()
		},
		[errorMessage, generateOptimizedPrompt, hasOptimizedPrompt, shouldKeepOpenForMediaPreview],
	)

	const handleApply = useCallback(() => {
		const prompt = displayOptimizedPrompt.trim()
		if (!prompt) return
		onApply(prompt)
		setOpen(false)
	}, [displayOptimizedPrompt, onApply])

	const handleCopy = useCallback(() => {
		const prompt = displayOptimizedPrompt.trim()
		if (!prompt) return
		void navigator.clipboard
			.writeText(prompt)
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [displayOptimizedPrompt, t])

	const handlePreviewMediaResource = useCallback(
		(resource: MediaResourceFullscreenPreviewItem) => {
			if (!onPreviewMediaResource) return
			mediaPreviewDismissGuardRef.current = true
			onPreviewMediaResource?.(resource)
		},
		[onPreviewMediaResource],
	)

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<TooltipProvider delayDuration={200}>
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className={styles.promptOptimizationButton}
								disabled={buttonDisabled}
								aria-label={tooltipLabel}
								aria-busy={isGenerating}
								data-has-result={hasOptimizedPrompt ? "true" : undefined}
								data-testid="prompt-optimization-button"
							>
								{isGenerating ? (
									<LoaderCircle size={16} className="animate-spin" />
								) : (
									<Sparkles size={16} />
								)}
							</Button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent className={styles.promptOptimizationTooltip}>
						{tooltipLabel}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={6}
				ref={floatingRef}
				className={styles.promptOptimizationContent}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (shouldKeepOpenForMediaPreview()) {
						event.preventDefault()
					}
				}}
				onFocusOutside={(event) => {
					if (shouldKeepOpenForMediaPreview()) {
						event.preventDefault()
					}
				}}
			>
				<div className={styles.promptOptimizationHeader}>
					<p className={styles.promptOptimizationTitle}>
						{t("promptOptimization.title", "提示词优化")}
					</p>
					{hasOptimizedPrompt && !isGenerating && (
						<IconButton
							aria-label={t("messageHistory.copyPrompt", "复制")}
							className={styles.promptOptimizationCopyButton}
							title={t("messageHistory.copyPrompt", "复制")}
							onClick={handleCopy}
						>
							<Copy size={16} />
						</IconButton>
					)}
				</div>
				{isGenerating ? (
					<div className={styles.promptOptimizationStatus}>
						<LoaderCircle size={16} className="animate-spin" />
						<span>{t("promptOptimization.generating", "正在生成优化结果")}</span>
					</div>
				) : errorMessage ? (
					<div
						className={`${styles.promptOptimizationStatus} ${styles.promptOptimizationError}`}
					>
						{errorMessage}
					</div>
				) : (
					<div ref={bodyRef} className={styles.promptOptimizationBody}>
						<PromptPlaceholderPreviewText
							text={optimizedPrompt}
							tokenConfig={promptPlaceholderTokenConfig}
							placeholderPaths={placeholderPaths ?? {}}
							onPreviewMediaResource={handlePreviewMediaResource}
							resolveResourceReference={
								canvas?.magicConfigManager.config?.methods?.resolveResourceReference
							}
							deletedSuffix={t("messageHistory.deletedSuffix", "（已删除）")}
						/>
					</div>
				)}
				{!isGenerating && (
					<div className={styles.promptOptimizationActions}>
						{hasOptimizedPrompt ? (
							<>
								<Button
									type="button"
									variant="outline"
									className={`${styles.promptOptimizationActionButton} ${styles.promptOptimizationSecondaryActionButton}`}
									onClick={() => void generateOptimizedPrompt()}
									disabled={isUnavailable}
								>
									<RefreshCw size={14} />
									{t("promptOptimization.regenerate", "重新生成")}
								</Button>
								<Button
									type="button"
									className={`${styles.promptOptimizationActionButton} ${styles.promptOptimizationPrimaryActionButton}`}
									onClick={handleApply}
								>
									{t("promptOptimization.apply", "应用")}
								</Button>
							</>
						) : (
							<Button
								type="button"
								className={`${styles.promptOptimizationActionButton} ${styles.promptOptimizationPrimaryActionButton}`}
								onClick={() => void generateOptimizedPrompt()}
								disabled={isUnavailable}
							>
								<Sparkles size={14} />
								{errorMessage
									? t("promptOptimization.retry", "重试")
									: t("promptOptimization.generate", "优化提示词")}
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

function decodeOptimizedPromptPlaceholders(
	prompt: string,
	placeholderPaths: Partial<Record<PromptPlaceholderTokenKind, string[]>> | undefined,
	tokenConfig: ReturnType<typeof resolvePromptPlaceholderTokenConfig>,
): string {
	let decoded = prompt
	for (const kind of ["image", "video", "audio"] as const) {
		const references =
			placeholderPaths?.[kind]
				?.map((path) => {
					const previewItem = buildPreviewMediaResourceItem(path, kind)
					return previewItem
						? {
								path,
								fileName: previewItem.fileName,
							}
						: null
				})
				.filter((item): item is { path: string; fileName: string } => Boolean(item)) ?? []
		if (references.length === 0) continue
		decoded = decodePromptPlaceholdersWithLabels(
			decoded,
			references,
			resolvePromptPlaceholderDecodeLabels(kind, tokenConfig),
			tokenConfig,
		)
	}
	return decoded
}
