import { useCallback, useSyncExternalStore } from "react"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
import { platformKey } from "@/utils/storage"

interface MessageDisplayPreference {
	simpleMode: boolean
	guideSeen: boolean
}
const defaultPreference: MessageDisplayPreference = { simpleMode: false, guideSeen: false }
const values = new Map<string, MessageDisplayPreference>()
const listeners = new Map<string, Set<() => void>>()

function read(key: string): MessageDisplayPreference {
	try {
		const value: unknown = JSON.parse(localStorage.getItem(key) || "null")
		if (value && typeof value === "object") {
			const record = value as Record<string, unknown>
			return { simpleMode: record.simpleMode === true, guideSeen: record.guideSeen === true }
		}
	} catch {
		// 隐私模式或损坏的存储回退默认值；不阻塞用户阅读和本次切换。
	}
	return defaultPreference
}
function snapshot(key: string) {
	if (!key) return defaultPreference
	if (!values.has(key)) values.set(key, read(key))
	return values.get(key) || defaultPreference
}
function notify(key: string) {
	listeners.get(key)?.forEach((listener) => listener())
}
function subscribe(key: string, listener: () => void) {
	if (!key) return () => undefined
	const subscribers = listeners.get(key) || new Set<() => void>()
	subscribers.add(listener)
	listeners.set(key, subscribers)
	const onStorage = (event: StorageEvent) => {
		if (event.key !== key && event.key !== null) return
		values.set(key, read(key))
		notify(key)
	}
	window.addEventListener("storage", onStorage)
	return () => {
		window.removeEventListener("storage", onStorage)
		subscribers.delete(listener)
		if (!subscribers.size) {
			listeners.delete(key)
			values.delete(key)
		}
	}
}
function update(key: string, change: Partial<MessageDisplayPreference>) {
	if (!key) return
	const value = { ...snapshot(key), ...change }
	values.set(key, value)
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch {
		// 存储不可写时，当前页面的菜单、引导和列表仍共享同一内存状态。
	}
	notify(key)
}

/** 偏好只属于当前组织、账号与浏览器；分享和只读嵌入由调用方关闭入口。 */
export function useMessageDisplayPreference(available = true) {
	const { userInfo } = useUserInfo()
	const key =
		available && userInfo?.organization_code && userInfo?.user_id
			? platformKey(
					`super_magic/message_display/${encodeURIComponent(userInfo.organization_code)}/${encodeURIComponent(userInfo.user_id)}`,
				)
			: ""
	const preference = useSyncExternalStore(
		useCallback((listener) => subscribe(key, listener), [key]),
		useCallback(() => snapshot(key), [key]),
		() => defaultPreference,
	)
	const setSimpleMode = useCallback((simpleMode: boolean) => update(key, { simpleMode }), [key])
	const claimGuide = useCallback(() => {
		if (!key || snapshot(key).guideSeen) return false
		update(key, { guideSeen: true })
		return true
	}, [key])
	return {
		...preference,
		accountKey: key,
		available: Boolean(key),
		setSimpleMode,
		claimGuide,
	}
}
