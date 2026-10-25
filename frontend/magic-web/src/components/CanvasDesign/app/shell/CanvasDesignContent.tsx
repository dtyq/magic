import { useRef, forwardRef, useCallback, useEffect, useReducer } from "react"
import { useMount, useUnmount, useUpdateEffect } from "ahooks"
import ViewportControls from "../../ui/canvas-editor/viewport-controls"
import Tools from "../../ui/toolbar/index"
import Layers from "../../ui/layers/index"
import ElementToolTopSurface from "../../ui/element-tools/surfaces/ElementToolTopSurface"
import { useCanvas } from "../providers/CanvasProvider"
import { useCanvasPanelUI } from "../providers/CanvasUIProvider"
import { useLayersUI } from "../providers/LayersUIProvider"
import { Canvas } from "../../runtime/core/Canvas"
import ImageMessageEditor from "../../ui/element-tools/editors/image/index"
import VideoGenerateEditor from "../../ui/element-tools/editors/video/index"
import MessageHistory from "../../ui/panels/history/index"
import ContentVersionPanel from "../../ui/panels/content-version/index"
import VideoFullscreenOverlay from "../../ui/fullscreen/video/index"
import ImageElementFullscreenOverlay from "../../ui/fullscreen/image-element/index"
import AudioElementFullscreenOverlay from "../../ui/fullscreen/audio-element/index"
import MediaResourceFullscreenPreview from "../../ui/fullscreen/media-resource/index"
import { getCanvasResourceFileName } from "../../runtime/shared/path/canvasResourcePath"
import { useMagic } from "../providers/MagicProvider"
import { toPlainObject } from "../../runtime/shared/ids"
import type { CanvasDesignRef, CanvasDesignProps } from "../../public/props"
import CanvasTips from "../../ui/panels/tips/index"
import { FloatingUIProvider } from "../providers/FloatingUIProvider"
import { BottomFloatingStackProvider } from "../providers/BottomFloatingStackProvider"
import { useCanvasDesignRef } from "../hooks/canvas/useCanvasDesignRef"
import { useCanvasEventListeners } from "../hooks/canvas/useCanvasEventListeners"
import { useCanvasEvent } from "../hooks/canvas/useCanvasEvent"
import ImageCropPanel from "../../ui/panels/crop/index"
import ImageExtendPanel from "../../ui/panels/extend/index"
import ImageEraserPanel from "../../ui/panels/eraser/index"
import ElementRenameOverlay from "../../ui/panels/rename/index"
import ElementActionHints from "../../ui/panels/action-hints/index"
import PluginPanel from "../../ui/panels/plugin/window/index"
import ElementBottomToolbarHost from "../../ui/canvas-editor/element-bottom-toolbar/ElementBottomToolbarHost"
import {
	configureCanvasClipboardPasteHost,
	releaseCanvasClipboardPasteHost,
} from "../../runtime/resources/clipboard/CanvasClipboardPasteController"

import styles from "./index.module.css"

