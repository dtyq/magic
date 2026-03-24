import { useMemo } from "react"
import { Plug, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCreation, useRequest } from "ahooks"
import {
	MCPManagerService,
	OfficialStrategy,
} from "@/components/Agent/MCP/service/MCPManagerService"

const MAX_DISPLAY_ICONS = 5

interface PluginTipsProps {
	onConnectClick?: () => void
}

function PluginTips({ onConnectClick }: PluginTipsProps) {
	const { t } = useTranslation("super/mainInput")

	const service = useCreation(() => {
		const s = new MCPManagerService()
		s.setContext(new OfficialStrategy())
		return s
	}, [])

	const { data } = useRequest(() => service.getMCPList(), {
		cacheKey: "plugin-tips-mcp-list",
	})

	const iconList = useMemo(
		() => (data ?? []).filter((item) => item.icon).slice(0, MAX_DISPLAY_ICONS),
		[data],
	)

	return (
		<button
			className="flex w-full items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-accent/50"
			onClick={onConnectClick}
		>
			<div className="flex grow items-center gap-2">
				<Plug className="size-4 text-foreground" />
				<p className="text-sm font-medium leading-5 text-foreground">
					{t("pluginTips.connectTools")}
				</p>
			</div>

			{/* Icon Group - Tool integration icons */}
			{iconList.length > 0 && (
				<div className="flex items-center pr-1.5">
					{iconList.map((tool) => (
						<div
							key={tool.id}
							className="-mr-1.5 flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-xs"
							title={tool.name}
						>
							<img
								src={tool.icon}
								alt={tool.name}
								className="size-3.5 rounded-xs object-contain"
								draggable={false}
							/>
						</div>
					))}
				</div>
			)}

			<ChevronRight className="size-4" />
		</button>
	)
}

export default PluginTips
