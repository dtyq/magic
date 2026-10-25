import type { NodeProps } from "../../../types"
import { cn } from "@/utils/cn"
import { superMagicStore } from "@/pages/superMagic/stores"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { defaultOpen } from "../../config"
import { useToggleWithScrollPreserve } from "../../../shared/hooks/useToggleWithScrollPreserve"
import { ChevronUp, ChevronRight } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

// Shared tag base — pill row inside the tool container
const tagBase = cn(
	"inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg",
	"bg-white p-1.5 dark:bg-card",
)

// Shared expand/collapse toggle button
const toggleButton = cn(
	"ml-auto inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-sm",
	"hover:bg-fill active:bg-fill-secondary",
)

function TodoWrite(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.super_message_id)
	const tool = node?.tool

	const isCreateMode = tool?.detail?.data?.type === "create"
	const items: Array<{ id: string; content: string; status: string }> =
		tool?.detail?.data?.items || []

	const [open, toggle] = useToggleWithScrollPreserve(defaultOpen)

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
				data-testid="on-mouse-enter"
			>
				<div
					className={cn(
						"inline-flex w-fit max-w-full items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border",
						open && "w-full rounded-b-none rounded-t-lg",
					)}
				>
					<div className={tagBase} onClick={onClick} data-testid="todo-write">
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
							onClick={toggle}
							data-testid="toggle"
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
					// Exclude the outer bottom padding from the viewport cap to retain the 300px panel limit.
					<ScrollArea
						className="m-0 rounded-b-lg rounded-t-none px-1.5 pb-1.5"
						viewportClassName="max-h-[294px] px-2 pb-2 [&>div]:!block"
					>
						<div className="flex max-h-full w-full flex-col items-center gap-2.5 self-stretch rounded-lg border border-border bg-white p-2.5 dark:bg-card">
							{items.map((o) => (
								<div key={o.id} className="flex items-start gap-2.5 self-stretch">
									<input
										className="aspect-square size-4 rounded-[4px] border border-border"
										type="checkbox"
										data-testid="checkbox-input"
									/>
									<div className="flex-1 text-xs font-normal not-italic leading-4 text-foreground/80">
										{o?.content}
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				)}
			</div>
		)
	}

	return (
		<div
			className="w-full flex-none overflow-hidden py-[5px]"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			data-testid="on-mouse-enter-2"
		>
			<div className="inline-flex w-fit max-w-full items-center overflow-hidden rounded-lg border border-[#e5e5e5] shadow-sm dark:border-border">
				<div
					className={cn(tagBase, isEmpty(tool?.detail) && "cursor-not-allowed")}
					onClick={onClick}
					data-testid="todo-write-2"
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
