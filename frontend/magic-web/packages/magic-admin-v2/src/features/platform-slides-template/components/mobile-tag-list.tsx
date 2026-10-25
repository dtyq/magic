import { MoreHorizontal, Pencil, Tags, Trash2, PowerOff, Power } from "lucide-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { mobileCardTokens } from "@magic-admin-v2/components/mobile-card"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { CopyableCode } from "@magic-admin-v2/features/platform-slides-template/components/copyable-code"
import {
	slidesTemplateStatus,
	type SlidesTemplateTag,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	formatDateTime,
	resolveSlidesTemplateTagName,
} from "@magic-admin-v2/features/platform-slides-template/utils"

type MobileTagListProps = {
	canEdit: boolean
	groupNames: Map<string, string>
	isLoading: boolean
	language: string
	onDelete: (tag: SlidesTemplateTag) => void
	onEdit: (tag: SlidesTemplateTag) => void
	onStatusChange: (tag: SlidesTemplateTag, enabled: boolean) => void
	selectedGroupId: string | null
	statusPendingIds: Set<string>
	tags: SlidesTemplateTag[]
}

export function MobileTagList({
	canEdit,
	groupNames,
	isLoading,
	language,
	onDelete,
	onEdit,
	onStatusChange,
	selectedGroupId,
	statusPendingIds,
	tags,
}: MobileTagListProps) {
	const { t } = useTranslation()

	if (isLoading) {
		return (
			<div className={`${mobileCardTokens.list} md:hidden`}>
				{Array.from({ length: 3 }).map((_, index) => (
					<div className={mobileCardTokens.card} key={index}>
						<div className={mobileCardTokens.header}>
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-6 w-14" />
						</div>
						<div className="px-4 pb-3">
							<Skeleton className="h-4 w-40" />
						</div>
						<div className={mobileCardTokens.content}>
							<Skeleton className="h-9" />
							<Skeleton className="h-9" />
						</div>
					</div>
				))}
			</div>
		)
	}

	if (tags.length === 0) {
		return (
			<div className="md:hidden">
				<EmptyState icon={Tags} title={t("slidesTemplate.emptyTags")} testId="platform-slides-template-empty" />
			</div>
		)
	}

	return (
		<div className={`${mobileCardTokens.list} md:hidden`}>
			{tags.map((tag) => {
				const enabled = tag.status === slidesTemplateStatus.enabled
				return (
					<article className={`${mobileCardTokens.card} min-w-0`} key={tag.id}>
						<div className={mobileCardTokens.header}>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 items-center gap-2">
									<h4 className="truncate text-sm font-semibold text-foreground">
										{resolveSlidesTemplateTagName(tag)}
									</h4>
									<Badge variant={enabled ? "success" : "outline"}>
										{enabled
											? t("slidesTemplate.enabled")
											: t("slidesTemplate.disabled")}
									</Badge>
								</div>
								<div className="mt-2 min-w-0 text-xs text-muted-foreground">
									<CopyableCode value={tag.code} />
								</div>
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger asChild data-testid="platform-slides-template-menu-trigger">
									<Button
										aria-label={t("slidesTemplate.actions")}
										className="-mr-2 -mt-2"
										size="icon"
										variant="ghost"
									 data-testid="platform-slides-template-edit-button">
										<MoreHorizontal className="size-4" aria-hidden="true" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" data-testid="platform-slides-template-action-button">
									<DropdownMenuItem
										disabled={!canEdit}
										onSelect={() => onEdit(tag)}
									 data-testid="platform-slides-template-menu-item">
										<Pencil className="mr-2 size-4" aria-hidden="true" />
										{t("common.edit")}
									</DropdownMenuItem>
									<DropdownMenuItem
										disabled={!canEdit || statusPendingIds.has(tag.id)}
										onSelect={() => onStatusChange(tag, !enabled)}
									 data-testid="platform-slides-template-menu-item">
										{enabled ? (
											<PowerOff className="mr-2 size-4" aria-hidden="true" />
										) : (
											<Power className="mr-2 size-4" aria-hidden="true" />
										)}
										{enabled
											? t("slidesTemplate.disabled")
											: t("slidesTemplate.enabled")}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										disabled={!canEdit}
										onSelect={() => onDelete(tag)}
									 data-testid="platform-slides-template-menu-item">
										<Trash2 className="mr-2 size-4" aria-hidden="true" />
										{t("slidesTemplate.delete")}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						<div className={mobileCardTokens.content}>
							{selectedGroupId === null ? (
								<div className="min-w-0">
									<p className={mobileCardTokens.label}>
										{t("slidesTemplate.parentGroup")}
									</p>
									<p className="truncate text-sm">
										{groupNames.get(String(tag.parent_id)) ?? "-"}
									</p>
								</div>
							) : null}
							<div className="min-w-0">
								<p className={mobileCardTokens.label}>
									{t("slidesTemplate.categoryCount")}
								</p>
								<p className="text-sm">{tag.template_count ?? 0}</p>
							</div>
							<div className="min-w-0">
								<p className={mobileCardTokens.label}>{t("slidesTemplate.sort")}</p>
								<p className="text-sm">{tag.sort}</p>
							</div>
							<div className="col-span-2 min-w-0">
								<p className={mobileCardTokens.label}>
									{t("slidesTemplate.updatedAt")}
								</p>
								<p className="truncate text-sm text-muted-foreground">
									{formatDateTime(
										tag.updated_at,
										language === "en_US" ? "en-US" : "zh-CN",
									)}
								</p>
							</div>
						</div>
					</article>
				)
			})}
		</div>
	)
}
