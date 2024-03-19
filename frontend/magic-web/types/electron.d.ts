// types/electron.d.ts
import type { DesktopCapturerSource, Display, IpcRenderer } from "electron"
import type { FileTypeResult } from "file-type"
import type { ThemeMode } from "antd-style"

/** 媒体视窗模块 */
export namespace MagicMediaElectron {
	/** 多媒体信息 */
	export interface MediaInfo {
		/** 多媒体数据 */
		media: Array<string>
		/** 当前预览第几张 */
		index?: number
	}

	/** electron 多媒体视窗 API */
	export interface MagicMediaElectronAPI {
		media: {
			getMedia: () => Promise<MediaInfo>
		}
	}
}

export namespace MagicScreenshotElectron {
	/** electron 全局截屏视窗 API - 结果 */
	interface GetScreenResult {
		/** 视窗 */
		sources: Array<DesktopCapturerSource>
		/** 屏幕 */
		displays: Array<Display>
	}

	/** electron 全局截屏视窗 API */
	export interface MagicScreenshotElectronAPI {
		getScreen: () => GetScreenResult
	}
}

/** 全局搜索模块 */
export namespace MagicSearchElectron {
	/** electron 全局搜索视窗 API */
	export interface MagicSearchElectronAPI {}
}

/** 全局主应用模块 */
export namespace MagicElectron {
	export interface ShortcutConfig {
		/** 全局搜索快捷键 */
		globalSearch?: null | Array<number>
	}

	/** 应用信息 */
	export interface ApplicationInfo {
		name: string
		archKind: string
		lastModified: string
		obtainedFrom: string
		path: string
		signedBy: Array<string>
		version: string
		icon: string
	}

	interface MacInfo {
		/** 应用名称 */
		appName: string
		/** 应用版本 */
		appVersion: string
		/** 设备所在用户名称 */
		hostname: string
		/** 设备唯一码 */
		mac: string
		/** 设备信息 */
		systemVersion: string
	}

	/** electron 主应用视窗 */
	export interface MagicElectronAPI {
		/** 环境模块 */
		env: {
			/** 是否为 linux 环境 */
			isLinux: () => boolean
			/** 是否为 macOS 环境 */
			isMacOS: () => boolean
			/** 是否为 window 环境 */
			isWindows: () => boolean
			/** 是否为 electron 环境 */
			isElectron: () => boolean
		}
		/** 系统模块 */
		os: {
			getSystemInfo: () => Promise<MacInfo>
			getScreenInfo: () => Promise<{
				source: Array<DesktopCapturerSource>
				displays: Array<Display>
			}>
		}
		/** 应用模块 */
		app: {
			queryApplications: () => Promise<Array<ApplicationInfo>>
			openApplication: (appInfo: ApplicationInfo) => void
		}
		/** 全局配置模块 */
		config: {
			/** 快捷键管理 */
			globalShortcut: {
				/** 获取所有的注册快捷键配置 */
				getRegisterAll: () => Promise<Array<ConfigModal>>
				/** 注册所有快捷键绑定 */
				register: (config: MagicElectron.ShortcutConfig) => void
				/** 注销单个快捷键绑定 */
				unregister: (name: null | Array<number>) => void
				/** 移除全部快捷键绑定 */
				unregisterAll: () => void
			}
		}
		/** 多媒体模块 */
		media: {
			/** 多媒体预览 */
			previewMedia: (params: {
				messageId: string | undefined
				conversationId: string | undefined
				fileId?: string
				fileName?: string
				fileSize?: number
				index?: number
				url?: string
				ext?:
					| Partial<FileTypeResult>
					| { ext?: "svg"; mime?: "image/svg+xml" }
					| { ext?: string; mime?: string }
				/** 是否独立显示 */
				standalone?: boolean
				useHDImage?: boolean
			}) => void
		}
		/** 国际化语言模块 */
		language: {
			/** 订阅语言的变更 */
			subscribe: (callback: (lang: string) => void) => () => void
			getLanguage: () => Promise<string>
			setLanguage: (lang: string) => void
		}
		/** 应用主题模块 */
		theme: {
			/** 订阅语言的变更 */
			subscribe: (callback: (theme: ThemeMode) => void) => () => void
			getTheme: () => Promise<string>
			setTheme: (theme: string) => void
		}
		/** 全局扩展能力模块 */
		extend: {}
		/** 日志模块 */
		log: {
			report: (log: string | Array<any> | Record<any, any> | Error) => Promise<void>
			query: (query?: MagicCore.LogsQuery) => Promise<Array<MagicCore.Log>>
		}
		/** 窗口视图模块 */
		view: {
			/** 显示回调 */
			onShow: (callback: () => void) => () => void
			/** 隐藏回调 */
			onHide: (callback: () => void) => () => void
			/** 最小化视窗 */
			minimize: () => void
			/** 最大化视窗 */
			maximize: () => void
			/** 关闭视窗 */
			close: () => void
			/** 全屏展示 */
			endFullScreen: () => void
			/** 显示视窗 */
			show: () => void
			/** 隐藏视窗 */
			hide: () => void
			/** 设置视窗高度 */
			setViewSize: (size: { height: number; width: number }) => void
			/** 设置视窗位置 */
			setViewPosition: (position: { x: number; y: number }) => void
			/** 设置视窗位置V2 */
			setViewPositionV2: (position: { x: number; y: number }) => void
		}
	}
}
