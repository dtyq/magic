import { Plug, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { TOOL_ICONS } from "../constants"

interface PluginTipsProps {
	onConnectClick?: () => void
}

function PluginTips({ onConnectClick }: PluginTipsProps) {
	const { t } = useTranslation("super/mainInput")

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
			<div className="flex items-center pr-1.5">
				{TOOL_ICONS.map((tool) => {
					const IconComponent = tool.icon
					return (
						<div
							key={tool.id}
							className="-mr-1.5 flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-xs"
							title={tool.label}
						>
							<IconComponent />
						</div>
					)
				})}
			</div>

			<ChevronRight className="size-4" />
		</button>
	)
}

export default PluginTips
