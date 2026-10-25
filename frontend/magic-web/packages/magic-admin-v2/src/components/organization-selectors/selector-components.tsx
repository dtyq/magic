import { Building2, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { UserAvatarRender } from "@magic-admin-v2/components/user-avatar-render"
import { Button } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"
import type {
	NodeAvatarProps,
	SelectionSummaryProps,
	SelectorRowProps,
	SelectorStateProps,
} from "./types"
import { formatSelectorMessage } from "./utils"

export function SelectionSummary({
	convertDepartmentsToMembers,
	selectedDepartments,
	selectedMembers,
	total,
}: SelectionSummaryProps) {
	const { t } = useTranslation()

	return (
		<div className="min-w-0 text-left text-xs text-muted-foreground">
			<div className="truncate">
				{total ? (
					<>
						{formatSelectorMessage(t("organizationSelector.selection.summary"), {
							total,
						})}
						{selectedMembers
							? formatSelectorMessage(
									t("organizationSelector.selection.memberPart"),
									{
										count: selectedMembers,
									},
								)
							: null}
						{selectedDepartments
							? formatSelectorMessage(
									t("organizationSelector.selection.departmentPart"),
									{
										count: selectedDepartments,
									},
								)
							: null}
					</>
				) : (
					t("organizationSelector.selection.none")
				)}
			</div>
			{convertDepartmentsToMembers && selectedDepartments ? (
				<div className="mt-1 truncate text-sky-700">
					{t("organizationSelector.selection.convertDepartmentsHint")}
				</div>
			) : null}
		</div>
	)
}

export function SelectorRow({
	node,
	onEnterDepartment,
	onToggle,
	selectable,
	selected,
	rowTestId,
	nodeButtonTestId,
	checkboxTestId,
	enterButtonTestId,
}: SelectorRowProps) {
	const { t } = useTranslation()
	const canNavigate = node.type === "department"

	return (
		<div
			className={cn(
				"grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
				"hover:bg-muted/70",
				selected ? "bg-sky-50" : "bg-background",
				node.disabled ? "opacity-50" : null,
			)}
			data-testid={rowTestId}
		>
			{selectable ? (
				<input
					type="checkbox"
					checked={selected}
					disabled={node.disabled}
					onChange={() => onToggle(node)}
					aria-label={formatSelectorMessage(t("organizationSelector.action.selectNode"), {
						name: node.name,
					})}
					className="size-4 rounded border-border accent-primary"
					data-testid={checkboxTestId}
				/>
			) : (
				<span className="size-4" />
			)}

			<button
				type="button"
				className="flex min-w-0 items-center gap-3 text-left disabled:cursor-not-allowed"
				data-testid={nodeButtonTestId}
				disabled={node.disabled}
				onClick={() => (selectable ? onToggle(node) : onEnterDepartment(node))}
			>
				<NodeAvatar node={node} />
				<span className="min-w-0">
					<span className="flex min-w-0 items-center gap-2">
						<span className="truncate font-medium text-foreground">{node.name}</span>
						{node.type === "department" && node.memberCount !== undefined ? (
							<span className="shrink-0 text-xs text-muted-foreground">
								{formatSelectorMessage(t("organizationSelector.node.memberCount"), {
									count: node.memberCount,
								})}
							</span>
						) : null}
					</span>
					{node.description ? (
						<span className="block truncate text-xs text-muted-foreground">
							{node.description}
						</span>
					) : null}
				</span>
			</button>

			{canNavigate ? (
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={() => onEnterDepartment(node)}
					aria-label={formatSelectorMessage(t("organizationSelector.action.enterNode"), {
						name: node.name,
					})}
					data-testid={enterButtonTestId}
				>
					<ChevronRight className="size-4" aria-hidden="true" />
				</Button>
			) : (
				<span className="size-8" />
			)}
		</div>
	)
}

export function NodeAvatar({ node, small = false }: NodeAvatarProps) {
	const sizeClassName = small ? "size-7" : "size-9"
	const iconClassName = small ? "size-3.5" : "size-4"

	if (node.type === "department") {
		return (
			<EntityAvatarRender
				className={sizeClassName}
				fallbackIcon={<Building2 className={iconClassName} aria-hidden="true" />}
			/>
		)
	}

	return (
		<UserAvatarRender
			className={cn(sizeClassName, small ? "text-[11px]" : "text-xs")}
			name={node.name}
			src={node.avatarUrl}
		/>
	)
}

export function SelectorState({ icon, label, testId }: SelectorStateProps & { testId?: string }) {
	return (
		<div
			className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground"
			data-testid={testId}
		>
			<div className="flex items-center gap-2">
				{icon}
				<span>{label}</span>
			</div>
		</div>
	)
}
