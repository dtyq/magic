import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn-ui/alert"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Separator } from "@/components/shadcn-ui/separator"
import magicToast from "@/components/base/MagicToaster/utils"
import { normalizeLocale } from "@/utils/locale"
import type { HtmlPermissionScope } from "../../iframe-api/types"
import type {
	HtmlPermissionDiagnostic,
	HtmlPermissionSnapshot,
} from "../../iframe-api/services/IframePermissionService"
import type { HtmlPermissionTtl } from "../../iframe-api/services/htmlPermissionPolicy"
import { HtmlPermissionItem } from "./HtmlPermissionItem"

interface HtmlPermissionManagerDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	permissionRevision: string | number
	getPermissionSnapshot: () => Promise<HtmlPermissionSnapshot>
	onAuthorize: (scope: HtmlPermissionScope) => Promise<boolean>
	onRevoke: (scope: HtmlPermissionScope) => Promise<HtmlPermissionSnapshot>
	onUpdateTtl: (
		scope: HtmlPermissionScope,
		ttlMs: HtmlPermissionTtl,
	) => Promise<HtmlPermissionSnapshot>
	onRevokeAll: () => Promise<HtmlPermissionSnapshot>
	/** Marks the current app code as reviewed for every grant (keeps expiry). */
	onAcknowledgeCodeChanges: () => Promise<HtmlPermissionSnapshot>
}

