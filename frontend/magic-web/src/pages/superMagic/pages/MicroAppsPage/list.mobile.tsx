import { useCallback } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
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
import MicroAppCard from "./components/MicroAppCard"
import MicroAppListActionDialogs from "./components/MicroAppListActionDialogs"
import MicroAppLoadErrorState from "./components/MicroAppLoadErrorState"
import MicroAppScopeTabs from "./components/MicroAppScopeTabs"
import { useMicroAppListItemActions } from "./hooks/useMicroAppListItemActions"
import { useMicroAppCollaboratorManagement } from "./hooks/useMicroAppCollaboratorManagement"
import { shouldOpenPublishedShare, useMicroAppsPage } from "./hooks/useMicroAppsPage"

function formatAppTime(value: string | null | undefined): string {
	if (!value) return ""
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function MobileGridLoading() {
	return (
		<div className="grid grid-cols-1 gap-3" data-testid="micro-apps-mobile-loading">
			{[1, 2, 3, 4].map((item) => (
				<div key={item} className="rounded-2xl border border-border/60 p-2">
					<div className="h-[76px] animate-pulse rounded-xl bg-muted/50" />
					<div className="space-y-3 px-2 pb-2 pt-3">
						<div className="h-4 w-3/4 animate-pulse rounded bg-muted/60" />
						<div className="h-4 w-1/2 animate-pulse rounded bg-muted/40" />
						<div className="h-3 w-3/5 animate-pulse rounded bg-muted/40" />
					</div>
				</div>
			))}
		</div>
	)
}

export default observer(function MicroAppsListPageMobile() {
	const { t } = useTranslation("super")
	const navigate = useNavigate({ fallbackRoute: { name: RouteName.MicroApps } })
	const {
		apps,
		scope,
		availableScopes,
		setScope,
		keyword,
		setKeyword,
		loading,
		loadingMore,
		hasMore,
		error,
		refresh,
		loadMore,
		renameApp,
		deleteApp,
	} = useMicroAppsPage()
	const itemActions = useMicroAppListItemActions({ renameApp, deleteApp })
	const { openInNewWindow } = itemActions
	const collaboratorManagement = useMicroAppCollaboratorManagement()

	const handleOpenApp = useCallback(
		(app: MicroAppListItem) => {
			if (shouldOpenPublishedShare(scope, app.publish_status)) {
				openInNewWindow(app)
				return
			}
			navigate({
				name: RouteName.MicroApp,
				params: { appId: app.app_id },
				viewTransition: false,
			})
		},
		[navigate, openInNewWindow, scope],
	)
	const EmptyIllustration = keyword ? MicroAppSearchEmptyIllustration : MicroAppEmptyIllustration

	return (
		<div
			className="absolute inset-0 flex h-full min-h-0 w-full flex-col overflow-hidden bg-mobile-background"
			data-testid="micro-apps-list-page-mobile"
		>
			<header className="mobile-page-header shrink-0 border-b border-border/60">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-9 shrink-0"
					onClick={() =>
						navigate({
							delta: -1,
							viewTransition: { type: "slide", direction: "right" },
						})
					}
					aria-label={t("microAppsPage.backToCreate")}
					data-testid="micro-apps-mobile-list-back"
				>
					<ArrowLeft className="size-[18px]" aria-hidden />
				</Button>
				<h1 className="min-w-0 flex-1 truncate px-2 text-center text-[17px] font-medium leading-6 text-foreground">
					{t("microAppsPage.galleryTitle")}
				</h1>
				<div className="size-9 shrink-0" aria-hidden />
			</header>

			<ScrollArea
				viewportClassName="[&>div]:!block"
				className="min-h-0 flex-1"
				data-testid="micro-apps-list-scroll-area"
			>
				<main className="px-3 pb-7">
					<div
						className="sticky top-0 z-20 -mx-3 mb-4 space-y-3 border-b border-border/50 bg-mobile-background px-4 pb-4 pt-4"
						data-testid="micro-apps-mobile-toolbar"
					>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={keyword}
								onChange={(event) => setKeyword(event.target.value)}
								placeholder={t("microAppsPage.searchPlaceholder")}
								className="h-10 rounded-xl pl-9"
								data-testid="micro-apps-mobile-search"
							/>
						</div>
						<div className="-mx-1 overflow-x-auto">
							{/* Scroll instead of shrinking tabs on mobile. */}
							<MicroAppScopeTabs
								value={scope}
								availableScopes={availableScopes}
								onChange={setScope}
								testIdPrefix="micro-apps-mobile-scope"
								className="h-10"
							/>
						</div>
					</div>

					{loading ? <MobileGridLoading /> : null}

					{!loading && error ? (
						<MicroAppLoadErrorState
							title={t("microAppsPage.errorTitle")}
							description={t("microAppsPage.errorDescription")}
							actionLabel={t("microAppsPage.refresh")}
							onRetry={refresh}
							mobile
						/>
					) : null}

					{!loading && !error && apps.length === 0 ? (
						<div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-muted/[0.08] px-6 py-7 text-center">
							<EmptyIllustration size="sm" />
							<div className="space-y-1">
								<p className="text-base font-medium text-foreground">
									{keyword
										? t("microAppsPage.noSearchResults")
										: scope === "accessible"
											? t("microAppsPage.publishedEmptyTitle")
											: t("microAppsPage.emptyTitle")}
								</p>
								<p className="text-sm text-muted-foreground">
									{keyword
										? t("microAppsPage.noSearchResultsDescription")
										: scope === "accessible"
											? t("microAppsPage.publishedEmptyDescription")
											: t("microAppsPage.emptyDescription")}
								</p>
							</div>
						</div>
					) : null}

					{!loading && !error && apps.length > 0 ? (
						<div
							className="grid grid-cols-1 gap-3"
							data-testid="micro-apps-mobile-list"
						>
							{apps.map((app) => (
								<MicroAppCard
									key={app.app_id}
									id={app.app_id}
									title={app.app_name || t("project.unnamedProject")}
									description={app.app_description}
									meta={
										app.updated_at
											? formatAppTime(app.updated_at)
											: t("microAppsPage.draftBadge")
									}
									coverUrl={app.cover_url}
									statusLabel={
										app.publish_status === "published"
											? t("microAppsPage.statusPublished")
											: t("microAppsPage.statusUnpublished")
									}
									onClick={() => handleOpenApp(app)}
									variant="mobile"
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
									testId={`micro-apps-mobile-app-${app.app_id}`}
								/>
							))}
						</div>
					) : null}

					{!loading && !error && hasMore ? (
						<div className="mt-6 flex justify-center">
							<Button
								type="button"
								variant="outline"
								onClick={loadMore}
								disabled={loadingMore}
								data-testid="micro-apps-mobile-load-more"
							>
								{loadingMore ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : null}
								{t("microAppsPage.loadMore")}
							</Button>
						</div>
					) : null}
				</main>
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
		</div>
	)
})
