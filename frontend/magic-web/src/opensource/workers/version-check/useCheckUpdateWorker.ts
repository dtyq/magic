import { useEffect, useRef, useCallback } from "react"
import WorkerJs from "./worker?sharedworker"
import { MessageType } from "./const"

// 用户消息推送Websocket连接
export default function useSharedWorker(options: WorkerOptions) {
	const workerRef = useRef<SharedWorker>()

	const sendMessage = useCallback((type: MessageType, data?: any) => {
		workerRef.current?.port.postMessage({
			type,
			...data,
		})
	}, [])

	const start = useCallback(() => {
		sendMessage(MessageType.START)
	}, [sendMessage])

	const stop = useCallback(() => {
		sendMessage(MessageType.STOP)
	}, [sendMessage])

	const close = useCallback(() => {
		sendMessage(MessageType.CLOSE)
	}, [sendMessage])

	const refresh = useCallback(() => {
		sendMessage(MessageType.REFRESH)
	}, [sendMessage])

	useEffect(() => {
		if (!workerRef.current) {
			try {
				workerRef.current = new WorkerJs(options)
			} catch (err) {
				console.log("unsupport shared worker", err)
			}
		}
		window.addEventListener("beforeunload", close)
		return () => {
			window.removeEventListener("beforeunload", close)
		}
	}, [close, options])

	return { start, stop, refresh, workerRef }
}
