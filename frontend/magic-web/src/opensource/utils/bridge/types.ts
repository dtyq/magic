/**
 * 桥接事件类型
 */
export const enum BridgeEventType {
	GetChartImage = "getChartImage",
	InjectChartOptions = "injectChartOptions",
	SwitchPage = "switchPage",
	InjectMindMapData = "injectMindMapData",
	GetMindMapImage = "getMindMapImage",
	InjectMermaidData = "injectMermaidData",
	GetMermaidImage = "getMermaidImage",
}

/**
 * 共享页面类型
 */
export const enum SharedPageType {
	Chart = "chart",
	MindMap = "mind_map",
	Mermaid = "mermaid",
}

/**
 * 桥接调用native事件
 */
export const enum BridgeCallNativeEvent {
	getChartImage = "GetChartImage",
	getMindMapImage = "GetMindMapImage",
	getMermaidImage = "GetMermaidImage",
}

/**
 * 桥接事件数据
 */
export type BridgeEventData = {
	[BridgeEventType.GetChartImage]: GetChartImageParams
	[BridgeEventType.InjectChartOptions]: InjectChartOptionsParams
	[BridgeEventType.SwitchPage]: SwitchPageParams
	[BridgeEventType.InjectMindMapData]: InjectMindMapDataParams
	[BridgeEventType.GetMindMapImage]: GetMindMapImageParams
	[BridgeEventType.InjectMermaidData]: InjectMermaidDataParams
	[BridgeEventType.GetMermaidImage]: GetMermaidImageParams
}

/**
 * 注入Mermaid数据参数
 */
export interface InjectMermaidDataParams {
	data: string
}

/**
 * 获取Mermaid图片参数
 */
export interface GetMermaidImageParams {
	data: string
	width: number
	height: number
}

/**
 * 获取思维导图图片参数
 */
export interface GetMindMapImageParams {
	data: string
	width: number
	height: number
}

/**
 * 注入思维导图数据参数
 */
export interface InjectMindMapDataParams {
	data: string
}

/**
 * 切换页面参数
 */
export interface SwitchPageParams {
	mode: SharedPageType
}

/**
 * 获取图表图片参数
 */
export interface GetChartImageParams {
	chartOptions: object
	width: number
	height: number
}

/**
 * 注入图表配置参数
 */
export interface InjectChartOptionsParams {
	chartOptions: object
}

export interface BridgeEvent<T extends BridgeEventType = BridgeEventType> {
	nativeDataResponse: BridgeEventData[T]
	nativeConfig: {
		appCallName: T
		requestId: string
		timeStamp: number
	}
}
export interface WebViewJavascriptBridge {
	init: (callback: (message: any, responseCallback: any) => void) => void
	callHandler: (nativeCallName: string, data: string) => void
	registerHandler: (
		nativeCallName: string,
		callback: (data: string, responseCallback: any) => void,
	) => void
	send: (message: string) => void
	didReadyIframe: () => void
}

declare global {
	interface Window {
		WebViewJavascriptBridge: WebViewJavascriptBridge
		bridge?: {
			callNative: (nativeCallName: string, data: any) => void
		}
		_AMapSecurityConfig?: {
			securityJsCode?: string
			serviceHost?: string
		}
	}
}
