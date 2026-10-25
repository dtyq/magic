import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { Copy, LoaderCircle, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useFloatingComponent } from "../../../../../app/hooks/layout/useFloatingComponent"
import { useOverflowChange } from "../../../../../app/hooks/layout/useOverflowChange"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useElementToolState } from "../../../../../app/providers/ElementToolStateProvider"
import { useHostUiLocale } from "../../../../../app/providers/HostUiLocaleProvider"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import type { CompleteImagePromptRequest } from "../../../../../public/magic-types"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { ElementTypeEnum, type ImageElement } from "../../../../../runtime/document/types"
import { ImageElement as ImageElementClass } from "../../../../../runtime/elements/image/ImageElement"
import { getCanvasResourceFileName } from "../../../../../runtime/shared/path/canvasResourcePath"
import {
	buildReferenceImageOptions,
	getImageProcessRequestPayload,
} from "../../../../../runtime/resources/image/imageCropUtils"
import IconButton from "../../../../primitives/custom/IconButton"
import { Button } from "../../../../primitives/shadcn/button"
import { Popover, PopoverContent, PopoverTrigger } from "../../../../primitives/shadcn/popover"
import useElementToolPopoverAlign from "../../../shared/hooks/useElementToolPopoverAlign"
import { useElementToolCommand } from "../../../model/useElementToolCommand"
import { buildImagePromptExtractionPrompt } from "./imagePromptExtractionPrompt"
import { createImagePromptTextElement } from "./imagePromptExtractionText"
import {
	getActiveImageContent,
	getContentById,
} from "../../../../../runtime/document/elementContent"
import styles from "./index.module.css"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

interface ImagePromptExtractionToolState {
	requestKey: string
	status: "loading" | "success" | "error"
	extractedPrompt?: string
	errorMessage?: string
}

