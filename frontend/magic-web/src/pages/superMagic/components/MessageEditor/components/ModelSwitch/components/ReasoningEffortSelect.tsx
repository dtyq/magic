import { useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"
import { cn } from "@/utils/cn"
import { useReasoningEffortLabels } from "../hooks/useReasoningEffortLabels"
import { type ModelItem, type ReasoningEffort } from "../types"
import { getModelDisplayedReasoningEffort, getSelectableReasoningLevels } from "../utils"

interface ReasoningEffortSelectProps {
	model: ModelItem
	/** 选中档位后回调带 reasoning_effort 的模型快照；「默认」回传 null 表示跟随后台。 */
	onReasoningEffortChange: (model: ModelItem) => void
	/** 菜单弹出方向：面板底栏向上，悬停卡向下。 */
	side?: "top" | "bottom"
	align?: "start" | "end"
	/** 菜单开合通知，悬停卡用它在菜单打开期间保持自己不关闭。 */
	onOpenChange?: (open: boolean) => void
	className?: string
}

/**
 * 思考强度的唯一控件：一行「思考强度 ［当前值 ⌄］」，点开是带勾选的档位列表，首项是显式「默认」。
 * 档位数量不固定（2 到 7 档），列表比一排胶囊更稳，也不会撑开所在容器。
 * 面板底栏和模型行的悬停卡共用它；显示值从持久化偏好和后台默认推导，不持有本地状态。
 */
export function ReasoningEffortSelect({
	model,
	onReasoningEffortChange,
	side = "top",
	align = "end",
	onOpenChange,
	className,
}: ReasoningEffortSelectProps) {
	const [open, setOpen] = useState(false)
	/**
	 * 最近一次开合是否由鼠标或触摸引起。鼠标操作时不用脚本转移焦点：
	 * 程序化的焦点移动会让浏览器（或系统的焦点高亮）在菜单、按钮上闪出焦点框。
	 * 键盘操作仍按无障碍要求把焦点移进菜单、关闭后还给按钮。
	 */
	const pointerInteractionRef = useRef(false)
	const { labels, defaultLabel, title } = useReasoningEffortLabels()
	const levels = getSelectableReasoningLevels(model)
	const canSelect = levels.length > 0
	const selected = canSelect ? getModelDisplayedReasoningEffort(model) : undefined
	const selectedLabel = selected ? labels[selected] : defaultLabel
	const options: Array<ReasoningEffort | undefined> = [undefined, ...levels]

	function changeOpen(value: boolean) {
		setOpen(value)
		onOpenChange?.(value)
	}

	function selectEffort(effort?: ReasoningEffort) {
		modelCache.setReasoningEffort(model, effort)
		changeOpen(false)
		onReasoningEffortChange({ ...model, reasoning_effort: effort ?? null })
	}

	const trigger = (
		<button
			type="button"
			disabled={!canSelect}
			className={cn(
				"flex h-7 w-full min-w-0 items-center justify-between gap-3 rounded-md px-1.5 text-left text-xs",
				"outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
				canSelect ? "hover:bg-muted/60" : "cursor-default",
				open && "bg-muted/60",
				className,
			)}
			aria-expanded={canSelect ? open : undefined}
			onPointerDown={() => {
				pointerInteractionRef.current = true
			}}
			onKeyDown={() => {
				pointerInteractionRef.current = false
			}}
			data-testid={
				canSelect ? "model-switch-reasoning-trigger" : "model-switch-reasoning-locked"
			}
		>
			<span className="shrink-0 text-muted-foreground">{title}</span>
			<span
				className={cn(
					"flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground",
					canSelect && "bg-muted",
				)}
			>
				{selectedLabel}
				{canSelect ? (
					<ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
				) : null}
			</span>
		</button>
	)

	// 没有可选档位时只展示固定的「默认」，不挂菜单。
	if (!canSelect) return trigger

	return (
		<Popover open={open} onOpenChange={changeOpen}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent
				data-testid="model-switch-reasoning-menu"
				// 菜单挂在 Portal 里；父级 DropdownMenu 据此属性不把它当作外部点击。
				data-model-switch-details-overlay
				side={side}
				align={align}
				sideOffset={6}
				collisionPadding={12}
				// 层级不低于模型面板本身，向上弹出盖在列表上时不会被面板挡住。
				className="z-dropdown w-36 rounded-lg p-0 duration-100"
				onOpenAutoFocus={(event) => {
					// 默认会聚焦滚动区域本身；键盘打开时改为聚焦当前档位，鼠标打开时焦点留在按钮上。
					event.preventDefault()
					if (pointerInteractionRef.current) return
					const content = event.currentTarget
					if (!(content instanceof HTMLElement)) return
					content.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
				}}
				onCloseAutoFocus={(event) => {
					if (pointerInteractionRef.current) event.preventDefault()
				}}
				onPointerDownOutside={() => {
					pointerInteractionRef.current = true
				}}
				onKeyDown={(event) => {
					// 键盘关闭（Esc）或键盘选中时，关闭后把焦点还给按钮。
					if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
						pointerInteractionRef.current = false
					}
				}}
			>
				<ScrollArea viewportClassName="max-h-64">
					<div className="flex flex-col p-1" role="group" aria-label={title}>
						{options.map((level, index) => (
							<div
								key={level ?? "default"}
								className={index === 0 ? "mb-1 border-b pb-1" : undefined}
							>
								<Button
									type="button"
									variant="ghost"
									className="h-8 w-full justify-between px-2 text-xs font-normal"
									onPointerDown={() => {
										pointerInteractionRef.current = true
									}}
									onClick={() => selectEffort(level)}
									aria-pressed={selected === level}
									data-testid={`model-switch-reasoning-option-${level ?? "default"}`}
								>
									{level ? labels[level] : defaultLabel}
									{selected === level ? (
										<Check className="size-3.5" aria-hidden="true" />
									) : null}
								</Button>
							</div>
						))}
					</div>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	)
}
