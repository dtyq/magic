import { ErrorBoundary } from "react-error-boundary"
import type { PropsWithChildren, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { IconAlertCircle } from "@tabler/icons-react"
import { logger as Logger } from "@/infrastructure/logger"
import { isChunkLoadError } from "@/utils/error"

const logger = Logger.createLogger("MessageRenderErrorBoundary")

interface MessageRenderErrorBoundaryProps extends PropsWithChildren {
	messageKey: string
	resetKey?: string | number | null
	fallbackWrapper?: (fallback: ReactNode) => ReactNode
}

function MessageRenderFallback({ error, onRetry }: { error: unknown; onRetry: () => void }) {
	const { t } = useTranslation("super")
	// 页面是旧版本，按需加载的模块文件已被新部署替换：重新渲染仍会请求同一个不存在的文件，
	// 只有刷新页面才能拿到新版本，所以此时「重试」换成「刷新页面」。
	const isStaleVersion = isChunkLoadError(error)

	return (
		<div
			className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
			data-testid="message-render-error"
			role="status"
		>
			<IconAlertCircle className="size-4 shrink-0" aria-hidden="true" />
			<span className="min-w-0 flex-1">
				{isStaleVersion
					? t("messageRenderError.staleVersion")
					: t("messageRenderError.title")}
			</span>
			<button
				type="button"
				className="shrink-0 rounded px-1.5 py-0.5 text-xs text-foreground underline-offset-2 hover:underline"
				onClick={isStaleVersion ? () => window.location.reload() : onRetry}
			>
				{isStaleVersion ? t("messageRenderError.refresh") : t("messageRenderError.retry")}
			</button>
		</div>
	)
}

export default function MessageRenderErrorBoundary({
	messageKey,
	resetKey,
	fallbackWrapper,
	children,
}: MessageRenderErrorBoundaryProps) {
	return (
		<ErrorBoundary
			resetKeys={resetKey === undefined ? undefined : [resetKey]}
			onError={(error, errorInfo) => {
				logger.error({
					eventKey: "super_magic_message_render_failed",
					errorKind: "render",
					error: error,
					message: "Message render failed",
					context: {
						messageKey,
						componentStack: errorInfo.componentStack,
						errorBoundary: "MessageRenderErrorBoundary",
					},
				})
			}}
			fallbackRender={({ error, resetErrorBoundary }) => {
				const fallback = (
					<MessageRenderFallback error={error} onRetry={resetErrorBoundary} />
				)
				return fallbackWrapper ? fallbackWrapper(fallback) : fallback
			}}
		>
			{children}
		</ErrorBoundary>
	)
}
