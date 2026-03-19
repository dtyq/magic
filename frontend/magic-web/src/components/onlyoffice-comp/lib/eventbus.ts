import { ONLYOFFICE_EVENT_KEYS } from "./const"

export type DocumentReadyData = {
	fileName: string
	fileType: string
}

export type LoadingChangeData = {
	loading: boolean
}

// 事件类型定义
export type EventKey = (typeof ONLYOFFICE_EVENT_KEYS)[keyof typeof ONLYOFFICE_EVENT_KEYS]

// 事件数据类型映射
type EventDataMap = {
	[ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT]: any
	[ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY]: DocumentReadyData
	[ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE]: LoadingChangeData
}

// 通用 EventBus 类
class EventBus {
	private listeners: Map<EventKey, Array<(data: any) => void>> = new Map()

	/**
	 * 监听事件
	 */
	on<K extends EventKey>(key: K, callback: (data: EventDataMap[K]) => void): void {
		if (!this.listeners.has(key)) {
			this.listeners.set(key, [])
		}
		this.listeners.get(key)!.push(callback)
	}

	/**
	 * 取消监听事件
	 */
	off<K extends EventKey>(key: K, callback: (data: EventDataMap[K]) => void): void {
		const callbacks = this.listeners.get(key)
		if (callbacks) {
			this.listeners.set(
				key,
				callbacks.filter((listener) => listener !== callback),
			)
		}
	}

	/**
	 * 触发事件
	 */
	emit<K extends EventKey>(key: K, data: EventDataMap[K]): void {
		const callbacks = this.listeners.get(key)
		if (callbacks) {
			callbacks.forEach((listener) => listener(data))
		}
	}

	/**
	 * 等待事件触发（返回 Promise）
	 */
	waitFor<K extends EventKey>(key: K, timeout?: number): Promise<EventDataMap[K]> {
		return new Promise<EventDataMap[K]>((resolve, reject) => {
			const timeoutId = timeout
				? setTimeout(() => {
						this.off(key, handleEvent)
						reject(new Error(`Event ${key} timeout after ${timeout}ms`))
					}, timeout)
				: null

			const handleEvent = (data: EventDataMap[K]) => {
				if (timeoutId) clearTimeout(timeoutId)
				this.off(key, handleEvent)
				resolve(data)
			}

			this.on(key, handleEvent)
		})
	}
}

// 创建全局 EventBus 实例
const onlyofficeEventbus = new EventBus()

export { onlyofficeEventbus }