export default function ImagePromptExtractionButton() {
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const { t } = useCanvasDesignI18n()
	const hostUiLocale = useHostUiLocale()
	const [open, setOpen] = useState(false)
	const [hasBodyScrollbar, setHasBodyScrollbar] = useState(false)
	const bodyRef = useRef<HTMLDivElement>(null)
	const completeImagePrompt = canvas?.magicConfigManager.config?.methods?.completeImagePrompt
	const tool = useElementToolResolution()
	const targetElementId = tool?.target.elementId
	const targetContentId = tool?.target.contentId

	const selectedImageElement = useMemo<ImageElement | null>(() => {
		const element = targetElementId
			? canvas?.elementManager.getElementData(targetElementId)
			: selectedElements[0]
		return element?.type === ElementTypeEnum.Image ? (element as ImageElement) : null
	}, [canvas, selectedElements, targetElementId])
	const resolvedElementId = targetElementId ?? selectedImageElement?.id
	const activeContent = selectedImageElement
		? tool
			? targetContentId
				? getContentById(selectedImageElement, targetContentId)
				: undefined
			: getActiveImageContent(selectedImageElement)
		: undefined
	const cropSignature = useMemo(
		() => JSON.stringify(activeContent?.crop ?? null),
		[activeContent?.crop],
	)
	const requestKey = useMemo(
		() =>
			buildImagePromptExtractionRequestKey({
				elementId: resolvedElementId,
				contentId: activeContent?.contentId,
				src: activeContent?.src,
				cropSignature,
			}),
		[activeContent?.contentId, activeContent?.src, cropSignature, resolvedElementId],
	)
	const { state: storedToolState, setState: setToolState } =
		useElementToolState<ImagePromptExtractionToolState>(
			resolvedElementId,
			ElementToolTypeEnum.ContentPromptExtraction,
			activeContent?.contentId,
		)
	const toolState = storedToolState?.requestKey === requestKey ? storedToolState : undefined
	const extractedPrompt = toolState?.status === "success" ? (toolState.extractedPrompt ?? "") : ""
	const errorMessage = toolState?.status === "error" ? (toolState.errorMessage ?? "") : ""
	const isGenerating = toolState?.status === "loading"
	const hasExtractedPrompt = Boolean(extractedPrompt)
	const isUnavailable = !completeImagePrompt
	const buttonDisabled = isGenerating || isUnavailable || !activeContent?.src
	const buttonLabel = isUnavailable
		? t("imagePromptExtraction.unavailable", "图片提炼能力暂不可用")
		: t("imagePromptExtraction.trigger", "提炼提示词")
	const { containerRef: floatingRef } = useFloatingComponent({
		id: "image-prompt-extraction-popover",
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
		enabled: open && hasExtractedPrompt && !isGenerating && !errorMessage,
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

	const buildRequest = useCallback(async (): Promise<CompleteImagePromptRequest | null> => {
		if (!canvas || !resolvedElementId || !selectedImageElement || !activeContent?.src)
			return null

		const filePath = activeContent.src
		const imageElementInstance = canvas.elementManager.getElementInstance(resolvedElementId)
		let referenceImageOptions: CompleteImagePromptRequest["reference_image_options"]
		if (activeContent.crop && imageElementInstance instanceof ImageElementClass) {
			let imageInfo = imageElementInstance.getImageInfo()
			if (!imageInfo?.naturalWidth || !imageInfo?.naturalHeight) {
				await imageElementInstance.getHTMLImageElement({ variant: "preview" })
				imageInfo = imageElementInstance.getImageInfo()
			}
			const processPayload = getImageProcessRequestPayload({
				crop: activeContent.crop,
				sourceDimensions: {
					width: imageInfo?.naturalWidth ?? selectedImageElement.width ?? 0,
					height: imageInfo?.naturalHeight ?? selectedImageElement.height ?? 0,
				},
			})
			referenceImageOptions = buildReferenceImageOptions({
				filePath,
				crop: processPayload.crop,
			})
		}

		const request: CompleteImagePromptRequest = {
			user_prompt: buildImagePromptExtractionPrompt({
				hostUiLocale,
				fileName: selectedImageElement.name || getCanvasResourceFileName(filePath),
				hasCrop: Boolean(referenceImageOptions?.length),
			}),
			reference_images: [filePath],
		}
		if (referenceImageOptions) {
			request.reference_image_options = referenceImageOptions
		}
		return request
	}, [activeContent, canvas, hostUiLocale, resolvedElementId, selectedImageElement])

	const generateExtractedPrompt = useCallback(async () => {
		if (!completeImagePrompt || isGenerating) return
		const requestKeyAtStart = requestKey
		setToolState({
			requestKey: requestKeyAtStart,
			status: "loading",
		})
		try {
			const request = await buildRequest()
			if (!request?.reference_images?.length || !request.user_prompt.trim()) {
				throw new ImagePromptExtractionUserError(
					t("imagePromptExtraction.emptyInput", "当前图片无法提炼提示词"),
				)
			}
			const result = await completeImagePrompt(request)
			const prompt = String(result?.prompt ?? "").trim()
			if (!prompt) {
				throw new ImagePromptExtractionUserError(
					t("imagePromptExtraction.emptyResult", "AI 未生成有效提示词，请重试"),
				)
			}
			setToolState({
				requestKey: requestKeyAtStart,
				status: "success",
				extractedPrompt: prompt,
			})
			openIfCurrent(requestKeyAtStart)
		} catch (error) {
			setToolState({
				requestKey: requestKeyAtStart,
				status: "error",
				errorMessage: getErrorMessage(
					error,
					t("imagePromptExtraction.failed", "提示词提炼失败，请重试"),
				),
			})
			openIfCurrent(requestKeyAtStart)
		}
	}, [
		buildRequest,
		completeImagePrompt,
		isGenerating,
		openIfCurrent,
		requestKey,
		setToolState,
		t,
	])

	useElementToolCommand(
		useMemo(
			() =>
				tool && resolvedElementId && activeContent?.contentId
					? {
							elementId: resolvedElementId,
							contentId: activeContent.contentId,
							toolId: ElementToolTypeEnum.ContentPromptExtraction,
							state: { available: !buttonDisabled },
							execute: () => generateExtractedPrompt(),
						}
					: null,
			[
				activeContent?.contentId,
				buttonDisabled,
				generateExtractedPrompt,
				resolvedElementId,
				tool,
			],
		),
	)

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) {
				setOpen(false)
				return
			}
			if (hasExtractedPrompt || errorMessage) {
				setOpen(true)
				return
			}
			if (buttonDisabled) return
			if (tool?.id === ElementToolTypeEnum.ContentPromptExtraction) {
				void tool.execute?.()
				return
			}
			void generateExtractedPrompt()
		},
		[buttonDisabled, errorMessage, generateExtractedPrompt, hasExtractedPrompt, tool],
	)

	const handleCreateText = useCallback(() => {
		const prompt = extractedPrompt.trim()
		if (!canvas || !selectedImageElement || !prompt) return
		const result = createImagePromptTextElement({
			canvas,
			imageElement: selectedImageElement,
			prompt,
		})
		if (!result) return
		setOpen(false)
	}, [canvas, extractedPrompt, selectedImageElement])

	const handleCopy = useCallback(() => {
		const prompt = extractedPrompt.trim()
		if (!prompt) return
		void navigator.clipboard
			.writeText(prompt)
			.then(() => {
				toast.success(t("menu.copySuccess", "复制成功"))
			})
			.catch(() => undefined)
	}, [extractedPrompt, t])

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
						data-testid="image-prompt-extraction-button"
						onMouseDown={handleMouseDown}
					>
						{isGenerating ? (
							<LoaderCircle size={16} className="animate-spin" />
						) : (
							<Sparkles size={16} />
						)}
						<span className={styles.buttonText}>
							{t("imagePromptExtraction.trigger", "提炼提示词")}
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
					<p className={styles.title}>
						{t("imagePromptExtraction.title", "图片提炼提示词")}
					</p>
					{hasExtractedPrompt && !isGenerating && (
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
						<span>{t("imagePromptExtraction.generating", "正在提炼提示词")}</span>
					</div>
				) : errorMessage ? (
					<div className={`${styles.status} ${styles.error}`}>{errorMessage}</div>
				) : (
					<div ref={bodyRef} className={styles.body}>
						{extractedPrompt}
					</div>
				)}
				{!isGenerating && (
					<div className={styles.actions}>
						{hasExtractedPrompt ? (
							<>
								<Button
									type="button"
									variant="outline"
									className={`${styles.actionButton} ${styles.secondaryActionButton}`}
									onClick={() => void generateExtractedPrompt()}
									disabled={isUnavailable}
								>
									<RefreshCw size={14} />
									{t("imagePromptExtraction.regenerate", "重新提炼")}
								</Button>
								<Button
									type="button"
									className={`${styles.actionButton} ${styles.primaryActionButton}`}
									onClick={handleCreateText}
								>
									{t("imagePromptExtraction.createText", "创建文本")}
								</Button>
							</>
						) : (
							<Button
								type="button"
								className={`${styles.actionButton} ${styles.primaryActionButton}`}
								onClick={() => void generateExtractedPrompt()}
								disabled={isUnavailable}
							>
								<Sparkles size={14} />
								{errorMessage
									? t("imagePromptExtraction.retry", "重试")
									: t("imagePromptExtraction.generate", "提炼提示词")}
							</Button>
						)}
					</div>
				)}
			</PopoverContent>
		</Popover>
	)
}

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ImagePromptExtractionUserError && error.message) {
		return error.message
	}
	return fallback
}

class ImagePromptExtractionUserError extends Error {}

function buildImagePromptExtractionRequestKey(params: {
	elementId?: string
	contentId?: string
	src?: string
	cropSignature: string
}): string {
	return JSON.stringify({
		elementId: params.elementId ?? "",
		contentId: params.contentId ?? "",
		src: params.src ?? "",
		crop: params.cropSignature,
	})
}
