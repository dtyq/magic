import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { TFunction } from "i18next"
import MagicModal from "@/components/base/MagicModal"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	buildHtmlMultiSelectionRequest,
	createHtmlElementCaptureId,
	createHtmlSelectionTarget,
	getHtmlScreenshotFileName,
	upsertHtmlSelectionTarget,
	buildAgentPromptContent,
	type HtmlMultiSelectionSubmitState,
	type HtmlSelectionScreenshot,
	type HtmlSelectionTarget,
	type InspectedElementRect,
	type useElementInspector,
} from "@/components/business/ElementInspector"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { roleStore } from "@/pages/superMagic/stores"
import { resolveDefaultAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"

type ElementInspector = ReturnType<typeof useElementInspector>

/** Minimal file info needed to identify the HTML file in a structured request. */
export interface InspectorFileInfo {
	fileId: string
	fileName: string
	filePath: string
}

type InspectorMode = "devConsole" | "toolbar" | "multiSelection" | "quickSelection"
type SelectionMode = "element" | "screenshot"

interface InspectorToolbarModeOptions {
	/** Disable target auto-scroll for previews whose coordinate space is scaled. */
	disableTargetScroll?: boolean
}

/**
 * Coordinates toolbar inspection and the multi-target HTML editing flow.
 * Multi-selection keeps a local draft; quick selection inserts one inspected
 * element immediately and enriches it after its screenshot is prepared.
 */
export function useInspectorToolbarMode(
	elementInspector: ElementInspector,
	t: TFunction<"super">,
	fileInfo?: InspectorFileInfo,
	options: InspectorToolbarModeOptions = {},
) {
	const { disableTargetScroll = false } = options
	const [mode, setMode] = useState<InspectorMode>("devConsole")
	const [activeTarget, setActiveTarget] = useState<HtmlSelectionTarget | null>(null)
	const [draftInstruction, setDraftInstruction] = useState("")
	const [pendingTargets, setPendingTargets] = useState<HtmlSelectionTarget[]>([])
	const [submitState, setSubmitState] = useState<HtmlMultiSelectionSubmitState>("idle")
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [selectionMode, setSelectionMode] = useState<SelectionMode>("element")
	const modeRef = useRef<InspectorMode>("devConsole")
	const exitRequestRef = useRef<Promise<boolean> | null>(null)
	const previousFileIdRef = useRef(fileInfo?.fileId)
	const quickSelectionRef = useRef<{
		selector: string
		captureId: string
		screenshotRequested: boolean
	} | null>(null)
	const fileId = fileInfo?.fileId
	const fileName = fileInfo?.fileName
	const filePath = fileInfo?.filePath
	const stableFileInfo = useMemo(
		() =>
			fileId && fileName && filePath !== undefined
				? { fileId, fileName, filePath }
				: undefined,
		[fileId, fileName, filePath],
	)
	const {
		selectedElement,
		start: startInspector,
		stop: stopInspector,
		clearSelection,
		setTrackedSelectors,
		scrollToSelector,
		scrollToPosition,
	} = elementInspector

	// Keep only the small set of element targets that can be visible in the
	// inspector. The iframe refreshes their viewport rects on scroll; unrelated
	// page elements are never measured.
	const trackedSelectors = useMemo(() => {
		const selectors = pendingTargets
			.filter(
				(target): target is Extract<HtmlSelectionTarget, { kind: "element" }> =>
					target.kind === "element",
			)
			.map((target) => target.info.selector)
		if (activeTarget?.kind === "element") selectors.push(activeTarget.info.selector)
		if (selectedElement?.selector) selectors.push(selectedElement.selector)
		return Array.from(new Set(selectors.filter(Boolean)))
	}, [activeTarget, pendingTargets, selectedElement?.selector])

	useEffect(() => {
		setTrackedSelectors(trackedSelectors)
	}, [setTrackedSelectors, trackedSelectors])

	const updateMode = useCallback((nextMode: InspectorMode) => {
		modeRef.current = nextMode
		setMode(nextMode)
	}, [])

	useEffect(() => {
		if (modeRef.current === "devConsole" || !selectedElement) return

		const info = selectedElement
		if (modeRef.current === "quickSelection") {
			// Insert the inspector node immediately with captureId.
			if (!quickSelectionRef.current) {
				quickSelectionRef.current = {
					selector: info.selector,
					captureId: createHtmlElementCaptureId(info.selector),
					screenshotRequested: false,
				}
				pubsub.publish(
					PubSubEvents.Append_Content_To_Editor,
					buildAgentPromptContent(
						info,
						t("stylePanel.inspector.agentPromptTitle"),
						stableFileInfo,
						undefined,
						quickSelectionRef.current.captureId,
						t,
					),
				)
			}
			stopInspector()
			return
		}

		if (
			modeRef.current === "multiSelection" &&
			activeTarget?.kind === "element" &&
			activeTarget.info.selector === info.selector
		) {
			return
		}

		setPendingTargets((targets) => {
			let changed = false
			const nextTargets = targets.map((target) => {
				if (target.kind !== "element" || target.info.selector !== info.selector) {
					return target
				}
				changed = true
				return { ...target, info }
			})
			return changed ? nextTargets : targets
		})
		setActiveTarget((target) =>
			target?.kind === "element" && target.info.selector === info.selector
				? { ...target, info }
				: target,
		)
		if (modeRef.current === "multiSelection") {
			const existing = pendingTargets.find(
				(target) => target.kind === "element" && target.info?.selector === info.selector,
			)
			setActiveTarget(existing ?? createHtmlSelectionTarget(info))
			setDraftInstruction(existing?.instruction ?? "")
			setSubmitError(null)
			stopInspector()
			return
		}

		// Toolbar mode keeps its historical behavior: one selection creates a topic.
		clearSelection()
		stopInspector()
		updateMode("devConsole")
		const content = buildAgentPromptContent(
			info,
			t("stylePanel.inspector.agentPromptTitle"),
			stableFileInfo,
			undefined,
			undefined,
			t,
		)

		if (!pubsub.hasListeners(PubSubEvents.Create_New_Topic)) {
			pubsub.publish(PubSubEvents.Set_Input_Message, content)
			return
		}

		const defaultSelection = resolveDefaultAgentSelection()
		const topicMode = superMagicModeService.isModeValid(
			defaultSelection.modeIdentifier,
			defaultSelection.agentCode,
		)
			? (defaultSelection.modeIdentifier as TopicMode)
			: undefined

		if (topicMode) roleStore.applyResolvedRole(topicMode)
		pubsub.publish(PubSubEvents.Create_New_Topic, {
			topicMode,
			afterCreate: { content, extraData: { hasInput: true } },
		})
	}, [
		selectedElement,
		activeTarget,
		stableFileInfo,
		pendingTargets,
		setPendingTargets,
		t,
		stopInspector,
		clearSelection,
		updateMode,
	])

	const startInToolbarMode = useCallback(() => {
		updateMode("toolbar")
		startInspector()
	}, [startInspector, updateMode])

	const startInAppendMode = useCallback(() => {
		setSubmitError(null)
		setSubmitState("idle")
		updateMode("multiSelection")
		setSelectionMode("element")
		startInspector()
	}, [startInspector, updateMode])

	const startInQuickSelectionMode = useCallback(() => {
		quickSelectionRef.current = null
		setSubmitError(null)
		setSelectionMode("element")
		updateMode("quickSelection")
		startInspector()
	}, [startInspector, updateMode])

	const updateSelectionMode = useCallback(
		(nextMode: SelectionMode) => {
			setSelectionMode(nextMode)
			setSubmitError(null)
			setActiveTarget(null)
			setDraftInstruction("")
			clearSelection()
			if (modeRef.current !== "multiSelection") updateMode("multiSelection")
			startInspector()
		},
		[clearSelection, startInspector, updateMode],
	)

	const captureScreenshotTarget = useCallback(
		(
			dataUrl: string,
			rect: InspectedElementRect,
			displaySize?: { width: number; height: number },
			documentRect?: InspectedElementRect,
		) => {
			setActiveTarget({
				id: `screenshot:${Date.now()}`,
				kind: "screenshot",
				screenshot: { dataUrl, rect, displaySize, documentRect: documentRect ?? rect },
				instruction: "",
			})
			clearSelection()
			setDraftInstruction("")
			setSubmitError(null)
			stopInspector()
		},
		[clearSelection, stopInspector],
	)

	const attachElementScreenshot = useCallback(
		(selector: string, screenshot: HtmlSelectionScreenshot) => {
			const captureId = createHtmlElementCaptureId(selector)
			setActiveTarget((target) =>
				target?.kind === "element" && target.info.selector === selector
					? { ...target, id: captureId, screenshot }
					: target,
			)
			setPendingTargets((targets) => {
				let changed = false
				const next = targets.map((target) => {
					if (target.kind !== "element" || target.info.selector !== selector) {
						return target
					}
					changed = true
					return { ...target, id: captureId, screenshot }
				})
				return changed ? next : targets
			})

			const quickSelection = quickSelectionRef.current
			if (!quickSelection || quickSelection.selector !== selector) return

			if (quickSelection.screenshotRequested) return
			quickSelection.screenshotRequested = true
			const finishScreenshot = (screenshotMention?: TiptapMentionAttributes) => {
				if (quickSelectionRef.current !== quickSelection) return
				if (screenshotMention) {
					pubsub.publish(PubSubEvents.Update_Html_Inspector_Screenshot, {
						captureId: quickSelection.captureId,
						screenshotMention,
					})
				}
				quickSelectionRef.current = null
				clearSelection()
				stopInspector()
				updateMode("devConsole")
			}

			if (!pubsub.hasListeners(PubSubEvents.Prepare_Html_Screenshot)) {
				finishScreenshot()
				return
			}

			pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
				captureId: quickSelection.captureId,
				dataUrl: screenshot.dataUrl,
				fileName: getHtmlScreenshotFileName(quickSelection.captureId),
				releaseAfterSuccess: true,
				onSuccess: finishScreenshot,
				onError: () => finishScreenshot(),
			})
		},
		[clearSelection, stopInspector, updateMode],
	)

	const confirmTarget = useCallback(() => {
		if (!activeTarget || !draftInstruction.trim()) return
		const confirmedTarget = {
			...activeTarget,
			instruction: draftInstruction.trim(),
			...(activeTarget.kind === "element" &&
			activeTarget.screenshot &&
			!activeTarget.id.startsWith(`element:${activeTarget.info.selector}:`)
				? {
						id: createHtmlElementCaptureId(activeTarget.info.selector),
					}
				: {}),
		}
		setPendingTargets((targets) => upsertHtmlSelectionTarget(targets, confirmedTarget))
		if (
			confirmedTarget.screenshot &&
			pubsub.hasListeners(PubSubEvents.Prepare_Html_Screenshot)
		) {
			// Region shots start upload now. Element shots stay local.
			pubsub.publish(PubSubEvents.Prepare_Html_Screenshot, {
				captureId: confirmedTarget.id,
				dataUrl: confirmedTarget.screenshot.dataUrl,
				fileName: getHtmlScreenshotFileName(confirmedTarget.id ?? ""),
				stageUpload: confirmedTarget.kind === "screenshot",
				onSuccess: (mention) => {
					if (confirmedTarget.kind !== "screenshot") return
					setPendingTargets((targets) =>
						targets.map((target) => {
							if (target.id !== confirmedTarget.id || target.kind !== "screenshot") {
								return target
							}
							return {
								...target,
								screenshot: { ...target.screenshot, mention },
							}
						}),
					)
				},
			})
		}
		setActiveTarget(null)
		setDraftInstruction("")
		setSubmitState("idle")
		// Keep the picker open so users can collect another target without reopening the toolbar.
		clearSelection()
		setSelectionMode("element")
		startInspector()
	}, [activeTarget, draftInstruction, clearSelection, startInspector])

	const cancelTarget = useCallback(() => {
		setActiveTarget(null)
		setDraftInstruction("")
		clearSelection()
		if (modeRef.current === "multiSelection") {
			setSelectionMode("element")
			startInspector()
			return
		}
		updateMode("devConsole")
		stopInspector()
	}, [clearSelection, startInspector, stopInspector, updateMode])

	const editPendingTarget = useCallback(
		(target: HtmlSelectionTarget) => {
			if (!disableTargetScroll) {
				if (target.kind === "element") {
					scrollToSelector?.(target.info.selector)
				} else {
					const documentRect = target.screenshot.documentRect ?? target.screenshot.rect
					scrollToPosition?.({
						left: documentRect.left,
						top: Math.max(0, documentRect.top - 80),
					})
				}
			}
			setActiveTarget(target)
			setDraftInstruction(target.instruction)
			setSubmitError(null)
			updateMode("multiSelection")
			stopInspector()
		},
		[disableTargetScroll, scrollToPosition, scrollToSelector, stopInspector, updateMode],
	)

	const removePendingTarget = useCallback(
		(targetId: string) => {
			setPendingTargets((targets) => targets.filter((target) => target.id !== targetId))
			setSubmitState("idle")
			setSelectionMode("element")
			if (activeTarget?.id !== targetId) return
			setActiveTarget(null)
			setDraftInstruction("")
			clearSelection()
			startInspector()
		},
		[activeTarget?.id, clearSelection, startInspector],
	)

	const resetSelection = useCallback(() => {
		quickSelectionRef.current = null
		setActiveTarget(null)
		setDraftInstruction("")
		setPendingTargets([])
		setSubmitError(null)
		setSubmitState("idle")
		setSelectionMode("element")
		clearSelection()
		updateMode("devConsole")
		stopInspector()
	}, [clearSelection, stopInspector, updateMode])

	// AI 选取模式在元素确认后仍会保留提交列表，因此不能只依赖
	// useElementInspector 的 active 状态来处理 Escape。
	const requestExit = useCallback((): Promise<boolean> => {
		if (modeRef.current === "quickSelection") {
			resetSelection()
			return Promise.resolve(true)
		}
		if (modeRef.current !== "multiSelection") return Promise.resolve(true)
		if (pendingTargets.length === 0) {
			resetSelection()
			return Promise.resolve(true)
		}
		if (exitRequestRef.current) return exitRequestRef.current

		const request = new Promise<boolean>((resolve) => {
			const modal = MagicModal.confirm({
				title: t("stylePanel.inspector.exitConfirmTitle"),
				content: t("stylePanel.inspector.exitConfirmContent", {
					count: pendingTargets.length,
				}),
				okText: t("common.confirm"),
				cancelText: t("common.cancel"),
				closable: false,
				maskClosable: false,
				centered: true,
				onOk: () => {
					resetSelection()
					modal.destroy()
					resolve(true)
				},
				onCancel: () => {
					modal.destroy()
					resolve(false)
				},
			})
		})
		exitRequestRef.current = request
		void request.finally(() => {
			if (exitRequestRef.current === request) exitRequestRef.current = null
		})
		return request
	}, [pendingTargets.length, resetSelection, t])

	const consumeEscape = useCallback(() => {
		if (modeRef.current !== "multiSelection" && modeRef.current !== "quickSelection") {
			return false
		}
		void requestExit()
		return true
	}, [requestExit])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
				(modeRef.current !== "multiSelection" && modeRef.current !== "quickSelection")
			)
				return
			consumeEscape()
			event.preventDefault()
			event.stopImmediatePropagation()
		}

		window.addEventListener("keydown", handleKeyDown, true)
		return () => window.removeEventListener("keydown", handleKeyDown, true)
	}, [consumeEscape])

	useEffect(() => {
		if (previousFileIdRef.current === fileInfo?.fileId) return
		previousFileIdRef.current = fileInfo?.fileId
		resetSelection()
	}, [fileInfo?.fileId, resetSelection])

	const submitPendingTargets = useCallback(async () => {
		if (!fileInfo?.fileId) {
			setSubmitError(t("stylePanel.inspector.fileRequired"))
			setSubmitState("failed")
			return
		}
		if (
			pendingTargets.length === 0 ||
			pendingTargets.some((target) => !target.instruction.trim())
		) {
			setSubmitError(t("stylePanel.inspector.descriptionRequired"))
			setSubmitState("failed")
			return
		}
		if (!pubsub.hasListeners(PubSubEvents.Submit_Html_Multi_Selection)) {
			setSubmitError(t("stylePanel.inspector.submitUnavailable"))
			setSubmitState("failed")
			return
		}

		setSubmitError(null)
		setSubmitState("submitting")
		stopInspector()
		setActiveTarget(null)
		setDraftInstruction("")
		setSelectionMode("element")
		updateMode("devConsole")
		try {
			const request = buildHtmlMultiSelectionRequest(
				fileInfo.fileId,
				pendingTargets,
				"",
				fileInfo.fileName,
				fileInfo.filePath,
			)
			request.onSuccess = resetSelection
			request.onError = (error) => {
				setSubmitError(error instanceof Error ? error.message : String(error))
				setSubmitState("failed")
			}
			pubsub.publish(PubSubEvents.Submit_Html_Multi_Selection, request)
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : String(error))
			setSubmitState("failed")
		}
	}, [fileInfo, pendingTargets, resetSelection, stopInspector, t, updateMode])

	return {
		hideInfoCard: mode !== "devConsole",
		isAppendPicking: mode === "multiSelection",
		isQuickSelecting: mode === "quickSelection",
		selectionMode,
		updateSelectionMode,
		captureScreenshotTarget,
		attachElementScreenshot,
		activeTarget,
		draftInstruction,
		setDraftInstruction,
		confirmTarget,
		cancelTarget,
		pendingTargets,
		submitState,
		submitError,
		editPendingTarget,
		removePendingTarget,
		resetSelection,
		requestExit,
		consumeEscape,
		submitPendingTargets,
		startInToolbarMode,
		startInAppendMode,
		startInQuickSelectionMode,
		inspectorModeRef: modeRef,
	}
}
