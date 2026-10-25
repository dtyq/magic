import {
	type Dispatch,
	type MutableRefObject,
	type RefObject,
	type SetStateAction,
	useEffect,
} from "react"
import { toast } from "sonner"
import type { Canvas } from "../../../../runtime/core/Canvas"
import type { CanvasDesignPlugin } from "../../../../runtime/document/types"
import {
	getPluginRuntimeMessageCapability,
	PLUGIN_RUNTIME_MESSAGE_TYPE,
	PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE,
	PLUGIN_RUNTIME_RESULT_TYPE_BY_MESSAGE_TYPE,
	parsePluginRuntimeMessage,
	pluginHasCapability,
	type PluginPoint,
	type PluginRuntimeMessage,
} from "../runtime-protocol/v1/index"
import {
	hydratePluginFileAssetSources,
	registerPluginClipboardSourceElements,
	registerPluginFileAssetSources,
	type PluginSourceElementMap,
} from "../window/pluginSourceElements"
import { PLUGIN_IFRAME_TARGET_ORIGIN, PLUGIN_WINDOW_MARGIN } from "../window/constants"
import type { PluginFileAsset, PluginFilePickerRequest } from "../window/types"
import { clampPluginPanelHeight } from "../window/position"
import { resolvePluginResource, getErrorMessage } from "../assets/resourceUtils"
import { pickPluginFiles, resolvePluginFileAssets } from "../assets/fileAssets"
import { readPluginCanvasClipboard } from "../window/readPluginCanvasClipboard"
import { generatePluginImages, getPluginImageModels } from "../generation/imageGeneration"
import { completePluginImagePrompt } from "../generation/imagePromptCompletion"
import {
	resolvePluginStorageKey,
	resolveSharedGenerationConfigStorageKey,
} from "../storage/pluginStorage"
import { validatePluginFetchBlobUrl } from "../assets/pluginFetchBlob"

interface UsePluginRuntimeBridgeParams {
	/* 是否正在等待本地文件对话框 */
	awaitingLocalFileDialogRef: MutableRefObject<boolean>
	/** 画布 */
	canvas: Canvas
	/** 通道 token */
	channelToken: string
	/** 文件选择器请求引用 */
	filePickerRequestRef: MutableRefObject<PluginFilePickerRequest | null>
	/** iframe 引用 */
	iframeRef: RefObject<HTMLIFrameElement | null>
	/** 插件 */
	plugin: CanvasDesignPlugin
	/** 插件窗口引用 */
	pluginWindowRef: RefObject<HTMLDivElement | null>
	/** 插件 iframe 上报画布图片拖拽投放目标时，由 PluginWindow 透传给专门的拖拽 hook */
	onCanvasAssetDragTarget?: (
		target: Extract<
			PluginRuntimeMessage,
			{ type: typeof PLUGIN_RUNTIME_MESSAGE_TYPE.CanvasAssetDragTarget }
		>,
	) => void
	/** 设置文件选择器请求 */
	setFilePickerRequest: Dispatch<SetStateAction<PluginFilePickerRequest | null>>
	/** 插件来源元素映射 */
	sourceElementByAssetKeyRef: MutableRefObject<PluginSourceElementMap>
	/** 设置框架高度 */
	setFrameHeight: (height: number) => void
}

