import { useEffect, useRef, useState } from "react"
import { reaction } from "mobx"
import { userStore } from "@/models/user"
import { appService } from "@/services/app/AppService"
import { mobileTabStore } from "@/stores/mobileTab"
import { RouteName } from "@/routes/constants"
import { INIT_DOMAINS } from "@/models/user/stores/initialization.store"
/**
 * Chat 数据初始化 Hook
 * 只在 Chat tab 激活时才初始化，避免影响其他 tab 的性能
 * 使用 requestIdleCallback 确保不阻塞 UI 渲染
 * @returns { isInitializing: boolean } 初始化状态
 */
export function useChatDataInit() {
	const initPromiseRef = useRef<Promise<void> | null>(null)
	const isInitializedRef = useRef(false)
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)
	const idleCallbackRef = useRef<number | null>(null)
	const [isInitializing, setIsInitializing] = useState(false)

	useEffect(() => {
		// 使用 MobX reaction 监听 activeTab 和 userInfo 的变化
		const disposer = reaction(
			() => ({
				activeTab: mobileTabStore.activeTab,
				magicId: userStore.user.userInfo?.magic_id,
				organizationCode: userStore.user.userInfo?.organization_code,
			}),
			({ activeTab, magicId, organizationCode }) => {
				// 只在 Chat tab 激活时才初始化
				const isChatActive = activeTab === RouteName.Chat
				if (!isChatActive) {
					// 清理之前的定时器
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current)
						timeoutRef.current = null
					}
					if (
						idleCallbackRef.current !== null &&
						typeof cancelIdleCallback !== "undefined"
					) {
						cancelIdleCallback(idleCallbackRef.current)
						idleCallbackRef.current = null
					}
					setTimeout(() => {
						setIsInitializing(false)
					}, 100)
					return
				}

				const magicUser = userStore.user.userInfo
				if (!magicUser || !magicId || !organizationCode) {
					return
				}

				// 检查是否已经初始化
				const alreadyInitialized = userStore.initialization.isInitialized({
					magicId,
					organizationCode,
					domain: INIT_DOMAINS.chat,
				})

				if (alreadyInitialized) {
					isInitializedRef.current = true
					setIsInitializing(false)
					return
				}

				// 如果已经有正在进行的初始化，等待它完成
				if (initPromiseRef.current) {
					setIsInitializing(true)
					initPromiseRef.current
						.catch((error) => {
							console.error("Chat data initialization error:", error)
						})
						.finally(() => {
							setIsInitializing(false)
						})
					return
				}

				// 开始初始化
				setIsInitializing(true)

				// 清理之前的定时器
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current)
					timeoutRef.current = null
				}
				if (idleCallbackRef.current !== null && typeof cancelIdleCallback !== "undefined") {
					cancelIdleCallback(idleCallbackRef.current)
					idleCallbackRef.current = null
				}

				// 使用 requestIdleCallback 延迟初始化，确保 UI 完全渲染后再执行
				const scheduleInit = () => {
					if (typeof requestIdleCallback !== "undefined") {
						idleCallbackRef.current = requestIdleCallback(
							() => {
								initPromiseRef.current = appService
									.initChatDataIfNeeded(magicUser)
									.catch((error) => {
										console.error("initChatDataIfNeeded error", error)
									})
									.finally(() => {
										isInitializedRef.current = true
										initPromiseRef.current = null
										setIsInitializing(false)
									})
							},
							{ timeout: 3000 }, // 3 秒后强制执行
						)
					} else {
						// 降级到 setTimeout
						timeoutRef.current = setTimeout(() => {
							initPromiseRef.current = appService
								.initChatDataIfNeeded(magicUser)
								.catch((error) => {
									console.error("initChatDataIfNeeded error", error)
								})
								.finally(() => {
									isInitializedRef.current = true
									initPromiseRef.current = null
									setIsInitializing(false)
								})
						}, 1000) // 1 秒延迟
					}
				}

				// 延迟执行，确保组件完全渲染后再初始化
				timeoutRef.current = setTimeout(() => {
					scheduleInit()
				}, 500)
			},
			{
				fireImmediately: true, // 立即执行一次，处理初始状态
			},
		)

		// 清理函数
		return () => {
			disposer()
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
				timeoutRef.current = null
			}
			if (idleCallbackRef.current !== null && typeof cancelIdleCallback !== "undefined") {
				cancelIdleCallback(idleCallbackRef.current)
				idleCallbackRef.current = null
			}
			setIsInitializing(false)
		}
	}, []) // 空依赖数组，只在 mount/unmount 时执行

	return { isInitializing }
}
