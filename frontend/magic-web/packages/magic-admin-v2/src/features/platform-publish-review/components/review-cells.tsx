import type { ReactNode } from "react"
import { Building2, ChevronRight, UsersRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CopyableValue } from "@magic-admin-v2/components/copyable-value"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import { cn } from "@magic-admin-v2/utils/cn"
import {
	getPublishTargetTypeLabel,
	getPublishStatusLabel,
	getPublishStatusTone,
	getReviewStatusLabel,
	getReviewStatusTone,
	type StatusTone,
} from "@magic-admin-v2/features/platform-publish-review/formatters"
import type {
	PublishReviewTargetItem,
	PublishReviewTargetValue,
} from "@magic-admin-v2/features/platform-publish-review/types"

export function NameCell({
	copyValue,
	fallbackIcon,
	name,
	secondary,
	secondaryCopyValue,
}: {
	copyValue?: string
	fallbackIcon: ReactNode
	name: string
	secondary?: string
	secondaryCopyValue?: string
}) {
	return (
		<div className="flex h-10 min-w-0 items-center gap-3">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
				{fallbackIcon}
			</div>
			<div className="min-w-0">
				{copyValue ? (
					<CopyableValue
						className="max-w-full font-sans text-sm font-medium text-foreground"
						displayValue={name}
						value={copyValue}
					/>
				) : (
					<div className="truncate font-medium text-foreground">{name}</div>
				)}
				{secondaryCopyValue ? (
					<CopyableValue
						className="max-w-full font-sans text-xs text-muted-foreground"
						displayValue={secondary}
						value={secondaryCopyValue}
					/>
				) : secondary ? (
					<div className="truncate text-xs text-muted-foreground">{secondary}</div>
				) : null}
			</div>
		</div>
	)
}

export function OrganizationCell({ code, name }: { code?: string; name?: string }) {
	const { t } = useTranslation()

	return (
		<div className="flex h-10 min-w-0 flex-col justify-center">
			<div className="truncate text-sm text-foreground">{name || t("common.emptyValue")}</div>
			<CopyableValue
				className="max-w-full font-sans text-xs text-muted-foreground"
				label={t("publishReview.column.organizationCode")}
				value={code}
			/>
		</div>
	)
}

export function ClampedText({ value }: { value: string }) {
	return (
		<div
			className="line-clamp-2 min-w-0 text-sm text-foreground"
			title={value === "-" ? undefined : value}
		>
			{value || "-"}
		</div>
	)
}

export function TableText({ value }: { value?: string }) {
	return <span className="text-sm text-muted-foreground">{value || "-"}</span>
}

export function CopyableTableText({ value }: { value?: string }) {
	return (
		<CopyableValue
			className="max-w-full font-sans text-sm text-muted-foreground"
			displayValue={value || "-"}
			value={value}
		/>
	)
}

export function PublishTargetCell({
	targetType,
	targetValue,
}: {
	targetType: string
	targetValue?: PublishReviewTargetValue | null
}) {
	const { t } = useTranslation()
	const users = targetValue?.users ?? []
	const departments = targetValue?.departments ?? []
	const entries = [...departments, ...users]
	const hasDetails = entries.length > 0

	if (targetType !== "MEMBER" || !hasDetails) {
		return <TableText value={getPublishTargetTypeLabel(targetType, t)} />
	}

	return (
		<Popover>
			<PopoverTrigger data-testid="platform-publish-review-detail-trigger" className="flex min-w-0 max-w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5">
						<Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
							{getPublishTargetTypeLabel(targetType, t)}
						</Badge>
					</div>
					<div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
						{users.length > 0 ? (
							<span className="flex items-center gap-1 whitespace-nowrap">
								<UsersRound className="size-3.5" aria-hidden="true" />
								{t("publishReview.target.memberCount", { count: users.length })}
							</span>
						) : null}
						{departments.length > 0 ? (
							<span className="flex items-center gap-1 whitespace-nowrap">
								<Building2 className="size-3.5" aria-hidden="true" />
								{t("publishReview.target.departmentCount", { count: departments.length })}
							</span>
						) : null}
					</div>
					<div className="mt-1 flex items-center gap-0.5 text-xs text-primary">
						<span>{t("publishReview.target.viewList")}</span>
						<ChevronRight className="size-3.5" aria-hidden="true" />
					</div>
				</div>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-[min(360px,calc(100vw-2rem))] p-0" data-testid="platform-publish-review-filter-content">
				<div className="border-b px-3 py-2.5">
					<div className="text-sm font-medium text-foreground">
						{t("publishReview.target.detailTitle")}
					</div>
					<div className="mt-0.5 text-xs text-muted-foreground">
						{formatTargetCount(users, departments, t)}
					</div>
				</div>
				<div className="max-h-72 space-y-3 overflow-y-auto p-3">
					<TargetDetailSection
						icon={<Building2 className="size-4" aria-hidden="true" />}
						items={departments}
						label={t("publishReview.target.departments")}
					/>
					<TargetDetailSection
						icon={<UsersRound className="size-4" aria-hidden="true" />}
						items={users}
						label={t("publishReview.target.members")}
					/>
				</div>
			</PopoverContent>
		</Popover>
	)
}

function TargetDetailSection({
	icon,
	items,
	label,
}: {
	icon: ReactNode
	items: PublishReviewTargetItem[]
	label: string
}) {
	if (items.length === 0) return null

	return (
		<section>
			<div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
				{icon}
				<span>{label}</span>
				<span>({items.length})</span>
			</div>
			<div className="space-y-1">
				{items.map((item, index) => (
					<div
						className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground odd:bg-muted/40"
						key={item.id || `${item.name || "target"}-${index}`}
					>
						<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
							{(item.name || "?").slice(0, 1)}
						</span>
						<span className="min-w-0 truncate">{item.name || "-"}</span>
					</div>
				))}
			</div>
		</section>
	)
}

function formatTargetCount(
	users: PublishReviewTargetItem[],
	departments: PublishReviewTargetItem[],
	t: ReturnType<typeof useTranslation>["t"],
) {
	return [
		users.length > 0 ? t("publishReview.target.memberCount", { count: users.length }) : null,
		departments.length > 0
			? t("publishReview.target.departmentCount", { count: departments.length })
			: null,
	]
		.filter(Boolean)
		.join(" · ")
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
	const toneClassName = {
		blue: "border-blue-200 bg-blue-50 text-blue-700",
		gray: "border-slate-200 bg-slate-50 text-slate-700",
		green: "border-emerald-200 bg-emerald-50 text-emerald-700",
		red: "border-red-200 bg-red-50 text-red-700",
		yellow: "border-amber-200 bg-amber-50 text-amber-700",
	}[tone]

	return <Badge className={cn("border font-medium", toneClassName)}>{label}</Badge>
}

export function ReviewStatusBadge({ value, t }: { value: string; t: (key: string) => string }) {
	return <StatusBadge label={getReviewStatusLabel(value, t)} tone={getReviewStatusTone(value)} />
}

export function PublishStatusBadge({ value, t }: { value: string; t: (key: string) => string }) {
	return (
		<StatusBadge label={getPublishStatusLabel(value, t)} tone={getPublishStatusTone(value)} />
	)
}
