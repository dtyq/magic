import { useCallback, useEffect, useRef, type DragEvent, type RefObject } from "react"
import { message } from "antd"
import { useTranslation } from "react-i18next"
import { sidebarStore } from "@/stores/layout"
import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import projectStore from "@/pages/superMagic/stores/core/project"
import superMagicService from "@/pages/superMagic/services"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { SidebarDragData, SidebarDropPosition } from "./types"
import {
	createSidebarDragImage,
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
} from "./dndUtils"
import type { ProjectPinBoundaryAction } from "./ProjectPinBoundaryConfirmDialog"

import { clearSidebarDragAppearance, setSidebarDragAppearance } from "./dragAppearance"

const SIDEBAR_DRAG_DATA_TYPE = "application/x-magic-sidebar-dnd"
const AUTO_EXPAND_DELAY = 1000

interface DropPreview {
	type: "workspace" | "project"
	workspaceId: string
	projectId?: string
	position?: SidebarDropPosition
	target: HTMLElement
	disabled?: boolean
}

interface UseWorkspaceListDndOptions {
	workspaces: Workspace[]
	scrollRef: RefObject<HTMLDivElement>
	disabled: boolean
	requestPinBoundaryConfirmation: (request: {
		action: ProjectPinBoundaryAction
		projectName: string
	}) => Promise<boolean>
}

interface DragVisualState {
	source: HTMLElement | null
	workspaceTarget: HTMLElement | null
	workspaceHeader: HTMLElement | null
	workspaceHeaderButton: HTMLElement | null
	workspaceDisabled: HTMLElement | null
}

interface DragFrame {
	target: Element | null
	clientX: number
	clientY: number
}

/** Returns the closest sidebar element matching a selector, constrained to the DND root. */
function closestWithinRoot(root: HTMLElement | null, target: EventTarget | null, selector: string) {
	if (!(target instanceof Element)) return null
	const element = target.closest<HTMLElement>(selector)
	return element && root?.contains(element) ? element : null
}

/** Builds the native drag payload from a source element. */
function getDragData(source: HTMLElement): SidebarDragData | null {
	const type = source.dataset.sidebarDndSource
	const workspaceId = source.dataset.sidebarDndWorkspaceId
	if (!type || !workspaceId) return null

	if (type === "workspace") return { type, workspaceId }
	if (type === "project" && source.dataset.sidebarDndProjectId) {
		return {
			type,
			workspaceId,
			projectId: source.dataset.sidebarDndProjectId,
		}
	}
	return null
}

/** Resolves a drop target according to the active item type. */
function resolveDropTarget(
	root: HTMLElement | null,
	target: EventTarget | null,
	active: SidebarDragData,
) {
	if (active.type === "workspace") {
		return closestWithinRoot(root, target, '[data-sidebar-drop-type="workspace"]')
	}

	return (
		closestWithinRoot(root, target, '[data-sidebar-drop-type="project"]') ||
		closestWithinRoot(root, target, '[data-sidebar-drop-type="project-list"]') ||
		closestWithinRoot(root, target, '[data-sidebar-drop-type="workspace"]')
	)
}

