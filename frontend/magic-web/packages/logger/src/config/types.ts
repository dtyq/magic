import type { IProviderConfig } from "../core/types"

/**
 * 火山引擎 APMPlus 特定配置
 */
export interface IVolcengineConfig extends IProviderConfig {
	type: "Volcengine"
	/** 应用 ID */
	aid: number
	/** SDK 插件配置 */
	plugins?: any[]
	/** 是否启用性能监控 */
	enablePerformance?: boolean
	/** 是否启用错误监控 */
	enableError?: boolean
}

/**
 * 阿里云 ARMS RUM 特定配置
 */
export interface IAliyunConfig extends IProviderConfig {
	type: "Aliyun"
	/** 站点 ID (Project ID) */
	pid: string
	/** RUM 数据上报端点 */
	endpoint?: string
	/** 应用版本号 */
	version?: string
	/** 是否启用 SPA 路由监听 */
	enableSPA?: boolean
	/** 是否发送资源加载信息 */
	sendResource?: boolean
	/** 资源类型标签 */
	tag?: string
}

/**
 * 配置联合类型
 */
export type ProviderConfig = IVolcengineConfig | IAliyunConfig
