import GlobalErrorBoundary from "@/opensource/components/fallback/GlobalErrorBoundary"
import AuthenticationProvider from "@/opensource/providers/AuthenticationProvider"
import GlobalChatProvider from "@/opensource/providers/ChatProvider"
import SuperMagic from "@/opensource/pages/superMagic"
import { reportErrorLog } from "@/opensource/pages/superMagic/utils/api"
import Logger from "@/utils/log/Logger"
import { createStyles } from "antd-style"
import { isEmpty } from "lodash-es"
import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import useDrag from "@/opensource/hooks/electron/useDrag"
import { magic } from "@/enhance/magicElectron"

// const console = new Logger("super")

const useStyles = createStyles(({ token }) => ({
	container: {
		flex: "auto",
		overflow: "hidden",
		height: "100%",
		width: "100%",
	},
	header: {
		width: "100%",
		height: 40,
		borderBottom: `1px solid ${token.colorBorder}`,
	},
}))

// 仅有超级麦吉的入口
function Super() {
	const { styles } = useStyles()

	const { onMouseDown } = useDrag()
	// const isDevelopment = process.env.NODE_ENV === "development"

	// 添加全局未捕获的错误和 Promise reject监听
	// useEffect(() => {
	// 	// 开发模式下不捕获错误
	// 	if (isDevelopment) return

	// 	// 处理常规错误
	// 	const handleError = (event: ErrorEvent) => {
	// 		event.preventDefault()
	// 		const errorInfo = {
	// 			message: event.message,
	// 			filename: event.filename,
	// 			lineno: event.lineno,
	// 			colno: event.colno,
	// 			type: event.type,
	// 			stack: event?.error?.stack,
	// 			timestamp: new Date(),
	// 			error_type: "global_error",
	// 		}
	// 		console.log(event, "xxxx")
	// 		console.error("未捕获的全局错误", errorInfo)
	// 		reportErrorLog({ log: JSON.stringify(errorInfo) })
	// 	}

	// 	// 处理未捕获的 Promise 拒绝
	// 	const handleRejection = (event: PromiseRejectionEvent) => {
	// 		event.preventDefault()
	// 		const errorInfo = {
	// 			reason: event.reason,
	// 			promise: event.promise,
	// 			error_type: "global_unhandled_rejection",
	// 		}
	// 		console.error("未捕获的 Promise reject", event)
	// 		if (isEmpty(event.reason) && isEmpty(event.promise)) {
	// 			return
	// 		}
	// 		reportErrorLog({ log: JSON.stringify(errorInfo) })
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

	return (
		<div className={styles.container}>
			{magic?.env?.isElectron?.() && (
				<div className={styles.header} onMouseDown={onMouseDown} />
			)}
			<GlobalErrorBoundary>
				<AuthenticationProvider>
					<GlobalChatProvider>
						<SuperMagic />
					</GlobalChatProvider>
				</AuthenticationProvider>
			</GlobalErrorBoundary>
		</div>
	)
}

export default observer(Super)
