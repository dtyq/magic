/** 事件名称 */
type EventName = string

export default class EventEmitter<T extends (...args: any[]) => void> {
	observers: Record<EventName, T>

	constructor() {
		// 存储事件监听器的键值对
		this.observers = {}
	}

	// 注册事件监听器
	on(eventName: EventName, listener: T) {
		if (!this.observers[eventName]) {
			this.observers[eventName] = listener
		}
	}

	// 触发事件，回调所有监听器
	emit(eventName: EventName, ...args: Array<any>) {
		const listener = this.observers[eventName]
		if (listener) {
			listener.apply(this, args)
		}
	}

	// 移除指定事件的指定监听器
	off(eventName: EventName) {
		if (Object.keys(this.observers).includes(eventName)) {
			delete this.observers[eventName]
		}
	}
}
