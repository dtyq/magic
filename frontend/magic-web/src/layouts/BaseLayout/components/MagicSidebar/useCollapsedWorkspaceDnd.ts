import { useCallback, useEffect, useRef, type RefObject } from "react"
import { message } from "antd"
import { useTranslation } from "react-i18next"
import projectStore from "@/pages/superMagic/stores/core/project"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import superMagicService from "@/pages/superMagic/services"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { SidebarDragData, SidebarDropPosition } from "./WorkspaceList/types"
import {
	createSidebarDragImage,
	createSidebarDropIndicator,
	getDropPosition,
	getProjectDropPosition,
	getEdgeScrollSpeed,
	getIndicatorLineY,
	getNearestProjectTarget,
	getNearestWorkspaceTarget,
	getPredecessorId,
	getProjectPinBoundaryAction,
	isProjectPinGroupBoundaryInsertion,
	getSuccessorId,
	insertAtPosition,
	isNoOpInsertion,
} from "./WorkspaceList/dndUtils"
import type { ProjectPinBoundaryAction } from "./WorkspaceList/ProjectPinBoundaryConfirmDialog"

import {
	clearSidebarDragAppearance,
	setSidebarDragAppearance,
} from "./WorkspaceList/dragAppearance"

const DRAG_DATA_TYPE = "application/x-magic-collapsed-sidebar-dnd"
const OPEN_PROJECT_POPOVER_DELAY = 1000

interface DropPreview {
	type: "workspace" | "project"
	workspaceId: string
	projectId?: string
	position?: SidebarDropPosition
	target: HTMLElement
	disabled?: boolean
}

interface DragFrame {
	target: EventTarget | null
	clientX: number
	clientY: number
}

type BuildPreview = (
	target: EventTarget | null,
	clientY: number,
	active: SidebarDragData | null,
) => DropPreview | null

interface VisualState {
	source: HTMLElement | null
	workspaceTarget: HTMLElement | null
	workspaceButton: HTMLElement | null
	workspaceDisabled: HTMLElement | null
}

interface UseCollapsedWorkspaceDndOptions {
	workspaces: Workspace[]
	enabled: boolean
	openProjectMenuId: string | null
	onProjectMenuChange: (workspaceId: string | null) => void
	requestPinBoundaryConfirmation: (request: {
		action: ProjectPinBoundaryAction
		projectName: string
	}) => Promise<boolean>
}

function getDragSource(target: EventTarget | null) {
	if (!(target instanceof Element)) return null
	return target.closest<HTMLElement>("[data-collapsed-sidebar-dnd-source]")
}

function getTarget(target: EventTarget | null, selector: string) {
	if (!(target instanceof Element)) return null
	return target.closest<HTMLElement>(selector)
}

