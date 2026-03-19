/**
 * 内置插件导出
 */

// 插件类
export { SensitiveDataPlugin } from "./SensitiveDataPlugin"
export { DeduplicationPlugin } from "./DeduplicationPlugin"
export { ErrorParserPlugin } from "./ErrorParserPlugin"
export { ConsolePlugin } from "./ConsolePlugin"
export { ReporterPlugin } from "./ReporterPlugin"
export { FetchMonitorPlugin } from "./FetchMonitorPlugin"
export { ResourceMonitorPlugin } from "./ResourceMonitorPlugin"
export { ErrorMonitorPlugin } from "./ErrorMonitorPlugin"
export { PageDwellTimePlugin } from "./PageDwellTimePlugin"
export { DeviceMonitorPlugin } from "./DeviceMonitorPlugin"

// 插件工厂函数
export { createSensitiveDataPlugin } from "./SensitiveDataPlugin"
export { createDeduplicationPlugin } from "./DeduplicationPlugin"
export { createErrorParserPlugin } from "./ErrorParserPlugin"
export { createConsolePlugin } from "./ConsolePlugin"
export { createReporterPlugin } from "./ReporterPlugin"
export { createFetchMonitorPlugin } from "./FetchMonitorPlugin"
export { createResourceMonitorPlugin } from "./ResourceMonitorPlugin"
export { createErrorMonitorPlugin } from "./ErrorMonitorPlugin"
export { createPageDwellTimePlugin } from "./PageDwellTimePlugin"
export { createDeviceMonitorPlugin } from "./DeviceMonitorPlugin"

// 配置类型
export type { SensitiveDataPluginOptions } from "./SensitiveDataPlugin"
export type { DeduplicationPluginOptions } from "./DeduplicationPlugin"
export type { ErrorParserPluginOptions } from "./ErrorParserPlugin"
export type { ConsolePluginOptions } from "./ConsolePlugin"
export type { ReporterPluginOptions } from "./ReporterPlugin"
export type { FetchMonitorPluginOptions } from "./FetchMonitorPlugin"
export type { ResourceMonitorPluginOptions } from "./ResourceMonitorPlugin"
export type { ErrorMonitorPluginOptions } from "./ErrorMonitorPlugin"

// /**
//  * 内置插件工厂函数集合
//  */
// export const BuiltinPlugins = {
// 	sensitiveData: createSensitiveDataPlugin,
// 	deduplication: createDeduplicationPlugin,
// 	errorParser: createErrorParserPlugin,
// 	console: createConsolePlugin,
// 	reporter: createReporterPlugin,
// 	fetchMonitor: createFetchMonitorPlugin,
// 	resourceMonitor: createResourceMonitorPlugin,
// 	errorMonitor: createErrorMonitorPlugin,
// 	pageDwellTime: createPageDwellTimePlugin,
// }
//
// /**
//  * 创建默认插件集合
//  */
// export function createDefaultPlugins() {
// 	return [
// 		createErrorParserPlugin(),
// 		createSensitiveDataPlugin(),
// 		createDeduplicationPlugin(),
// 		createConsolePlugin(),
// 		createReporterPlugin(),
// 	]
// }
