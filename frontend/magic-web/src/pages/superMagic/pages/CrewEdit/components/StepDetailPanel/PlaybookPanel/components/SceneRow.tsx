import { useTranslation } from "react-i18next"
import { GripVertical, MoreHorizontal, Pause, PenLine, Play, Trash2 } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Switch } from "@/components/shadcn-ui/switch"
import { MagicDropdown } from "@/components/base/MagicDropdown"
import { cn } from "@/lib/tiptap-utils"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import type { SceneAction, SceneItem } from "../types"
import { observer } from "mobx-react-lite"
import { resolveLocalText } from "./SceneEditPanel/utils"

interface SceneRowProps {
	scene: SceneItem
	selected: boolean
	onSelect: (id: string, checked: boolean) => void
	onToggleEnabled: (id: string) => void
	onAction: (id: string, action: SceneAction) => void
}

export const SceneRow = observer(function SceneRow({
	scene,
	selected,
	onSelect,
	onToggleEnabled,
	onAction,
}: SceneRowProps) {
	const { t, i18n } = useTranslation("crew/create")
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: scene.id,
	})

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"m-1 flex cursor-pointer items-start gap-2.5 overflow-hidden rounded-md px-2.5 py-3 hover:bg-muted/40",
				isDragging && "opacity-50",
			)}
		>
			<button
				type="button"
				className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:text-foreground active:cursor-grabbing"
				aria-label="drag"
				data-testid={`playbook-scene-drag-${scene.id}`}
				{...attributes}
				{...listeners}
			>
				<GripVertical className="h-4 w-4" />
			</button>

			<div className="flex shrink-0 items-center justify-center pt-1">
				<Checkbox
					checked={selected}
					onCheckedChange={(checked) => onSelect(scene.id, !!checked)}
					data-testid={`playbook-scene-checkbox-${scene.id}`}
				/>
			</div>

			<div
				className="flex min-w-0 flex-1 items-start gap-2"
				onClick={() => onAction(scene.id, "edit")}
			>
				<div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-accent">
					<LucideLazyIcon icon={scene.icon} size={16} className="text-muted-foreground" />
				</div>

				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex items-center gap-1.5">
						<p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
							{resolveLocalText(scene.name, i18n.language) || t("playbook.untitled")}
						</p>
						<p className="shrink-0 whitespace-nowrap text-[10px] leading-3 text-muted-foreground">
							{t("playbook.updatedAt", { date: scene.update_at })}
						</p>
					</div>

					<p className="truncate text-xs leading-4 text-muted-foreground">
						{resolveLocalText(scene.description, i18n.language) ||
							t("playbook.untitledDescription")}
					</p>
				</div>
			</div>

			<Switch
				checked={scene.enabled}
				onCheckedChange={() => onToggleEnabled(scene.id)}
				data-testid={`playbook-scene-switch-${scene.id}`}
				className="mt-1 shrink-0"
			/>

			<MagicDropdown
				placement="bottomRight"
				menu={{
					items: [
						{
							key: "edit",
							icon: <PenLine className="h-4 w-4" />,
							label: t("playbook.actions.edit"),
							onClick: () => onAction(scene.id, "edit"),
						},
						{
							key: scene.enabled ? "disable" : "enable",
							icon: scene.enabled ? (
								<Pause className="h-4 w-4" />
							) : (
								<Play className="h-4 w-4" />
							),
							label: scene.enabled
								? t("playbook.actions.disable")
								: t("playbook.actions.enable"),
							onClick: () => onToggleEnabled(scene.id),
						},
						{ type: "divider" },
						{
							key: "delete",
							icon: <Trash2 className="h-4 w-4" />,
							label: t("playbook.actions.delete"),
							danger: true,
							onClick: () => onAction(scene.id, "delete"),
						},
					],
				}}
			>
				<span>
					<Button
						variant="ghost"
						size="icon"
						className={cn("mt-0.5 size-5 shrink-0 rounded-md")}
						data-testid={`playbook-scene-more-${scene.id}`}
					>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</span>
			</MagicDropdown>
		</div>
	)
})
