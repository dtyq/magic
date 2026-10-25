import { useCallback, useEffect, useMemo, useState } from "react"
import { useEventListener, useLatest } from "ahooks"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import type { Canvas } from "../../../../runtime/core/Canvas"
import { ElementTypeEnum, type VideoElement } from "../../../../runtime/document/types"
import { VideoElement as VideoElementClass } from "../../../../runtime/elements/video/VideoElement"
import { generateUUID } from "../../../../runtime/shared/ids"
import VideoGenerateEditorRender from "./VideoGenerateEditorRender"
import { useVideoPointsConfirm } from "./useVideoPointsConfirm"
import { buildVideoPointsEstimateSignature } from "./points/video-points-estimate.utils"
import { collectPendingVideoGenerationRequestResourcePaths } from "./points/video-points-estimate.resources"
import { resolveVideoPointsEstimateGate } from "./points/video-points-estimate.policy"
import type { GenerateVideoRequest } from "../../../../public/magic-types"
import { ElementToolTypeEnum } from "../../../../public/props"
import type { MediaResourceFullscreenPreviewItem } from "../../../fullscreen/media-resource/index"
import {
	getActiveContent,
	getContentGenerationState,
	getContentState,
} from "../../../../runtime/document/elementContent"
import { useIsMediaReplacing } from "../../../../app/hooks/canvas"
import { useGenerationRuntime } from "../../../../app/hooks/canvas/useGenerationRuntime"
import { useCanvasUI } from "../../../../app/providers/CanvasUIProvider"
import { isEditorInteractiveKeyboardTarget } from "../../../editors/keyboard"
import { resolveVideoReferenceVideoModel } from "./model-config/video-editor-config.model"
import type { VideoEditSessionSnapshot } from "./video-editor-config.types"
import { buildMediaEditSourceFingerprint } from "../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"
import {
	runSeedanceImageCompliancePreflight,
	shouldRunSeedanceImageCompliancePreflight,
} from "../../../../runtime/resources/asset/seedanceImageCompliancePreflight"
import { useElementToolCommand } from "../../model/useElementToolCommand"
import type { GenerationToolCommandRequest } from "../../../../runtime/element-tools"
import {
	VIDEO_DRAFT_FINAL_RESOLUTION,
	buildVideoDraftFinalRequest,
	isDraftTaskVideoRequest,
	isDraftVideoContent,
	supportsVideoDraftFinal,
} from "../../../../runtime/resources/video-draft-final/videoDraftFinalRequest"
import { resolveVideoDraftFinalHint } from "../../../../runtime/resources/video-draft-final/videoDraftFinalHint"
import { useVideoPointsEstimate } from "./useVideoPointsEstimate"
import { toastSeedanceCompliancePreflightBlocked } from "../../../toolbar/asset-library/assetComplianceToasts"
import type { MediaEditorSubmissionController } from "../shared/useMediaEditorSubmission"

interface VideoSecondEditProps {
	videoElement: VideoElement
	pendingToolCommand?: GenerationToolCommandRequest | null
	onPendingToolCommandHandled?: () => void
	onPreviewMediaResource?: (resource: MediaResourceFullscreenPreviewItem) => void
	isMediaResourcePreviewOpen?: boolean
	submissionController: MediaEditorSubmissionController
}

async function waitForPendingVideoGenerationResources(
	canvas: Canvas,
	request: Partial<GenerateVideoRequest>,
): Promise<void> {
	const uploadManager = canvas.canvasFileUploadManager
	const collectPendingPaths = () =>
		collectPendingVideoGenerationRequestResourcePaths(request, (path) =>
			uploadManager.shouldDeferRemoteResourceLoad(path),
		)

	const pendingPaths = collectPendingPaths()
	if (pendingPaths.length === 0) return

	return new Promise<void>((resolve) => {
		let resolved = false
		const finish = () => {
			if (resolved) return
			resolved = true
			unsubscribe()
			resolve()
		}
		const unsubscribe = canvas.eventEmitter.on("resource:remote-load-deferral-released", () => {
			const nextPendingPaths = collectPendingPaths()
			if (nextPendingPaths.length > 0) {
				return
			}

			finish()
		})

		if (collectPendingPaths().length === 0) {
			finish()
		}
	})
}

