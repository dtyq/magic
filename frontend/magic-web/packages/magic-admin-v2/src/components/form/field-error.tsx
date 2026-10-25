import type { ReactNode } from "react"
import { cn } from "@magic-admin-v2/utils/cn"

/** 手动传入错误文案的表单字段错误提示。 */
export function FieldError({ className, message }: { className?: string; message?: ReactNode }) {
	return message ? <p className={cn("text-xs text-destructive", className)}>{message}</p> : null
}
