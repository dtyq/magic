import { ChevronRight, ListCollapse } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { VirtualProcessToggleItem } from "../virtual-message-items"
import { AssistantMessageHeader } from "./Nodes/AssistantMessageHeader"
import { TaskStatus } from "../../../pages/Workspace/types"
import { StatusBadge } from "./Card/components/StatusBadge"

export function MessageProcessToggle({
	item,
	onToggle,
}: {
	item: VirtualProcessToggleItem
	onToggle: () => void
}) {
	const { t } = useTranslation("super")
	const content = (
		<div className="mt-1 w-full">
			<button
				type="button"
				aria-expanded={item.expanded}
				onClick={onToggle}
				className="group/process flex h-9 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-muted-foreground transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
			>
				<ListCollapse
					size={16}
					className="shrink-0 transition-colors group-hover/process:text-foreground/90"
				/>
				<span className="text-[13px] font-normal leading-5 text-foreground/75 group-hover/process:text-foreground/90">
					{item.expanded ? t("simpleMode.collapse") : t("simpleMode.expand")}
				</span>
				<span className="text-xs font-normal leading-5 text-muted-foreground/80">
					<span className="mr-2 text-muted-foreground/50">·</span>
					{t("simpleMode.messageCount", { count: item.count })}
				</span>
				<ChevronRight
					size={14}
					strokeWidth={1.4}
					className={cn(
						"ml-1 shrink-0 text-muted-foreground/70 transition-[transform,color] group-hover/process:text-foreground/90 motion-reduce:transition-none",
						item.expanded && "rotate-90",
					)}
				/>
			</button>
			{item.status !== TaskStatus.FINISHED && (
				<div className="mb-1 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-2">
					<span className="text-xs leading-5 text-muted-foreground">
						{item.hasRetainedContent
							? t("simpleMode.lastProgress")
							: t("simpleMode.noReplyBeforeStop")}
					</span>
					{item.showStatus && <StatusBadge status={item.status} />}
				</div>
			)}
			{item.expanded && (
				<div
					aria-hidden
					className="mt-1.5 h-px w-full bg-gradient-to-r from-border/60 to-transparent"
				/>
			)}
		</div>
	)
	return item.showHeader ? (
		<AssistantMessageHeader sendTime={item.sendTime}>{content}</AssistantMessageHeader>
	) : (
		content
	)
}