export default function HtmlPermissionManagerDialog({
	open,
	onOpenChange,
	permissionRevision,
	getPermissionSnapshot,
	onAuthorize,
	onRevoke,
	onUpdateTtl,
	onRevokeAll,
	onAcknowledgeCodeChanges,
}: HtmlPermissionManagerDialogProps) {
	const { t, i18n } = useTranslation("super")
	const [snapshot, setSnapshot] = useState<HtmlPermissionSnapshot | null>(null)
	const [loading, setLoading] = useState(false)
	const [authorizingScope, setAuthorizingScope] = useState<HtmlPermissionScope | null>(null)
	const [revokingScope, setRevokingScope] = useState<HtmlPermissionScope | null>(null)
	const [updatingScope, setUpdatingScope] = useState<HtmlPermissionScope | null>(null)
	const [revokingAll, setRevokingAll] = useState(false)
	const [acknowledging, setAcknowledging] = useState(false)
	const [now, setNow] = useState(() => Date.now())

	const dateFormatter = useMemo(
		() => createHtmlPermissionDateFormatter(i18n.language),
		[i18n.language],
	)

	const refreshSnapshot = useCallback(async () => {
		setLoading(true)
		try {
			setSnapshot(await getPermissionSnapshot())
			setNow(Date.now())
		} catch {
			magicToast.error(t("htmlEditor.permissionManager.loadFailed"))
		} finally {
			setLoading(false)
		}
	}, [getPermissionSnapshot, t])

	useEffect(() => {
		if (!open) return
		void refreshSnapshot()
	}, [open, permissionRevision, refreshSnapshot])

	useEffect(() => {
		if (!open || !snapshot) return
		const timer = window.setInterval(() => {
			const currentTime = Date.now()
			setNow(currentTime)
			if (
				snapshot.permissions.some(
					(item) =>
						item.grant?.expiresAt !== null &&
						item.grant?.expiresAt !== undefined &&
						item.grant.expiresAt <= currentTime,
				)
			) {
				void refreshSnapshot()
			}
		}, 30_000)
		return () => window.clearInterval(timer)
	}, [open, refreshSnapshot, snapshot])

	const handleRevoke = async (scope: HtmlPermissionScope) => {
		setRevokingScope(scope)
		try {
			setSnapshot(await onRevoke(scope))
			magicToast.success(t("htmlEditor.permissionManager.revokeSuccess"))
		} catch {
			magicToast.error(t("htmlEditor.permissionManager.revokeFailed"))
		} finally {
			setRevokingScope(null)
		}
	}

	const handleAuthorize = async (scope: HtmlPermissionScope) => {
		setAuthorizingScope(scope)
		try {
			const allowed = await onAuthorize(scope)
			setSnapshot(await getPermissionSnapshot())
			setNow(Date.now())
			if (allowed) magicToast.success(t("htmlEditor.permissionManager.authorizeSuccess"))
		} catch {
			magicToast.error(t("htmlEditor.permissionManager.authorizeFailed"))
		} finally {
			setAuthorizingScope(null)
		}
	}

	const handleUpdateTtl = async (scope: HtmlPermissionScope, ttlMs: HtmlPermissionTtl) => {
		setUpdatingScope(scope)
		try {
			setSnapshot(await onUpdateTtl(scope, ttlMs))
			setNow(Date.now())
			magicToast.success(t("htmlEditor.permissionManager.updateDurationSuccess"))
		} catch {
			magicToast.error(t("htmlEditor.permissionManager.updateDurationFailed"))
		} finally {
			setUpdatingScope(null)
		}
	}

	const handleRevokeAll = async () => {
		setRevokingAll(true)
		try {
			setSnapshot(await onRevokeAll())
			magicToast.success(t("htmlEditor.permissionManager.revokeAllSuccess"))
		} catch {
			magicToast.error(t("htmlEditor.permissionManager.revokeFailed"))
		} finally {
			setRevokingAll(false)
		}
	}

	const handleAcknowledge = async () => {
		setAcknowledging(true)
		try {
			setSnapshot(await onAcknowledgeCodeChanges())
			magicToast.success(t("htmlEditor.permissionManager.codeBanner.acknowledgeSuccess"))
		} catch {
			magicToast.error(t("htmlEditor.permissionManager.codeBanner.acknowledgeFailed"))
		} finally {
			setAcknowledging(false)
		}
	}

	const declaredCount =
		snapshot?.permissions.filter((item) => item.declarationStatus === "declared").length ?? 0
	const visiblePermissions = useMemo(
		() =>
			snapshot?.permissions.filter(
				(item) =>
					item.supported &&
					(snapshot.mode === "legacy"
						? Boolean(item.grant)
						: item.declarationStatus === "declared"),
			) ?? [],
		[snapshot],
	)
	const visibleDiagnostics = useMemo(
		() => snapshot?.diagnostics.filter((item) => item.code !== "scopeUnsupported") ?? [],
		[snapshot],
	)
	const emptyPermissionsMessage =
		snapshot?.mode === "legacy"
			? t("htmlEditor.permissionManager.noActivePermissions")
			: t("htmlEditor.permissionManager.noDeclaredPermissions")
	const permissionMutationInProgress = Boolean(
		authorizingScope || revokingScope || updatingScope || revokingAll || acknowledging,
	)
	const showCodeBanner =
		Boolean(snapshot) &&
		((snapshot?.codeChangedGrantCount ?? 0) > 0 || (snapshot?.needsReconfirmCount ?? 0) > 0)
	const getDiagnosticText = useCallback(
		(diagnostic: HtmlPermissionDiagnostic) => {
			switch (diagnostic.code) {
				case "manifestAbsent":
					return t("htmlEditor.permissionManager.diagnostics.manifestAbsent")
				case "manifestLoadError":
					return t("htmlEditor.permissionManager.diagnostics.manifestLoadError", {
						error: diagnostic.error,
					})
				case "scopesInvalid":
					return t("htmlEditor.permissionManager.diagnostics.scopesInvalid")
				case "scopeInvalid":
					return t("htmlEditor.permissionManager.diagnostics.scopeInvalid")
				case "scopeDuplicate":
					return t("htmlEditor.permissionManager.diagnostics.scopeDuplicate", {
						scope: diagnostic.scope,
					})
				case "scopeUnsupported":
					return t("htmlEditor.permissionManager.diagnostics.scopeUnsupported", {
						scope: diagnostic.scope,
					})
			}
		},
		[t],
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="grid h-[min(800px,90dvh)] max-h-[calc(100dvh-2rem)] w-[min(880px,calc(100vw-2rem))] !max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
				data-testid="html-permission-manager-dialog"
			>
				<DialogHeader className="shrink-0 gap-2 border-b px-6 py-5 pr-12">
					<div className="flex items-center gap-2">
						<ShieldCheck size={16} className="text-primary" />
						<DialogTitle>{t("htmlEditor.permissionManager.title")}</DialogTitle>
					</div>
					<DialogDescription>
						{t("htmlEditor.permissionManager.description")}
					</DialogDescription>
				</DialogHeader>

				<ScrollArea
					type="always"
					className="h-full min-h-0 overflow-hidden [&_[data-slot=scroll-area-scrollbar]]:w-2 [&_[data-slot=scroll-area-scrollbar]]:p-0.5 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/40"
					viewportClassName="h-full overflow-y-auto pr-2"
					data-testid="html-permission-manager-scroll-area"
				>
					<div className="space-y-5 px-6 py-5">
						{(loading && !snapshot) || snapshot?.configStatus === "loading" ? (
							<div className="flex min-h-56 items-center justify-center">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
							</div>
						) : snapshot ? (
							<>
								<section className="rounded-lg border bg-muted/30 p-4">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="min-w-0">
											<h3 className="truncate text-sm font-semibold text-foreground">
												{snapshot.app.name ||
													t(
														"htmlEditor.permissionManager.defaultAppName",
													)}
											</h3>
											<p className="mt-1 text-xs text-muted-foreground">
												{snapshot.app.reason ||
													t("htmlEditor.permissionManager.noReason")}
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											<Badge variant="secondary">
												{t("htmlEditor.permissionManager.declaredCount", {
													count: declaredCount,
												})}
											</Badge>
											<Badge variant="outline">
												{t("htmlEditor.permissionManager.grantedCount", {
													count: snapshot.activeGrantCount,
												})}
											</Badge>
										</div>
									</div>
									<dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
										<AppMeta
											label={t("htmlEditor.permissionManager.version")}
											value={snapshot.app.version || "-"}
										/>
										<AppMeta
											label={t("htmlEditor.permissionManager.entry")}
											value={snapshot.app.entry || "-"}
										/>
										<AppMeta
											label={t("htmlEditor.permissionManager.appRoot")}
											value={snapshot.app.appRootDir || "/"}
										/>
									</dl>
								</section>

								{visibleDiagnostics.length > 0 ? (
									<Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
										<AlertCircle />
										{/* 标题和说明必须作为同一个网格项，避免被 Alert 分配到不同位置。 */}
										<div className="min-w-0 space-y-1">
											<AlertTitle>
												{t("htmlEditor.permissionManager.diagnosticsTitle")}
											</AlertTitle>
											<AlertDescription className="text-amber-800 dark:text-amber-200">
												<ul className="list-disc space-y-1 pl-4">
													{visibleDiagnostics.map((diagnostic, index) => (
														<li
															key={`${diagnostic.code}-${diagnostic.scope || index}`}
														>
															{getDiagnosticText(diagnostic)}
														</li>
													))}
												</ul>
											</AlertDescription>
										</div>
									</Alert>
								) : null}

								{showCodeBanner && snapshot ? (
									<Alert
										className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
										data-testid="html-permission-code-banner"
									>
										<AlertCircle />
										<div className="min-w-0 space-y-2">
											<AlertTitle className="line-clamp-none">
												{t("htmlEditor.permissionManager.codeBanner.title")}
											</AlertTitle>
											<AlertDescription className="text-amber-800 dark:text-amber-200">
												{snapshot.needsReconfirmCount > 0
													? t(
															"htmlEditor.permissionManager.codeBanner.descriptionWithReconfirm",
															{ count: snapshot.needsReconfirmCount },
														)
													: t(
															"htmlEditor.permissionManager.codeBanner.descriptionReadOnly",
														)}
											</AlertDescription>
											<div className="flex flex-wrap gap-2 pt-1">
												<Button
													size="sm"
													variant="outline"
													disabled={permissionMutationInProgress}
													onClick={() => void handleAcknowledge()}
												>
													{acknowledging ? (
														<Loader2
															size={14}
															className="animate-spin"
														/>
													) : (
														<ShieldCheck size={14} />
													)}
													{t(
														"htmlEditor.permissionManager.codeBanner.acknowledge",
													)}
												</Button>
												<Button
													size="sm"
													variant="outline"
													disabled={permissionMutationInProgress}
													onClick={() => void handleRevokeAll()}
												>
													<Trash2 size={14} />
													{t(
														"htmlEditor.permissionManager.codeBanner.revokeAll",
													)}
												</Button>
											</div>
										</div>
									</Alert>
								) : null}

								<section>
									<div className="mb-3 flex items-center justify-between gap-3">
										<h3 className="text-sm font-semibold">
											{t("htmlEditor.permissionManager.permissionsTitle")}
										</h3>
										<span className="text-xs text-muted-foreground">
											{t("htmlEditor.permissionManager.currentTab")}
										</span>
									</div>
									<div className="overflow-hidden rounded-lg border">
										{visiblePermissions.length === 0 ? (
											<div className="px-4 py-10 text-center text-sm text-muted-foreground">
												{emptyPermissionsMessage}
											</div>
										) : null}
										{visiblePermissions.map((item, index) => {
											return (
												<div
													key={`${item.scope}:${item.grant?.grantedAt || 0}:${item.grant?.expiresAt ?? "always"}`}
												>
													{index > 0 ? <Separator /> : null}
													<HtmlPermissionItem
														item={item}
														now={now}
														dateFormatter={dateFormatter}
														disabled={permissionMutationInProgress}
														authorizing={
															authorizingScope === item.scope
														}
														updating={updatingScope === item.scope}
														revoking={revokingScope === item.scope}
														onAuthorize={handleAuthorize}
														onUpdateTtl={handleUpdateTtl}
														onRevoke={handleRevoke}
													/>
												</div>
											)
										})}
									</div>
								</section>
							</>
						) : null}
					</div>
				</ScrollArea>

				<DialogFooter
					className={`z-10 shrink-0 border-t bg-background px-6 py-4 ${
						snapshot?.activeGrantCount ? "sm:justify-between" : "sm:justify-end"
					}`}
					data-testid="html-permission-manager-footer"
				>
					{snapshot?.activeGrantCount ? (
						<Button
							variant="destructive"
							className="gap-1.5"
							disabled={permissionMutationInProgress}
							onClick={() => void handleRevokeAll()}
						>
							{revokingAll ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Trash2 size={14} />
							)}
							{t("htmlEditor.permissionManager.revokeAll")}
						</Button>
					) : null}
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("common.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export function createHtmlPermissionDateFormatter(language?: string) {
	const localeTag = normalizeLocale(language).replaceAll("_", "-")
	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}
	try {
		return new Intl.DateTimeFormat(localeTag, options)
	} catch {
		return new Intl.DateTimeFormat("en-US", options)
	}
}

function AppMeta({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="mt-1 truncate font-medium text-foreground" title={value}>
				{value}
			</dd>
		</div>
	)
}
