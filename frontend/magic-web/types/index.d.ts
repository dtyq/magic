import "./env"
import "./theme"
import "./assets"
import "./react-router"
import type {
	MagicElectron,
	MagicMediaElectron,
	MagicScreenshotElectron,
	MagicSearchElectron,
} from "./electron"
import { DingTalk, DingTalkSDKAPI } from "./dingTalk"
import type { Lark } from "./lark"
import "vite-plugin-pwa/client"
import "vite-plugin-pwa/info"

declare global {
	interface Window {
		/** 主应用视窗 */
		magic: MagicElectron.MagicElectronAPI
		/** 多媒体视窗 */
		magicMedia: MagicMediaElectron.MagicMediaElectronAPI
		/** 全局截图视窗 */
		magicScreenshot: MagicScreenshotElectron.MagicScreenshotElectronAPI
		/** 全局搜索视窗 */
		magicSearch: MagicSearchElectron.MagicSearchElectronAPI

		// 临时设置开发者模式
		setDebug?: (debug: boolean) => void

		/**
		 * 第三方 SDK API
		 */
		/** 钉钉扫码登录API */
		DTFrameLogin: DingTalk.DTFrameLoginAPI
		/** 飞书扫码登录API */
		QRLogin: Lark.LarkQRLogin
		/** 飞书免登SDK */
		tt: Lark.LarkSDK
		/** 钉钉SDK */
		dd: DingTalk.DingTalkSDKAPI
	}
}
