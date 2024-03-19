import { useRef, forwardRef, useState, useCallback } from "react"
import UIProvider from "./components/ui/custom/UIProvider"
import Zoom from "./components/Zoom"
import Tools from "./components/Tools"
import Layers from "./components/Layers"
import ElementTools from "./components/ElementTools"
import { CanvasProvider, useCanvas } from "./context/CanvasContext"
import { CanvasUIProvider } from "./context/CanvasUIContext"
import { LayersUIProvider, useLayersUI } from "./context/LayersUIContext"
import { ElementMenuProvider } from "./components/ElementMenu/ElementMenuProvider"
import { useMount, useUnmount, useUpdateEffect } from "ahooks"
import { Canvas } from "./canvas/Canvas"
import ImageMessageEditor from "./components/ImageMessageEditor"
import MessageHistory from "./components/MessageHistory"
import { MagicProvider, useMagic } from "./context/MagicContext"
import { toPlainObject } from "./canvas/utils/utils"
import { PortalContainerProvider } from "./components/ui/custom/PortalContainerContext"
import { CanvasDesignI18nProvider } from "./context/I18nContext"
import type { CanvasDesignRef, CanvasDesignProps } from "./types"
import CanvasTips from "./components/CanvasTips"
import { FloatingUIProvider } from "./context/FloatingUIContext"
import { useCanvasDesignRef } from "./hooks/useCanvasDesignRef"
import { useCanvasEventListeners } from "./hooks/useCanvasEventListeners"

import styles from "./index.module.css"

const CanvasDesignContent = forwardRef<CanvasDesignRef, CanvasDesignProps>((props, ref) => {
	const { id, readonly = false, data = {}, marker = {}, viewport = {}, getIsMobile, t } = props

	const { defaultData, onCanvasDesignDataChange } = data

	const {
		defaultMarkers,
		beforeMarkerCreate,
		onMarkerCreated,
		onMarkerDeleted,
		onMarkerSelectChange,
		onMarkerUpdated,
		onMarkerRestored,
	} = marker

	const { autoLoadCacheViewport = true } = viewport

	const { canvas, setCanvas } = useCanvas()

	const { width: layersWidth, collapsed: layersCollapsed } = useLayersUI()

	const { methods, permissions } = useMagic()

	const canvasContainerRef = useRef<HTMLDivElement>(null)

	const canvasInstanceRef = useRef<Canvas | null>(null)

	// 处理 ref 方法暴露
	useCanvasDesignRef(ref)

	// 处理所有事件监听（onMarkerRestored 在 restoreMarkers 后直接调用，不通过画布事件）
	useCanvasEventListeners({
		readonly,
		methods,
		onMarkerSelectChange,
		beforeMarkerCreate,
		onMarkerCreated,
		onMarkerDeleted,
		onMarkerUpdated,
		onCanvasDesignDataChange,
	})

	// 更新视口偏移量
	const updateViewportOffset = useCallback(
		(instance: Canvas | null) => {
			if (!instance) return
			const left = layersCollapsed ? 0 : layersWidth + 8
			instance.viewportController.setDefaultViewportOffset({
				left,
				right: 0,
				top: 0,
				bottom: 0,
			})
		},
		[layersCollapsed, layersWidth],
	)

	useMount(() => {
		if (!canvasContainerRef.current) return
		const canvasInstance = new Canvas({
			element: canvasContainerRef.current,
			id,
			defaultReadyonly: readonly,
			magic: {
				methods: methods,
				permissions: permissions,
			},
			getIsMobile: getIsMobile,
			t: t,
		})

		setCanvas(canvasInstance)
		// 保存到 ref，确保卸载时能拿到实例
		canvasInstanceRef.current = canvasInstance
		updateViewportOffset(canvasInstance)

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
		setTimeout(() => {
			// 使用传入的 defaultCanvasData 或默认空数据
			// 兼容 useImmer 创建的 Proxy 对象，转换为普通对象
			canvasInstance.loadDocument(defaultData ? toPlainObject(defaultData) : { elements: [] })
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
		const canvasInstance = canvasInstanceRef.current
		if (!canvasInstance) return
		canvasInstance.destroy()
		canvasInstanceRef.current = null
		setCanvas(null)
	})

	useUpdateEffect(() => {
		canvas?.setReadonly(readonly)
	}, [readonly, canvas])

	useUpdateEffect(() => {
		canvas?.setT(t)
	}, [t, canvas])

	useUpdateEffect(() => {
		canvas?.updateIsMobileDevice(getIsMobile)
	}, [getIsMobile, canvas])

	useUpdateEffect(() => {
		canvas?.magicConfigManager.update({
			methods: methods,
			permissions: permissions,
		})
	}, [methods, permissions, canvas])

	useUpdateEffect(() => {
		updateViewportOffset(canvas)
	}, [layersCollapsed, layersWidth, canvas, updateViewportOffset])

	return (
		<FloatingUIProvider canvas={canvas}>
			<div ref={canvasContainerRef} className={styles.canvasContainer} />
			{!readonly && <ElementTools />}
			{!readonly && <ImageMessageEditor />}
			<MessageHistory />
			<Layers />
			{!readonly && <Tools />}
			{!readonly && <CanvasTips />}
			<Zoom />
		</FloatingUIProvider>
	)
})

CanvasDesignContent.displayName = "CanvasDesignContent"

const CanvasDesign = forwardRef<CanvasDesignRef, CanvasDesignProps>((props, ref) => {
	const { getIsMobile } = props

	const appContainerRef = useRef<HTMLDivElement>(null)

	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

	const setAppContainerRef = useCallback((node: HTMLDivElement | null) => {
		appContainerRef.current = node
		if (node) {
			setPortalContainer(node)
		}
	}, [])

	return (
		<MagicProvider
			methods={props.magic?.methods}
			permissions={props.magic?.permissions}
			imageFilesForMention={props.data?.imageFilesForMention}
			mentionDataServiceCtor={props.data?.mentionDataServiceCtor}
			mentionExtension={props.data?.mentionExtension}
		>
			<UIProvider>
				<CanvasDesignI18nProvider t={props.t}>
					<PortalContainerProvider value={portalContainer}>
						<div ref={setAppContainerRef} className={styles.appContainer}>
							<CanvasProvider>
								<CanvasUIProvider readonly={props.readonly}>
									<ElementMenuProvider>
										<LayersUIProvider getIsMobile={getIsMobile}>
											<CanvasDesignContent ref={ref} {...props} />
										</LayersUIProvider>
									</ElementMenuProvider>
								</CanvasUIProvider>
							</CanvasProvider>
						</div>
					</PortalContainerProvider>
				</CanvasDesignI18nProvider>
			</UIProvider>
		</MagicProvider>
	)
})

CanvasDesign.displayName = "CanvasDesign"

export default CanvasDesign
