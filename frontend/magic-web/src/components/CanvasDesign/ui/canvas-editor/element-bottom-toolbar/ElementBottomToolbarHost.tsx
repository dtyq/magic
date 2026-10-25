import {
	useCanvasModeUI,
	useCanvasPanelUI,
	useCanvasSelectionUI,
} from "../../../app/providers/CanvasUIProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useIsMediaReplacing } from "../../../app/hooks/canvas"
import { useElementTools, ElementToolBottomSurface } from "../../element-tools"

/**
 * Bottom surface 宿主只负责收集 Canvas/UI 快照；工具分组、图标和版本布局
 * 由统一的 ElementToolBottomSurface 渲染器完成。
 */
export default function ElementBottomToolbarHost() {
	const { selectedElements, isDragging, isSelecting, activeToolSession } = useCanvasSelectionUI()
	const { croppingElementId, extendingElementId, erasingElementId, editingElementId } =
		useCanvasModeUI()
	const { fullscreenMediaElement } = useCanvasPanelUI()
	const { t } = useCanvasDesignI18n()
	const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null
	const isReplacing = useIsMediaReplacing(selectedElement?.id)
	const bottomTools = useElementTools(selectedElement?.id ?? null, "bottom", {
		selectedElements,
		isDragging,
		isSelecting,
		activeToolSession,
		isReplacing,
		isCropping: croppingElementId === selectedElement?.id,
		isExtending: extendingElementId === selectedElement?.id,
		isErasing: erasingElementId === selectedElement?.id,
		isEditing: editingElementId === selectedElement?.id,
		isFullscreenPreviewOpen: Boolean(fullscreenMediaElement),
	})

	return <ElementToolBottomSurface tools={bottomTools} t={t} elementId={selectedElement?.id} />
}
