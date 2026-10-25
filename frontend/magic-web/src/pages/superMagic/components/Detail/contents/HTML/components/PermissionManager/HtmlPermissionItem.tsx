import { useEffect, useState } from "react"
import type { TFunction } from "i18next"
import { Clock3, Loader2, ShieldCheck, ShieldOff, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import type { HtmlPermissionScope } from "../../iframe-api/types"
import type { HtmlPermissionSnapshotItem } from "../../iframe-api/services/IframePermissionService"
import {
	parseHtmlPermissionTtl,
	serializeHtmlPermissionTtl,
	type HtmlPermissionTtl,
} from "../../iframe-api/services/htmlPermissionPolicy"
import { useHtmlPermissionI18n } from "../../hooks/useHtmlPermissionI18n"

interface HtmlPermissionItemProps {
	item: HtmlPermissionSnapshotItem
	now: number
	dateFormatter: Intl.DateTimeFormat
	disabled: boolean
	authorizing: boolean
	updating: boolean
	revoking: boolean
	onAuthorize: (scope: HtmlPermissionScope) => Promise<void>
	onUpdateTtl: (scope: HtmlPermissionScope, ttlMs: HtmlPermissionTtl) => Promise<void>
	onRevoke: (scope: HtmlPermissionScope) => Promise<void>
}

export function HtmlPermissionItem({
	item,
	now,
	dateFormatter,
	disabled,
	authorizing,
	updating,
	revoking,
	onAuthorize,
	onUpdateTtl,
	onRevoke,
}: HtmlPermissionItemProps) {
	const { t } = useTranslation("super")
	const { getScopeLabel, getTtlLabel } = useHtmlPermissionI18n()
	const grant = item.grant
	const currentTtlMs = grant
		? grant.expiresAt === null
			? null
			: grant.expiresAt - grant.grantedAt
		: 0
	const currentTtlValue = serializeHtmlPermissionTtl(currentTtlMs)
	const [selectedTtlValue, setSelectedTtlValue] = useState(currentTtlValue)
	const selectedTtl = parseHtmlPermissionTtl(selectedTtlValue)
	const scope = item.scope as HtmlPermissionScope
	const busy = disabled || authorizing || updating || revoking
	const canUpdate =
		Boolean(grant) &&
		(selectedTtl === null || Number.isFinite(selectedTtl)) &&
		selectedTtl !== 0 &&
		selectedTtl !== currentTtlMs

	useEffect(() => {
		setSelectedTtlValue(currentTtlValue)
	}, [currentTtlValue])

	return (
		<div className="p-4">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-sm font-medium">
					{item.supported ? getScopeLabel(scope) : item.scope}
				</span>
				{item.declarationStatus === "unsupported" ? <UnsupportedBadge /> : null}
				<GrantBadge granted={Boolean(grant)} />
				{grant ? <CodeChangeBadge item={item} /> : null}
			</div>
			{grant ? (
				<>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<span>
							{t("htmlEditor.permissionManager.grantedAt", {
								time: dateFormatter.format(grant.grantedAt),
							})}
						</span>
						<span className="inline-flex items-center gap-1">
							<Clock3 size={12} />
							{grant.expiresAt === null
								? t("htmlEditor.permissionManager.alwaysValid")
								: t("htmlEditor.permissionManager.expiresAt", {
										time: dateFormatter.format(grant.expiresAt),
										remaining: formatRemaining(grant.expiresAt - now, t),
									})}
						</span>
					</div>
					{item.supported ? (
						<div className="mt-3 flex flex-wrap items-center gap-2">
							<span className="text-xs text-muted-foreground">
								{t("htmlEditor.permissionManager.durationLabel")}
							</span>
							{item.ttlOptions.length > 0 ? (
								<>
									<Select
										value={selectedTtlValue}
										onValueChange={setSelectedTtlValue}
										disabled={busy}
									>
										<SelectTrigger
											size="sm"
											className="w-32"
											aria-label={t(
												"htmlEditor.permissionManager.durationSelect",
												{ scope: getScopeLabel(scope) },
											)}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{item.ttlOptions.map((option) => (
												<SelectItem
													key={serializeHtmlPermissionTtl(option.ttlMs)}
													value={serializeHtmlPermissionTtl(option.ttlMs)}
												>
													{getTtlLabel(option.ttlMs)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Button
										size="sm"
										disabled={!canUpdate || busy}
										onClick={() => void onUpdateTtl(scope, selectedTtl)}
									>
										{updating ? (
											<Loader2 size={14} className="animate-spin" />
										) : null}
										{t("htmlEditor.permissionManager.updateDuration")}
									</Button>
								</>
							) : null}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										className="gap-1.5"
										disabled={busy}
										onClick={() => void onRevoke(scope)}
									>
										{revoking ? (
											<Loader2 size={16} className="animate-spin" />
										) : (
											<ShieldOff size={16} />
										)}
										{t("htmlEditor.permissionManager.revoke")}
									</Button>
								</TooltipTrigger>
								<TooltipContent
									side="top"
									className="z-tooltip max-w-80 whitespace-normal text-wrap break-words text-left"
								>
									<p className="font-medium">
										{t("htmlEditor.permissionManager.revokeNoteTitle")}
									</p>
									<p className="mt-1 text-background/80">
										{t("htmlEditor.permissionManager.revokeNote")}
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
					) : null}
				</>
			) : item.supported ? (
				<div className="mt-2 flex flex-wrap items-center justify-between gap-3">
					<p className="text-xs text-muted-foreground">
						{t("htmlEditor.permissionManager.askWhenUsed")}
					</p>
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						disabled={busy}
						onClick={() => void onAuthorize(scope)}
					>
						{authorizing ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<ShieldCheck size={16} />
						)}
						{t("htmlEditor.permissionManager.authorize")}
					</Button>
				</div>
			) : null}
		</div>
	)
}

/**
 * Shows whether the app code changed after the grant was confirmed. Read-only grants stay
 * valid silently; high-risk ones announce that they will ask again on next use.
 */
function CodeChangeBadge({ item }: { item: HtmlPermissionSnapshotItem }) {
	const { t } = useTranslation("super")
	if (item.needsReconfirm) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant="outline"
						className="gap-1 border-amber-300 text-amber-700 dark:text-amber-300"
						data-testid="html-permission-reconfirm-badge"
					>
						<TriangleAlert size={12} />
						{t("htmlEditor.permissionManager.reconfirmNext")}
					</Badge>
				</TooltipTrigger>
				<TooltipContent
					side="top"
					className="z-tooltip max-w-80 whitespace-normal text-wrap break-words text-left"
				>
					{t("htmlEditor.permissionManager.reconfirmNextHint")}
				</TooltipContent>
			</Tooltip>
		)
	}
	if (item.codeStatus !== "changed") return null
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge
					variant="outline"
					className="gap-1 border-amber-300 text-amber-700 dark:text-amber-300"
					data-testid="html-permission-code-changed-badge"
				>
					<TriangleAlert size={12} />
					{t("htmlEditor.permissionManager.codeChanged")}
				</Badge>
			</TooltipTrigger>
			<TooltipContent
				side="top"
				className="z-tooltip max-w-80 whitespace-normal text-wrap break-words text-left"
			>
				{t("htmlEditor.permissionManager.codeChangedHint")}
			</TooltipContent>
		</Tooltip>
	)
}

function UnsupportedBadge() {
	const { t } = useTranslation("super")
	return (
		<Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
			{t("htmlEditor.permissionManager.unsupported")}
		</Badge>
	)
}

function GrantBadge({ granted }: { granted: boolean }) {
	const { t } = useTranslation("super")
	return granted ? (
		<Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
			{t("htmlEditor.permissionManager.granted")}
		</Badge>
	) : (
		<Badge variant="outline">{t("htmlEditor.permissionManager.notGranted")}</Badge>
	)
}

export function formatRemaining(remainingMs: number, t: TFunction<"super">) {
	if (remainingMs <= 0) return t("htmlEditor.permissionManager.remainingExpired")
	if (remainingMs > 24 * 60 * 60 * 1000) {
		return t("htmlEditor.permissionManager.remainingDays", {
			count: Math.ceil(remainingMs / (24 * 60 * 60 * 1000)),
		})
	}
	const minutes = Math.ceil(remainingMs / 60_000)
	if (minutes <= 1) return t("htmlEditor.permissionManager.remainingLessThanMinute")
	if (minutes < 60) return t("htmlEditor.permissionManager.remainingMinutes", { count: minutes })
	const hours = Math.ceil(minutes / 60)
	return t("htmlEditor.permissionManager.remainingHours", { count: hours })
}
