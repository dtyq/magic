import {
	memo,
	type ChangeEvent,
	type Dispatch,
	type PointerEventHandler,
	type SetStateAction,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"

import type { Canvas } from "../../../../runtime/core/Canvas"
import type { CanvasDesignPlugin } from "../../../../runtime/document/types"
import type {
	ReferenceResourcePanelItem,
	ReferenceResourcePanelSelectContext,
} from "../../../../public/props"
import {
	REFERENCE_RESOURCE_SOURCE_TYPES,
	type ReferenceResourceSourceType,
} from "../../../editors/message/reference-assets/reference-resource.types"
import { createPluginChannelToken, type PluginRuntimeMessage } from "../runtime-protocol/v1/index"
import {
	getPluginFilePickerAccept,
	getPluginReferenceResourceType,
	pickPluginFiles,
	resolveProjectPluginFile,
} from "../assets/fileAssets"
import styles from "./index.module.css"
import { PluginFilePicker } from "../assets/PluginFilePicker"
import { PluginRuntimeEmpty } from "./PluginRuntimeEmpty"
import { PluginRuntimeFrame } from "./PluginRuntimeFrame"
import { PluginWindowHeader } from "./PluginWindowHeader"
import {
	clampPluginPanelSize,
	clampPositionToContainer,
	getPluginPanelSizeBounds,
	getInitialPosition,
	saveCachedPosition,
} from "./position"
import { getErrorMessage } from "../assets/resourceUtils"
import type {
	PluginFileAsset,
	PluginFilePickerRequest,
	PluginWindowPosition,
	PluginWindowSize,
} from "./types"
import { useCanvasImageExternalDragToPlugin } from "./useCanvasImageExternalDragToPlugin"
import { usePluginRuntimeBridge } from "../runtime-bridge/usePluginRuntimeBridge"
import { usePluginView } from "./usePluginView"
import { useProjectAttachmentDragToPlugin } from "./useProjectAttachmentDragToPlugin"

type CanvasAssetDragTargetMessage = Extract<
	PluginRuntimeMessage,
	{ type: "magic-canvas-plugin:canvas-asset-drag-target" }
>

function isReferenceResourcePanelItem(
	item: ReferenceResourcePanelItem | undefined,
): item is ReferenceResourcePanelItem {
	return Boolean(item)
}

export const PluginWindow = memo(function PluginWindow({
	canvas,
	locale,
	plugin,
	sessionId,
	panelSize,
	setPanelSize,
	setFrameHeight,
	onManualResizeStart,
	onManualResizeEnd,
}: {
	canvas: Canvas
	locale: string
	plugin: CanvasDesignPlugin
	sessionId: number
	panelSize: PluginWindowSize
	setPanelSize: Dispatch<SetStateAction<PluginWindowSize>>
	setFrameHeight: (height: number) => void
	onManualResizeStart: () => void
	onManualResizeEnd: (size: PluginWindowSize) => void
}) {
	const channelToken = useMemo(() => createPluginChannelToken(), [])
	const [position, setPosition] = useState<PluginWindowPosition>(() =>
		getInitialPosition(canvas.container),
	)
	const panelSizeRef = useRef(panelSize)
	const resizeStartRef = useRef({ pointerX: 0, pointerY: 0, width: 0, height: 0 })
	const dragStartRef = useRef({ pointerX: 0, pointerY: 0, windowX: 0, windowY: 0 })
	const draggingRef = useRef(false)
	const positionRef = useRef(position)
	const resizingRef = useRef(false)
	const pluginWindowRef = useRef<HTMLDivElement>(null)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const localFileInputRef = useRef<HTMLInputElement>(null)
	const awaitingLocalFileDialogRef = useRef(false)
	const [filePickerRequest, setFilePickerRequest] = useState<PluginFilePickerRequest | null>(null)
	const filePickerRequestRef = useRef<PluginFilePickerRequest | null>(null)
	const projectFileBatchItemsRef = useRef<Array<ReferenceResourcePanelItem | undefined>>([])
	const pluginView = usePluginView(
		plugin,
		locale,
		channelToken,
		canvas.permissionManager.getContext().mode,
	)
	// 单个插件窗口内维护 asset/path -> 画布元素 id 的临时映射，供后续 generate-and-place 贴近来源图。
	const sourceElementByAssetKeyRef = useRef(new Map<string, string>())

	useEffect(() => {
		const sourceElementByAssetKey = sourceElementByAssetKeyRef.current
		sourceElementByAssetKey.clear()
		return () => {
			sourceElementByAssetKey.clear()
		}
	}, [canvas, channelToken])

	useLayoutEffect(() => {
		panelSizeRef.current = panelSize
	}, [panelSize])

	// 连接画布图片拖拽和插件 iframe：宿主负责预览、落点确认与最终文件投递。
	const { canvasAssetDragGhost, handleCanvasAssetDragTarget, isCanvasAssetDragActive } =
		useCanvasImageExternalDragToPlugin({
			canvas,
			channelToken,
			iframeRef,
			plugin,
			pluginWindowRef,
			sourceElementByAssetKeyRef,
		})
	// 连接项目附件拖拽和插件 iframe：宿主负责预览、落点确认与最终文件投递。
	const { handleProjectAttachmentDragTarget, isProjectAttachmentDragActive } =
		useProjectAttachmentDragToPlugin({
			canvas,
			channelToken,
			iframeRef,
			plugin,
			pluginWindowRef,
		})

	const handlePluginAssetDragTarget = useCallback(
		(target: CanvasAssetDragTargetMessage) => {
			handleCanvasAssetDragTarget(target)
			handleProjectAttachmentDragTarget(target)
		},
		[handleCanvasAssetDragTarget, handleProjectAttachmentDragTarget],
	)

	useLayoutEffect(() => {
		positionRef.current = position
	}, [position])

	useLayoutEffect(() => {
		filePickerRequestRef.current = filePickerRequest
	}, [filePickerRequest])

	const getCurrentSizeBounds = useCallback(() => {
		return getPluginPanelSizeBounds(
			canvas.container,
			pluginWindowRef.current,
			panelSizeRef.current,
		)
	}, [canvas.container])

	const clampCurrentSize = useCallback(() => {
		const bounds = getCurrentSizeBounds()
		if (!bounds) return false
		const currentSize = panelSizeRef.current
		const nextSize = clampPluginPanelSize(currentSize, bounds)
		panelSizeRef.current = nextSize
		if (nextSize.width === currentSize.width && nextSize.height === currentSize.height) {
			return false
		}
		setPanelSize(nextSize)
		return true
	}, [getCurrentSizeBounds, setPanelSize])

	const clampCurrentPosition = useCallback(() => {
		setPosition((currentPosition) => {
			const nextPosition = clampPositionToContainer(
				currentPosition,
				canvas.container,
				pluginWindowRef.current,
			)
			positionRef.current = nextPosition
			if (nextPosition.x === currentPosition.x && nextPosition.y === currentPosition.y) {
				return currentPosition
			}
			return nextPosition
		})
	}, [canvas])

	useLayoutEffect(() => {
		clampCurrentSize()
		clampCurrentPosition()
	}, [clampCurrentPosition, clampCurrentSize, panelSize])

	useEffect(() => {
		const resizeObserver = new ResizeObserver(() => {
			clampCurrentSize()
			clampCurrentPosition()
		})
		resizeObserver.observe(canvas.container)
		return () => {
			resizeObserver.disconnect()
		}
	}, [canvas.container, clampCurrentPosition, clampCurrentSize])

	usePluginRuntimeBridge({
		awaitingLocalFileDialogRef,
		canvas,
		channelToken,
		filePickerRequestRef,
		iframeRef,
		onCanvasAssetDragTarget: handlePluginAssetDragTarget,
		plugin,
		pluginWindowRef,
		setFilePickerRequest,
		sourceElementByAssetKeyRef,
		setFrameHeight,
	})

	const handleClose = useCallback(() => {
		sourceElementByAssetKeyRef.current.clear()
		canvas.pluginManager.close(plugin.name)
	}, [canvas.pluginManager, plugin.name])

	const respondToPickFiles = useCallback(
		(requestId: string, result: { files?: PluginFileAsset[]; error?: string }) => {
			iframeRef.current?.contentWindow?.postMessage(
				{
					channelToken,
					type: "magic-canvas-plugin:pick-files-result",
					requestId,
					...result,
				},
				"*",
			)
		},
		[channelToken],
	)

	useEffect(() => {
		const handleWindowFocus = () => {
			if (!awaitingLocalFileDialogRef.current) return
			window.setTimeout(() => {
				if (!awaitingLocalFileDialogRef.current) return
				awaitingLocalFileDialogRef.current = false
				const request = filePickerRequestRef.current
				if (!request) return
				filePickerRequestRef.current = null
				setFilePickerRequest(null)
				respondToPickFiles(request.requestId, { files: [] })
			}, 300)
		}
		window.addEventListener("focus", handleWindowFocus)
		return () => {
			window.removeEventListener("focus", handleWindowFocus)
		}
	}, [respondToPickFiles])

	const handleFilePickerOpenChange = useCallback(
		(open: boolean) => {
			if (open) return
			if (awaitingLocalFileDialogRef.current) return
			const request = filePickerRequestRef.current
			projectFileBatchItemsRef.current = []
			filePickerRequestRef.current = null
			setFilePickerRequest(null)
			if (request) {
				respondToPickFiles(request.requestId, { files: [] })
			}
		},
		[respondToPickFiles],
	)

	const handleLocalFileInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			awaitingLocalFileDialogRef.current = false
			const request = filePickerRequest
			const files = Array.from(event.target.files || [])
			event.target.value = ""
			projectFileBatchItemsRef.current = []
			filePickerRequestRef.current = null
			setFilePickerRequest(null)
			if (!request) return
			if (!files.length) {
				respondToPickFiles(request.requestId, { files: [] })
				return
			}
			void pickPluginFiles(canvas, files, request.options).then(
				(files) => respondToPickFiles(request.requestId, { files }),
				(error) => respondToPickFiles(request.requestId, { error: getErrorMessage(error) }),
			)
		},
		[canvas, filePickerRequest, respondToPickFiles],
	)

	const handleFilePickerSourceSelect = useCallback((source: ReferenceResourceSourceType) => {
		awaitingLocalFileDialogRef.current = false
		projectFileBatchItemsRef.current = []
		if (source === REFERENCE_RESOURCE_SOURCE_TYPES.localUpload) {
			awaitingLocalFileDialogRef.current = true
			localFileInputRef.current?.click()
		}
	}, [])

	const handleProjectFileSelect = useCallback(
		(item: ReferenceResourcePanelItem, context?: ReferenceResourcePanelSelectContext) => {
			awaitingLocalFileDialogRef.current = false
			const request = filePickerRequest
			if (!request) return
			if (context?.batch) {
				const { index, total } = context.batch
				projectFileBatchItemsRef.current[index] = item
				if (index < total - 1) return
				const items = projectFileBatchItemsRef.current
					.slice(0, total)
					.filter(isReferenceResourcePanelItem)
				projectFileBatchItemsRef.current = []
				filePickerRequestRef.current = null
				setFilePickerRequest(null)
				context.reset?.()
				void Promise.all(
					items.map((selectedItem) =>
						resolveProjectPluginFile(canvas, selectedItem, request.options),
					),
				).then(
					(files) => respondToPickFiles(request.requestId, { files }),
					(error) =>
						respondToPickFiles(request.requestId, { error: getErrorMessage(error) }),
				)
				return
			}
			projectFileBatchItemsRef.current = []
			filePickerRequestRef.current = null
			setFilePickerRequest(null)
			context?.reset?.()
			void resolveProjectPluginFile(canvas, item, request.options).then(
				(file) => respondToPickFiles(request.requestId, { files: [file] }),
				(error) => respondToPickFiles(request.requestId, { error: getErrorMessage(error) }),
			)
		},
		[canvas, filePickerRequest, respondToPickFiles],
	)

	const handlePluginWindowPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
		(event) => {
			event.stopPropagation()
			if (event.target instanceof Node && !event.currentTarget.contains(event.target)) {
				return
			}
			const request = filePickerRequestRef.current
			if (!request || awaitingLocalFileDialogRef.current) return
			filePickerRequestRef.current = null
			setFilePickerRequest(null)
			respondToPickFiles(request.requestId, { files: [] })
		},
		[respondToPickFiles],
	)

	const handleHeaderPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
		if ((event.target as HTMLElement).closest("button")) return
		const currentPosition = positionRef.current
		draggingRef.current = true
		dragStartRef.current = {
			pointerX: event.clientX,
			pointerY: event.clientY,
			windowX: currentPosition.x,
			windowY: currentPosition.y,
		}
		event.currentTarget.setPointerCapture(event.pointerId)
		event.preventDefault()
	}, [])

	const handleHeaderPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>(
		(event) => {
			if (!draggingRef.current) return
			const nextX =
				dragStartRef.current.windowX + event.clientX - dragStartRef.current.pointerX
			const nextY =
				dragStartRef.current.windowY + event.clientY - dragStartRef.current.pointerY
			const nextPosition = clampPositionToContainer(
				{ x: nextX, y: nextY },
				canvas.container,
				pluginWindowRef.current,
			)
			positionRef.current = nextPosition
			setPosition(nextPosition)
		},
		[canvas.container],
	)

	const handleHeaderPointerUp = useCallback<PointerEventHandler<HTMLDivElement>>(() => {
		draggingRef.current = false
		saveCachedPosition(positionRef.current)
	}, [])

	const handleResizePointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>(
		(event) => {
			event.stopPropagation()
			onManualResizeStart()
			const currentSize = panelSizeRef.current
			resizingRef.current = true
			resizeStartRef.current = {
				pointerX: event.clientX,
				pointerY: event.clientY,
				width: currentSize.width,
				height: currentSize.height,
			}
			event.currentTarget.setPointerCapture(event.pointerId)
			event.preventDefault()
		},
		[onManualResizeStart],
	)

	const commitResize = useCallback(() => {
		if (!resizingRef.current) return
		resizingRef.current = false
		onManualResizeEnd(panelSizeRef.current)
		const currentPosition = positionRef.current
		const nextPosition = clampPositionToContainer(
			currentPosition,
			canvas.container,
			pluginWindowRef.current,
		)
		if (nextPosition.x === currentPosition.x && nextPosition.y === currentPosition.y) return
		positionRef.current = nextPosition
		setPosition(nextPosition)
		saveCachedPosition(nextPosition)
	}, [canvas.container, onManualResizeEnd])

	const handleResizePointerMove = useCallback<PointerEventHandler<HTMLButtonElement>>(
		(event) => {
			if (!resizingRef.current) return
			const nextSize = clampPluginPanelSize(
				{
					width:
						resizeStartRef.current.width +
						event.clientX -
						resizeStartRef.current.pointerX,
					height:
						resizeStartRef.current.height +
						event.clientY -
						resizeStartRef.current.pointerY,
				},
				getCurrentSizeBounds() ?? undefined,
			)
			panelSizeRef.current = nextSize
			setPanelSize(nextSize)
		},
		[getCurrentSizeBounds, setPanelSize],
	)

	const handleResizePointerEnd = useCallback<PointerEventHandler<HTMLButtonElement>>(
		(event) => {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId)
			}
			commitResize()
		},
		[commitResize],
	)

	return (
		<div
			ref={pluginWindowRef}
			className={styles.pluginWindow}
			style={{
				transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
				width: panelSize.width,
			}}
			data-canvas-ui-component
			data-canvas-plugin-window
			onPointerDown={handlePluginWindowPointerDown}
		>
			<input
				ref={localFileInputRef}
				type="file"
				accept={getPluginFilePickerAccept(filePickerRequest?.options)}
				multiple={Boolean(filePickerRequest?.options?.multiple)}
				className={styles.pluginFilePickerInput}
				onChange={handleLocalFileInputChange}
			/>
			<PluginFilePicker
				open={Boolean(filePickerRequest)}
				onOpenChange={handleFilePickerOpenChange}
				onSelectSource={handleFilePickerSourceSelect}
				onProjectSelect={handleProjectFileSelect}
				maxReferenceFiles={filePickerRequest?.options?.maxCount}
				maxProjectSelectBatchCount={
					filePickerRequest?.options?.multiple ? filePickerRequest.options.maxCount : 1
				}
				referenceResourceType={getPluginReferenceResourceType(filePickerRequest?.options)}
				anchorPosition={filePickerRequest?.anchorPosition}
			/>
			<PluginWindowHeader
				icon={pluginView.icon}
				label={pluginView.label}
				description={pluginView.description}
				onClose={handleClose}
				onPointerDown={handleHeaderPointerDown}
				onPointerMove={handleHeaderPointerMove}
				onPointerUp={handleHeaderPointerUp}
			/>

			{pluginView.srcDoc ? (
				<>
					<PluginRuntimeFrame
						ref={iframeRef}
						key={`${plugin.name}-${sessionId}`}
						height={panelSize.height}
						srcDoc={pluginView.srcDoc}
						title={pluginView.label}
					/>
					{/* 拖拽期间用透明层接管指针，避免 iframe 吃掉宿主侧 mousemove/mouseup。 */}
					{(isCanvasAssetDragActive || isProjectAttachmentDragActive) && (
						<div className={styles.canvasAssetDragShield} aria-hidden="true" />
					)}
				</>
			) : (
				<div
					className={styles.pluginRuntimeEmptyFrame}
					style={{ height: panelSize.height }}
				>
					<PluginRuntimeEmpty
						description={pluginView.description}
						label={pluginView.label}
					/>
				</div>
			)}
			<button
				type="button"
				className={styles.pluginWindowResizeHandle}
				aria-label="Resize plugin panel"
				onPointerDown={handleResizePointerDown}
				onPointerMove={handleResizePointerMove}
				onPointerUp={handleResizePointerEnd}
				onPointerCancel={handleResizePointerEnd}
			>
				<span className={styles.pluginWindowResizeHandleIcon} />
			</button>
			{canvasAssetDragGhost}
		</div>
	)
})
