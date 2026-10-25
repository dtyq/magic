import { loader } from "@monaco-editor/react"
import { env, isDev } from "@/utils/env"

/**
 * CDN 上部署的 Monaco 版本；与本地 `monaco-editor` 依赖版本解耦，升级依赖时不必同步改动这里。
 */
export const MONACO_CDN_VERSION = "0.52.2"

/** 开发环境由 Vite 同源提供本地依赖包，避免请求 CDN 被防盗链规则拒绝。 */
export const MONACO_DEV_VS_PATH = "/node_modules/monaco-editor/min/vs"

/**
 * 解析 Monaco AMD loader 的 `vs` 根路径。
 * 生产环境走 CDN；开发环境走本地依赖，因为 CDN 的防盗链规则只放行线上域名。
 */
export function resolveMonacoVsPath(dev: boolean, cdnHost: string | undefined): string {
	if (dev) return MONACO_DEV_VS_PATH

	const base = (cdnHost ?? "").trim().replace(/\/+$/, "")
	return `${base}/monaco-editor/${MONACO_CDN_VERSION}/min/vs`
}

/** Configure Monaco's CDN path once before the lazy editor components mount. */
export function configureMonacoLoader() {
	loader.config({
		paths: {
			vs: resolveMonacoVsPath(isDev, env("MAGIC_CDNHOST")),
		},
	})
}

configureMonacoLoader()