const CanvasDesignContent = forwardRef<CanvasDesignRef, CanvasDesignProps>((props, ref) => {
	const {
		id,
		accessMode,
		capabilities,
		data = {},
		marker = {},
		viewport = {},
		getDevice,
		t,
		nameLabelIconResolver,
		shareHostBottomChrome = false,
	} = props

	const {
		defaultData,
		elementDetailsProvenance,
		onElementDetailsProvenanceChange,
		onCanvasDesignDataChange,
		onCanvasDesignDataPatchChange,
		onSelectionChange,
		elementActionHints,
		onElementActionHintAction,
		connectionActionHints,
		onConnectionActionHintAction,
	} = data

	const {
		defaultMarkers,
		beforeMarkerCreate,
		onMarkerCreated,
		onMarkerDeleted,
		onMarkerUpdated,
		onMarkerRestored,
	} = marker

	const { autoLoadCacheViewport = true, floatingBoundary = null } = viewport

	const { canvas, setCanvas } = useCanvas()

	const { width: layersWidth, collapsed: layersCollapsed } = useLayersUI()

	const { methods, permissions } = useMagic()
	const [, forcePermissionUpdate] = useReducer((value: number) => value + 1, 0)
	useCanvasEvent("permission:changed", () => forcePermissionUpdate(), [])
	const resolvedAccessMode = accessMode ?? "edit"
	const canWrite = canvas?.permissionManager?.can("document.write") ?? false
	const canGenerate = canvas?.permissionManager?.can("sideEffect.generate") ?? false

	useEffect(() => {
		const controller = configureCanvasClipboardPasteHost(methods)
		return () => releaseCanvasClipboardPasteHost(controller)
	}, [methods])

	const {
		fullscreenMediaElement,
		setFullscreenMediaElement,
		storyboardReferenceImagePreview,
		setStoryboardReferenceImagePreview,
	} = useCanvasPanelUI()

	const canvasContainerRef = useRef<HTMLDivElement>(null)

	const canvasInstanceRef = useRef<Canvas | null>(null)
	const loadDocumentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// 处理 ref 方法暴露
	useCanvasDesignRef(ref)

	// 处理所有事件监听（onMarkerRestored 在 restoreMarkers 后直接调用，不通过画布事件）
	useCanvasEventListeners({
		methods,
		beforeMarkerCreate,
		onMarkerCreated,
		onMarkerDeleted,
		onMarkerUpdated,
		onCanvasDesignDataChange,
		onCanvasDesignDataPatchChange,
		onSelectionChange,
	})

	// 更新视口偏移量
	const updatePadding = useCallback(
		(instance: Canvas | null, options?: { preserveViewportCenter?: boolean }) => {
			if (!instance) return
			const left = layersCollapsed ? 0 : layersWidth + 8
			instance.viewportController.setDefaultViewportPadding(
				{
					left,
					right: 0,
					top: 0,
					bottom: 0,
				},
				options,
			)
		},
		[layersCollapsed, layersWidth],
	)

	useMount(() => {
		const designProjectId = id.trim()
		if (!designProjectId) {
			throw new Error("CanvasDesign: id is required as designProjectId.")
		}
		if (!canvasContainerRef.current) return
		const scopeElement = canvasContainerRef.current.closest("[data-canvas-ui-component]")
		const canvasInstance = new Canvas({
			element: canvasContainerRef.current,
			scopeElement:
				scopeElement instanceof HTMLElement ? scopeElement : canvasContainerRef.current,
			id: designProjectId,
			accessMode: resolvedAccessMode,
			capabilities,
			plugins: props.plugins,
			nameLabelIconResolver,
			magic: {
				methods: methods,
				permissions: permissions,
			},
			getDevice: getDevice,
			t: t,
		})
		canvasInstance.elementDetailsRuntimeManager.setOnChange(onElementDetailsProvenanceChange)

		setCanvas(canvasInstance)
		// 保存到 ref，确保卸载时能拿到实例
		canvasInstanceRef.current = canvasInstance
		updatePadding(canvasInstance)

		// 监听 document:loaded 事件，恢复 markers
		canvasInstance.eventEmitter.once("document:loaded", () => {
			// 恢复 markers
			if (defaultMarkers?.length) {
				canvasInstance.markerManager.restoreMarkers(defaultMarkers)
				// 直接回调，无需监听画布事件（数据本就来自父组件）
				const actualMarkers = canvasInstance.markerManager.exportMarkers()
				onMarkerRestored?.(actualMarkers)
			}
		})

		// 确保react层事件都监听了, 再初始化
		loadDocumentTimerRef.current = setTimeout(() => {
			loadDocumentTimerRef.current = null
			if (canvasInstanceRef.current !== canvasInstance) {
				return
			}
			// 使用传入的 defaultCanvasData 或默认空数据
			// 兼容 useImmer 创建的 Proxy 对象，转换为普通对象
			canvasInstance.loadDocument(
				defaultData ? toPlainObject(defaultData) : { elements: [] },
				{ elementDetailsProvenance },
			)
			// 从 storage 读取 viewport 信息并加载
			if (methods?.getStorage) {
				const storageData = methods.getStorage()
				if (autoLoadCacheViewport) {
					if (storageData?.viewport) {
						canvasInstance.loadViewport(storageData.viewport)
					} else {
						canvasInstance.viewportController.fitToScreen()
					}
				}
			}
		}, 10)
	})

	useUnmount(() => {
		if (loadDocumentTimerRef.current) {
			clearTimeout(loadDocumentTimerRef.current)
			loadDocumentTimerRef.current = null
		}
		const canvasInstance = canvasInstanceRef.current
		if (!canvasInstance) return
		canvasInstance.destroy()
		canvasInstanceRef.current = null
		setCanvas(null)
	})

	useUpdateEffect(() => {
		canvas?.setAccessContext({
			mode: resolvedAccessMode,
			capabilities: capabilities ?? {},
		})
	}, [resolvedAccessMode, capabilities, canvas])

	useUpdateEffect(() => {
		canvas?.setT(t)
	}, [t, canvas])

	useUpdateEffect(() => {
		canvas?.elementDetailsRuntimeManager.setOnChange(onElementDetailsProvenanceChange)
	}, [canvas, onElementDetailsProvenanceChange])

	useUpdateEffect(() => {
		canvas?.updateDeviceInfo(getDevice)
	}, [getDevice, canvas])

	useUpdateEffect(() => {
		const updateResult = canvas?.magicConfigManager.update({
			methods: methods,
			permissions: permissions,
		})
		if (updateResult?.resourceReferenceResolverChanged) {
			canvas?.handleResourceReferenceResolverChanged({
				changedWorkspacePaths: updateResult.resourceReferenceChangedPaths,
			})
		}
		canvas?.invalidateMagicModelListCaches()
	}, [methods, permissions, canvas, t])

	useUpdateEffect(() => {
		updatePadding(canvas, { preserveViewportCenter: true })
	}, [layersCollapsed, layersWidth, canvas, updatePadding])

	return (
		<FloatingUIProvider canvas={canvas} floatingBoundary={floatingBoundary}>
			<BottomFloatingStackProvider>
				<div ref={canvasContainerRef} className={styles.canvasContainer} />
				<ElementActionHints
					hints={elementActionHints}
					onAction={onElementActionHintAction}
					connectionHints={connectionActionHints}
					onConnectionAction={onConnectionActionHintAction}
				/>
				<ElementToolTopSurface />
				{canGenerate && <ImageMessageEditor />}
				{canGenerate && <VideoGenerateEditor />}
				<ElementBottomToolbarHost />
				{canWrite && <ImageCropPanel />}
				{canWrite && <ImageExtendPanel />}
				{canWrite && <ImageEraserPanel />}
				<MessageHistory />
				<ContentVersionPanel />
				{/* Keep rename after editor surfaces so its temporary z-index promotion wins ties. */}
				{canWrite && <ElementRenameOverlay />}
				{fullscreenMediaElement?.type === "video" ? (
					<VideoFullscreenOverlay
						elementId={fullscreenMediaElement.elementId}
						onClose={() => setFullscreenMediaElement(null)}
					/>
				) : null}
				{fullscreenMediaElement?.type === "image" ? (
					<ImageElementFullscreenOverlay
						elementId={fullscreenMediaElement.elementId}
						onClose={() => setFullscreenMediaElement(null)}
					/>
				) : null}
				{fullscreenMediaElement?.type === "audio" ? (
					<AudioElementFullscreenOverlay
						elementId={fullscreenMediaElement.elementId}
						onClose={() => setFullscreenMediaElement(null)}
					/>
				) : null}
				{storyboardReferenceImagePreview ? (
					<MediaResourceFullscreenPreview
						resource={{
							kind: "image",
							path: storyboardReferenceImagePreview.path,
							fileName:
								getCanvasResourceFileName(storyboardReferenceImagePreview.path) ||
								storyboardReferenceImagePreview.path,
							crop: storyboardReferenceImagePreview.crop,
						}}
						onClose={() => setStoryboardReferenceImagePreview(null)}
					/>
				) : null}
				<Layers />
				{canWrite && <Tools />}
				{canGenerate && <PluginPanel />}
				{canWrite && <CanvasTips />}
				<ViewportControls shareHostBottomChrome={shareHostBottomChrome} />
			</BottomFloatingStackProvider>
		</FloatingUIProvider>
	)
})

export default CanvasDesignContent
