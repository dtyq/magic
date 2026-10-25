import { useLayoutEffect, useMemo, useReducer, useRef, useSyncExternalStore } from "react"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasEvent } from "../../../app/hooks/canvas/useCanvasEvent"
import type {
	ElementToolCommand,
	ElementToolRuntimeState,
	ElementToolType,
} from "../../../runtime/element-tools"

interface ElementToolCommandRegistration {
	elementId: string
	toolId: ElementToolType
	contentId?: string
	operationId?: string
	state?: Omit<ElementToolRuntimeState, "available"> & { available?: boolean }
	execute: (command: ElementToolCommand) => void | Promise<void>
}

/** 编辑器只暴露命令能力，不再拥有底部工具的展示生命周期。 */
export function useElementToolCommand(registration: ElementToolCommandRegistration | null): void {
	const { canvas } = useCanvas()
	const commandBus = canvas?.elementToolCommandBus
	const registrationRef = useRef<ElementToolCommandRegistration | null>(registration)
	registrationRef.current = registration
	const registrationKey = registration
		? [
				registration.elementId,
				registration.toolId,
				registration.contentId ?? "",
				registration.operationId ?? "",
				registration.state?.available ?? true,
				registration.state?.disabled ?? false,
				registration.state?.loading ?? false,
				registration.state?.disabledReason ?? "",
				registration.state?.data?.version?.current ?? "",
				registration.state?.data?.version?.total ?? "",
				registration.state?.data?.version?.isMain ?? "",
				registration.state?.data?.videoGenerationEstimate?.resolution ?? "",
				registration.state?.data?.videoGenerationEstimate?.points ?? "",
				registration.state?.data?.videoDraftFinalHint?.deadlineText ?? "",
				registration.state?.data?.videoDraftFinalHint?.expired ?? "",
			].join("\u0000")
		: null
	useLayoutEffect(() => {
		const currentRegistration = registrationRef.current
		if (!commandBus || !currentRegistration) return
		const capturedContentId = currentRegistration.contentId
		const capturedElementId = currentRegistration.elementId
		const capturedToolId = currentRegistration.toolId
		return commandBus.register(
			{
				elementId: currentRegistration.elementId,
				toolId: currentRegistration.toolId,
				contentId: currentRegistration.contentId,
				operationId: currentRegistration.operationId,
			},
			(command: ElementToolCommand) => {
				if (
					command.elementId !== capturedElementId ||
					command.toolId !== capturedToolId ||
					(capturedContentId && command.contentId !== capturedContentId)
				)
					return
				return registrationRef.current?.execute(command)
			},
			currentRegistration.state,
		)
	}, [commandBus, registrationKey])
}

export function useElementToolRuntimeStates(elementId: string | null) {
	const { canvas } = useCanvas()
	const bus = canvas?.elementToolCommandBus
	const [, forcePreviewUpdate] = useReducer((value: number) => value + 1, 0)
	useCanvasEvent(
		"content:previewChanged",
		({ data }) => {
			if (!elementId || !data.elementId || data.elementId === elementId) {
				forcePreviewUpdate()
			}
		},
		[elementId],
	)
	const contentId = useCanvasElementContentId(elementId)
	const subscribe = useMemo(
		() => (listener: () => void) => {
			if (!bus || !elementId) return () => undefined
			return bus.subscribeElement(elementId, contentId, listener)
		},
		[bus, contentId, elementId],
	)
	const getSnapshot = useMemo(
		() => () =>
			bus && elementId ? bus.getElementToolStates(elementId, contentId) : EMPTY_TOOL_STATES,
		[bus, contentId, elementId],
	)
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

const EMPTY_TOOL_STATES = new Map<ElementToolType, ElementToolRuntimeState>()

function useCanvasElementContentId(elementId: string | null): string | undefined {
	const { canvas } = useCanvas()
	const element = elementId ? canvas?.elementManager?.getElementData(elementId) : undefined
	return element && "contents" in element
		? (canvas?.getEffectiveContentId(element.id) ?? undefined)
		: undefined
}
