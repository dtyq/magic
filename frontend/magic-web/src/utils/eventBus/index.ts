/**
 * 发布订阅基础实现
 */
class EventBus {
	private eventMap: Record<string, ((data: any) => void)[]> = {}

	on(event: string, callback: (data: any) => void) {
		this.eventMap[event] = this.eventMap[event] || []
		this.eventMap[event].push(callback)
	}

	off(event: string, callback: (data: any) => void) {
		this.eventMap[event] = this.eventMap[event] || []
		this.eventMap[event] = this.eventMap[event].filter((cb) => cb !== callback)
	}

	emit(event: string, data: any) {
		this.eventMap[event] = this.eventMap[event] || []
		this.eventMap[event].forEach((cb) => cb(data))
	}
}

export default EventBus
