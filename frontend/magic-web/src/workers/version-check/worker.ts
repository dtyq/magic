import { ReflectMessageType, MessageType } from "./const"
import { generateUUID, getLatestAppVersion } from "./utils"

export const portList: any[] = [] // 存储端口
export const visiblePorts: any[] = [] // 存储页面可见情况

// 使用对象包装intervalId，使其可变
export const state = {
	intervalId: null as NodeJS.Timeout | null,
}

// 给除自己外的窗口发送消息
function sendMessage(port: { id: any }, message: { type: string }) {
	portList.forEach((o) => {
		if (o.id !== port.id) {
			o.postMessage(message)
		}
	})
}

// 给所有窗口发送消息
function broadcast(message: { type: string; data?: any; message?: string }) {
	portList.forEach((port) => {
		port.postMessage(message)
	})
}

declare global {
	interface Window {
		onconnect: (e: { ports: any[] }) => void
	}
}

export const onconnect = function onconnect(e: { ports: any[] }) {
	const port = e.ports[0]
	port.id = generateUUID()
	// 存储端口
	portList.push(port)
	// 监听port推送

	port.onmessage = async function onmessage(e: any) {
		// 取数据
		const data = e.data || {}
		const type = data.type || ""
		switch (type) {
			case MessageType.START: // 开启轮询
				// 防止重复添加
				if (!visiblePorts.find((o) => o === port.id)) {
					visiblePorts.push(port.id)
				}
				if (state.intervalId !== null) {
					clearInterval(state.intervalId)
				}
				try {
					const res = await getLatestAppVersion()
					broadcast({
						type: ReflectMessageType.REFLECT_GET_LATEST_VERSION,
						data: res,
					})
					state.intervalId = setInterval(async () => {
						try {
							const latestVersion = await getLatestAppVersion()
							broadcast({
								type: ReflectMessageType.REFLECT_GET_LATEST_VERSION,
								data: latestVersion,
							})
						} catch (error) {
							broadcast({
								type: ReflectMessageType.REFLECT_GET_LATEST_VERSION,
								data: undefined,
								message: error instanceof Error ? error.message : "Unknown error",
							})
						}
					}, 30000)
				} catch (error) {
					broadcast({
						type: ReflectMessageType.REFLECT_GET_LATEST_VERSION,
						data: undefined,
						message: error instanceof Error ? error.message : "Unknown error",
					})
				}
				break
			case MessageType.STOP: // 停止轮询
				{
					const visibleIndex = visiblePorts.indexOf(port.id)
					if (visibleIndex > -1) visiblePorts.splice(visibleIndex, 1)
				}
				// 当所有页面不可见时，才停止轮询
				if (state.intervalId !== null && visiblePorts.length === 0) {
					clearInterval(state.intervalId)
					state.intervalId = null
				}
				break
			case MessageType.CLOSE: // 关闭当前端口
				{
					const index = portList.indexOf(port)
					if (index > -1) {
						portList.splice(index, 1)
					}
				}
				break
			case MessageType.REFRESH: // 主动刷新，通知其他页面刷新
				sendMessage(port, {
					type: ReflectMessageType.REFLECT_REFRESH,
				})
				break
			default:
				broadcast({ type: "error", message: "Unknown message type" })
				break
		}
	}
}
