import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { AppWindow, History, Loader2 } from "lucide-react"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import {
	MicroAppEmptyIllustration,
	MicroAppSearchEmptyIllustration,
} from "@/pages/superMagic/components/MicroAppStateIllustration"
import {
	canEditProject,
	canManageCollaborators as canManageProjectCollaborators,
} from "@/pages/superMagic/utils/permission"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import MicroAppCard from "./MicroAppCard"
import MicroAppListActionDialogs from "./MicroAppListActionDialogs"
import MicroAppLoadErrorState from "./MicroAppLoadErrorState"
import MicroAppScopeTabs from "./MicroAppScopeTabs"
import MicroAppListTransition from "./MicroAppListTransition"
import { useMicroAppListItemActions } from "../hooks/useMicroAppListItemActions"
import { useMicroAppCollaboratorManagement } from "../hooks/useMicroAppCollaboratorManagement"
import { shouldOpenPublishedShare, type useMicroAppsPage } from "../hooks/useMicroAppsPage"

function formatAppTime(value: string | null | undefined): string {
	if (!value) return ""
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function EmptyState({
	title,
	description,
	searching,
	access,
	recent,
}: {
	title: string
	description: string
	searching: boolean
	access: boolean
	recent: boolean
}) {
	const Illustration = searching ? MicroAppSearchEmptyIllustration : MicroAppEmptyIllustration
	const AccessIcon = recent ? History : AppWindow

	return (
		<div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-muted/[0.08] px-6 py-8 text-center">
			{access && !searching ? (
				<div
					className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground"
					aria-hidden
				>
					<AccessIcon size={16} />
				</div>
			) : (
				<Illustration size="md" />
			)}
			<div className="space-y-1">
				<p className="text-sm font-semibold text-foreground">{title}</p>
				<p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
			</div>
		</div>
	)
}

function MicroAppsGridLoading({ compact }: { compact: boolean }) {
	return (
		<div
			className={
				compact
					? "grid grid-cols-1 gap-2"
					: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3"
			}
		>
			{[1, 2, 3, 4, 5, 6].map((item) => (
				<div
					key={item}
					className={
						compact
							? "flex items-center gap-3 px-2 py-3"
							: "rounded-2xl border border-border/50 p-2"
					}
				>
					<Skeleton
						className={
							compact
								? "h-14 w-[76px] shrink-0 rounded-xl"
								: "h-[76px] w-full rounded-xl"
						}
					/>
					<div
						className={
							compact ? "min-w-0 flex-1 space-y-2" : "space-y-3 px-2 pb-2 pt-3"
						}
					>
						<Skeleton className="h-4 w-4/5" />
						{!compact ? <Skeleton className="h-4 w-1/2" /> : null}
						<Skeleton className="h-3 w-3/5" />
					</div>
				</div>
			))}
		</div>
	)
}

interface MicroAppLibraryPanelProps {
	model: ReturnType<typeof useMicroAppsPage>
	access?: boolean
	search?: boolean
	onChanged: () => void
}

export default function MicroAppLibraryPanel({
	model,
	access = false,
	search = false,
	onChanged,
}: MicroAppLibraryPanelProps) {
	const { t } = useTranslation("super")
	const navigate = useNavigate()
	const {
		apps,
		scope,
		availableScopes,
		setScope,
		keyword,
		loading,
		loadingMore,
		hasMore,
		error,
		refresh,
		loadMore,
		loadMoreError,
		total,
	} = model
	const testIdPrefix = search
		? "micro-apps-search-results"
		: access
			? "micro-apps-access"
			: "micro-apps"
	/** The scopes this panel offers; a single one renders no tabs. */
	const scopeTabs = availableScopes.filter((item) =>
		access
			? item === "accessible" || item === "recent"
			: item === "created" || item === "collaborated",
	)
	const scrollRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		// Only this panel returns to the top when its filter changes.
		if (scrollRef.current) scrollRef.current.scrollTop = 0
	}, [scope, keyword])
	const initialLoading = model.initialLoading ?? (loading && apps.length === 0)
	// Mutations refresh the other panel because the same app can appear in both scopes.
	const itemActions = useMicroAppListItemActions({
		renameApp: async (...args) => {
			const result = await model.renameApp(...args)
			onChanged()
			return result
		},
		deleteApp: async (...args) => {
			const result = await model.deleteApp(...args)
			onChanged()
			return result
		},
	})
	const { openInNewWindow } = itemActions
	const collaboratorManagement = useMicroAppCollaboratorManagement()
	const handleOpenApp = useCallback(
		(app: MicroAppListItem) => {
			if (
				(search && app.publish_status === "published") ||
				shouldOpenPublishedShare(scope, app.publish_status)
			) {
				openInNewWindow(app)
				return
			}
			navigate({ name: RouteName.MicroApp, params: { appId: app.app_id } })
		},
		[navigate, openInNewWindow, scope, search],
	)
	return (
		<section
			className="flex h-full min-h-0 min-w-0 flex-col"
			aria-label={
				search
					? t("microAppsPage.searchResultsTitle")
					: access
						? t("microAppsPage.accessTitle")
						: t("microAppsPage.developmentTitle")
			}
		>
			<div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
				<h3 className="text-sm font-semibold text-foreground">
					{search
						? t("microAppsPage.searchResultsTitle")
						: access
							? t("microAppsPage.accessTitle")
							: t("microAppsPage.developmentTitle")}
					<Loader2
						className={`ml-2 inline-block size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none ${loading ? "visible" : "invisible"}`}
						aria-hidden
					/>
				</h3>
				{!search ? (
					<MicroAppScopeTabs
						value={scope}
						availableScopes={scopeTabs}
						onChange={setScope}
						testIdPrefix={`${testIdPrefix}-scope`}
						className="w-auto"
					/>
				) : null}
			</div>
			{/* Allow boundary scrolling to reach the outer viewport and return to the creation prompt. */}
			<ScrollArea
				viewportRef={scrollRef}
				data-testid={`${testIdPrefix}-scroll`}
				className="min-h-0 flex-1"
				viewportClassName="overscroll-y-auto [&>div]:!block"
			>
				{/* Reserve space inside the viewport for card hover lift, shadows, and focus rings. */}
				<div className="pb-4 pl-2 pr-3 pt-2">
					<MicroAppListTransition loading={loading}>
						{initialLoading ? (
							<div data-testid={`${testIdPrefix}-loading`}>
								<MicroAppsGridLoading compact={access || search} />
							</div>
						) : null}
						{!loading && error ? (
							<MicroAppLoadErrorState
								title={t("microAppsPage.errorTitle")}
								description={t("microAppsPage.errorDescription")}
								actionLabel={t("microAppsPage.refresh")}
								onRetry={refresh}
							/>
						) : null}
						{!loading && !error && apps.length === 0 ? (
							<EmptyState
								searching={Boolean(keyword)}
								access={access}
								recent={scope === "recent"}
								title={
									keyword
										? t("microAppsPage.noSearchResults")
										: scope === "accessible"
											? t("microAppsPage.publishedEmptyTitle")
											: scope === "recent"
												? t("microAppsPage.recentEmptyTitle")
												: t("microAppsPage.emptyTitle")
								}
								description={
									keyword
										? t("microAppsPage.noSearchResultsDescription")
										: scope === "accessible"
											? t("microAppsPage.publishedEmptyDescription")
											: scope === "recent"
												? t("microAppsPage.recentEmptyDescription")
												: t("microAppsPage.emptyDescription")
								}
							/>
						) : null}
						{!error && apps.length > 0 ? (
							<div
								className={
									access || search
										? "grid grid-cols-1 gap-2"
										: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3"
								}
								data-testid={`${testIdPrefix}-list`}
							>
								{apps.map((app) => (
									<MicroAppCard
										key={app.app_id}
										compact={access || search}
										id={app.app_id}
										title={app.app_name || t("project.unnamedProject")}
										description={app.app_description}
										meta={
											app.updated_at
												? t("microAppsPage.updatedAt", {
														date: formatAppTime(app.updated_at),
													})
												: t("microAppsPage.draftBadge")
										}
										coverUrl={app.cover_url}
										statusLabel={
											app.publish_status === "published"
												? t("microAppsPage.statusPublished")
												: t("microAppsPage.statusUnpublished")
										}
										external={shouldOpenPublishedShare(
											scope,
											app.publish_status,
										)}
										onClick={() => handleOpenApp(app)}
										onOpenInNewWindow={() => itemActions.openInNewWindow(app)}
										onRename={() => itemActions.openRename(app)}
										onDelete={() => itemActions.openDelete(app)}
										onManageCollaborators={() =>
											collaboratorManagement.openCollaboratorManager(app)
										}
										managingCollaborators={
											collaboratorManagement.loadingAppId === app.app_id
										}
										canDelete={app.can_delete}
										canRename={canEditProject(app.user_role)}
										canManageCollaborators={
											collaboratorManagement.canManageCollaborators &&
											canManageProjectCollaborators(app.user_role)
										}
										testId={`${testIdPrefix}-app-${app.app_id}`}
										trailingActions={
											search ? (
												<div className="flex shrink-0 gap-2">
													{app.user_role ? (
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																navigate({
																	name: RouteName.MicroApp,
																	params: { appId: app.app_id },
																})
															}
														>
															{canEditProject(app.user_role)
																? t(
																		"microAppsPage.continueDevelopment",
																	)
																: t("microAppsPage.viewProject")}
														</Button>
													) : null}
													{app.publish_status === "published" ? (
														<Button
															variant="outline"
															size="sm"
															onClick={() => openInNewWindow(app)}
														>
															{t("microAppsPage.openApp")}
														</Button>
													) : null}
												</div>
											) : null
										}
									/>
								))}
							</div>
						) : null}
						{!error && apps.length > 0 ? (
							<div className="mt-4 flex flex-col items-center gap-2 py-2">
								<p className="text-xs text-muted-foreground" role="status">
									{search
										? t("microAppsPage.searchLoadedCount", {
												count: apps.length,
											})
										: t("microAppsPage.loadedCount", {
												count: apps.length,
												total,
											})}
								</p>
								{loadMoreError ? (
									<p role="alert" className="text-sm text-destructive">
										{t("microAppsPage.loadMoreFailed")}
									</p>
								) : null}
								{hasMore ? (
									<Button
										type="button"
										variant="outline"
										onClick={loadMore}
										disabled={loading || loadingMore}
										data-testid={`${testIdPrefix}-load-more`}
									>
										{loadingMore ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : null}
										{loadMoreError
											? t("microAppsPage.retryLoadMore")
											: t("microAppsPage.loadMore")}
									</Button>
								) : null}
							</div>
						) : null}
					</MicroAppListTransition>
				</div>
			</ScrollArea>
			<MicroAppListActionDialogs
				renameTarget={itemActions.renameTarget}
				deleteTarget={itemActions.deleteTarget}
				renaming={itemActions.renaming}
				deleting={itemActions.deleting}
				onCloseRename={itemActions.closeRename}
				onCloseDelete={itemActions.closeDelete}
				onConfirmRename={itemActions.confirmRename}
				onConfirmDelete={itemActions.confirmDelete}
			/>
			{collaboratorManagement.CollaboratorUpdatePanel}
		</section>
	)
}
