import { useTranslation } from "react-i18next"
import { ErrorBoundary } from "react-error-boundary"
import type { PropsWithChildren } from "react"
import { Alert, Button, Flex } from "antd"
import { createStyles } from "antd-style"
import { logger as Logger } from "@/utils/log"
import { IconBug, IconReload } from "@tabler/icons-react"

const logger = Logger.createLogger("EditorErrorBoundary")

const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			padding: ${token.padding}px;
			margin: ${token.margin}px 0;
			border-radius: ${token.borderRadius}px;
		`,
		errorDetailsWrapper: css`
			color: ${token.colorPrimary};
			cursor: pointer;
		`,
		errorDetails: css`
			background-color: ${token.magicColorScales.grey[0]};
			padding: ${token.paddingXS}px;
			border-radius: ${token.borderRadiusSM}px;
			font-family: "Courier New", monospace;
			font-size: ${token.fontSizeSM}px;
			max-height: 200px;
			overflow-y: auto;
			white-space: pre-wrap;
			word-break: break-all;
			margin-top: 8px;
		`,
		actions: css`
			margin-top: ${token.marginSM}px;
		`,
	}
})

interface EditorErrorBoundaryProps extends PropsWithChildren {
	onRetry?: () => void
	fallbackMode?: "simple" | "detailed"
	inputData?: Record<string, any>
}

function EditorErrorBoundary({
	children,
	onRetry,
	fallbackMode = "simple",
	inputData,
}: EditorErrorBoundaryProps) {
	const { t } = useTranslation(["interface", "super"])
	const { styles } = useStyles()

	return (
		<ErrorBoundary
			onError={(error, errorInfo) => {
				// 记录详细的错误信息
				logger.error("EditorBody Error Boundary caught an error:", {
					error: error.message,
					stack: error.stack,
					componentStack: errorInfo.componentStack,
					errorBoundary: "EditorErrorBoundary",
					inputData,
				})

				// 检查是否是DOM操作相关的错误
				if (
					error.message.includes("removeChild") ||
					error.message.includes("insertBefore") ||
					error.message.includes("appendChild")
				) {
					logger.warn("DOM operation error detected in EditorBody")
				}
			}}
			fallbackRender={({ error, resetErrorBoundary }) => {
				const isDOMError =
					error.message.includes("removeChild") || error.message.includes("DOM")

				return (
					<div className={styles.container}>
						<Alert
							message={
								isDOMError
									? t("super:editorErrorBoundary.title.editorRenderError")
									: t("super:editorErrorBoundary.title.editorComponentError")
							}
							description={
								<Flex vertical gap={12}>
									<div>
										{isDOMError
											? t(
												"super:editorErrorBoundary.description.domOperationError",
											)
											: t(
												"super:editorErrorBoundary.description.generalError",
											)}
									</div>

									{fallbackMode === "detailed" && (
										<details>
											<summary className={styles.errorDetailsWrapper}>
												<IconBug size={16} />{" "}
												{t(
													"super:editorErrorBoundary.actions.viewErrorDetails",
												)}
											</summary>
											<div className={styles.errorDetails}>
												{error.message}
												{error.stack && `\n\n堆栈信息:\n${error.stack}`}
											</div>
										</details>
									)}

									<Flex gap={8} className={styles.actions}>
										{onRetry && (
											<Button
												type="primary"
												icon={<IconReload size={16} />}
												onClick={() => {
													resetErrorBoundary()
													onRetry?.()
												}}
												size="small"
											>
												{t(
													"super:editorErrorBoundary.actions.reloadEditor",
												)}
											</Button>
										)}

										<Button
											onClick={() => window.location.reload()}
											size="small"
										>
											{t("super:editorErrorBoundary.actions.refreshPage")}
										</Button>
									</Flex>
								</Flex>
							}
							type="error"
							showIcon
						/>
					</div>
				)
			}}
		>
			{children}
		</ErrorBoundary>
	)
}

export default EditorErrorBoundary
