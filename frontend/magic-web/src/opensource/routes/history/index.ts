import type { Blocker, Listener } from "history"
import { getRoutePath, routesMatch, convertSearchParams } from "./helpers"
import type { RouteParams } from "./types"
import { RouteName } from "@/opensource/routes/constants"
import { configStore } from "@/opensource/models/config"
import { defaultClusterCode } from "@/opensource/routes/helpers"
import { matchPath } from "react-router"
import { baseHistory } from "./baseHistory"
import { isString } from "lodash-es"
import { logger as Logger } from "@/opensource/utils/log"
import { whiteListRoutes } from "../const/whiteRoutes"
import { getHistoryStackTracker } from "./historyStackTracker"

const logger = Logger.createLogger("route")

export { baseHistory }

// 防止死循环的状态追踪
let isRedirecting = false
let lastRedirectPath: string | null = null
let redirectCount = 0
const MAX_REDIRECT_COUNT = 3

// 初始化 history 堆栈跟踪器（仅在开发环境）
if (process.env.NODE_ENV === "development") {
	getHistoryStackTracker()
}

// 重置重定向状态
function resetRedirectState() {
	isRedirecting = false
	lastRedirectPath = null
	redirectCount = 0
}

// 延迟重置重定向状态
function delayedResetRedirectState() {
	setTimeout(() => {
		resetRedirectState()
	}, 50) // 0.1秒后重置状态
}

// const whiteListRoutes = [
// 	/** 知识库预览 */
// 	"/:clusterCode/knowledge/preview/*",
// 	/** 云文档 */
// 	"/:clusterCode/docx/*",
// 	/** 白板 */
// 	"/:clusterCode/whiteboard/*",
// 	/** Office文档 */
// 	"/:clusterCode/office/*",
// 	/** 多维表格 */
// 	"/:clusterCode/base/*",
// 	/** 多维表格表单视图 */
// 	"/:clusterCode/form/*",
// 	/** 知识库目录 */
// 	"/:clusterCode/knowledge/directory/*",
// 	/** 文件 */
// 	"/:clusterCode/file/*",
// ]

baseHistory.listen(({ location, action }) => {
	// 只处理POP操作（浏览器前进/后退）
	if (action === "POP") {
		// 防止死循环：如果正在重定向中，跳过处理
		if (isRedirecting) {
			console.log("跳过处理：正在重定向中")
			return
		}

		// 防止重复重定向到相同路径
		if (lastRedirectPath === location.pathname) {
			console.log("跳过处理：重复重定向到相同路径")
			delayedResetRedirectState()
			return
		}

		// 防止重定向次数过多
		if (redirectCount >= MAX_REDIRECT_COUNT) {
			console.log("跳过处理：重定向次数过多，重置状态")
			resetRedirectState()
			return
		}

		const matchesRoute = routesMatch(location.pathname)
		const cacheClusterCode = configStore.cluster.clusterCode || defaultClusterCode

		// 检查是否为iOS设备
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
		const isWhiteListRoute = whiteListRoutes.some((o) => matchPath(o, window.location.pathname))

		if (isWhiteListRoute) {
			// 白名单则跳过集群编码统一问题
			return
		}
		// 当且仅当组织编码变更时，替换返回路径
		if (
			cacheClusterCode !== matchesRoute?.params?.clusterCode &&
			isString(matchesRoute?.params?.clusterCode)
		) {
			// 保留原始的查询参数（如 workspaceId, projectId, topicId 等）
			const searchParams = new URLSearchParams(location.search)
			const query = convertSearchParams(searchParams)

			const path = getRoutePath({
				name: matchesRoute?.route?.name || RouteName.Super,
				params: {
					...(matchesRoute?.params || {}),
					clusterCode: cacheClusterCode,
				},
				query,
			})

			if (!path) {
				// 路径生成失败，跳过重定向
				return
			}

			// 设置重定向状态
			isRedirecting = true
			redirectCount++
			lastRedirectPath = path

			try {
				// iOS 下使用更温和的跳转方式，避免强制替换导致应用退出
				if (isIOS && path) {
					// 直接使用 baseHistory.replace 而不是原生 API
					// 避免手动触发 popstate 事件导致的死循环
					baseHistory.replace(path)
				} else {
					// 路由历史重载
					baseHistory.replace(path || "/super")
				}
			} catch (error) {
				console.error("路由重定向失败", error)
				logger.error("redirectFail", error)
			} finally {
				// 延迟重置重定向状态
				delayedResetRedirectState()
			}
		}
	}
})

export class history {
	get action() {
		return baseHistory.action
	}

	get location() {
		return baseHistory.location
	}

	static push = (props: RouteParams) => {
		try {
			// 获取路由跳转配置，当且仅当存在集群编码时，则自定义集群编码跳转（新的集群编码需要在这里做集群切换编排以及路由改写），否则默认拿当前集群编码（登录路由等无需集群编码）
			const path = getRoutePath(props)
			if (path) {
				baseHistory.push(path, props?.state)
			} else {
				throw new Error(`push route params: ${JSON.stringify(props)}`)
			}
		} catch (error) {
			logger.error("route path parser fail", error)
		}
	}

	static replace(props: RouteParams) {
		try {
			// 获取路由跳转配置，当且仅当存在集群编码时，则自定义集群编码跳转（新的集群编码需要在这里做集群切换编排以及路由改写），否则默认拿当前集群编码（登录路由等无需集群编码）
			const path = getRoutePath(props)
			console.log("path ====> ", path)
			if (path) {
				baseHistory.replace(path, props?.state)
			} else {
				throw new Error(`replace route params: ${JSON.stringify(props)}`)
			}
		} catch (error) {
			logger.error("route path parser fail", error)
		}
	}

	static createHref(props: RouteParams) {
		try {
			// 获取路由跳转配置，当且仅当存在集群编码时，则自定义集群编码跳转（新的集群编码需要在这里做集群切换编排以及路由改写），否则默认拿当前集群编码（登录路由等无需集群编码）
			const path = getRoutePath(props)
			if (path) {
				return baseHistory.createHref(path)
			} else {
				throw new Error(`createHref route params: ${JSON.stringify(props)}`)
			}
		} catch (error) {
			logger.error("route path parser fail", error)
		}
	}

	static go(delta: number) {
		return baseHistory.go(delta)
	}

	static back() {
		return baseHistory.back()
	}

	static forward() {
		return baseHistory.forward()
	}

	static listen(listener: Listener) {
		return baseHistory.listen(listener)
	}

	static block(blocker: Blocker) {
		return baseHistory.block(blocker)
	}
}
