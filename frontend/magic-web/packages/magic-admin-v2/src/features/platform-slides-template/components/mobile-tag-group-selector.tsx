import {
	ChevronDown,
	MoreHorizontal,
	Pencil,
	Plus,
	Power,
	PowerOff,
	Tags,
	Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { mobileCardTokens } from "@magic-admin-v2/components/mobile-card"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@magic-admin-v2/components/ui/sheet"
import {
	slidesTemplateStatus,
	type SlidesTemplateTag,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	isSystemSlidesTemplateTagGroup,
	resolveSlidesTemplateTagName,
} from "@magic-admin-v2/features/platform-slides-template/utils"
import { cn } from "@magic-admin-v2/utils/cn"

type MobileTagGroupSelectorProps = {
	canEdit: boolean
	groups: SlidesTemplateTag[]
	onAdd: () => void
	onDelete: (group: SlidesTemplateTag) => void
	onEdit: (group: SlidesTemplateTag) => void
	onSelect: (groupId: string | null) => void
	onStatusChange: (group: SlidesTemplateTag, enabled: boolean) => void
	selectedGroup: SlidesTemplateTag | null
	selectedGroupId: string | null
	statusPendingIds: Set<string>
	total: number
}

export function MobileTagGroupSelector({
	canEdit,
	groups,
	onAdd,
	onDelete,
	onEdit,
	onSelect,
	onStatusChange,
	selectedGroup,
	selectedGroupId,
	statusPendingIds,
	total,
}: MobileTagGroupSelectorProps) {
	const { t } = useTranslation()
	const [open, setOpen] = useState(false)
	const [keyword, setKeyword] = useState("")
	const filteredGroups = useMemo(() => {
		const normalizedKeyword = keyword.trim().toLowerCase()
		if (!normalizedKeyword) return groups
		return groups.filter((group) =>
			`${resolveSlidesTemplateTagName(group)} ${group.code}`
				.toLowerCase()
				.includes(normalizedKeyword),
		)
	}, [groups, keyword])

	const selectGroup = (groupId: string | null) => {
		onSelect(groupId)
		setOpen(false)
	}

	return (
		<>
			<button data-testid="platform-slides-template-mobile-tag-trigger"
				className={`${mobileCardTokens.card} flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 md:hidden`}
				onClick={() => setOpen(true)}
				type="button"
			>
				<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
					<Tags className="size-4" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold text-foreground">
						{selectedGroup
							? resolveSlidesTemplateTagName(selectedGroup)
							: t("slidesTemplate.allTags")}
					</span>
					<p className="mt-0.5 text-xs text-muted-foreground">
						{t("common.paginationTotal", { count: total })}
					</p>
				</div>
				<ChevronDown
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden="true"
				/>
			</button>

			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent data-testid="platform-slides-template-mobile-tag-content" closeButtonTestId="platform-slides-template-mobile-tag-close-button" className="max-h-[82svh] gap-0 rounded-t-2xl p-0" side="bottom">
					<SheetHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left">
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<SheetTitle>{t("slidesTemplate.tagGroupTitle")}</SheetTitle>
								<SheetDescription>
									{t("slidesTemplate.mobile.selectTagGroup")}
								</SheetDescription>
							</div>
							<Button
								aria-label={t("slidesTemplate.createTagGroup")}
								disabled={!canEdit}
								onClick={() => {
									setOpen(false)
									onAdd()
								}}
								size="icon"
								variant="outline"
							 data-testid="platform-slides-template-create-button">
								<Plus className="size-4" aria-hidden="true" />
							</Button>
						</div>
					</SheetHeader>
					<div className="min-h-0 overflow-y-auto p-3">
						<FilterSearchInput
							clearLabel={t("common.clear")}
							onValueChange={setKeyword}
							placeholder={t("slidesTemplate.mobile.searchTagGroup")}
							value={keyword}
						 inputTestId="platform-slides-template-mobile-search-input" clearButtonTestId="platform-slides-template-mobile-search-clear-button"/>
						<div className="mt-3 grid gap-1">
							<button data-testid="platform-slides-template-mobile-tag-option"
								className={cn(
									"flex min-h-14 items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-muted",
									selectedGroupId === null && "bg-primary/10",
								)}
								onClick={() => selectGroup(null)}
								type="button"
							>
								<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
									<Tags className="size-4" aria-hidden="true" />
								</div>
								<div className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium">
										{t("slidesTemplate.allTags")}
									</span>
									<span className="mt-0.5 block text-xs text-muted-foreground">
										{t("slidesTemplate.mobile.viewAllTagGroups")}
									</span>
								</div>
							</button>

							{filteredGroups.map((group) => {
								const enabled = group.status === slidesTemplateStatus.enabled
								return (
									<div
										className={cn(
											"flex min-h-16 items-center gap-2 rounded-lg px-3 transition-colors hover:bg-muted",
											selectedGroupId === String(group.id) && "bg-primary/10",
										)}
										key={group.id}
									>
										<button data-testid="platform-slides-template-mobile-tag-apply-button"
											className="min-w-0 flex-1 text-left"
											onClick={() => selectGroup(String(group.id))}
											type="button"
										>
											<span className="flex min-w-0 items-center gap-2">
												<span className="truncate text-sm font-medium">
													{resolveSlidesTemplateTagName(group)}
												</span>
												{isSystemSlidesTemplateTagGroup(group) ? (
													<Badge className="h-5 px-1.5" variant="outline">
														{t("slidesTemplate.systemBuiltIn")}
													</Badge>
												) : null}
											</span>
											<span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
												<span className="truncate">{group.code}</span>
												<span aria-hidden="true">·</span>
												<span>
													{t("slidesTemplate.mobile.sortValue", {
														value: group.sort,
													})}
												</span>
											</span>
										</button>
										<Badge variant={enabled ? "success" : "outline"}>
											{enabled
												? t("slidesTemplate.enabled")
												: t("slidesTemplate.disabled")}
										</Badge>
										<DropdownMenu modal={false}>
											<DropdownMenuTrigger asChild data-testid="platform-slides-template-menu-trigger">
												<Button
													aria-label={t("slidesTemplate.actions")}
													size="icon"
													variant="ghost"
												 data-testid="platform-slides-template-edit-button">
													<MoreHorizontal
														className="size-4"
														aria-hidden="true"
													/>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" data-testid="platform-slides-template-action-button">
												<DropdownMenuItem
													disabled={!canEdit}
													onSelect={() => {
														setOpen(false)
														onEdit(group)
													}}
												 data-testid="platform-slides-template-menu-item">
													<Pencil
														className="mr-2 size-4"
														aria-hidden="true"
													/>
													{t("common.edit")}
												</DropdownMenuItem>
												<DropdownMenuItem
													disabled={
														!canEdit || statusPendingIds.has(group.id)
													}
													onSelect={() => onStatusChange(group, !enabled)}
												 data-testid="platform-slides-template-menu-item">
													{enabled ? (
														<PowerOff
															className="mr-2 size-4"
															aria-hidden="true"
														/>
													) : (
														<Power
															className="mr-2 size-4"
															aria-hidden="true"
														/>
													)}
													{enabled
														? t("slidesTemplate.disabled")
														: t("slidesTemplate.enabled")}
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													disabled={
														!canEdit ||
														isSystemSlidesTemplateTagGroup(group)
													}
													onSelect={() => {
														setOpen(false)
														onDelete(group)
													}}
												 data-testid="platform-slides-template-menu-item">
													<Trash2
														className="mr-2 size-4"
														aria-hidden="true"
													/>
													{t("slidesTemplate.delete")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								)
							})}
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</>
	)
}
