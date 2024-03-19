import { useState, useMemo, useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { matchPath } from "react-router"
import { configStore } from "@/opensource/models/config"
import { userStore } from "@/opensource/models/user"
import { useAccount } from "@/opensource/stores/authentication"
import { useClusterConfig } from "@/opensource/models/config/hooks"
import { service } from "@/opensource/services"
import type { ConfigService } from "@/opensource/services/config/ConfigService"
import type { LoginService } from "@/opensource/services/user/LoginService"
import { CommonApi } from "@/opensource/apis"
import { convertSearchParams, routesMatch } from "@/opensource/routes/history/helpers"
import { history } from "@/opensource/routes"
import { RouteName } from "@/opensource/routes/constants"
import { omit } from "lodash-es"
import { whiteListRoutes } from "@/opensource/routes/const/whiteRoutes"

// 集群配置加载缓存，避免重复请求
const clusterConfigLoadingCache = new Map<string, Promise<void>>()
const clusterConfigLoadedCache = new Set<string>()

interface UseClusterSwitchOptions {
	targetClusterCode: string
}

interface UseClusterSwitchResult {
	isSameCluster: boolean
	loading: boolean
	setSameCluster: (value: boolean) => void
}

/**
 * 集群切换逻辑 Hook
 * 负责处理集群配置加载、账号匹配和自动切换逻辑
 *
 * 性能优化：
 * 1. 使用 AbortController 取消过期请求
 * 2. 使用缓存避免重复加载集群配置
 * 3. 使用 useMemo 缓存计算结果
 * 4. 使用 useMemoizedFn 稳定函数引用
 */
export function useClusterSwitch(options: UseClusterSwitchOptions): UseClusterSwitchResult {
	const { targetClusterCode } = options
	const { accountSwitch } = useAccount()
	const { clustersConfig } = useClusterConfig()

	// 使用 useMemo 避免不必要的初始状态计算
	const initialSameCluster = useMemo(
		() => targetClusterCode === configStore.cluster.clusterCode,
		[targetClusterCode],
	)

	// 预先检查是否为白名单路由（只在 mount 时计算一次）
	const isWhiteListRoute = useMemo(
		() => isInWhiteList(window.location.pathname),
		[], // 空依赖，只在组件挂载时计算
	)

	// 优化 loading 初始状态：如果集群匹配或在白名单中，不需要 loading
	const initialLoading = useMemo(
		() => !initialSameCluster && !isWhiteListRoute,
		[initialSameCluster, isWhiteListRoute],
	)

	const [isSameCluster, setSameCluster] = useState(initialSameCluster)
	const [loading, setLoading] = useState(initialLoading)

	// 使用 ref 存储 AbortController，用于取消过期请求
	const abortControllerRef = useRef<AbortController | null>(null)
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

	// 查找匹配的账号（使用 useMemo 缓存）
	const matchedAccount = useMemo(() => findMatchedAccount(targetClusterCode), [targetClusterCode])

	// 稳定的错误处理函数
	const handleError = useMemoizedFn((error: unknown) => {
		console.error("ClusterLayout init error:", error)
		handleInitError()
	})

	// 稳定的加载集群配置函数（带缓存）
	const loadClusterConfig = useMemoizedFn(async (clusterCode: string): Promise<void> => {
		// 如果已经加载过，直接返回
		if (clusterConfigLoadedCache.has(clusterCode)) {
			return
		}

		// 如果正在加载中，返回现有的 Promise
		const existingPromise = clusterConfigLoadingCache.get(clusterCode)
		if (existingPromise) {
			return existingPromise
		}

		// 创建新的加载 Promise
		const loadingPromise = service
			.get<LoginService>("loginService")
			.getClusterConfig(clusterCode)
			.then(() => {
				clusterConfigLoadedCache.add(clusterCode)
			})
			.finally(() => {
				clusterConfigLoadingCache.delete(clusterCode)
			})

		clusterConfigLoadingCache.set(clusterCode, loadingPromise)
		return loadingPromise
	})

	// 主初始化逻辑
	const initialize = useMemoizedFn(async (signal: AbortSignal) => {
		try {
			// 提前判断：如果目标集群与当前集群一致，或在白名单中，直接通过（无需 loading）
			if (targetClusterCode === configStore.cluster.clusterCode || isWhiteListRoute) {
				if (!clustersConfig?.[targetClusterCode]) {
					try {
						await service
							.get<LoginService>("loginService")
							.getClusterConfig(targetClusterCode)
						await service
							.get<ConfigService>("configService")
							.setClusterCode(targetClusterCode)
					} catch (error) {
						console.warn("whiteList cluster config sync failed", error)
					}
				}
				setSameCluster(true)
				setLoading(false)
				return
			}

			// 只有在需要切换时才显示 loading
			setLoading(true)

			// 1. 获取私有配置
			await CommonApi.getPrivateConfigure(targetClusterCode, false)

			// 检查请求是否已被取消
			if (signal.aborted) return

			// 2. 如果集群配置不存在，则加载集群配置（带缓存）
			if (!clustersConfig?.[targetClusterCode] && targetClusterCode !== "") {
				await loadClusterConfig(targetClusterCode)
			}

			// 检查请求是否已被取消
			if (signal.aborted) return

			// 3. 再次检查集群是否一致（可能在异步操作期间已切换）
			if (targetClusterCode === configStore.cluster.clusterCode || isWhiteListRoute) {
				setSameCluster(true)
				return
			}

			// 4. 如果找到匹配账号，自动切换
			if (matchedAccount) {
				setSameCluster(true)
				await accountSwitch(
					matchedAccount.magic_id,
					matchedAccount.magic_user_id,
					matchedAccount.organizationCode,
				).catch(console.error)
			} else {
				// 目标集群不存在已登录账号，且为非白名单
				setSameCluster(false)
			}
		} catch (error) {
			// 忽略取消错误
			if (signal.aborted) return
			handleError(error)
		} finally {
			if (!signal.aborted) {
				setLoading(false)
			}
		}
	})

	// 使用 useEffect 替代 useDebounceEffect，实现更精细的控制
	useEffect(() => {
		// 取消之前的请求
		if (abortControllerRef.current) {
			abortControllerRef.current.abort()
		}

		// 清除之前的防抖定时器
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		// 创建新的 AbortController
		const abortController = new AbortController()
		abortControllerRef.current = abortController

		// 快速判断：如果集群已匹配或在白名单中，立即执行（无需防抖）
		const needsSwitch =
			targetClusterCode !== configStore.cluster.clusterCode && !isWhiteListRoute

		if (!needsSwitch) {
			// 无需切换，立即执行
			initialize(abortController.signal).catch(console.error)
		} else {
			// 需要切换，使用防抖避免快速切换导致的多次请求
			debounceTimerRef.current = setTimeout(() => {
				initialize(abortController.signal).catch(console.error)
			}, 50)
		}

		// 清理函数
		return () => {
			abortController.abort()
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [targetClusterCode, initialize, isWhiteListRoute])

	return {
		isSameCluster,
		loading,
		setSameCluster,
	}
}

/**
 * 检查路径是否在白名单中
 * 使用缓存避免重复匹配
 */
const whiteListCheckCache = new Map<string, boolean>()

function isInWhiteList(pathname: string): boolean {
	// 先检查缓存
	if (whiteListCheckCache.has(pathname)) {
		return whiteListCheckCache.get(pathname)!
	}

	// 执行匹配
	const result = whiteListRoutes.some((route) => matchPath(route, pathname))

	// 缓存结果（限制缓存大小，避免内存泄漏）
	if (whiteListCheckCache.size > 100) {
		// 删除最早的缓存项
		const firstKey = whiteListCheckCache.keys().next().value
		if (firstKey) {
			whiteListCheckCache.delete(firstKey)
		}
	}

	whiteListCheckCache.set(pathname, result)
	return result
}

/**
 * 查找匹配的账号
 * 根据目标集群代码，在已登录账号中查找对应的账号
 */
function findMatchedAccount(targetClusterCode: string) {
	return userStore.account.accounts.find(
		(account) => account.deployCode?.toLowerCase?.() === targetClusterCode?.toLowerCase?.(),
	)
}

/**
 * 处理初始化错误
 * 当集群编码无效时，重定向至对应集群路由或超麦
 */
function handleInitError() {
	const url = new URL(window.location.href)
	const routeMeta = routesMatch(url.pathname)

	if (routeMeta?.route?.name) {
		// 重定向到当前路由但移除集群编码
		history.replace({
			name: routeMeta.route.name,
			params: omit(routeMeta.params, ["clusterCode"]),
			query: convertSearchParams(url.searchParams),
		})
	} else {
		// 重定向到超麦
		history.replace({
			name: RouteName.Super,
		})
	}
}
