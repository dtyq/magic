import { useId } from "react"
import { useTranslation } from "react-i18next"
import { useDraggable } from "@dnd-kit/core"
import { GripVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/utils/cn"
import type { PPTBuildEntry, PPTBuildUpdate } from "../../iframe-bridge/types/props"
import { appendBuildStep, groupBuildQueue } from "./buildQueue"

export function PPTBuildQueueItem({
	entry,
	entries,
	selected,
	disabled,
	delayedUntilStep,
	onSelect,
	onUpdate,
}: {
	entry: PPTBuildEntry
	entries: PPTBuildEntry[]
	selected: boolean
	disabled?: boolean
	/** Display number of the step at which a later-appearing ancestor reveals this item. */
	delayedUntilStep?: number
	onSelect: (selector: string) => void
	onUpdate: (updates: PPTBuildUpdate[]) => Promise<void>
}) {
	const { t } = useTranslation("super")
	const id = useId()
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
		id: `item:${entry.selector}`,
		disabled,
		data: { type: "item", selector: entry.selector },
	})
	const groups = selected ? groupBuildQueue(entries) : []
	const grouped = (groups.find((group) => group.step === entry.build.step)?.items.length ?? 0) > 1
	return (
		<li
			ref={setNodeRef}
			className={cn(
				"relative rounded bg-background p-2",
				selected && "bg-accent",
				// The row stays put as a placeholder; a preview follows the pointer.
				isDragging && "opacity-40 outline outline-dashed outline-1 outline-border",
			)}
		>
			<div className="flex min-w-0 items-center gap-1">
				<button
					type="button"
					ref={setActivatorNodeRef}
					disabled={disabled}
					className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
					aria-label={t("ppt.build.dragItem")}
					{...attributes}
					{...listeners}
				>
					<GripVertical size={14} />
				</button>
				<button
					type="button"
					className="min-w-0 flex-1 rounded text-left text-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
					disabled={disabled}
					onClick={() => onSelect(entry.selector)}
					aria-pressed={selected}
				>
					<SmartTooltip>{entry.label}</SmartTooltip>
					<span className="text-xs text-muted-foreground">
						{entry.build.effect === "fade"
							? t("ppt.build.fade")
							: t("ppt.build.appear")}
					</span>
					{delayedUntilStep ? (
						<span className="block text-xs text-amber-600">
							{t("ppt.build.afterParent", { step: delayedUntilStep })}
						</span>
					) : null}
				</button>
				<MagicTooltip title={t("ppt.build.remove")}>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 shrink-0"
						disabled={disabled}
						aria-label={t("ppt.build.remove")}
						onClick={() => void onUpdate([{ selector: entry.selector, build: null }])}
					>
						<Trash2 size={16} />
					</Button>
				</MagicTooltip>
			</div>
			{selected && (
				<div className="mt-2 grid grid-cols-2 gap-2">
					<label className="space-y-1 text-xs" htmlFor={`${id}-effect`}>
						<span className="text-muted-foreground">{t("ppt.build.effect")}</span>
						<select
							id={`${id}-effect`}
							value={entry.build.effect}
							disabled={disabled}
							className="h-8 w-full rounded border border-input bg-background px-1"
							onChange={(event) =>
								void onUpdate([
									{
										selector: entry.selector,
										build: {
											...entry.build,
											effect: event.target.value as "appear" | "fade",
										},
									},
								])
							}
						>
							<option value="appear">{t("ppt.build.appear")}</option>
							<option value="fade">{t("ppt.build.fade")}</option>
						</select>
					</label>
					<label className="space-y-1 text-xs" htmlFor={`${id}-step`}>
						<span className="text-muted-foreground">{t("ppt.build.step")}</span>
						<select
							id={`${id}-step`}
							value={entry.build.step}
							disabled={disabled}
							className="h-8 w-full rounded border border-input bg-background px-1"
							onChange={(event) =>
								void onUpdate(
									event.target.value === "new"
										? appendBuildStep(
												entries,
												entry.selector,
												entry.build.effect,
											)
										: [
												{
													selector: entry.selector,
													build: {
														...entry.build,
														step: Number(event.target.value),
													},
												},
											],
								)
							}
						>
							{groups.map((item, i) => (
								<option key={item.step} value={item.step}>
									{t("ppt.build.stepLabel", { step: i + 1 })}
								</option>
							))}
							{grouped && groups.length < 1000 && (
								<option value="new">{t("ppt.build.newStep")}</option>
							)}
						</select>
					</label>
				</div>
			)}
		</li>
	)
}
