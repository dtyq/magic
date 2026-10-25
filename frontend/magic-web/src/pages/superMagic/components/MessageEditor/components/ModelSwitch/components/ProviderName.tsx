import EllipsisTooltip from "@/pages/vectorKnowledge/components/Create/components/EllipsisTooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { ModeModelGroup } from "../types"
import ProviderIcon from "./ProviderIcon"

interface ProviderNameProps {
	item: ModeModelGroup
}

/** 分组标题：供应商图标加名称；模型行不再带图标，这里是供应商身份的唯一出处。 */
function ProviderName({ item }: ProviderNameProps) {
	const isMobile = useIsMobile()

	return (
		<div
			// 打开面板自动滚到选中行时，据此扣除吸顶标题的高度。
			data-model-switch-group-header
			className={cn(
				"flex items-center gap-1.5 px-2 pb-0.5 pt-1.5 text-muted-foreground",
				// 桌面列表滚动时分组标题吸在顶部；面板与弹层底色都是 card，吸顶时不会露出下面的行。
				!isMobile && "sticky top-0 z-[1] bg-card",
				isMobile && "pt-2.5",
			)}
		>
			<ProviderIcon provider={item} size={16} />
			<EllipsisTooltip title={item.name}>
				<div className="text-xs font-normal leading-4 tracking-[0.01em] [font-family:Inter,sans-serif]">
					{item.name}
				</div>
			</EllipsisTooltip>
		</div>
	)
}

export default ProviderName