/** Manages DND inside the collapsed workspace popup and its nested project popover. */
export function useCollapsedWorkspaceDnd({
	workspaces,
	enabled,
	openProjectMenuId,
	onProjectMenuChange,
	requestPinBoundaryConfirmation,
}: UseCollapsedWorkspaceDndOptions): {
	rootRef: RefObject<HTMLDivElement>
} {
	const { t } = useTranslation("super")
	const rootRef = useRef<HTMLDivElement>(null)
	const activeDragRef = useRef<SidebarDragData | null>(null)
	const previewRef = useRef<DropPreview | null>(null)
	const visualRef = useRef<VisualState>({
		source: null,
		workspaceTarget: null,
		workspaceButton: null,
		workspaceDisabled: null,
	})
	const queuedFrameRef = useRef<DragFrame | null>(null)
	const frameRef = useRef<number | null>(null)
	const pointerRef = useRef<DragFrame | null>(null)
	const autoScrollFrameRef = useRef<number | null>(null)
	const openPopoverTimerRef = useRef<number | null>(null)
	const pendingPopoverWorkspaceRef = useRef<string | null>(null)
	const openProjectMenuIdRef = useRef(openProjectMenuId)
	const onProjectMenuChangeRef = useRef(onProjectMenuChange)
	const dragImageRef = useRef<HTMLElement | null>(null)
	const indicatorRef = useRef<SVGSVGElement | null>(null)
	const latestWorkspacesRef = useRef(workspaces)
	const latestBuildPreviewRef = useRef<BuildPreview | null>(null)
	const latestApplyPreviewRef = useRef<((preview: DropPreview | null) => void) | null>(null)
	const latestQueueFrameRef = useRef<((frame: DragFrame) => void) | null>(null)
	const latestClearPreviewVisualsRef = useRef<(() => void) | null>(null)
	const latestResetRef = useRef<(() => void) | null>(null)
	const latestTranslateRef = useRef(t)
	openProjectMenuIdRef.current = openProjectMenuId
	onProjectMenuChangeRef.current = onProjectMenuChange

	const clearOpenPopoverTimer = useCallback(() => {
		if (openPopoverTimerRef.current !== null) {
			window.clearTimeout(openPopoverTimerRef.current)
		}
		openPopoverTimerRef.current = null
		pendingPopoverWorkspaceRef.current = null
	}, [])

	/** Opens one target workspace project popover after a stable one-second hover. */
	const scheduleOpenProjectPopover = useCallback(
		(workspaceId: string) => {
			if (
				openProjectMenuIdRef.current === workspaceId ||
				pendingPopoverWorkspaceRef.current === workspaceId
			) {
				return
			}

			clearOpenPopoverTimer()
			pendingPopoverWorkspaceRef.current = workspaceId
			openPopoverTimerRef.current = window.setTimeout(() => {
				if (pendingPopoverWorkspaceRef.current !== workspaceId) return
				onProjectMenuChangeRef.current(workspaceId)
				openProjectMenuIdRef.current = workspaceId
				clearOpenPopoverTimer()
			}, OPEN_PROJECT_POPOVER_DELAY)
		},
		[clearOpenPopoverTimer],
	)

	const clearWorkspaceHighlight = useCallback(() => {
		const targets = document.querySelectorAll<HTMLElement>(
			"[data-collapsed-sidebar-dnd-visual='true']",
		)
		for (const target of targets) {
			clearSidebarDragAppearance(target)
			delete target.dataset.collapsedSidebarDndVisual
		}
		clearSidebarDragAppearance(visualRef.current.workspaceButton)
		clearSidebarDragAppearance(visualRef.current.workspaceDisabled)
		visualRef.current.workspaceTarget = null
		visualRef.current.workspaceButton = null
		visualRef.current.workspaceDisabled = null
	}, [])

	const hideIndicator = useCallback(() => {
		indicatorRef.current?.classList.add("hidden")
	}, [])

	/** Clears transient hover visuals while keeping the native drag session alive. */
	const clearPreviewVisuals = useCallback(() => {
		clearOpenPopoverTimer()
		clearWorkspaceHighlight()
		hideIndicator()
		previewRef.current = null
	}, [clearOpenPopoverTimer, clearWorkspaceHighlight, hideIndicator])

	const clearVisuals = useCallback(() => {
		clearSidebarDragAppearance(visualRef.current.source)
		visualRef.current.source = null
		clearPreviewVisuals()
	}, [clearPreviewVisuals])

	const showIndicator = useCallback((target: HTMLElement, position: SidebarDropPosition) => {
		const indicator = indicatorRef.current
		if (!indicator) return

		const targetRect = target.getBoundingClientRect()
		const workspaceList = rootRef.current?.contains(target) ? rootRef.current : null
		const projectList = target.closest<HTMLElement>(
			"[data-collapsed-sidebar-dnd-drop-type='project-list']",
		)
		const indicatorContainer = projectList || workspaceList
		const listTop = workspaceList?.getBoundingClientRect().top ?? -Infinity
		const viewport = target
			.closest<HTMLElement>("[data-project-scroll-container]")
			?.getBoundingClientRect()
		const lineY = Math.min(
			Math.max(
				getIndicatorLineY(target, position, indicatorContainer),
				listTop + 4,
				(viewport?.top ?? -Infinity) + 4,
			),
			(viewport?.bottom ?? Infinity) - 4,
		)
		const width = Math.max(8, targetRect.width)

		indicator.classList.remove("hidden")
		indicator.style.left = `${targetRect.left}px`
		indicator.style.top = `${lineY - 4}px`
		indicator.style.width = `${width}px`
		indicator.setAttribute("width", String(width))
		indicator.setAttribute("height", "8")
		indicator.setAttribute("viewBox", `0 0 ${width} 8`)
		indicator.querySelector("line")?.setAttribute("x2", String(Math.max(4, width - 2)))
	}, [])

	const showWorkspaceHighlight = useCallback(
		(target: HTMLElement | null) => {
			if (!target || visualRef.current.workspaceTarget === target) return
			clearWorkspaceHighlight()
			setSidebarDragAppearance(target, "collapsedWorkspace")
			target.dataset.collapsedSidebarDndVisual = "true"
			const button = target.querySelector<HTMLElement>("button")
			setSidebarDragAppearance(button, "transparent")
			visualRef.current.workspaceTarget = target
			visualRef.current.workspaceButton = button || null
		},
		[clearWorkspaceHighlight],
	)

	/** Applies a non-droppable opacity state to the current workspace target. */
	const showWorkspaceDisabled = useCallback(
		(target: HTMLElement | null) => {
			if (!target) return
			clearWorkspaceHighlight()
			setSidebarDragAppearance(target, "disabled")
			target.dataset.collapsedSidebarDndVisual = "true"
			visualRef.current.workspaceTarget = target
			visualRef.current.workspaceDisabled = target
		},
		[clearWorkspaceHighlight],
	)

	const getScrollContainer = useCallback((target: EventTarget | null) => {
		if (target instanceof Element) {
			const localContainer = target.closest<HTMLElement>(
				"[data-project-scroll-container], [data-slot='scroll-area-viewport']",
			)
			if (localContainer) return localContainer
		}
		return rootRef.current?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']")
	}, [])

	const stopAutoScroll = useCallback(() => {
		if (autoScrollFrameRef.current !== null) {
			window.cancelAnimationFrame(autoScrollFrameRef.current)
		}
		autoScrollFrameRef.current = null
		pointerRef.current = null
	}, [])

	const buildPreview = useCallback(
		(
			target: EventTarget | null,
			clientY: number,
			active: SidebarDragData | null,
		): DropPreview | null => {
			if (!active) return null

			const directWorkspaceTarget = getTarget(
				target,
				"[data-collapsed-sidebar-dnd-drop-type='workspace']",
			)
			if (active.type === "workspace") {
				const workspaceTarget =
					getNearestWorkspaceTarget(
						rootRef.current,
						clientY,
						active.workspaceId,
						"[data-collapsed-sidebar-dnd-drop-type='workspace']",
						"collapsedSidebarDndWorkspaceId",
					) || directWorkspaceTarget
				if (!workspaceTarget) return null
				const workspaceId = workspaceTarget.dataset.collapsedSidebarDndWorkspaceId
				if (!workspaceId || workspaceId === active.workspaceId) return null
				const position = getDropPosition(workspaceTarget, clientY)
				const sourceIndex = workspaces.findIndex((item) => item.id === active.workspaceId)
				const targetIndex = workspaces.findIndex((item) => item.id === workspaceId)
				if (
					sourceIndex === -1 ||
					targetIndex === -1 ||
					isNoOpInsertion(sourceIndex, targetIndex, position, workspaces.length)
				)
					return null
				return { type: "workspace", workspaceId, position, target: workspaceTarget }
			}
			if (active.type !== "project") return null

			const projectTarget = getTarget(
				target,
				"[data-collapsed-sidebar-dnd-drop-type='project']",
			)
			if (projectTarget) {
				const workspaceId = projectTarget.dataset.collapsedSidebarDndWorkspaceId
				const projectId = projectTarget.dataset.collapsedSidebarDndProjectId
				if (!workspaceId || !projectId || projectId === active.projectId) {
					return null
				}
				const projects = projectStore.getProjectsByWorkspace(active.workspaceId)
				const sourceIndex = projects.findIndex((item) => item.id === active.projectId)
				const targetIndex = projects.findIndex((item) => item.id === projectId)
				const position = getProjectDropPosition(
					projectTarget,
					clientY,
					sourceIndex,
					targetIndex,
				)
				if (workspaceId === active.workspaceId) {
					if (
						sourceIndex === -1 ||
						targetIndex === -1 ||
						isNoOpInsertion(sourceIndex, targetIndex, position, projects.length)
					) {
						return null
					}
				}
				return { type: "project", workspaceId, projectId, position, target: projectTarget }
			}

			const projectListTarget = getTarget(
				target,
				"[data-collapsed-sidebar-dnd-drop-type='project-list']",
			)
			if (projectListTarget) {
				const nearestProjectTarget = getNearestProjectTarget(
					projectListTarget,
					clientY,
					active.projectId,
					"[data-collapsed-sidebar-dnd-drop-type='project']",
					"collapsedSidebarDndProjectId",
				)
				if (nearestProjectTarget) {
					const workspaceId = nearestProjectTarget.dataset.collapsedSidebarDndWorkspaceId
					const projectId = nearestProjectTarget.dataset.collapsedSidebarDndProjectId
					if (!workspaceId || !projectId) return null
					const projects = projectStore.getProjectsByWorkspace(active.workspaceId)
					const sourceIndex = projects.findIndex((item) => item.id === active.projectId)
					const targetIndex = projects.findIndex((item) => item.id === projectId)
					const position = getProjectDropPosition(
						nearestProjectTarget,
						clientY,
						sourceIndex,
						targetIndex,
					)
					if (workspaceId === active.workspaceId) {
						const projects = projectStore.getProjectsByWorkspace(active.workspaceId)
						const sourceIndex = projects.findIndex(
							(item) => item.id === active.projectId,
						)
						const targetIndex = projects.findIndex((item) => item.id === projectId)
						if (
							sourceIndex === -1 ||
							targetIndex === -1 ||
							isNoOpInsertion(sourceIndex, targetIndex, position, projects.length)
						) {
							return null
						}
					}
					return {
						type: "project",
						workspaceId,
						projectId,
						position,
						target: nearestProjectTarget,
					}
				}

				if (projectListTarget.dataset.collapsedSidebarDndDropEmpty !== "true") return null
				const workspaceId = projectListTarget.dataset.collapsedSidebarDndWorkspaceId
				if (!workspaceId) return null
				if (workspaceId === active.workspaceId) {
					const projects = projectStore.getProjectsByWorkspace(active.workspaceId)
					const sourceIndex = projects.findIndex((item) => item.id === active.projectId)
					if (
						sourceIndex === -1 ||
						isNoOpInsertion(sourceIndex, projects.length, "after", projects.length)
					) {
						const workspaceTarget = projectListTarget.closest<HTMLElement>(
							"[data-collapsed-sidebar-dnd-drop-type='workspace']",
						)
						return workspaceTarget
							? {
									type: "workspace",
									workspaceId,
									target: workspaceTarget,
									disabled: true,
								}
							: null
					}
				}
				return {
					type: "project",
					workspaceId,
					position: "after",
					target: projectListTarget,
				}
			}

			// Keep the source workspace non-droppable across its row and margin hit area.
			if (active.type === "project" && rootRef.current) {
				const sourceWorkspaceTarget = Array.from(
					rootRef.current.querySelectorAll<HTMLElement>(
						"[data-collapsed-sidebar-dnd-drop-type='workspace']",
					),
				).find((item) => item.dataset.collapsedSidebarDndWorkspaceId === active.workspaceId)
				if (sourceWorkspaceTarget) {
					const rect = sourceWorkspaceTarget.getBoundingClientRect()
					if (clientY >= rect.top - 8 && clientY <= rect.bottom + 8) {
						return {
							type: "workspace",
							workspaceId: active.workspaceId,
							target: sourceWorkspaceTarget,
							disabled: true,
						}
					}
				}
			}

			// Prefer an explicitly hovered workspace, including the source workspace.
			const workspaceTarget =
				directWorkspaceTarget ||
				getNearestWorkspaceTarget(
					rootRef.current,
					clientY,
					undefined,
					"[data-collapsed-sidebar-dnd-drop-type='workspace']",
					"collapsedSidebarDndWorkspaceId",
				)
			if (!workspaceTarget) return null
			const workspaceId = workspaceTarget.dataset.collapsedSidebarDndWorkspaceId
			if (!workspaceId) return null
			if (workspaceId === active.workspaceId) {
				return { type: "workspace", workspaceId, target: workspaceTarget, disabled: true }
			}
			return { type: "workspace", workspaceId, target: workspaceTarget }
		},
		[workspaces],
	)

	const applyPreview = useCallback(
		(preview: DropPreview | null) => {
			const previous = previewRef.current
			const isSamePreview =
				previous?.type === preview?.type &&
				previous?.workspaceId === preview?.workspaceId &&
				previous?.projectId === preview?.projectId &&
				previous?.position === preview?.position &&
				previous?.disabled === preview?.disabled &&
				previous?.target === preview?.target
			if (isSamePreview) return

			previewRef.current = preview
			clearWorkspaceHighlight()
			hideIndicator()
			if (!preview) {
				clearOpenPopoverTimer()
				return
			}

			if (preview.type === "workspace") {
				// The source workspace is non-droppable, but still opens its project popover on hover.
				if (
					activeDragRef.current?.type === "project" &&
					preview.workspaceId === activeDragRef.current.workspaceId
				) {
					scheduleOpenProjectPopover(preview.workspaceId)
					showWorkspaceDisabled(preview.target)
					return
				}
				if (activeDragRef.current?.type === "workspace") {
					clearOpenPopoverTimer()
					showIndicator(preview.target, preview.position || "after")
					return
				}
				if (preview.disabled) {
					showWorkspaceDisabled(preview.target)
					return
				}
				scheduleOpenProjectPopover(preview.workspaceId)
				showWorkspaceHighlight(preview.target)
				return
			}

			clearOpenPopoverTimer()
			showIndicator(preview.target, preview.position || "after")
		},
		[
			clearOpenPopoverTimer,
			clearWorkspaceHighlight,
			hideIndicator,
			scheduleOpenProjectPopover,
			showIndicator,
			showWorkspaceDisabled,
			showWorkspaceHighlight,
		],
	)

	const flushFrame = useCallback(() => {
		frameRef.current = null
		const frame = queuedFrameRef.current
		queuedFrameRef.current = null
		if (!frame) return
		const target = document.elementFromPoint(frame.clientX, frame.clientY) || frame.target
		applyPreview(buildPreview(target, frame.clientY, activeDragRef.current))
	}, [applyPreview, buildPreview])

	const runAutoScroll = useCallback(
		function scrollFrame() {
			autoScrollFrameRef.current = null
			const pointer = pointerRef.current
			const active = activeDragRef.current
			const container = getScrollContainer(pointer?.target || null)
			if (!pointer || !active || !container) return

			const speed = getEdgeScrollSpeed(container, pointer.clientY)
			if (speed === 0) return
			const previousScrollTop = container.scrollTop
			container.scrollTop += speed
			if (container.scrollTop === previousScrollTop) return

			const target =
				document.elementFromPoint(pointer.clientX, pointer.clientY) || pointer.target
			applyPreview(buildPreview(target, pointer.clientY, active))
			autoScrollFrameRef.current = window.requestAnimationFrame(scrollFrame)
		},
		[applyPreview, buildPreview, getScrollContainer],
	)

	const queueFrame = useCallback(
		(frame: DragFrame) => {
			queuedFrameRef.current = frame
			pointerRef.current = frame
			const container = getScrollContainer(frame.target)
			if (!container || getEdgeScrollSpeed(container, frame.clientY) === 0) {
				stopAutoScroll()
			} else if (autoScrollFrameRef.current === null) {
				autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
			}
			if (frameRef.current === null) {
				frameRef.current = window.requestAnimationFrame(flushFrame)
			}
		},
		[flushFrame, getScrollContainer, runAutoScroll, stopAutoScroll],
	)

	const reset = useCallback(() => {
		if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
		frameRef.current = null
		queuedFrameRef.current = null
		stopAutoScroll()
		clearOpenPopoverTimer()
		clearVisuals()
		if (dragImageRef.current?.parentNode)
			dragImageRef.current.parentNode.removeChild(dragImageRef.current)
		dragImageRef.current = null
		activeDragRef.current = null
	}, [clearOpenPopoverTimer, clearVisuals, stopAutoScroll])

	latestWorkspacesRef.current = workspaces
	latestBuildPreviewRef.current = buildPreview
	latestApplyPreviewRef.current = applyPreview
	latestQueueFrameRef.current = queueFrame
	latestClearPreviewVisualsRef.current = clearPreviewVisuals
	latestResetRef.current = reset
	latestTranslateRef.current = t

	useEffect(() => {
		if (!enabled) return
		const indicator = createSidebarDropIndicator()
		indicatorRef.current = indicator

		const handleDragStart = (event: Event) => {
			const source = getDragSource(event.target)
			if (!source) return
			const type = source.dataset.collapsedSidebarDndSource
			const workspaceId = source.dataset.collapsedSidebarDndWorkspaceId
			if (!workspaceId || (type !== "workspace" && type !== "project")) return
			const projectId = source.dataset.collapsedSidebarDndProjectId
			if (type === "project" && !projectId) return

			const data: SidebarDragData =
				type === "workspace"
					? { type, workspaceId }
					: { type, workspaceId, projectId: projectId as string }
			activeDragRef.current = data
			const dragEvent = event as DragEvent
			if (dragEvent.dataTransfer) dragEvent.dataTransfer.effectAllowed = "move"
			dragEvent.dataTransfer?.clearData()
			dragEvent.dataTransfer?.setData(DRAG_DATA_TYPE, JSON.stringify(data))
			const dragImage = createSidebarDragImage(
				source.dataset.collapsedSidebarDndLabel || "",
				data.type,
			)
			if (dragImage) {
				dragImageRef.current = dragImage
				dragEvent.dataTransfer?.setDragImage(dragImage, 12, 14)
			}
			setSidebarDragAppearance(source, "source")
			visualRef.current.source = source
		}

		const handleDragOver = (event: Event) => {
			if (!activeDragRef.current) return
			const dragEvent = event as DragEvent
			dragEvent.preventDefault()
			if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = "move"
			latestQueueFrameRef.current?.({
				target: event.target,
				clientX: dragEvent.clientX,
				clientY: dragEvent.clientY,
			})
		}

		const handleDragEnter = (event: Event) => {
			if (!activeDragRef.current) return
			const dragEvent = event as DragEvent
			dragEvent.preventDefault()
		}

		const handleDrag = (event: Event) => {
			if (!activeDragRef.current) return
			const dragEvent = event as DragEvent
			if (dragEvent.clientX <= 0 || dragEvent.clientY <= 0) return
			latestQueueFrameRef.current?.({
				target: event.target,
				clientX: dragEvent.clientX,
				clientY: dragEvent.clientY,
			})
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") latestResetRef.current?.()
		}
		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.key === "Escape") latestResetRef.current?.()
		}
		const handleCancel = () => latestResetRef.current?.()
		const handleDragEnd = () => latestResetRef.current?.()
		const handleDragLeave = (event: DragEvent) => {
			if (!activeDragRef.current) return
			const relatedTarget = event.relatedTarget
			if (!(relatedTarget instanceof Node) || !rootRef.current?.contains(relatedTarget)) {
				latestClearPreviewVisualsRef.current?.()
			}
		}

		const handleDrop = async (event: Event) => {
			if (!activeDragRef.current) return
			const dragEvent = event as DragEvent
			dragEvent.preventDefault()
			const active = activeDragRef.current
			const releaseTarget =
				document.elementFromPoint(dragEvent.clientX, dragEvent.clientY) || event.target
			const releasePreview = latestBuildPreviewRef.current?.(
				releaseTarget,
				dragEvent.clientY,
				active,
			)
			// The release decision must be the same decision represented by the
			// indicator. Do not submit an older cached target.
			const preview = releasePreview
			latestApplyPreviewRef.current?.(preview)
			latestResetRef.current?.()
			if (!preview || preview.disabled) {
				return
			}

			try {
				if (active.type === "workspace") {
					const currentWorkspaces = latestWorkspacesRef.current
					const sourceIndex = currentWorkspaces.findIndex(
						(item) => item.id === active.workspaceId,
					)
					const targetIndex = currentWorkspaces.findIndex(
						(item) => item.id === preview.workspaceId,
					)
					if (sourceIndex === -1 || targetIndex === -1) return
					const next = insertAtPosition(
						currentWorkspaces,
						sourceIndex,
						targetIndex,
						preview.position || "after",
					)
					if (next.every((item, index) => item.id === currentWorkspaces[index]?.id)) {
						return
					}
					const preWorkspaceId = getPredecessorId(
						currentWorkspaces,
						active.workspaceId,
						preview.workspaceId,
						preview.position || "after",
					)
					const nextWorkspaceId = getSuccessorId(
						currentWorkspaces,
						active.workspaceId,
						preview.workspaceId,
						preview.position || "after",
					)
					await superMagicService.workspace.moveWorkspace(
						active.workspaceId,
						preWorkspaceId,
						nextWorkspaceId,
					)
					return
				}
				if (active.type !== "project") return

				if (
					preview.type === "project" &&
					!(await projectStore.ensureProjectDropNeighbors(
						preview.workspaceId,
						preview.projectId,
						preview.position !== "before",
					))
				)
					throw new Error("Project drop neighbors are unavailable")
				const sourceProjects = projectStore.getProjectsByWorkspace(active.workspaceId)
				const project = sourceProjects.find((item) => item.id === active.projectId)
				if (!project) return

				if (preview.workspaceId === active.workspaceId) {
					const sourceIndex = sourceProjects.findIndex(
						(item) => item.id === active.projectId,
					)
					const targetIndex =
						preview.type === "project" && preview.projectId
							? sourceProjects.findIndex((item) => item.id === preview.projectId)
							: sourceProjects.length
					if (sourceIndex === -1) return
					const next = insertAtPosition(
						sourceProjects,
						sourceIndex,
						targetIndex === -1 ? sourceProjects.length : targetIndex,
						preview.position || "after",
					)
					if (next.every((item, index) => item.id === sourceProjects[index]?.id)) {
						return
					}
					const decisionOrder = sourceProjects.map((item) => item.id)
					const projectDropPosition = preview.position || "after"
					const projectTargetId =
						preview.type === "project" ? preview.projectId : undefined
					const preProjectId = isProjectPinGroupBoundaryInsertion(
						sourceProjects,
						active.projectId,
						projectTargetId,
						projectDropPosition,
					)
						? null
						: getPredecessorId(
								decisionOrder.map((id) => ({ id })),
								active.projectId,
								projectTargetId,
								projectDropPosition,
							)
					const nextProjectId = getSuccessorId(
						decisionOrder.map((id) => ({ id })),
						active.projectId,
						preview.type === "project" ? preview.projectId : undefined,
						preview.position || "after",
					)
					const pinAction = getProjectPinBoundaryAction(
						sourceProjects,
						active.projectId,
						preview.type === "project" ? preview.projectId : undefined,
						preview.position || "after",
					)
					const pinState = pinAction
						? pinAction === "pin"
						: project.is_pinned
							? true
							: undefined
					if (pinAction) {
						const confirmed = await requestPinBoundaryConfirmation({
							action: pinAction,
							projectName:
								project.project_name ||
								latestTranslateRef.current("project.unnamedProject"),
						})
						if (!confirmed) return
					}
					if (pinState !== undefined) {
						await superMagicService.project.pinProject(
							project,
							pinState,
							active.workspaceId,
							preProjectId,
							nextProjectId,
						)
						await projectStore.loadProjectsForWorkspace(active.workspaceId, true, true)
					} else {
						await superMagicService.project.moveProjectInWorkspace(
							active.workspaceId,
							active.projectId,
							preProjectId,
							nextProjectId,
						)
					}
					return
				}

				const targetProjects = projectStore.getProjectsByWorkspace(preview.workspaceId)
				// A workspace-row drop moves the project without specifying an order anchor.
				const targetDecisionOrder = targetProjects.map((item) => item.id)
				const projectDropPosition = preview.position || "after"
				const projectTargetId = preview.type === "project" ? preview.projectId : undefined
				const isPinnedWorkspaceDrop = preview.type === "workspace" && project.is_pinned
				const preProjectId =
					preview.type === "workspace"
						? isPinnedWorkspaceDrop
							? null
							: undefined
						: isProjectPinGroupBoundaryInsertion(
									[project, ...targetProjects],
									active.projectId,
									projectTargetId,
									projectDropPosition,
							  )
							? null
							: getPredecessorId(
									targetDecisionOrder.map((id) => ({ id })),
									active.projectId,
									projectTargetId,
									projectDropPosition,
								)
				const nextProjectId =
					preview.type === "workspace"
						? isPinnedWorkspaceDrop
							? null
							: undefined
						: getSuccessorId(
								targetDecisionOrder.map((id) => ({ id })),
								active.projectId,
								projectTargetId,
								projectDropPosition,
							)
				const pinAction = isPinnedWorkspaceDrop
					? null
					: getProjectPinBoundaryAction(
							[project, ...targetProjects],
							active.projectId,
							preview.type === "project" ? preview.projectId : undefined,
							preview.position || "after",
						)
				const pinState = pinAction
					? pinAction === "pin"
					: project.is_pinned
						? true
						: undefined
				const usePinApi = Boolean(
					isPinnedWorkspaceDrop ||
					(pinState === true &&
						preview.type === "project" &&
						targetProjects.find((item) => item.id === projectTargetId)?.is_pinned),
				)
				if (pinAction) {
					const confirmed = await requestPinBoundaryConfirmation({
						action: pinAction,
						projectName:
							project.project_name ||
							latestTranslateRef.current("project.unnamedProject"),
					})
					if (!confirmed) return
				}
				const targetWorkspace = workspaceStore.getWorkspaceById(preview.workspaceId)
				await superMagicService.project.moveProjectFromSidebar({
					project,
					targetWorkspaceId: preview.workspaceId,
					targetWorkspaceName: targetWorkspace?.name,
					preProjectId,
					nextProjectId,
					isPinned: pinState,
					usePinApi,
				})
			} catch (error) {
				console.error("Failed to persist collapsed sidebar drag result:", error)
				message.error(
					latestTranslateRef.current("common.operationFailed", {
						defaultValue: "操作失败，请稍后重试",
					}),
				)
			}
		}

		document.addEventListener("dragstart", handleDragStart, true)
		document.addEventListener("dragover", handleDragOver, true)
		document.addEventListener("dragenter", handleDragEnter, true)
		document.addEventListener("drag", handleDrag, true)
		document.addEventListener("drop", handleDrop, true)
		document.addEventListener("dragend", handleDragEnd, true)
		window.addEventListener("dragend", handleDragEnd, true)
		window.addEventListener("keydown", handleKeyDown, true)
		window.addEventListener("keyup", handleKeyUp, true)
		document.addEventListener("dragleave", handleDragLeave, true)
		window.addEventListener("blur", handleCancel)
		document.addEventListener("visibilitychange", handleCancel)

		return () => {
			document.removeEventListener("dragstart", handleDragStart, true)
			document.removeEventListener("dragover", handleDragOver, true)
			document.removeEventListener("dragenter", handleDragEnter, true)
			document.removeEventListener("drag", handleDrag, true)
			document.removeEventListener("drop", handleDrop, true)
			document.removeEventListener("dragend", handleDragEnd, true)
			window.removeEventListener("dragend", handleDragEnd, true)
			window.removeEventListener("keydown", handleKeyDown, true)
			window.removeEventListener("keyup", handleKeyUp, true)
			document.removeEventListener("dragleave", handleDragLeave, true)
			window.removeEventListener("blur", handleCancel)
			document.removeEventListener("visibilitychange", handleCancel)
			latestResetRef.current?.()
			indicator.remove()
			indicatorRef.current = null
		}
		// Keep global listeners stable during drag; latest callbacks are stored in refs.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled])

	return { rootRef }
}
