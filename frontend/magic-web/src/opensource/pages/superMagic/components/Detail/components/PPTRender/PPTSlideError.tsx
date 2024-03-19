import { CSSProperties, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, FileQuestion, Link2Off } from "lucide-react"
import { cn } from "@/opensource/lib/utils"

interface PPTSlideErrorProps {
	index: number
	error?: Error
	isActive: boolean
	className?: string
	style?: CSSProperties
}

type ErrorType = "not_found" | "no_url" | "network" | "timeout" | "permission" | "unknown"

function getErrorType(error?: Error): ErrorType {
	if (!error) return "unknown"

	const message = error.message.toLowerCase()

	if (message.includes("no url available") || message.includes("url不可用")) {
		return "no_url"
	}
	if (message.includes("not found") || message.includes("找不到") || message.includes("不存在")) {
		return "not_found"
	}
	if (message.includes("network") || message.includes("网络")) {
		return "network"
	}
	if (message.includes("timeout") || message.includes("超时")) {
		return "timeout"
	}
	if (message.includes("permission") || message.includes("权限")) {
		return "permission"
	}

	return "unknown"
}

function PPTSlideError({ className, style, index, error, isActive }: PPTSlideErrorProps) {
	const { t } = useTranslation("super")
	const errorType = getErrorType(error)

	// Determine icon based on error type
	const ErrorIcon = useMemo(() => {
		switch (errorType) {
			case "not_found":
				return FileQuestion
			case "no_url":
				return Link2Off
			case "network":
			case "timeout":
			case "permission":
			case "unknown":
			default:
				return AlertTriangle
		}
	}, [errorType])

	// Determine error title
	const errorTitle = useMemo(() => {
		switch (errorType) {
			case "not_found":
				return t("ppt.error.fileNotFound")
			case "no_url":
				return t("ppt.error.noUrl")
			case "network":
				return t("ppt.error.network")
			case "timeout":
				return t("ppt.error.timeout")
			case "permission":
				return t("ppt.error.permission")
			default:
				return t("ppt.loadError")
		}
	}, [errorType, t])

	// Determine error description
	const errorDescription = useMemo(() => {
		switch (errorType) {
			case "not_found":
				return t("ppt.error.fileNotFoundDesc", { index: index + 1 })
			case "no_url":
				return t("ppt.error.noUrlDesc", { index: index + 1 })
			case "network":
				return t("ppt.error.networkDesc", { index: index + 1 })
			case "timeout":
				return t("ppt.error.timeoutDesc", { index: index + 1 })
			case "permission":
				return t("ppt.error.permissionDesc", { index: index + 1 })
			default:
				return t("ppt.slideLoadError", { index: index + 1 })
		}
	}, [errorType, t, index])

	return (
		<div
			data-testid="ppt-slide-error"
			className={cn("h-full w-full", className)}
			style={{ ...style, display: isActive ? "block" : "none" }}
		>
			<div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
				<ErrorIcon size={64} className="text-destructive" />
				<div className="text-center">
					<p className="text-lg font-medium text-destructive">{errorTitle}</p>
					<p className="mt-2 text-sm text-muted-foreground">{errorDescription}</p>
					{error?.message && (
						<details className="mt-4 text-left">
							<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
								{t("ppt.error.technicalDetails")}
							</summary>
							<p className="mt-2 break-words rounded bg-muted p-3 font-mono text-xs text-muted-foreground">
								{error.message}
							</p>
						</details>
					)}
				</div>
			</div>
		</div>
	)
}

export default PPTSlideError
