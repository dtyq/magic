import { Button } from "@/components/shadcn-ui/button"
import MagicImage from "@/components/base/MagicImage"
import { IconCheck, IconLoader2, IconSettings } from "@tabler/icons-react"
import { IconMCP } from "@/enhance/tabler/icons-react"
import type { IMCPItem } from "../../../types"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { useState } from "react"
import { hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import { renderMarkdownLinks } from "../../../renderMarkdownLinks"

interface MCPItemProps {
	item: IMCPItem
	selected?: boolean
	onClick?: (item: IMCPItem) => void
	onStatusChange?: (item: IMCPItem) => Promise<void>
}

export function MCPItem(props: MCPItemProps) {
	const { item, selected, onClick, onStatusChange } = props

	const { t } = useTranslation("agent")

	const [loading, setLoading] = useState(false)

	const triggerEnable = useMemoizedFn(async () => {
		setLoading(true)
		try {
			await onStatusChange?.(item)
		} catch (error) {
			console.error(error)
		} finally {
			setLoading(false)
		}
	})

	const triggerSettings = useMemoizedFn((event) => {
		event?.stopPropagation()
		event?.preventDefault()
		onClick?.(item)
	})

	return (
		<div
			className="flex w-full items-start justify-between gap-2.5 overflow-hidden rounded-md px-2.5 py-3 hover:bg-fill"
			data-testid="agent-mcp-panel-item"
		>
			<div
				className="size-10 shrink-0 overflow-hidden"
				data-testid="agent-mcp-panel-item-icon"
			>
				<MagicImage
					className="size-full rounded-md border border-border"
					src={item?.icon}
					alt={item?.name}
					fallback={
						<div className="inline-flex size-full items-center justify-center overflow-hidden rounded-md bg-black/20 text-white dark:bg-white/20">
							<IconMCP size="100%" />
						</div>
					}
				/>
			</div>
			<div className="inline-flex min-w-0 flex-1 flex-col gap-1">
				<div className="inline-flex items-center gap-2.5 text-sm font-semibold text-foreground">
					<span className="line-clamp-1 leading-5">{item?.name}</span>
					{hasEditRight(item.user_operation) && (
						<button
							type="button"
							className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border border-border px-1 text-[10px] font-normal hover:bg-fill focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:bg-fill-secondary"
							onClick={triggerSettings}
							data-testid="agent-mcp-panel-item-settings-button"
						>
							<IconSettings size={13} />
							{t("mcp.panel.settings")}
						</button>
					)}
				</div>
				<div className="line-clamp-2 text-xs font-normal leading-4 text-muted-foreground">
					{renderMarkdownLinks(item?.description || t("mcp.card.desc"), {
						linkClassName:
							"px-0.5 text-primary underline underline-offset-2 hover:text-primary/90",
						linkTestId: "agent-mcp-panel-item-description-link",
					})}
				</div>
			</div>
			<div className="mt-2.5 inline-flex shrink-0 items-center">
				<Button
					type="button"
					className="w-20"
					variant={selected ? "default" : "outline"}
					disabled={loading}
					onClick={triggerEnable}
					data-testid="agent-mcp-panel-item-toggle-button"
				>
					{loading && <IconLoader2 className="size-4 animate-spin" />}
					{!loading && selected && <IconCheck className="size-6" />}
					{!loading && !selected && t("mcp.panel.create")}
				</Button>
			</div>
		</div>
	)
}