export function useWorkspaceListDnd({
	workspaces,
	scrollRef,
	disabled,
	requestPinBoundaryConfirmation,
}: UseWorkspaceListDndOptions) {
	const { t } = useTranslation("super")
	const rootRef = useRef<HTMLDivElement>(null)
	const dropIndicatorRef = useRef<SVGSVGElement>(null)
	const activeDragRef = useRef<SidebarDragData | null>(null)
	const previewRef = useRef<DropPreview | null>(null)
	const visualRef = useRef<DragVisualState>({
		source: null,
		workspaceTarget: null,
		workspaceHeader: null,
		workspaceHeaderButton: null,
		workspaceDisabled: null,
	})
	const dragImageRef = useRef<HTMLElement | null>(null)
	const frameRef = useRef<number | null>(null)
	const queuedFrameRef = useRef<DragFrame | null>(null)
	const autoScrollFrameRef = useRef<number | null>(null)
	const pointerRef = useRef<DragFrame | null>(null)
	const expandTimerRef = useRef<number | null>(null)
	const expandWorkspaceRef = useRef<string | null>(null)

	const clearExpandTimer = useCallback(() => {
		if (expandTimerRef.current !== null) window.clearTimeout(expandTimerRef.current)
		expandTimerRef.current = null
		expandWorkspaceRef.current = null
	}, [])

	const hideDropIndicator = useCallback(() => {
		const indicator = dropIndicatorRef.current
		if (indicator) indicator.classList.add("hidden")
	}, [])

	const clearWorkspaceHighlight = useCallback(() => {
		const target = visualRef.current.workspaceTarget
		if (!target) return
		clearSidebarDragAppearance(target)
		clearSidebarDragAppearance(visualRef.current.workspaceHeader)
		clearSidebarDragAppearance(visualRef.current.workspaceHeaderButton)
		clearSidebarDragAppearance(visualRef.current.workspaceDisabled)
		visualRef.current.workspaceHeader = null
		visualRef.current.workspaceHeaderButton = null
		visualRef.current.workspaceTarget = null
		visualRef.current.workspaceDisabled = null
	}, [])

	const clearDragVisuals = useCallback(() => {
		const source = visualRef.current.source
		clearSidebarDragAppearance(source)
		visualRef.current.source = null
		clearWorkspaceHighlight()
		hideDropIndicator()
		previewRef.current = null
	}, [clearWorkspaceHighlight, hideDropIndicator])

	const showWorkspaceHighlight = useCallback(
		(target: HTMLElement | null, refresh = false) => {
			if (!target || (!refresh && visualRef.current.workspaceTarget === target)) return
			clearWorkspaceHighlight()
			setSidebarDragAppearance(target, "workspace")
			const header = target.querySelector<HTMLElement>("[data-sidebar-workspace-header]")
			if (header) {
				const targetRect = target.getBoundingClientRect()
				const headerRect = header.getBoundingClientRect()
				const isCollapsed = !target.querySelector('[data-sidebar-drop-type="project-list"]')
				const isStickyOffset = headerRect.top > targetRect.top + 1
				setSidebarDragAppearance(
					header,
					isCollapsed
						? "headerCollapsed"
						: isStickyOffset
							? "headerSticky"
							: "headerExpanded",
				)
			}
			const activeButton = header?.querySelector<HTMLElement>(
				'[data-sidebar="menu-button"][data-active="true"]',
			)
			setSidebarDragAppearance(activeButton, "transparent")
			visualRef.current.workspaceHeader = header || null
			visualRef.current.workspaceHeaderButton = activeButton || null
			visualRef.current.workspaceTarget = target
		},
		[clearWorkspaceHighlight],
	)

	/** Applies a non-droppable opacity state to the current workspace target. */
	const showWorkspaceDisabled = useCallback(
		(target: HTMLElement | null) => {
			if (!target) return
			clearWorkspaceHighlight()
			setSidebarDragAppearance(target, "disabled")
			visualRef.current.workspaceTarget = target
			visualRef.current.workspaceDisabled = target
		},
		[clearWorkspaceHighlight],
	)

	const showDropIndicator = useCallback((target: HTMLElement, position: SidebarDropPosition) => {
		const root = rootRef.current
		const indicator = dropIndicatorRef.current
		if (!root || !indicator) return

		const rootRect = root.getBoundingClientRect()
		const targetRect = target.getBoundingClientRect()
		const projectList = target.closest<HTMLElement>('[data-sidebar-drop-type="project-list"]')
		const requestedLineY = getIndicatorLineY(target, position, projectList || root)
		const stickyHeader = root.querySelector<HTMLElement>(
			"[data-testid='sidebar-workspace-list-sticky-header']",
		)
		const stickyHeaderBottom = stickyHeader?.getBoundingClientRect().bottom ?? -Infinity
		// Keep the indicator's 4px radius below the sticky header instead of covering its controls.
		const viewport = target
			.closest<HTMLElement>("[data-workspaces-scroll-container]")
			?.getBoundingClientRect()
		const lineY = Math.min(
			Math.max(requestedLineY, stickyHeaderBottom + 4, (viewport?.top ?? -Infinity) + 4),
			(viewport?.bottom ?? Infinity) - 4,
		)
		const width = Math.max(8, targetRect.width)
		indicator.classList.remove("hidden")

		indicator.style.left = `${targetRect.left - rootRect.left}px`
		indicator.style.top = `${lineY - rootRect.top - 4}px`
		indicator.style.width = `${width}px`
		indicator.setAttribute("width", String(width))
		indicator.setAttribute("height", "8")
		indicator.setAttribute("viewBox", `0 0 ${width} 8`)

		const line = indicator.querySelector("line")
		const circle = indicator.querySelector("circle")
		line?.setAttribute("x2", String(Math.max(4, width - 2)))
		circle?.setAttribute("cx", "4")
	}, [])

	const scheduleExpand = useCallback(
		(workspaceId: string) => {
			if (
				sidebarStore.expandedWorkspaces.has(workspaceId) ||
				expandWorkspaceRef.current === workspaceId
			)
				return

			clearExpandTimer()
			expandWorkspaceRef.current = workspaceId
			expandTimerRef.current = window.setTimeout(() => {
				if (expandWorkspaceRef.current !== workspaceId) return
				sidebarStore.setWorkspaceExpanded(workspaceId, true)
				window.requestAnimationFrame(() => {
					const target = visualRef.current.workspaceTarget
					if (target?.dataset.sidebarDropWorkspaceId === workspaceId) {
						showWorkspaceHighlight(target, true)
					}
				})
				clearExpandTimer()
			}, AUTO_EXPAND_DELAY)
		},
		[clearExpandTimer, showWorkspaceHighlight],
	)

	/** Converts a pointer target into a preview; output is null when dropping is invalid. */
	const buildPreview = useCallback(
		(target: EventTarget | null, clientY: number, active: SidebarDragData | null) => {
			if (!active) return null
			let dropTarget = resolveDropTarget(rootRef.current, target, active)
			if (active.type === "workspace") {
				// Resolve row gaps to one stable workspace instead of switching with elementFromPoint.
				dropTarget =
					getNearestWorkspaceTarget(
						rootRef.current,
						clientY,
						active.workspaceId,
						'[data-sidebar-drop-type="workspace"]',
						"sidebarDropWorkspaceId",
					) || dropTarget
			}
			if (active.type === "project" && !dropTarget) {
				// Project drags may hover the source workspace; do not exclude it from hit testing.
				dropTarget = getNearestWorkspaceTarget(
					rootRef.current,
					clientY,
					undefined,
					'[data-sidebar-drop-type="workspace"]',
					"sidebarDropWorkspaceId",
				)
			}
			if (!dropTarget) return null
			if (
				active.type === "project" &&
				dropTarget.dataset.sidebarDropType === "project-list" &&
				dropTarget.dataset.sidebarDropEmpty !== "true"
			) {
				dropTarget = getNearestProjectTarget(
					dropTarget,
					clientY,
					active.projectId,
					'[data-sidebar-drop-type="project"]',
					"sidebarDropProjectId",
				)
				if (!dropTarget) return null
			}

			const dropType = dropTarget.dataset.sidebarDropType
			const workspaceId = dropTarget.dataset.sidebarDropWorkspaceId
			if (!workspaceId) return null

			if (active.type === "workspace") {
				if (dropType !== "workspace" || workspaceId === active.workspaceId) return null
				const position = getDropPosition(dropTarget, clientY)
				const sourceIndex = workspaces.findIndex((item) => item.id === active.workspaceId)
				const targetIndex = workspaces.findIndex((item) => item.id === workspaceId)
				if (
					sourceIndex === -1 ||
					targetIndex === -1 ||
					isNoOpInsertion(sourceIndex, targetIndex, position, workspaces.length)
				)
					return null
				return {
					type: "workspace",
					workspaceId,
					position,
					target: dropTarget,
				} satisfies DropPreview
			}
			if (active.type !== "project") return null

			if (dropType === "workspace") {
				if (workspaceId === active.workspaceId) {
					const workspaceRoot = dropTarget.closest<HTMLElement>(
						"[data-sidebar-workspace-root]",
					)
					return {
						type: "workspace",
						workspaceId,
						target: workspaceRoot || dropTarget,
						disabled: true,
					} satisfies DropPreview
				}
				return { type: "workspace", workspaceId, target: dropTarget } satisfies DropPreview
			}

			if (dropType === "project-list") {
				if (dropTarget.dataset.sidebarDropEmpty === "true") {
					if (workspaceId === active.workspaceId) return null
					return {
						type: "workspace",
						workspaceId,
						target: dropTarget,
					} satisfies DropPreview
				}
				const position = "after" as const
				if (workspaceId === active.workspaceId) {
					const projects = projectStore.getProjectsByWorkspace(active.workspaceId)
					const sourceIndex = projects.findIndex((item) => item.id === active.projectId)
					if (
						sourceIndex !== -1 &&
						isNoOpInsertion(sourceIndex, projects.length, position, projects.length)
					) {
						return null
					}
				}
				return {
					type: "project",
					workspaceId,
					position,
					target: dropTarget,
				} satisfies DropPreview
			}

			const projectId = dropTarget.dataset.sidebarDropProjectId
			if (!projectId || projectId === active.projectId) return null
			const projects = projectStore.getProjectsByWorkspace(active.workspaceId)
			const sourceIndex = projects.findIndex((item) => item.id === active.projectId)
			const targetIndex = projects.findIndex((item) => item.id === projectId)
			const position = getProjectDropPosition(dropTarget, clientY, sourceIndex, targetIndex)
			if (workspaceId === active.workspaceId) {
				const noOp =
					sourceIndex !== -1 &&
					targetIndex !== -1 &&
					isNoOpInsertion(sourceIndex, targetIndex, position, projects.length)
				if (noOp) {
					return null
				}
			}
			return {
				type: "project",
				workspaceId,
				projectId,
				position,
				target: dropTarget,
			} satisfies DropPreview
		},
		[workspaces],
	)

	/** Applies the current preview directly to DOM so dragover does not re-render the list. */
	const applyPreview = useCallback(
		(preview: DropPreview | null, refreshPosition = false) => {
			const previous = previewRef.current
			const isSamePreview =
				previous?.type === preview?.type &&
				previous?.workspaceId === preview?.workspaceId &&
				previous?.projectId === preview?.projectId &&
				previous?.position === preview?.position &&
				previous?.disabled === preview?.disabled &&
				previous?.target === preview?.target
			if (isSamePreview) {
				if (refreshPosition && preview) {
					if (preview.type === "project" || activeDragRef.current?.type === "workspace") {
						showDropIndicator(preview.target, preview.position || "after")
					} else if (preview.disabled) {
						showWorkspaceDisabled(preview.target)
					} else {
						const workspaceRoot = preview.target.closest<HTMLElement>(
							"[data-sidebar-workspace-root]",
						)
						showWorkspaceHighlight(workspaceRoot, true)
					}
				}
				return
			}

			previewRef.current = preview
			clearWorkspaceHighlight()
			hideDropIndicator()
			if (!preview) {
				clearExpandTimer()
				return
			}

			if (preview.type === "workspace") {
				clearExpandTimer()
				if (activeDragRef.current?.type === "workspace") {
					showDropIndicator(preview.target, preview.position || "after")
					return
				}
				if (preview.disabled) {
					showWorkspaceDisabled(preview.target)
					return
				}
				if (!sidebarStore.expandedWorkspaces.has(preview.workspaceId)) {
					scheduleExpand(preview.workspaceId)
				}
				const workspaceRoot = preview.target.closest<HTMLElement>(
					"[data-sidebar-workspace-root]",
				)
				showWorkspaceHighlight(workspaceRoot)
				return
			}

			clearExpandTimer()
			showDropIndicator(preview.target, preview.position || "after")
		},
		[
			clearExpandTimer,
			clearWorkspaceHighlight,
			hideDropIndicator,
			scheduleExpand,
			showDropIndicator,
			showWorkspaceDisabled,
			showWorkspaceHighlight,
		],
	)

	const flushDragFrame = useCallback(() => {
		frameRef.current = null
		const frame = queuedFrameRef.current
		queuedFrameRef.current = null
		if (!frame) return
		const target = document.elementFromPoint(frame.clientX, frame.clientY) || frame.target
		applyPreview(buildPreview(target, frame.clientY, activeDragRef.current))
	}, [applyPreview, buildPreview])

	const stopAutoScroll = useCallback(() => {
		if (autoScrollFrameRef.current !== null) {
			window.cancelAnimationFrame(autoScrollFrameRef.current)
		}
		autoScrollFrameRef.current = null
		pointerRef.current = null
	}, [])

	const getScrollContainer = useCallback(
		(target: EventTarget | null, clientY: number) => {
			// 每帧只滚动一个视口；内部沿当前方向到边界后，才交给外层导航。
			if (target instanceof Element) {
				const local = target.closest<HTMLElement>("[data-project-scroll-container]")
				if (local && rootRef.current?.contains(local)) {
					const speed = getEdgeScrollSpeed(local, clientY)
					if (
						(speed < 0 && local.scrollTop > 0) ||
						(speed > 0 && local.scrollTop + local.clientHeight < local.scrollHeight)
					)
						return local
				}
			}
			return scrollRef.current
		},
		[scrollRef],
	)

	const runAutoScroll = useCallback(
		function scrollFrame() {
			autoScrollFrameRef.current = null
			const pointer = pointerRef.current
			const active = activeDragRef.current
			const scrollContainer = getScrollContainer(
				pointer
					? document.elementFromPoint(pointer.clientX, pointer.clientY) || pointer.target
					: null,
				pointer?.clientY ?? 0,
			)
			if (!pointer || !active || !scrollContainer) return

			const speed = getEdgeScrollSpeed(scrollContainer, pointer.clientY)
			if (speed === 0) return

			const previousScrollTop = scrollContainer.scrollTop
			scrollContainer.scrollTop += speed
			if (scrollContainer.scrollTop === previousScrollTop) return

			const target =
				document.elementFromPoint(pointer.clientX, pointer.clientY) || pointer.target
			applyPreview(buildPreview(target, pointer.clientY, active), true)
			autoScrollFrameRef.current = window.requestAnimationFrame(scrollFrame)
		},
		[applyPreview, buildPreview, getScrollContainer],
	)

	const updateAutoScroll = useCallback(
		(frame: DragFrame) => {
			pointerRef.current = frame
			const scrollContainer = getScrollContainer(frame.target, frame.clientY)
			if (!scrollContainer || getEdgeScrollSpeed(scrollContainer, frame.clientY) === 0) {
				stopAutoScroll()
				return
			}
			if (autoScrollFrameRef.current === null) {
				autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
			}
		},
		[runAutoScroll, stopAutoScroll, getScrollContainer],
	)

	const handleDragStart = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (disabled) return
			const source = closestWithinRoot(
				rootRef.current,
				event.target,
				"[data-sidebar-dnd-source]",
			)
			const data = source ? getDragData(source) : null
			if (!source || !data) return

			activeDragRef.current = data
			event.dataTransfer.effectAllowed = "move"
			event.dataTransfer.clearData()
			event.dataTransfer.setData(SIDEBAR_DRAG_DATA_TYPE, JSON.stringify(data))
			const image = createSidebarDragImage(source.dataset.sidebarDndLabel || "", data.type)
			if (image) {
				dragImageRef.current = image
				event.dataTransfer.setDragImage(image, 12, 14)
			}
			const visualSource =
				data.type === "workspace"
					? source.closest<HTMLElement>("[data-sidebar-workspace-root]") || source
					: source
			setSidebarDragAppearance(visualSource, "source")
			visualRef.current.source = visualSource
		},
		[disabled],
	)

	/** Queues one pointer sample for preview and edge-scroll updates. */
	const queueDragFrame = useCallback(
		(frame: DragFrame) => {
			queuedFrameRef.current = frame
			updateAutoScroll(frame)
			if (frameRef.current === null) {
				frameRef.current = window.requestAnimationFrame(flushDragFrame)
			}
		},
		[flushDragFrame, updateAutoScroll],
	)

	const handleDragOver = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!activeDragRef.current) return
			event.preventDefault()
			event.dataTransfer.dropEffect = "move"
			queueDragFrame({
				target: event.target as Element | null,
				clientX: event.clientX,
				clientY: event.clientY,
			})
		},
		[queueDragFrame],
	)

	const handleDragMove = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!activeDragRef.current || event.clientX <= 0 || event.clientY <= 0) return
			queueDragFrame({
				target: event.target as Element | null,
				clientX: event.clientX,
				clientY: event.clientY,
			})
		},
		[queueDragFrame],
	)

	const resetDragState = useCallback(() => {
		if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
		frameRef.current = null
		queuedFrameRef.current = null
		stopAutoScroll()
		clearExpandTimer()
		clearDragVisuals()
		if (dragImageRef.current?.parentNode)
			dragImageRef.current.parentNode.removeChild(dragImageRef.current)
		dragImageRef.current = null
		activeDragRef.current = null
	}, [clearDragVisuals, clearExpandTimer, stopAutoScroll])

	const terminateDrag = useCallback(() => {
		resetDragState()
	}, [resetDragState])

	const handleDragLeave = useCallback(
		(event: DragEvent<HTMLDivElement>) => {
			if (!activeDragRef.current) return
			const pointerTarget = document.elementFromPoint(event.clientX, event.clientY)
			if (pointerTarget && rootRef.current?.contains(pointerTarget)) return
			if (
				!(event.relatedTarget instanceof Node) ||
				!rootRef.current?.contains(event.relatedTarget)
			) {
				stopAutoScroll()
				clearExpandTimer()
				clearDragVisuals()
			}
		},
		[clearDragVisuals, clearExpandTimer, stopAutoScroll],
	)

	const handleDrop = useCallback(
		async (event: DragEvent<HTMLDivElement>) => {
			if (!activeDragRef.current) return
			event.preventDefault()
			const active = activeDragRef.current
			const releaseTarget =
				document.elementFromPoint(event.clientX, event.clientY) || event.target
			const releasePreview = buildPreview(releaseTarget, event.clientY, active)
			// Resolve the final drop from the release coordinates first. The cached
			// frame may describe the previous gap when the last drag frame is queued.
			// The release decision must be the same decision represented by the
			// indicator. Never submit an older cached target when release hit-testing
			// produced no valid target.
			const cachedPreview = previewRef.current
			const cachedTargetStillContainsRelease =
				cachedPreview?.target &&
				releaseTarget instanceof Node &&
				(cachedPreview.target === releaseTarget ||
					cachedPreview.target.contains(releaseTarget))
			const preview =
				releasePreview ||
				(cachedTargetStillContainsRelease && cachedPreview ? cachedPreview : null)
			applyPreview(preview)
			terminateDrag()
			if (!preview || disabled) {
				return
			}

			try {
				if (active.type === "workspace") {
					const sourceIndex = workspaces.findIndex(
						(item) => item.id === active.workspaceId,
					)
					const targetIndex = workspaces.findIndex(
						(item) => item.id === preview.workspaceId,
					)
					if (sourceIndex === -1 || targetIndex === -1) return
					const next = insertAtPosition(
						workspaces,
						sourceIndex,
						targetIndex,
						preview.position || "after",
					)
					if (next.every((item, index) => item.id === workspaces[index]?.id)) {
						return
					}
					const preWorkspaceId = getPredecessorId(
						workspaces,
						active.workspaceId,
						preview.workspaceId,
						preview.position || "after",
					)
					const nextWorkspaceId = getSuccessorId(
						workspaces,
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
						projectTargetId,
						projectDropPosition,
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
							projectName: project.project_name || t("project.unnamedProject"),
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
						projectName: project.project_name || t("project.unnamedProject"),
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
				console.error("Failed to persist sidebar drag result:", error)
				message.error(t("common.operationFailed", { defaultValue: "操作失败，请稍后重试" }))
			}
		},
		[
			applyPreview,
			buildPreview,
			disabled,
			requestPinBoundaryConfirmation,
			t,
			terminateDrag,
			workspaces,
		],
	)

	useEffect(() => {
		return () => {
			if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
			stopAutoScroll()
			clearExpandTimer()
			clearDragVisuals()
			if (dragImageRef.current?.parentNode)
				dragImageRef.current.parentNode.removeChild(dragImageRef.current)
		}
	}, [clearDragVisuals, clearExpandTimer, stopAutoScroll])

	useEffect(() => {
		const cancelDrag = () => {
			if (activeDragRef.current) terminateDrag()
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") cancelDrag()
		}
		document.addEventListener("keydown", handleKeyDown, true)
		window.addEventListener("blur", cancelDrag)
		document.addEventListener("visibilitychange", cancelDrag)
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true)
			window.removeEventListener("blur", cancelDrag)
			document.removeEventListener("visibilitychange", cancelDrag)
		}
	}, [terminateDrag])

	return {
		rootRef: rootRef as RefObject<HTMLDivElement>,
		dropIndicatorRef: dropIndicatorRef as RefObject<SVGSVGElement>,
		handleDragStart,
		handleDragMove,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleDragEnd: () => terminateDrag(),
		handleDragCancel: () => terminateDrag(),
	}
}
