import { useCallback, useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useCanvasElement } from "../../../app/hooks/canvas"
import useCanvasSelectionFloatingPanel from "../../../app/hooks/layout/useCanvasSelectionFloatingPanel"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasPanelUI } from "../../../app/providers/CanvasUIProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { BaseElement } from "../../../runtime/elements/core/BaseElement"
import { isContentVersionOperations } from "../../../runtime/elements/core/ContentVersionOperations"
import { ElementTypeEnum } from "../../../runtime/document/types"
import ContentVersionGrid, { type ContentVersionElement } from "./ContentVersionGrid"
import styles from "./index.module.css"

function isContentVersionElement(
	element: ReturnType<typeof useCanvasElement>,
): element is ContentVersionElement {
	return (
		element?.type === ElementTypeEnum.Image ||
		element?.type === ElementTypeEnum.Video ||
		element?.type === ElementTypeEnum.Audio
	)
}

export default function ContentVersionPanel() {
	const { versionPanelElementId, closeVersionPanel } = useCanvasPanelUI()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const element = useCanvasElement(versionPanelElementId)
	const [busyContentId, setBusyContentId] = useState<string>()
	const panelRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		setBusyContentId(undefined)
	}, [versionPanelElementId])
	useEffect(() => {
		if (
			versionPanelElementId &&
			(!isContentVersionElement(element) || element.contents.length <= 1)
		) {
			closeVersionPanel()
		}
	}, [closeVersionPanel, element, versionPanelElementId])

	const { setRefs } = useCanvasSelectionFloatingPanel({
		id: "content-version-panel",
		elementId: versionPanelElementId ?? "",
		onClose: closeVersionPanel,
		closeOnSelectionChange: true,
	})
	const setPanelRef = useCallback(
		(node: HTMLDivElement | null) => {
			panelRef.current = node
			setRefs(node)
		},
		[setRefs],
	)
	useEffect(() => {
		const node = panelRef.current
		if (!node || !canvas) return
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault()
			event.stopPropagation()
			canvas.viewportController.handleWheelFromFloating(event)
		}
		// Radix ScrollArea listens on document, so capture and stop here before its handler.
		node.addEventListener("wheel", handleWheel, { capture: true, passive: false })
		return () => node.removeEventListener("wheel", handleWheel, { capture: true })
	}, [canvas, versionPanelElementId])

	const getOperations = useCallback((): BaseElement | undefined => {
		if (!canvas || !versionPanelElementId) return undefined
		return canvas.elementManager.getElementInstance(versionPanelElementId)
	}, [canvas, versionPanelElementId])

	const handleSelect = useCallback(
		(contentId: string) => {
			if (!canvas || !versionPanelElementId) return
			const instance = getOperations()
			if (!isContentVersionOperations(instance)) return
			if (canvas.permissionManager.can("document.write")) {
				instance.switchActiveContent(contentId)
			} else {
				canvas.setPreviewContent(versionPanelElementId, contentId)
			}
		},
		[canvas, getOperations, versionPanelElementId],
	)

	const handleSetMain = useCallback(
		(contentId: string) => {
			if (!canvas || !versionPanelElementId) return
			const instance = getOperations()
			if (!isContentVersionOperations(instance)) return
			setBusyContentId(contentId)
			try {
				const previousContentId = canvas.getEffectiveContentId(versionPanelElementId)
				if (previousContentId !== contentId) {
					const switched = instance.switchActiveContent(contentId)
					if (
						!switched ||
						canvas.getEffectiveContentId(versionPanelElementId) !== contentId
					) {
						return
					}
				}
				if (!instance.setMainContent(contentId) && previousContentId !== contentId) {
					if (previousContentId) instance.switchActiveContent(previousContentId)
				}
			} finally {
				setBusyContentId(undefined)
			}
		},
		[canvas, getOperations, versionPanelElementId],
	)

	const handleDelete = useCallback(
		async (contentId: string) => {
			if (!canvas || !versionPanelElementId) return
			const instance = getOperations()
			if (!isContentVersionOperations(instance)) return
			setBusyContentId(contentId)
			try {
				const previousContentId = canvas.getEffectiveContentId(versionPanelElementId)
				// The element-level delete contract intentionally targets the active Content.
				// Select the requested card first so hover deletion never removes a sibling.
				if (previousContentId !== contentId) {
					const switched = instance.switchActiveContent(contentId)
					if (
						!switched ||
						canvas.getEffectiveContentId(versionPanelElementId) !== contentId
					) {
						return
					}
				}
				const deleted = await Promise.resolve(instance.deleteActiveContent())
				if (!deleted && previousContentId && previousContentId !== contentId) {
					instance.switchActiveContent(previousContentId)
				}
			} finally {
				setBusyContentId(undefined)
			}
		},
		[canvas, getOperations, versionPanelElementId],
	)

	if (!versionPanelElementId || !isContentVersionElement(element)) return null

	const canWrite = canvas?.permissionManager.can("document.write") ?? false
	const canDelete = canWrite && (canvas?.permissionManager.can("document.delete") ?? false)
	const canSetMain = canWrite
	const effectiveContentId =
		canvas?.getEffectiveContentId(element.id) ?? element.activeContentId ?? undefined

	return (
		<div
			ref={setPanelRef}
			className={styles.panel}
			data-canvas-ui-component
			role="dialog"
			aria-label={t("elementBottomToolbar.versionPanelTitle", "查看版本")}
		>
			<div className={styles.header}>
				<h2 className={styles.title}>
					{t("elementBottomToolbar.versionPanelTitle", "查看版本")}
				</h2>
				<button
					type="button"
					className={styles.closeButton}
					aria-label={t("elementBottomToolbar.closeVersionPanel", "关闭版本面板")}
					onClick={closeVersionPanel}
				>
					<X size={16} />
				</button>
			</div>
			<div className={styles.divider} />
			<ScrollArea className={styles.scrollArea} viewportClassName={styles.scrollViewport}>
				<div className={styles.content}>
					<ContentVersionGrid
						element={element}
						effectiveContentId={effectiveContentId}
						busyContentId={busyContentId}
						canDelete={canDelete}
						canSetMain={canSetMain}
						onSelect={handleSelect}
						onDelete={(contentId) => void handleDelete(contentId)}
						onSetMain={handleSetMain}
					/>
				</div>
			</ScrollArea>
		</div>
	)
}
