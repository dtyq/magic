import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"
import { Film, Mic } from "lucide-react"
import { useCanvas } from "../../app/providers/CanvasProvider"
import { useMagic } from "../../app/providers/MagicProvider"
import { ToolTypeEnum, type ToolType } from "../../runtime/document/types"
import { ImageSparkles } from "../primitives/icons"

type MediaCreationTool =
	| typeof ToolTypeEnum.ImageGenerator
	| typeof ToolTypeEnum.VideoGenerator
	| typeof ToolTypeEnum.AudioGenerator

interface DragPreview {
	x: number
	y: number
	label: string
	tool: MediaCreationTool
	canDrop: boolean
}

// 判定用屏幕像素，与画布缩放无关；轻微手抖仍执行原来的单击。
const DRAG_DISTANCE = 5

function isMediaCreationTool(tool?: ToolType): tool is MediaCreationTool {
	return (
		tool === ToolTypeEnum.ImageGenerator ||
		tool === ToolTypeEnum.VideoGenerator ||
		tool === ToolTypeEnum.AudioGenerator
	)
}

export function useToolCreationDrag() {
	const { canvas } = useCanvas()
	const { imageModelList, videoModelList } = useMagic()
	const [preview, setPreview] = useState<DragPreview | null>(null)
	const cancelRef = useRef<(() => void) | null>(null)
	const suppressClickRef = useRef(false)

	useEffect(() => {
		const resetClick = () => {
			suppressClickRef.current = false
		}
		const suppressGestureClick = (event: MouseEvent) => {
			if (!suppressClickRef.current || event.detail === 0) return
			suppressClickRef.current = false
			event.preventDefault()
			event.stopImmediatePropagation()
		}
		// Escape 会提前释放指针捕获，后续 click 可能落到画布或其它面板。
		// 只拦截本次手势的鼠标 click；新的按下和键盘激活继续按原行为执行。
		window.addEventListener("pointerdown", resetClick, true)
		window.addEventListener("click", suppressGestureClick, true)
		return () => {
			window.removeEventListener("pointerdown", resetClick, true)
			window.removeEventListener("click", suppressGestureClick, true)
		}
	}, [])

	useEffect(() => () => cancelRef.current?.(), [canvas, imageModelList, videoModelList])
	useEffect(() => {
		return canvas?.eventEmitter.on("permission:changed", () => {
			if (!canvas.permissionManager.can("document.write")) cancelRef.current?.()
		})
	}, [canvas])

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>, tool: ToolType | undefined, label: string) => {
			suppressClickRef.current = false
			if (
				!canvas ||
				event.button !== 0 ||
				!event.isPrimary ||
				!isMediaCreationTool(tool) ||
				!canvas.permissionManager.can("document.write")
			)
				return

			cancelRef.current?.()
			const target = event.currentTarget
			const pointerId = event.pointerId
			const start = { x: event.clientX, y: event.clientY }
			let dragging = false
			let finished = false

			const getDropPosition = (clientX: number, clientY: number) => {
				if (!canvas.permissionManager.can("document.write")) return null
				const hit = document.elementFromPoint(clientX, clientY)
				const container = canvas.stage.container()
				// 指针捕获负责手势，实际命中负责落点；面板即使覆盖画布也不能接受创建。
				if (
					!hit ||
					!container.contains(hit) ||
					hit.closest(
						"[data-canvas-ui-component]:not([data-canvas-design-app-container])",
					)
				)
					return null
				const bounds = container.getBoundingClientRect()
				if (bounds.width <= 0 || bounds.height <= 0) return null
				const stagePoint = {
					x: ((clientX - bounds.left) * canvas.stage.width()) / bounds.width,
					y: ((clientY - bounds.top) * canvas.stage.height()) / bounds.height,
				}
				return canvas.stage.getAbsoluteTransform().copy().invert().point(stagePoint)
			}

			const finish = () => {
				if (finished) return
				finished = true
				window.removeEventListener("pointermove", move, true)
				window.removeEventListener("pointerup", release, true)
				window.removeEventListener("pointercancel", pointerCancel, true)
				window.removeEventListener("keydown", keydown, true)
				window.removeEventListener("blur", cancel)
				target.removeEventListener("lostpointercapture", cancel)
				if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
				cancelRef.current = null
				setPreview(null)
			}
			const cancel = () => {
				suppressClickRef.current = true
				finish()
			}
			const move = (pointer: PointerEvent) => {
				if (pointer.pointerId !== pointerId) return
				if (!canvas.permissionManager.can("document.write")) {
					cancel()
					return
				}
				if (
					!dragging &&
					Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) < DRAG_DISTANCE
				)
					return
				dragging = true
				suppressClickRef.current = true
				pointer.preventDefault()
				pointer.stopPropagation()
				setPreview({
					x: pointer.clientX,
					y: pointer.clientY,
					tool,
					label,
					canDrop: getDropPosition(pointer.clientX, pointer.clientY) !== null,
				})
			}
			const release = (pointer: PointerEvent) => {
				if (pointer.pointerId !== pointerId) return
				const position = dragging ? getDropPosition(pointer.clientX, pointer.clientY) : null
				if (dragging) {
					pointer.preventDefault()
					pointer.stopPropagation()
				}
				finish()
				if (!position) return
				// 仅释放时提交一次真实创建；拖动与取消不会写入历史或触发生成请求。
				if (tool === ToolTypeEnum.ImageGenerator) {
					canvas.toolManager
						.getImageGeneratorTool()
						.createImageAtCanvasPoint(position.x, position.y, imageModelList)
				} else if (tool === ToolTypeEnum.VideoGenerator) {
					canvas.toolManager
						.getVideoGeneratorTool()
						.createVideoAtCanvasPoint(position.x, position.y, videoModelList)
				} else {
					canvas.toolManager
						.getAudioGeneratorTool()
						.createAudioAtCanvasPoint(position.x, position.y)
				}
			}
			const pointerCancel = (pointer: PointerEvent) => {
				if (pointer.pointerId === pointerId) cancel()
			}
			const keydown = (key: KeyboardEvent) => {
				if (key.key !== "Escape") return
				key.preventDefault()
				key.stopPropagation()
				cancel()
			}

			target.setPointerCapture(pointerId)
			target.addEventListener("lostpointercapture", cancel)
			window.addEventListener("pointermove", move, true)
			window.addEventListener("pointerup", release, true)
			window.addEventListener("pointercancel", pointerCancel, true)
			window.addEventListener("keydown", keydown, true)
			window.addEventListener("blur", cancel)
			cancelRef.current = cancel
		},
		[canvas, imageModelList, videoModelList],
	)

	const Icon =
		preview?.tool === ToolTypeEnum.ImageGenerator
			? ImageSparkles
			: preview?.tool === ToolTypeEnum.VideoGenerator
				? Film
				: Mic
	const dragPreview = preview
		? createPortal(
				<div
					className="pointer-events-none fixed z-[1100] flex select-none items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
					style={{
						// 使用自身尺寸居中，让拖拽提示随鼠标移动，不偏移到右下方。
						left: preview.x,
						top: preview.y,
						transform: "translate(-50%, -50%)",
						opacity: preview.canDrop ? 1 : 0.5,
					}}
					aria-hidden
				>
					<Icon size={16} />
					<span>{preview.label}</span>
				</div>,
				document.body,
			)
		: null

	return { onPointerDown, dragPreview }
}
