import type { ReactNode } from "react"
import { CircleAlert, MessageSquareOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"

interface NoSendProps {
	children?: ReactNode
	"data-layout"?: string
	"data-unclosed"?: string
	"data-invalid"?: string
}

/** 正文仍可阅读和交互；样式只标识渠道发送范围，不是禁用态或思考内容。 */
export function NoSend({ children, ...attributes }: NoSendProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const block = attributes["data-layout"] === "block"
	const invalid = attributes["data-invalid"] === "true"
	const unclosed = attributes["data-unclosed"] === "true"
	const description = invalid
		? t("noSend.invalidClosing")
		: unclosed
			? t("noSend.unclosed")
			: t("noSend.description")
	const Icon = invalid || unclosed ? CircleAlert : MessageSquareOff
	const button = (
		<button
			type="button"
			aria-label={description}
			className={cn(
				"inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground",
				"hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				block ? "absolute right-1 top-1" : "ml-1 align-middle",
			)}
		>
			<Icon size={16} aria-hidden />
		</button>
	)
	const explanation = isMobile ? (
		<Popover>
			<PopoverTrigger asChild>{button}</PopoverTrigger>
			<PopoverContent className="w-auto max-w-xs p-3 text-sm">{description}</PopoverContent>
		</Popover>
	) : (
		<MagicTooltip title={description}>{button}</MagicTooltip>
	)
	if (invalid) return explanation
	const Container = block ? "div" : "span"
	return (
		<Container
			className={cn(
				"border-dashed border-border bg-muted/30 text-foreground",
				// 图标占用自己的区域，不能遮挡正文链接，也不能把整个消息做成禁用态。
				block ? "relative my-2 rounded-md border p-3 pr-9" : "rounded-sm border-b px-0.5",
			)}
		>
			{children}
			{explanation}
		</Container>
	)
}