export function usePluginRuntimeBridge({
	awaitingLocalFileDialogRef,
	canvas,
	channelToken,
	filePickerRequestRef,
	iframeRef,
	plugin,
	pluginWindowRef,
	onCanvasAssetDragTarget,
	setFilePickerRequest,
	sourceElementByAssetKeyRef,
	setFrameHeight,
}: UsePluginRuntimeBridgeParams) {
	useEffect(() => {
		const postPluginMessage = (message: Record<string, unknown>, transfer?: Transferable[]) => {
			iframeRef.current?.contentWindow?.postMessage(
				{
					channelToken,
					...message,
				},
				PLUGIN_IFRAME_TARGET_ORIGIN,
				transfer,
			)
		}
		const respondToRequest = (
			request: PluginFilePickerRequest,
			result: { files?: PluginFileAsset[]; error?: string },
		) => {
			postPluginMessage({
				type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.PickFiles,
				requestId: request.requestId,
				...result,
			})
		}

		const rejectMissingCapability = (data: PluginRuntimeMessage, capability: string) => {
			const resultType =
				PLUGIN_RUNTIME_RESULT_TYPE_BY_MESSAGE_TYPE[
					data.type as keyof typeof PLUGIN_RUNTIME_RESULT_TYPE_BY_MESSAGE_TYPE
				]
			const message = `Plugin capability not declared: ${capability}`
			console.warn(`[PluginPanel] ${message}`, plugin.name)
			if (resultType && "requestId" in data) {
				postPluginMessage({
					type: resultType,
					requestId: data.requestId,
					error: message,
				})
			}
		}

		const withPluginStorageKey = (key: string): string => {
			return resolvePluginStorageKey(plugin.name, key)
		}

		const sharedGenerationConfigStorageKey = resolveSharedGenerationConfigStorageKey()

		const closeFilePicker = () => {
			const request = filePickerRequestRef.current
			if (!request || awaitingLocalFileDialogRef.current) return
			filePickerRequestRef.current = null
			setFilePickerRequest(null)
			respondToRequest(request, { files: [] })
		}

		const handleMessage = (event: MessageEvent<unknown>) => {
			if (event.source !== iframeRef.current?.contentWindow) return
			const data = parsePluginRuntimeMessage(event.data, channelToken)
			if (!data) return
			const capability = getPluginRuntimeMessageCapability(data.type)
			if (capability && !pluginHasCapability(plugin, capability)) {
				rejectMissingCapability(data, capability)
				return
			}

			switch (data.type) {
				case PLUGIN_RUNTIME_MESSAGE_TYPE.SetHeight:
					setFrameHeight(clampPluginPanelHeight(data.height))
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.Close:
					canvas.pluginManager.close(plugin.name)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.ResolveResource:
					void resolvePluginResource(plugin, data.path).then(
						(url) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.ResolveResource,
								requestId: data.requestId,
								url,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.ResolveResource,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.PickFiles: {
					const request = {
						requestId: data.requestId,
						options: data.options,
						anchorPosition: resolvePluginFilePickerAnchorPosition(
							iframeRef.current,
							pluginWindowRef.current,
							data.triggerPoint,
						),
					}
					filePickerRequestRef.current = request
					setFilePickerRequest(request)
					return
				}
				case PLUGIN_RUNTIME_MESSAGE_TYPE.PointerDown:
					closeFilePicker()
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.CanvasAssetDragTarget:
					// 该消息是拖拽过程中的高频状态同步，交给外部拖拽 hook 维护当前 drop 目标。
					onCanvasAssetDragTarget?.(data)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.GetImageModels:
					void getPluginImageModels(canvas).then(
						(models) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.GetImageModels,
								requestId: data.requestId,
								models,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.GetImageModels,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.GenerateAndPlace:
					// 生成落点需要知道 reference 对应哪张画布图，这里把窗口级来源映射交给生成模块解析。
					void generatePluginImages(canvas, data.params, {
						sourceElementByAssetKey: sourceElementByAssetKeyRef.current,
					}).then(
						(result) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.GenerateAndPlace,
								requestId: data.requestId,
								result,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.GenerateAndPlace,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.CompleteImagePrompt:
					void completePluginImagePrompt(canvas, data.params).then(
						(result) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.CompleteImagePrompt,
								requestId: data.requestId,
								result,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.CompleteImagePrompt,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.UploadFile: {
					const file = new File([data.arrayBuffer], data.fileName, {
						type: data.mimeType,
					})
					void pickPluginFiles(canvas, [file], { type: "image" }).then(
						(files) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.UploadFile,
								requestId: data.requestId,
								file: files[0] ?? null,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.UploadFile,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				}
				case PLUGIN_RUNTIME_MESSAGE_TYPE.ResolveFileAssets:
					void resolvePluginFileAssets(canvas, data.files, data.options).then(
						(files) => {
							// resolve 过程会把插件传入的 path 转成新的 asset，补回来源元素后才能用于生成图贴源放置。
							const filesWithSources = hydratePluginFileAssetSources(
								sourceElementByAssetKeyRef.current,
								files,
								canvas.magicConfigManager.config?.methods?.resolveResourceReference,
							)
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.ResolveFileAssets,
								requestId: data.requestId,
								files: filesWithSources,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.ResolveFileAssets,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.ReadCanvasClipboard:
					void readPluginCanvasClipboard(canvas).then(
						(result) => {
							// 剪贴板读出的 payload 与上传后的 asset 都登记来源，覆盖“先读剪贴板再生成”的链路。
							registerPluginClipboardSourceElements(
								sourceElementByAssetKeyRef.current,
								result.payload,
								canvas.magicConfigManager.config?.methods?.resolveResourceReference,
							)
							registerPluginFileAssetSources(
								sourceElementByAssetKeyRef.current,
								result.uploadedAssets,
								canvas.magicConfigManager.config?.methods?.resolveResourceReference,
							)
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.ReadCanvasClipboard,
								requestId: data.requestId,
								payload: result.payload,
								uploadedAssets: result.uploadedAssets,
							})
						},
						(error) => {
							postPluginMessage({
								type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.ReadCanvasClipboard,
								requestId: data.requestId,
								error: getErrorMessage(error),
							})
						},
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.FetchBlob: {
					let validatedUrl: URL
					try {
						validatedUrl = validatePluginFetchBlobUrl(
							plugin,
							data.url,
							window.location.origin,
						)
					} catch (error) {
						postPluginMessage({
							type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.FetchBlob,
							requestId: data.requestId,
							error: getErrorMessage(error),
						})
						return
					}

					void fetch(validatedUrl.toString())
						.then((r) => r.arrayBuffer())
						.then(
							(arrayBuffer) => {
								postPluginMessage(
									{
										type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.FetchBlob,
										requestId: data.requestId,
										arrayBuffer,
									},
									[arrayBuffer],
								)
							},
							(error) => {
								postPluginMessage({
									type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.FetchBlob,
									requestId: data.requestId,
									error: getErrorMessage(error),
								})
							},
						)
					return
				}
				case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageGet:
				case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageSet:
				case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageRemove:
				case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageGetSharedGenerationConfig:
				case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageSetSharedGenerationConfig:
				case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageRemoveSharedGenerationConfig:
					handlePluginStorageMessage(
						data,
						withPluginStorageKey,
						sharedGenerationConfigStorageKey,
						postPluginMessage,
					)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.Error:
					toast.error(data.message)
					return
				case PLUGIN_RUNTIME_MESSAGE_TYPE.Toast:
					showPluginToast(data)
					return
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [
		awaitingLocalFileDialogRef,
		canvas,
		channelToken,
		filePickerRequestRef,
		iframeRef,
		onCanvasAssetDragTarget,
		plugin,
		sourceElementByAssetKeyRef,
		pluginWindowRef,
		setFilePickerRequest,
		setFrameHeight,
	])
}

function handlePluginStorageMessage(
	data: Extract<
		PluginRuntimeMessage,
		{
			requestId: string
			type:
				| typeof PLUGIN_RUNTIME_MESSAGE_TYPE.StorageGet
				| typeof PLUGIN_RUNTIME_MESSAGE_TYPE.StorageSet
				| typeof PLUGIN_RUNTIME_MESSAGE_TYPE.StorageRemove
				| typeof PLUGIN_RUNTIME_MESSAGE_TYPE.StorageGetSharedGenerationConfig
				| typeof PLUGIN_RUNTIME_MESSAGE_TYPE.StorageSetSharedGenerationConfig
				| typeof PLUGIN_RUNTIME_MESSAGE_TYPE.StorageRemoveSharedGenerationConfig
		}
	>,
	resolveStorageKey: (key: string) => string,
	sharedGenerationConfigStorageKey: string,
	postPluginMessage: (message: Record<string, unknown>, transfer?: Transferable[]) => void,
) {
	const resultType =
		PLUGIN_RUNTIME_RESULT_TYPE_BY_MESSAGE_TYPE[
			data.type as keyof typeof PLUGIN_RUNTIME_RESULT_TYPE_BY_MESSAGE_TYPE
		]
	try {
		switch (data.type) {
			case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageGet:
				postPluginMessage({
					type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.StorageGet,
					requestId: data.requestId,
					value: window.localStorage.getItem(resolveStorageKey(data.key)),
				})
				return
			case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageSet:
				window.localStorage.setItem(resolveStorageKey(data.key), data.value)
				postPluginMessage({
					type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.StorageSet,
					requestId: data.requestId,
				})
				return
			case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageRemove:
				window.localStorage.removeItem(resolveStorageKey(data.key))
				postPluginMessage({
					type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.StorageRemove,
					requestId: data.requestId,
				})
				return
			case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageGetSharedGenerationConfig:
				postPluginMessage({
					type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.StorageGetSharedGenerationConfig,
					requestId: data.requestId,
					value: window.localStorage.getItem(sharedGenerationConfigStorageKey),
				})
				return
			case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageSetSharedGenerationConfig:
				window.localStorage.setItem(sharedGenerationConfigStorageKey, data.value)
				postPluginMessage({
					type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.StorageSetSharedGenerationConfig,
					requestId: data.requestId,
				})
				return
			case PLUGIN_RUNTIME_MESSAGE_TYPE.StorageRemoveSharedGenerationConfig:
				window.localStorage.removeItem(sharedGenerationConfigStorageKey)
				postPluginMessage({
					type: PLUGIN_RUNTIME_RESULT_MESSAGE_TYPE.StorageRemoveSharedGenerationConfig,
					requestId: data.requestId,
				})
				return
		}
	} catch (error) {
		postPluginMessage({
			type: resultType,
			requestId: data.requestId,
			error: getErrorMessage(error),
		})
	}
}

function showPluginToast(
	data: Extract<PluginRuntimeMessage, { type: typeof PLUGIN_RUNTIME_MESSAGE_TYPE.Toast }>,
) {
	const toastType = data.toastType ?? "info"
	if (toastType === "success") {
		toast.success(data.message)
		return
	}
	if (toastType === "warning") {
		toast.warning(data.message)
		return
	}
	if (toastType === "error") {
		toast.error(data.message)
		return
	}
	toast(data.message)
}

function resolvePluginFilePickerAnchorPosition(
	iframe: HTMLIFrameElement | null,
	pluginWindow: HTMLDivElement | null,
	triggerPoint?: PluginPoint,
): PluginPoint | undefined {
	if (!iframe || !pluginWindow || !triggerPoint) return undefined
	const iframeRect = iframe.getBoundingClientRect()
	const pluginWindowRect = pluginWindow.getBoundingClientRect()
	const x = iframeRect.left + triggerPoint.x - pluginWindowRect.left
	const y = iframeRect.top + triggerPoint.y - pluginWindowRect.top
	return {
		x: Math.min(
			Math.max(PLUGIN_WINDOW_MARGIN, x),
			pluginWindowRect.width - PLUGIN_WINDOW_MARGIN,
		),
		y: Math.min(
			Math.max(PLUGIN_WINDOW_MARGIN, y),
			pluginWindowRect.height - PLUGIN_WINDOW_MARGIN,
		),
	}
}
