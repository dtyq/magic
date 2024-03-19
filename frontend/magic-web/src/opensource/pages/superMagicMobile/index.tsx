import { Outlet } from "react-router"

export default function SuperMagicMobile() {
	// 添加全局未捕获的错误和 Promise reject监听
	// useEffect(() => {
	// 	// 处理常规错误
	// 	const handleError = (event: ErrorEvent) => {
	// 		event.preventDefault()
	// 		const errorInfo = {
	// 			message: event.message,
	// 			filename: event.filename,
	// 			lineno: event.lineno,
	// 			colno: event.colno,
	// 			error: event.error,
	// 		}
	// 		console.error("未捕获的全局错误", errorInfo)
	// 		reportErrorLog({ log: JSON.stringify(event) })
	// 	}

	// 	// 处理未捕获的 Promise 拒绝
	// 	const handleRejection = (event: PromiseRejectionEvent) => {
	// 		event.preventDefault()
	// 		const errorInfo = {
	// 			reason: event.reason,
	// 			promise: event.promise,
	// 		}
	// 		reportErrorLog({ log: JSON.stringify(event) })
	// 		console.error("未捕获的 Promise reject", errorInfo)
	// 	}

	// 	// 添加事件监听器
	// 	window.addEventListener("error", handleError)
	// 	window.addEventListener("unhandledrejection", handleRejection)

	// 	// 清理函数
	// 	return () => {
	// 		window.removeEventListener("error", handleError)
	// 		window.removeEventListener("unhandledrejection", handleRejection)
	// 	}
	// }, [])
	return <Outlet />
}