/** 视频成片结果态：重新编辑可调整已保存请求，再次生成则直接追加同配置 Content。 */
export default function VideoSecondEdit(props: VideoSecondEditProps) {
	const { videoElement, pendingToolCommand, onPendingToolCommandHandled, submissionController } =
		props
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const { methods, videoModelList, getCachedVideoPointsEstimate, getVideoPointsEstimate } =
		useMagic()
	const { selectedElements } = useCanvasUI()
	const [editingMode, setEditingMode] = useState<"quick-edit" | "re-edit" | null>(null)
	const [isGeneratingAgain, setIsGeneratingAgain] = useState(false)
	const [isPreparingGenerateAgain, setIsPreparingGenerateAgain] = useState(false)
	const [isPreparingGenerateFinal, setIsPreparingGenerateFinal] = useState(false)
	const [isSubmittingGenerateFinal, setIsSubmittingGenerateFinal] = useState(false)
	const [draftFinalRequestId, setDraftFinalRequestId] = useState(() => generateUUID())
	const isReplacing = useIsMediaReplacing(videoElement.id)
	const isMediaResourcePreviewOpen = props.isMediaResourcePreviewOpen ?? false
	const videoContent = getActiveContent(videoElement)
	const savedGenerateVideoRequest = videoContent?.generateVideoRequest
	const sessionStore = canvas?.mediaEditRecoveryManager
	const sessionContentId = videoContent?.contentId ?? videoElement.activeContentId ?? ""
	const { activeContentIsGenerating: persistedActiveContentIsGenerating } =
		getContentGenerationState(videoElement)
	const runtimeGeneration = useGenerationRuntime(videoElement.id, sessionContentId)
	const activeContentIsGenerating =
		persistedActiveContentIsGenerating || Boolean(runtimeGeneration)
	const sessionSourceFingerprint = buildMediaEditSourceFingerprint(
		sessionContentId,
		videoContent?.src,
	)
	const confirmVideoGeneration = useVideoPointsConfirm()
	const quickEditModel = resolveVideoReferenceVideoModel(
		videoModelList,
		savedGenerateVideoRequest?.model_id,
	)
	const canQuickEdit = Boolean(videoContent?.src && quickEditModel)
	const isDraftTaskResult = isDraftTaskVideoRequest(savedGenerateVideoRequest)
	const draftSourceModel = useMemo(
		() =>
			videoModelList.find((model) => model.model_id === savedGenerateVideoRequest?.model_id),
		[videoModelList, savedGenerateVideoRequest?.model_id],
	)
	const hasDraftFinalCapability = Boolean(
		videoContent &&
		getContentState(videoContent) === "completed" &&
		isDraftVideoContent(videoContent) &&
		supportsVideoDraftFinal(draftSourceModel, videoContent.generateVideoRequest?.model_id),
	)
	const draftFinalFinishedAt = videoContent?.videoGenerationResultMeta?.runtime?.finished_at
	const draftFinalHint = useMemo(
		() =>
			hasDraftFinalCapability ? resolveVideoDraftFinalHint(draftFinalFinishedAt) : undefined,
		[draftFinalFinishedAt, hasDraftFinalCapability],
	)
	const draftFinalExpired = draftFinalHint?.expired === true
	const draftFinalRequest = useMemo(
		() =>
			videoContent && hasDraftFinalCapability
				? buildVideoDraftFinalRequest(videoContent, draftFinalRequestId)
				: null,
		[draftFinalRequestId, hasDraftFinalCapability, videoContent],
	)
	const draftFinalEstimateSignature = useMemo(
		() => (draftFinalRequest ? buildVideoPointsEstimateSignature(draftFinalRequest) : null),
		[draftFinalRequest],
	)
	const { points: draftFinalEstimatedPoints, isLoading: isDraftFinalEstimateLoading } =
		useVideoPointsEstimate({
			request: draftFinalRequest,
			signature: draftFinalEstimateSignature,
			enabled: hasDraftFinalCapability,
		})

	const handleStartRegenerate = useCallback(() => {
		if (!canvas || !savedGenerateVideoRequest || isDraftTaskResult) return
		if (canvas.mediaReplaceController?.isReplacing?.(videoElement.id)) return
		setEditingMode("re-edit")
	}, [canvas, isDraftTaskResult, savedGenerateVideoRequest, videoElement.id])

	const handleStartQuickEdit = useCallback(() => {
		if (!canvas || !canQuickEdit) return
		if (canvas.mediaReplaceController?.isReplacing?.(videoElement.id)) return
		if (activeContentIsGenerating) return
		setEditingMode("quick-edit")
	}, [activeContentIsGenerating, canQuickEdit, canvas, videoElement.id])

	const isEditingRef = useLatest(editingMode !== null)
	const selectedElementsRef = useLatest(selectedElements)
	const handleStartQuickEditRef = useLatest(handleStartQuickEdit)

	const estimateVideoRequestPoints = useCallback(
		async (request: GenerateVideoRequest): Promise<number | null> => {
			if (!canvas) return null
			const estimateSignature = buildVideoPointsEstimateSignature(request)
			const hasPendingResourceDeferrals =
				collectPendingVideoGenerationRequestResourcePaths(request, (path) =>
					canvas.canvasFileUploadManager.shouldDeferRemoteResourceLoad(path),
				).length > 0
			const estimateGate = resolveVideoPointsEstimateGate({
				enabled: true,
				request,
				signature: estimateSignature,
				hasEstimateVideoPoints: Boolean(methods?.estimateVideoPoints),
				hasPendingResourceDeferrals,
			})
			if (estimateGate.blockedReason === "pending_resource_deferrals") {
				await waitForPendingVideoGenerationResources(canvas, request)
			}
			const canEstimate =
				estimateGate.blockedReason === "pending_resource_deferrals"
					? resolveVideoPointsEstimateGate({
							enabled: true,
							request,
							signature: estimateSignature,
							hasEstimateVideoPoints: Boolean(methods?.estimateVideoPoints),
							hasPendingResourceDeferrals: false,
						}).canEstimate
					: estimateGate.canEstimate
			if (!canEstimate) return null

			try {
				const cachedEstimate = getCachedVideoPointsEstimate(estimateSignature)
				const estimate =
					cachedEstimate ??
					(await getVideoPointsEstimate({ signature: estimateSignature, request }))
				return typeof estimate.points === "number" ? estimate.points : null
			} catch {
				return null
			}
		},
		[
			canvas,
			getCachedVideoPointsEstimate,
			getVideoPointsEstimate,
			methods?.estimateVideoPoints,
		],
	)

	useEventListener(
		"keydown",
		(event: KeyboardEvent) => {
			if (
				isEditingRef.current ||
				isReplacing ||
				isMediaResourcePreviewOpen ||
				!canQuickEdit ||
				activeContentIsGenerating
			)
				return
			if (
				!selectedElementsRef.current?.some(
					(element) =>
						element?.type === ElementTypeEnum.Video && element.id === videoElement.id,
				)
			) {
				return
			}
			if (isEditorInteractiveKeyboardTarget(event.target)) return
			if (event.key !== "Tab" || event.shiftKey) return
			event.preventDefault()
			handleStartQuickEditRef.current?.()
		},
		{ target: window },
	)

	const handleGenerateAgain = useCallback(async () => {
		if (!canvas || !savedGenerateVideoRequest || isGeneratingAgain || isPreparingGenerateAgain)
			return
		if (canvas.mediaReplaceController?.isReplacing?.(videoElement.id)) return
		// 预估与提交共用同一任务对象，确认弹窗期间不重新生成 task id。
		const generateVideoRequest: GenerateVideoRequest = {
			...savedGenerateVideoRequest,
			video_id: generateUUID(),
		}

		setIsPreparingGenerateAgain(true)
		let estimatedPoints: number | null
		try {
			estimatedPoints = await estimateVideoRequestPoints(generateVideoRequest)
		} finally {
			setIsPreparingGenerateAgain(false)
		}

		await confirmVideoGeneration({
			points: estimatedPoints,
			onConfirm: async () => {
				if (canvas.mediaReplaceController?.isReplacing?.(videoElement.id)) return
				setIsGeneratingAgain(true)
				const requestWithId = generateVideoRequest
				const modelName = videoModelList.find(
					(model) => model.model_id === requestWithId.model_id,
				)?.model_name
				const requiresCompliance = shouldRunSeedanceImageCompliancePreflight({
					canvas,
					request: requestWithId,
					modelName,
				})
				try {
					await submissionController.run({
						initialPhase: requiresCompliance ? "validating" : "submitting",
						execute: async ({ setPhase }) => {
							if (requiresCompliance) {
								const compliancePreflight =
									await runSeedanceImageCompliancePreflight({
										canvas,
										sourceVideoElementId: videoElement.id,
										request: requestWithId,
										modelName,
									})
								if (!compliancePreflight.proceed) {
									toastSeedanceCompliancePreflightBlocked(t, compliancePreflight)
									return { accepted: false }
								}
							}

							setPhase("submitting")

							const elementInstance = canvas.elementManager.getElementInstance(
								videoElement.id,
							)
							if (!(elementInstance instanceof VideoElementClass)) {
								return { accepted: false }
							}
							const submitted = await elementInstance.submitContentGeneration(
								requestWithId,
								{
									preserveVideoId: true,
								},
							)
							if (submitted) {
								sessionStore?.clearContent(videoElement.id, sessionContentId)
							}
							return { accepted: submitted }
						},
					})
				} finally {
					setIsGeneratingAgain(false)
				}
			},
		})
	}, [
		canvas,
		confirmVideoGeneration,
		estimateVideoRequestPoints,
		isGeneratingAgain,
		isPreparingGenerateAgain,
		savedGenerateVideoRequest,
		sessionContentId,
		sessionStore,
		submissionController,
		t,
		videoModelList,
		videoElement,
	])

	const handleGenerateFinal = useCallback(async () => {
		if (
			!canvas ||
			!draftFinalRequest ||
			!sessionContentId ||
			!hasDraftFinalCapability ||
			draftFinalExpired ||
			isPreparingGenerateFinal ||
			isSubmittingGenerateFinal
		) {
			return
		}

		setIsPreparingGenerateFinal(true)
		let estimatedPoints = draftFinalEstimatedPoints
		try {
			if (estimatedPoints == null) {
				estimatedPoints = await estimateVideoRequestPoints(draftFinalRequest)
			}
		} finally {
			setIsPreparingGenerateFinal(false)
		}

		await confirmVideoGeneration({
			points: estimatedPoints,
			onConfirm: async () => {
				setIsSubmittingGenerateFinal(true)
				try {
					await canvas.videoDraftFinalManager?.start({
						sourceElementId: videoElement.id,
						sourceContentId: sessionContentId,
						request: draftFinalRequest,
					})
				} finally {
					// 每次实际确认都是独立任务；下一次点击必须使用全新的 video_id。
					setDraftFinalRequestId(generateUUID())
					setIsSubmittingGenerateFinal(false)
				}
			},
		})
	}, [
		canvas,
		confirmVideoGeneration,
		draftFinalEstimatedPoints,
		draftFinalExpired,
		draftFinalRequest,
		estimateVideoRequestPoints,
		hasDraftFinalCapability,
		isPreparingGenerateFinal,
		isSubmittingGenerateFinal,
		sessionContentId,
		videoElement.id,
	])

	useEffect(() => {
		if (
			!pendingToolCommand ||
			pendingToolCommand.contentId !== sessionContentId ||
			activeContentIsGenerating ||
			isReplacing ||
			isMediaResourcePreviewOpen
		) {
			return
		}

		// 消费时仍以命令中捕获的 ContentId 为边界，避免版本切换后复用
		// 当前 active Content 的请求。
		onPendingToolCommandHandled?.()
		switch (pendingToolCommand.toolId) {
			case ElementToolTypeEnum.GenerationQuickEdit:
				handleStartQuickEdit()
				return
			case ElementToolTypeEnum.GenerationReEdit:
				handleStartRegenerate()
				return
			case ElementToolTypeEnum.GenerationGenerateAgain:
				void handleGenerateAgain()
				return
			case ElementToolTypeEnum.GenerationGenerateFinal:
				void handleGenerateFinal()
				return
		}
	}, [
		activeContentIsGenerating,
		handleGenerateAgain,
		handleGenerateFinal,
		handleStartQuickEdit,
		handleStartRegenerate,
		isMediaResourcePreviewOpen,
		isReplacing,
		onPendingToolCommandHandled,
		pendingToolCommand,
		sessionContentId,
	])

	const canRestore = Boolean(savedGenerateVideoRequest?.model_id)
	const canReEdit = canRestore && !isDraftTaskResult
	const generateAgainBusy = isGeneratingAgain || isPreparingGenerateAgain
	const generateFinalBusy =
		isDraftFinalEstimateLoading || isPreparingGenerateFinal || isSubmittingGenerateFinal
	const canGenerateFinal =
		hasDraftFinalCapability && !editingMode && !isReplacing && !isMediaResourcePreviewOpen

	useEffect(() => {
		if (!isReplacing) return
		setEditingMode(null)
		sessionStore?.clearContent(videoElement.id, sessionContentId)
	}, [isReplacing, sessionContentId, sessionStore, videoElement.id])

	useElementToolCommand(
		useMemo(
			() => ({
				elementId: videoElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationQuickEdit,
				state: {
					available:
						canQuickEdit && !editingMode && !isReplacing && !isMediaResourcePreviewOpen,
				},
				execute: handleStartQuickEdit,
			}),
			[
				canQuickEdit,
				editingMode,
				handleStartQuickEdit,
				isMediaResourcePreviewOpen,
				isReplacing,
				sessionContentId,
				videoElement.id,
			],
		),
	)
	useElementToolCommand(
		useMemo(
			() => ({
				elementId: videoElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationReEdit,
				state: {
					available:
						canReEdit && !editingMode && !isReplacing && !isMediaResourcePreviewOpen,
				},
				execute: handleStartRegenerate,
			}),
			[
				canReEdit,
				editingMode,
				handleStartRegenerate,
				isMediaResourcePreviewOpen,
				isReplacing,
				sessionContentId,
				videoElement.id,
			],
		),
	)
	useElementToolCommand(
		useMemo(
			() => ({
				elementId: videoElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationGenerateFinal,
				state: {
					available: canGenerateFinal,
					disabled: generateFinalBusy || draftFinalExpired,
					loading: generateFinalBusy,
					data: {
						videoGenerationEstimate: {
							resolution: VIDEO_DRAFT_FINAL_RESOLUTION.toUpperCase(),
							points: draftFinalEstimatedPoints,
						},
						...(draftFinalHint ? { videoDraftFinalHint: draftFinalHint } : {}),
					},
				},
				execute: handleGenerateFinal,
			}),
			[
				canGenerateFinal,
				draftFinalEstimatedPoints,
				draftFinalExpired,
				draftFinalHint,
				generateFinalBusy,
				handleGenerateFinal,
				sessionContentId,
				videoElement.id,
			],
		),
	)
	useElementToolCommand(
		useMemo(
			() => ({
				elementId: videoElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				state: {
					available:
						canRestore && !editingMode && !isReplacing && !isMediaResourcePreviewOpen,
					disabled: generateAgainBusy,
					loading: generateAgainBusy,
				},
				execute: handleGenerateAgain,
			}),
			[
				canRestore,
				editingMode,
				generateAgainBusy,
				handleGenerateAgain,
				isMediaResourcePreviewOpen,
				isReplacing,
				sessionContentId,
				videoElement.id,
			],
		),
	)

	if (isReplacing) return null

	if (!editingMode) return null

	return (
		<VideoGenerateEditorRender
			key={`${videoElement.id}-from-result-${editingMode}`}
			videoElement={videoElement}
			autoFocus
			autoFocusAtDocumentEnd
			restoreOnMount={editingMode === "quick-edit" ? "quickEdit" : "originalRequestOnly"}
			// 结果态的快捷编辑、重新编辑都沿用旧链路，在右侧创建新元素；
			// 结果态“再次生成”单独通过 handleGenerateAgain 追加 Content。
			submitTarget="new-element"
			sessionIntent={editingMode}
			sessionSourceFingerprint={sessionSourceFingerprint}
			sessionSnapshot={
				sessionStore?.get<VideoEditSessionSnapshot>(
					{
						elementId: videoElement.id,
						contentId: sessionContentId,
						intent: editingMode,
					},
					sessionSourceFingerprint,
				)?.draft
			}
			syncElementSize={false}
			onGenerateSubmitSucceeded={() => setEditingMode(null)}
			onPreviewMediaResource={props.onPreviewMediaResource}
			isMediaResourcePreviewOpen={props.isMediaResourcePreviewOpen}
			submissionController={props.submissionController}
		/>
	)
}
