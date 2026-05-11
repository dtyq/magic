import EllipsisTooltip from "@/pages/vectorKnowledge/components/Create/components/EllipsisTooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { ModeModelGroup } from "../types"
import ProviderIcon from "./ProviderIcon"

interface ProviderNameProps {
	item: ModeModelGroup
}

function ProviderName({ item }: ProviderNameProps) {
	const isMobile = useIsMobile()

	return (
		<div className="flex items-center gap-1">
			{!isMobile ? <ProviderIcon provider={item} size={16} /> : null}
			<EllipsisTooltip title={item.name}>
				<div className="text-xs font-bold leading-4 text-muted-foreground [font-family:Inter,sans-serif]">
					{item.name}
				</div>
			</EllipsisTooltip>
		</div>
	)
}

export default ProviderName
