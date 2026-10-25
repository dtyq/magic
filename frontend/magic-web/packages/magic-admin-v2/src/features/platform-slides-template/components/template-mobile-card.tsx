import { Eye, FileImage, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Card, CardContent } from "@magic-admin-v2/components/ui/card"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import {
	slidesTemplateSourceType,
	slidesTemplateStatus,
	type SlidesTemplate,
} from "@magic-admin-v2/features/platform-slides-template/types"
import {
	isSystemSlidesTemplate,
	resolveSlidesTemplateCategoryName,
	resolveSlidesTemplateTagName,
	resolveSlidesTemplateTitle,
} from "@magic-admin-v2/features/platform-slides-template/utils"
import { CopyableCode } from "@magic-admin-v2/features/platform-slides-template/components/copyable-code"
import { mobileCardTokens } from "@magic-admin-v2/components/mobile-card"

type TemplateMobileCardProps = {
	canEdit: boolean
	onDelete: () => void
	onEdit: () => void
	onPreview: () => void
	onStatusChange: (checked: boolean) => void
	record: SlidesTemplate
	statusPending: boolean
}

export function TemplateMobileCard({
	canEdit,
	onDelete,
	onEdit,
	onPreview,
	onStatusChange,
	record,
	statusPending,
}: TemplateMobileCardProps) {
	const { t } = useTranslation()
	const system = isSystemSlidesTemplate(record)

	return (
		<Card className={mobileCardTokens.card}>
			<CardContent className="space-y-3.5 p-4">
				<div className="flex gap-3">
					<div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
						{record.thumbnail_url ? (
							<img
								alt={resolveSlidesTemplateTitle(record)}
								className="size-full object-cover"
								src={record.thumbnail_url}
							/>
						) : (
							<FileImage className="size-5 text-muted-foreground" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<div className="truncate font-semibold">
							{resolveSlidesTemplateTitle(record)}
						</div>
						<CopyableCode value={record.code} />
						<div className="mt-1 text-xs text-muted-foreground">
							{record.source_type === slidesTemplateSourceType.system
								? t("slidesTemplate.system")
								: t("slidesTemplate.official")}{" "}
							·{" "}
							{t("slidesTemplate.mobile.usageCount", {
								count: record.usage_count ?? 0,
							})}
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
					<span>
						{t("slidesTemplate.mobile.categoryLabel")}
						{resolveSlidesTemplateCategoryName(record.category)}
					</span>
					<span>
						{t("slidesTemplate.mobile.sortLabel")}
						{record.sort}
					</span>
					<span className="flex items-center gap-1">
						{t("slidesTemplate.mobile.categoryStatusLabel")}
						{record.category ? (
							<Badge
								variant={
									record.category.status === slidesTemplateStatus.enabled
										? "secondary"
										: "outline"
								}
							>
								{record.category.status === slidesTemplateStatus.enabled
									? t("slidesTemplate.enabled")
									: t("slidesTemplate.disabled")}
							</Badge>
						) : (
							"-"
						)}
					</span>
					<span className="col-span-2">
						{t("slidesTemplate.mobile.tagsLabel")}
						{(record.tags ?? [])
							.map((tag) => resolveSlidesTemplateTagName(tag))
							.join(t("slidesTemplate.listSeparator")) || "-"}
					</span>
				</div>
				<div className="flex items-center justify-between gap-3 border-t pt-3">
					<div className="flex items-center gap-2">
						<span className="text-sm">{t("slidesTemplate.status")}</span>
						<Switch
							checked={record.status === slidesTemplateStatus.enabled}
							disabled={!canEdit}
							loading={statusPending}
							onCheckedChange={onStatusChange}
							data-testid="platform-slides-template-switch"
						/>
					</div>
					<div className="flex min-w-0 gap-2">
						<Button
							onClick={onPreview}
							size="icon-sm"
							className="md:w-auto md:gap-1.5 md:px-2.5"
							variant="outline"
							data-testid="platform-slides-template-delete-button"
						>
							<Eye className="mr-1 size-4" />
						</Button>
						<Button
							aria-label={t("slidesTemplate.aria.editTemplate", {
								name: resolveSlidesTemplateTitle(record),
							})}
							disabled={!canEdit || system}
							onClick={onEdit}
							size="icon-sm"
							className="md:w-auto md:gap-1.5 md:px-2.5"
							variant="outline"
							data-testid="platform-slides-template-delete-button"
						>
							<Pencil className="mr-1 size-4" />
						</Button>
						<Button
							aria-label={t("slidesTemplate.aria.deleteTemplate", {
								name: resolveSlidesTemplateTitle(record),
							})}
							disabled={!canEdit || system}
							onClick={onDelete}
							size="icon-sm"
							className="md:w-auto md:gap-1.5 md:px-2.5"
							variant="outline"
							data-testid="platform-slides-template-delete-button"
						>
							<Trash2 className="size-4 text-destructive" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
