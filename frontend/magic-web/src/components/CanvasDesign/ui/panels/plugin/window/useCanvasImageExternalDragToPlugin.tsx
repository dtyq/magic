import {
	type MutableRefObject,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

import type { Canvas } from "../../../../runtime/core/Canvas"
import type { CanvasEvent } from "../../../../runtime/core/EventEmitter"
import {
	ElementTypeEnum,
	type ImageElement,
	type CanvasDesignPlugin,
} from "../../../../runtime/document/types"
import { getActiveImageContent } from "../../../../runtime/document/elementContent"
import { useImageLowUrl } from "../../../../app/hooks/resources/useImageUrls"
import {
	createCanvasAssetDragSessionId,
	pluginHasCapability,
	type PluginCanvasAssetDragTargetMode,
	type PluginRuntimeMessage,
} from "../runtime-protocol/v1/index"
import { resolveCanvasImageDragAssets } from "./canvasImageDragAssets"
import { getIframePoint, getPluginWindowHoverState } from "./dragGeometry"
import styles from "./index.module.css"
import { registerPluginFileAssetSource, type PluginSourceElementMap } from "./pluginSourceElements"

type CanvasAssetDragTargetMessage = Extract<
	PluginRuntimeMessage,
	{ type: "magic-canvas-plugin:canvas-asset-drag-target" }
>

interface DragPreviewItem {
	id: string
	name: string
	src?: string
}

interface DragState {
	/** 宿主侧拖拽会话 ID，与插件 iframe 上报的 dragSessionId 绑定 */
	sessionId: string
	/** 拖拽起始元素 ID */
	originElementId: string
	/** 本次拖拽可导出的图片元素 ID 列表 */
	imageElementIds: string[]
	/** 当前指针窗口 X 坐标 */
	clientX: number
	/** 当前指针窗口 Y 坐标 */
	clientY: number
	/** 是否悬停在插件浮窗范围内 */
	isOverPlugin: boolean
	/** 是否悬停在可投放目标范围内 */
	isOverTarget: boolean
	/** 拖拽预览图片列表 */
	previewItems: DragPreviewItem[]
}

interface DropTarget {
	/** 投放目标 ID */
	targetId: string
	/** 投放目标模式 */
	mode: PluginCanvasAssetDragTargetMode
	/** 是否可投放 */
	canDrop: boolean
	/** grid 投放区剩余可导入张数 */
	importRemaining?: number
}

interface UseCanvasImageExternalDragToPluginParams {
	canvas: Canvas
	channelToken: string
	iframeRef: RefObject<HTMLIFrameElement | null>
	plugin: CanvasDesignPlugin
	pluginWindowRef: RefObject<HTMLDivElement | null>
	/** 记录拖入插件的文件 asset 与原画布元素的关系，供插件后续生成时恢复来源图。 */
	sourceElementByAssetKeyRef: MutableRefObject<PluginSourceElementMap>
}

/** 获取拖拽预览所需的图片元素元信息，缩略图 URL 由 useImageLowUrl 异步解析。 */
function getImagePreviewItem(canvas: Canvas, elementId: string): DragPreviewItem | null {
	const element = canvas.elementManager.getElementData(elementId)
	if (!element || element.type !== ElementTypeEnum.Image) return null
	const imageElement = element as ImageElement
	const activeContent =
		(canvas.getEffectiveContent?.(imageElement.id) as
			| ReturnType<typeof getActiveImageContent>
			| undefined) ?? getActiveImageContent(imageElement)
	if (!activeContent.src) return null
	return {
		id: elementId,
		name: imageElement.name || "Image",
		src: activeContent.src,
	}
}

function CanvasAssetDragGhostItem({ item, index }: { item: DragPreviewItem; index: number }) {
	const { lowUrl } = useImageLowUrl({
		elementId: item.id,
		src: item.src,
		enabled: Boolean(item.src),
	})

	return (
		<div
			className={styles.canvasAssetDragGhostItem}
			style={{
				transform: `translate3d(${index * 7}px, ${index * 5}px, 0) rotate(${index * 3}deg)`,
			}}
		>
			{lowUrl ? (
				<img
					className={styles.canvasAssetDragGhostImage}
					src={lowUrl}
					alt={item.name}
					draggable={false}
				/>
			) : (
				<span className={styles.canvasAssetDragGhostPlaceholder} />
			)}
		</div>
	)
}

function CanvasAssetDragGhost({ dragState }: { dragState: DragState }) {
	if (typeof document === "undefined") return null

	// 拖拽预览挂到 body，避免被插件浮窗或 iframe 的 overflow/z-index 截断。
	const visibleItems = dragState.previewItems.length
		? dragState.previewItems
		: [{ id: "placeholder", name: "Image" }]
	const count = dragState.imageElementIds.length

	return createPortal(
		<div
			className={styles.canvasAssetDragGhost}
			style={{
				transform: `translate3d(${dragState.clientX + 14}px, ${dragState.clientY + 14}px, 0)`,
			}}
		>
			<div className={styles.canvasAssetDragGhostStack}>
				{visibleItems.map((item, index) => (
					<CanvasAssetDragGhostItem key={item.id} item={item} index={index} />
				))}
				{count > 1 && <span className={styles.canvasAssetDragGhostCount}>{count}</span>}
			</div>
		</div>,
		document.body,
	)
}

/** 最多取前三张图片作为拖拽 ghost 的堆叠预览 */
function getPreviewItems(canvas: Canvas, elementIds: string[]): DragPreviewItem[] {
	return elementIds
		.slice(0, 3)
		.map((elementId) => getImagePreviewItem(canvas, elementId))
		.filter((item): item is DragPreviewItem => Boolean(item))
}

/**
 * 处理画布图片外部拖拽和插件 iframe 的事件。
 * 画布侧只负责发出 start/move/end；这个 hook 负责：
 * 1. 将窗口坐标转换为 iframe 坐标并通知插件；
 * 2. 接收插件上报的当前 drop target；
 * 3. 在 mouseup/pointerup 后解析图片文件并投递给插件；
 * 4. 渲染宿主层的拖拽预览。
 * @param canvas - 画布实例
 * @param channelToken - 插件通道 token
 * @param iframeRef - iframe 引用
 * @param plugin - 插件实例
 * @param pluginWindowRef - 插件浮窗引用
 * @param sourceElementByAssetKeyRef - 插件 asset/path 到画布元素 id 的来源映射
 * @returns 处理画布图片外部拖拽和插件 iframe 的事件的函数
 */
export function useCanvasImageExternalDragToPlugin({
	canvas,
	channelToken,
	iframeRef,
	plugin,
	pluginWindowRef,
	sourceElementByAssetKeyRef,
}: UseCanvasImageExternalDragToPluginParams): {
	canvasAssetDragGhost: ReactNode
	handleCanvasAssetDragTarget: (target: CanvasAssetDragTargetMessage) => void
	isCanvasAssetDragActive: boolean
	isCanvasAssetDragOverPlugin: boolean
	isCanvasAssetDropResolving: boolean
} {
	const [dragState, setDragState] = useState<DragState | null>(null)
	const [isDropResolving, setIsDropResolving] = useState(false)
	const dragStateRef = useRef<DragState | null>(null)
	const dragSessionIdRef = useRef<string | null>(null)
	const targetRef = useRef<DropTarget | null>(null)
	const isInsideIframeRef = useRef(false)
	// 只有声明了 assets.pickFiles 能力的插件才允许接收画布图片拖入。
	const canAcceptCanvasImageDrag = pluginHasCapability(plugin, "assets.pickFiles")

	useEffect(() => {
		dragStateRef.current = dragState
	}, [dragState])

	/** 向插件 iframe 投递带 channelToken 的宿主消息 */
	const postPluginMessage = useCallback(
		(message: Record<string, unknown>) => {
			iframeRef.current?.contentWindow?.postMessage(
				{
					channelToken,
					...message,
				},
				"*",
			)
		},
		[channelToken, iframeRef],
	)

	/** 通知插件清理画布图片拖拽 hover/drop 状态（不结束宿主拖拽会话） */
	const sendDragLeave = useCallback(() => {
		isInsideIframeRef.current = false
		targetRef.current = null
		// 指针离开 iframe 或拖拽结束时，通知插件清理内部 hover 样式。
		postPluginMessage({
			type: "magic-canvas-plugin:canvas-asset-drag-leave",
		})
	}, [postPluginMessage])

	/**
	 * 结束宿主拖拽会话：通知插件 leave，并同步清空 session ref 与 UI 状态。
	 * 任何清 session 的路径都应走这里，避免 ref / dragState / resolving 不同步残留。
	 */
	const finishDragSession = useCallback(() => {
		sendDragLeave()
		dragSessionIdRef.current = null
		setDragState(null)
		setIsDropResolving(false)
	}, [sendDragLeave])

	/** 仅当 sessionId 仍是当前活跃会话时收尾，避免异步失败误清新开的拖拽 */
	const finishDragSessionIfCurrent = useCallback(
		(sessionId: string) => {
			if (dragSessionIdRef.current !== sessionId) return false
			finishDragSession()
			return true
		},
		[finishDragSession],
	)

	/** 将当前拖拽位置同步给插件 iframe，并携带图片数量等元信息 */
	const postDragMove = useCallback(
		(
			state: Pick<
				DragState,
				"sessionId" | "clientX" | "clientY" | "imageElementIds" | "originElementId"
			>,
		) => {
			const iframePoint = getIframePoint(iframeRef.current, state.clientX, state.clientY)
			if (!iframePoint) {
				if (isInsideIframeRef.current) {
					sendDragLeave()
				}
				return
			}

			isInsideIframeRef.current = true
			// 给iframe 发 move 事件，只传元信息，真正文件会在确认 drop 后再解析，避免拖动中反复上传。
			postPluginMessage({
				type: "magic-canvas-plugin:canvas-asset-drag-move",
				dragSessionId: state.sessionId,
				clientX: iframePoint.x,
				clientY: iframePoint.y,
				assetsMeta: {
					count: state.imageElementIds.length,
					originElementId: state.originElementId,
				},
			})
		},
		[iframeRef, postPluginMessage, sendDragLeave],
	)

	/** 接收插件 iframe 上报的当前可投放目标（须匹配活跃拖拽会话） */
	const handleCanvasAssetDragTarget = useCallback((target: CanvasAssetDragTargetMessage) => {
		const activeSessionId = dragSessionIdRef.current
		if (!activeSessionId || !dragStateRef.current) return
		if (target.dragSessionId !== activeSessionId) return

		const nextTarget =
			target.canDrop && target.targetId && target.mode
				? isInsideIframeRef.current
					? {
							targetId: target.targetId,
							mode: target.mode,
							canDrop: true,
							importRemaining: target.importRemaining,
						}
					: null
				: null

		// 插件每次命中/离开投放目标都会上报，宿主只记录当前可 drop 的目标。
		targetRef.current = nextTarget
		setDragState((current) =>
			current?.sessionId === activeSessionId
				? {
						...current,
						isOverTarget: Boolean(nextTarget),
					}
				: current,
		)
	}, [])

	useEffect(() => {
		/** 画布开始外部图片拖拽时，初始化宿主拖拽状态和 ghost 预览 */
		const handleStart = (event: CanvasEvent<"image:external-drag:start">) => {
			if (!canAcceptCanvasImageDrag) return
			const { data } = event
			// 新会话开始前先完整收尾旧会话，避免异步 resolve 残留或插件侧 hover 不同步。
			if (dragSessionIdRef.current) {
				finishDragSession()
			}
			const sessionId = createCanvasAssetDragSessionId()
			dragSessionIdRef.current = sessionId
			const nextState: DragState = {
				sessionId,
				originElementId: data.originElementId,
				imageElementIds: data.imageElementIds,
				clientX: data.clientX,
				clientY: data.clientY,
				isOverPlugin: getPluginWindowHoverState(
					pluginWindowRef.current,
					data.clientX,
					data.clientY,
				),
				isOverTarget: false,
				previewItems: getPreviewItems(canvas, data.imageElementIds),
			}
			targetRef.current = null
			setDragState(nextState)
			postDragMove(nextState)
		}

		/** 画布拖拽移动时，更新宿主坐标并继续转发给插件 iframe */
		const handleMove = (event: CanvasEvent<"image:external-drag:move">) => {
			if (!canAcceptCanvasImageDrag || !dragStateRef.current) return
			const { data } = event
			const isOverPlugin = getPluginWindowHoverState(
				pluginWindowRef.current,
				data.clientX,
				data.clientY,
			)
			const nextState = {
				...dragStateRef.current,
				clientX: data.clientX,
				clientY: data.clientY,
				isOverPlugin,
				isOverTarget: Boolean(targetRef.current),
			}
			setDragState(nextState)
			postDragMove(nextState)
		}

		/** 画布拖拽结束时，根据插件最后上报的 drop target 决定是否投递文件 */
		const handleEnd = (event: CanvasEvent<"image:external-drag:end">) => {
			if (!canAcceptCanvasImageDrag) return
			const current = dragStateRef.current
			const target = targetRef.current

			// 如果拖拽被取消（工具切换/Escape/多指手势/浏览器取消 pointer），或者没有可投放目标，则不进行图片导入。
			if (!current || event.data.cancelled || !target?.canDrop) {
				finishDragSession()
				return
			}

			// slot 是单图替换位，只导入拖拽起点；grid 支持把选区里的图片批量导入。
			let elementIds =
				target.mode === "slot" ? [current.originElementId] : current.imageElementIds
			const maxResolveCount =
				target.mode === "slot"
					? 1
					: Math.max(0, target.importRemaining ?? elementIds.length)
			if (maxResolveCount <= 0) {
				finishDragSession()
				return
			}
			elementIds = elementIds.slice(0, maxResolveCount)

			const sessionId = current.sessionId

			setIsDropResolving(true)
			const toastId = toast.loading(
				canvas.t?.("plugin.canvasAssetDrop.loading", "正在导入图片...") ||
					"正在导入图片...",
			)
			void resolveCanvasImageDragAssets(canvas, elementIds)
				.then((files) => {
					// 会话已被新拖拽/卸载接管：只关掉 loading，勿误清新会话、勿弹失败 toast。
					if (dragSessionIdRef.current !== sessionId) {
						toast.dismiss(toastId)
						return
					}
					if (!files.length) {
						toast.dismiss(toastId)
						finishDragSessionIfCurrent(sessionId)
						return
					}
					// 拖入插件的文件可能随后作为 reference_images 回到宿主，提前记录文件 key 与画布元素的关系。
					files.forEach((file) => {
						registerPluginFileAssetSource(
							sourceElementByAssetKeyRef.current,
							file,
							canvas.magicConfigManager.config?.methods?.resolveResourceReference,
						)
					})
					postPluginMessage({
						type: "magic-canvas-plugin:canvas-asset-drop",
						dragSessionId: sessionId,
						targetId: target.targetId,
						files,
					})
					toast.dismiss(toastId)
				})
				.catch(() => {
					// 会话已非当前：只 dismiss loading，避免对已顶替的新会话误弹失败与误清状态。
					if (dragSessionIdRef.current !== sessionId) {
						toast.dismiss(toastId)
						return
					}
					toast.error(
						canvas.t?.("plugin.canvasAssetDrop.error", "图片导入失败，请重试") ||
							"图片导入失败，请重试",
						{ id: toastId },
					)
				})
				.finally(() => {
					// 兜底收尾：成功/失败路径已清则 no-op；仅仍属本会话时清理。
					finishDragSessionIfCurrent(sessionId)
				})
		}

		const unsubscribers = [
			canvas.eventEmitter.on("image:external-drag:start", handleStart),
			canvas.eventEmitter.on("image:external-drag:move", handleMove),
			canvas.eventEmitter.on("image:external-drag:end", handleEnd),
		]

		return () => {
			unsubscribers.forEach((unsubscribe) => unsubscribe())
		}
	}, [
		canAcceptCanvasImageDrag,
		canvas,
		finishDragSession,
		finishDragSessionIfCurrent,
		pluginWindowRef,
		postDragMove,
		postPluginMessage,
		sourceElementByAssetKeyRef,
	])

	useEffect(() => {
		return () => {
			// 卸载或 channel 变更导致 leave 重建时，完整结束会话，避免只清 ref 残留遮罩。
			finishDragSession()
		}
	}, [finishDragSession])

	// resolve 期间保留 dragState / session，但关闭 ghost 与遮罩，让用户继续操作插件面板。
	const showCanvasAssetDragOverlay = Boolean(dragState) && !isDropResolving
	const canvasAssetDragGhost =
		showCanvasAssetDragOverlay && dragState ? (
			<CanvasAssetDragGhost dragState={dragState} />
		) : null

	return {
		canvasAssetDragGhost,
		handleCanvasAssetDragTarget,
		isCanvasAssetDragActive: showCanvasAssetDragOverlay,
		isCanvasAssetDragOverPlugin: Boolean(dragState?.isOverPlugin) && !isDropResolving,
		isCanvasAssetDropResolving: isDropResolving,
	}
}
