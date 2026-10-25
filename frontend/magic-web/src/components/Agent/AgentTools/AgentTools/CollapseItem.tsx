import { Divider, Button } from "antd"
import {
	IconAlertCircleFilled,
	IconChevronRight,
	IconTools,
	IconPlus,
	IconPackage,
} from "@tabler/icons-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import { useState } from "react"
import type { UseableToolSet } from "@/types/flow"
import MagicAvatar from "@/components/base/MagicAvatar"
import defaultToolAvatar from "@/assets/logos/tool-avatar.png"
import { useTranslation } from "react-i18next"
import { openCreateToolModal } from "../../../business/CreateToolModal/openCreateToolModal"
import { hasEditRight } from "@/pages/flow/components/AuthControlButton/types"

interface CollapseItemProps {
	item: UseableToolSet.Item
	usableCache: Set<string>
	onToolAdd?: (tool: UseableToolSet.UsableTool, toolSetId: string) => void
	onToolsUpdate?: (toolsetId: string, tools: UseableToolSet.UsableTool[]) => void
}

export default function CollapseItem(props: CollapseItemProps) {
	const { item, usableCache, onToolAdd, onToolsUpdate } = props

	const { t } = useTranslation("agent")

	const [open, setOpen] = useState(true)

	// Open the tool creation flow.
	const handleAddTool = () => {
		if (!item?.id) return

		openCreateToolModal({
			toolsetId: item.id,
			onSuccess: (toolData) => {
				// After publication, update this tool set's list so the user can select the new tool.
				// Do not automatically add the tool to an MCP.
				if (onToolsUpdate && item.tools && toolData.id) {
					// Create a basic tool entry; detailed type configuration is fetched when the tool is used.
					const newTool = {
						code: toolData.id,
						name: toolData.name || "",
						description: toolData.description || "",
						input: {} as any,
						output: {} as any,
						custom_system_input: {} as any,
					} as UseableToolSet.UsableTool
					onToolsUpdate(item.id, [newTool, ...item.tools])
				}
			},
			showJustAddButton: false,
			showAddAndNextButton: true,
		})
	}

	return (
		<div
			className={cn(
				"mb-1 flex flex-col items-start justify-center gap-2 self-stretch rounded-[8px] border border-border p-3 last:mb-0",
				open ? "bg-neutral-50 dark:bg-neutral-900" : "bg-background",
			)}
		>
			<div className="flex w-full cursor-pointer gap-2" onClick={() => setOpen((v) => !v)}>
				<div className="size-[50px] flex-none overflow-hidden rounded-[8px]">
					<MagicAvatar radius={8} src={item?.icon || defaultToolAvatar} size={50}>
						{item?.name}
					</MagicAvatar>
				</div>
				<div className="flex flex-auto flex-col gap-2 overflow-hidden">
					<div className="flex items-center justify-end gap-2">
						<span className="mr-auto line-clamp-1 text-ellipsis text-base font-semibold not-italic leading-[22px] text-foreground/80">
							{item?.name}
						</span>
						<div className="flex items-center gap-1">
							<div className="flex h-5 cursor-pointer items-center gap-0.5 rounded-[3px] bg-fill px-2 py-0.5 dark:bg-white/10 [&_span]:text-xs [&_span]:font-normal [&_span]:not-italic [&_span]:leading-4 [&_span]:text-foreground/60">
								<IconTools size={14} className="text-primary" />
								<span>
									{t("common.tool.card.toolsCount", {
										count: item?.tools?.length || 0,
									})}
								</span>
							</div>
							<div className="flex h-5 cursor-pointer items-center gap-0.5 rounded-[3px] bg-fill px-2 py-0.5 dark:bg-white/10 [&_span]:text-xs [&_span]:font-normal [&_span]:not-italic [&_span]:leading-4 [&_span]:text-foreground/60">
								<IconAlertCircleFilled size={14} className="text-warning" />
								<span>{t("common.tool.card.noQuote")}</span>
							</div>
						</div>
						<div
							className={cn(
								"flex size-5 flex-none items-center justify-center transition-all duration-100 ease-linear",
								open && "rotate-90",
							)}
						>
							<IconChevronRight size={20} />
						</div>
					</div>
					<div className="line-clamp-1 text-ellipsis whitespace-nowrap text-xs font-normal not-italic leading-4 text-foreground/40">
						{item?.description}
					</div>
				</div>
			</div>
			{item?.creator_info?.name && (
				<div className="flex items-center">
					<span className="overflow-hidden text-ellipsis text-xs font-normal not-italic leading-4 text-primary">
						{item?.creator_info?.name}
					</span>
					<Divider type="vertical" />
					<span className="overflow-hidden text-ellipsis text-xs font-normal not-italic leading-4 text-foreground/40">
						{t("common.tool.card.createAt")} {item?.created_at}0
					</span>
				</div>
			)}
			{open && (
				<>
					<Divider className="!m-0" />
					<div className="w-full">
						<div className="my-2.5 text-sm font-semibold not-italic leading-5 text-foreground/80">
							{t("common.tool.card.groupTitle", { count: item?.tools?.length || 0 })}
						</div>

						{/* Creating a tool requires edit permission. */}
						{hasEditRight(item.user_operation || 0) && (
							<Button
								className="mb-2.5 !flex w-full !items-center !justify-center gap-1 !border-border !bg-fill !text-foreground/80 hover:!bg-fill-secondary active:!bg-neutral-300 dark:!bg-white/10 dark:hover:!bg-white/[0.15] dark:active:!bg-white/20 [&_.magic-btn-icon]:flex [&_.magic-btn-icon]:items-center"
								icon={<IconPackage size={20} />}
								onClick={handleAddTool}
							>
								{t("common.tool.addTool")}
							</Button>
						)}
						{/* Reserve space for the persistent scrollbar so it does not cover tool action buttons. */}
						<ScrollArea
							type="always"
							className="w-full"
							viewportClassName="max-h-[220px] pr-3 [&>div]:!block"
						>
							{item?.tools?.map((tool) => (
								<div
									className="mb-2.5 flex w-full cursor-pointer items-start justify-between gap-1 self-stretch overflow-hidden rounded-[12px] bg-background p-3 last:mb-0 hover:bg-fill dark:hover:bg-white/10 [&:hover_.magic-btn]:bg-background"
									key={tool?.code}
								>
									<div className="flex flex-auto flex-col gap-1">
										<div className="text-sm font-semibold not-italic leading-5 text-foreground/80">
											{tool?.name}
										</div>
										<div className="text-xs font-normal not-italic leading-4 text-foreground/60">
											{tool?.description}
										</div>
									</div>
									<div className="flex h-full w-[76px] flex-none items-center [&_.magic-btn-icon]:flex [&_.magic-btn-icon]:items-center">
										<Button
											className="dark:!border-border dark:!bg-fill dark:!text-foreground/80 dark:hover:!bg-fill-secondary dark:disabled:!text-foreground/40"
											block
											disabled={usableCache.has(tool?.code)}
											icon={
												usableCache.has(tool?.code) ? null : (
													<IconPlus size={20} />
												)
											}
											onClick={() => onToolAdd?.(tool, item?.id)}
										>
											{t(
												usableCache.has(tool?.code)
													? "common.tool.card.added"
													: "common.tool.card.add",
											)}
										</Button>
									</div>
								</div>
							))}
						</ScrollArea>
					</div>
				</>
			)}
		</div>
	)
}
