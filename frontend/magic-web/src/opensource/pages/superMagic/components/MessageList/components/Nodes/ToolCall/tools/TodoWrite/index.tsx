import type { NodeProps } from "../../../types"
import { cn } from "@/opensource/lib/utils"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { memo, useState } from "react"
import { observer } from "mobx-react-lite"
import { defaultOpen } from "../../config"
import { ChevronUp, ChevronRight } from "lucide-react"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/opensource/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

// Shared tag base — pill row inside the tool container
const tagBase = cn(
	"inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg",
	"bg-white pb-1.5 pl-1.5 pt-1.5 dark:bg-card",
)

// Shared expand/collapse toggle button
const toggleButton = cn(
	"ml-auto inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-sm",
	"hover:bg-fill active:bg-fill-secondary",
)

function TodoWrite(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool

	const isCreateMode = tool?.detail?.data?.type === "create"
	const items: Array<{ id: string; content: string; status: string }> =
		tool?.detail?.data?.items || []

	const [open, setOpen] = useState(defaultOpen)

	const onClick = () => {
		if (tool.status !== "error") {
			props?.onClick?.()
		}
	}

	if (isCreateMode) {
		return (
			<div
				className="w-full flex-none overflow-hidden py-[5px]"
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
			>
				<div
					className={cn(
						"inline-flex w-fit max-w-full items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border",
						open && "w-full rounded-b-none rounded-t-lg",
					)}
				>
					<div className={tagBase} onClick={onClick}>
						<ToolIconBadge toolName={tool?.name} />
						<span className="w-fit flex-none text-xs font-normal not-italic leading-4 text-foreground">
							{tool?.action}
						</span>
						<div className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
							{tool?.remark}
						</div>
					</div>
					{tool.status !== "error" && (
						<div
							className={cn(toggleButton, "mr-1.5")}
							onClick={() => setOpen((o) => !o)}
						>
							{open ? (
								<ChevronUp
									size={16}
									className="rotate-180 transition-all duration-100 ease-linear"
								/>
							) : (
								<ChevronRight
									size={16}
									className="transition-all duration-100 ease-linear"
								/>
							)}
						</div>
					)}
				</div>
				{open && (
					<MagicScrollBar className="relative m-0 max-h-[300px] rounded-b-lg rounded-t-none pb-1.5 pl-1.5 pr-1.5 pt-0 [&_.simplebar-content]:!pb-2 [&_.simplebar-content]:!pl-2 [&_.simplebar-content]:!pr-2 [&_.simplebar-content]:!pt-0">
						<div className="flex max-h-full w-full flex-col items-center gap-2.5 self-stretch rounded-lg border border-border bg-white p-2.5 dark:bg-card">
							{items.map((o) => (
								<div key={o.id} className="flex items-start gap-2.5 self-stretch">
									<input
										className="aspect-square size-4 rounded-[4px] border border-border"
										type="checkbox"
									/>
									<div className="flex-1 text-xs font-normal not-italic leading-4 text-foreground/80">
										{o?.content}
									</div>
								</div>
							))}
						</div>
					</MagicScrollBar>
				)}
			</div>
		)
	}

	return (
		<div
			className="w-full flex-none overflow-hidden py-[5px]"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border">
				<div
					className={cn(tagBase, isEmpty(tool?.detail) && "cursor-not-allowed")}
					onClick={onClick}
				>
					<ToolIconBadge toolName={tool?.name} />
					<span className="w-fit flex-none text-xs font-normal not-italic leading-4 text-foreground">
						{tool?.action}
					</span>
					<div className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
						{tool?.remark || items.map((o) => o.content)}
					</div>
				</div>
			</div>
		</div>
	)
}

export default memo(observer(TodoWrite))
