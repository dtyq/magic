import { useTranslation } from "react-i18next"
import {
	SuperMobileShellRouteLayout,
	useOptionalSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell"
import { MagiClawCreateSheet } from "./MagiClawCreateSheet"
import { MagiClawDeleteConfirmSheet } from "./MagiClawDeleteConfirmSheet"
import { MagiClawEditDialog } from "./MagiClawEditDialog"
import { MagiClawMobileContextMenu } from "./MagiClawMobileContextMenu"
import { MagiClawMobileFeatureList } from "./MagiClawMobileFeatureList"
import { MagiClawMobileHeader } from "./MagiClawMobileHeader"
import { MagiClawMobileList } from "./MagiClawMobileList"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { useMagiClawMobilePage } from "./useMagiClawMobilePage"

/** 页面面板只负责把移动端壳层、列表视图和页面级浮层状态接起来。 */
function MagiClawMobilePanel() {
	const {
		activeActionClawCode,
		canCreateMagicClaw,
		clawBrandValues,
		claws,
		contextMenuState,
		createButtonLabel,
		deletingClaw,
		dialog,
		dismissedUpgradeBadgeByClawKey,
		editingClaw,
		getDisplayedClawStatus,
		handleConfirmDelete,
		handleConfirmUpgradeClaw,
		handleCreateClaw,
		handleOpenCreate,
		handleOpenClawPlaygroundWithPreWarm,
		handleOpenEditClaw,
		handleRequestDelete,
		handleRestartClaw,
		handleStartClaw,
		handleStopClaw,
		handleUpdateClaw,
		isCreateDialogOpen,
		isCreating,
		isUpdating,
		openContextMenu,
		refreshClawListAsync,
		setDeletingClaw,
		setEditingClaw,
		setIsCreateDialogOpen,
		t: tSidebar,
		visibleListError,
		visibleListLoading,
		closeContextMenu,
	} = useMagiClawMobilePage()
	const contextMenuClaw = contextMenuState?.claw ?? null
	const contextMenuStatus = contextMenuClaw ? getDisplayedClawStatus(contextMenuClaw) : null

	return (
		<>
			{dialog}
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-mobile-background"
				data-testid="magi-claw-page-mobile"
			>
				<MagiClawMobileHeader
					title={tSidebar("superLobster.title", clawBrandValues)}
					createAriaLabel={createButtonLabel}
					disableCreateTrigger={!canCreateMagicClaw}
					onOpenCreate={handleOpenCreate}
				/>

				<ScrollEdgeFadeContainer
					fadeColor="mobile-background"
					className="min-h-0 flex-1"
					scrollClassName="px-4 pb-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					contentDeps={[claws.length, visibleListLoading, visibleListError]}
					onScroll={closeContextMenu}
				>
					<div
						className="flex flex-col gap-12"
						data-testid="magi-claw-mobile-scroll-content"
					>
						<MagiClawMobileList
							claws={claws}
							clawBrandValues={clawBrandValues}
							t={tSidebar}
							visibleListLoading={visibleListLoading}
							visibleListError={visibleListError}
							activeActionClawCode={activeActionClawCode}
							dismissedUpgradeBadgeByClawKey={dismissedUpgradeBadgeByClawKey}
							getDisplayedClawStatus={getDisplayedClawStatus}
							canCreateMagicClaw={canCreateMagicClaw}
							createButtonLabel={createButtonLabel}
							onOpenCreate={handleOpenCreate}
							onRetry={() => {
								void refreshClawListAsync()
							}}
							onOpenMenu={openContextMenu}
							onOpenChat={(claw) => {
								void handleOpenClawPlaygroundWithPreWarm(claw)
							}}
							onUpgradeClaw={handleConfirmUpgradeClaw}
						/>
						<MagiClawMobileFeatureList />
					</div>
				</ScrollEdgeFadeContainer>
			</div>

			{contextMenuClaw && contextMenuState ? (
				<MagiClawMobileContextMenu
					claw={contextMenuClaw}
					anchorRect={contextMenuState.anchorRect}
					displayStatus={contextMenuStatus}
					isActionLoading={activeActionClawCode === contextMenuClaw.code}
					editLabel={tSidebar("superLobster.mobile.editInfo")}
					restartLabel={tSidebar("superLobster.created.restart", clawBrandValues)}
					startLabel={tSidebar("superLobster.created.start", clawBrandValues)}
					stopLabel={tSidebar("superLobster.created.stop", clawBrandValues)}
					deleteLabel={tSidebar("superLobster.created.delete", clawBrandValues)}
					onClose={closeContextMenu}
					onEdit={() => handleOpenEditClaw(contextMenuClaw)}
					onRestart={() => {
						void handleRestartClaw(contextMenuClaw)
					}}
					onStart={() => {
						void handleStartClaw(contextMenuClaw)
					}}
					onStop={() => {
						void handleStopClaw(contextMenuClaw)
					}}
					onDelete={() => handleRequestDelete(contextMenuClaw)}
				/>
			) : null}

			<MagiClawCreateSheet
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreate={(payload) => void handleCreateClaw(payload)}
				isSubmitting={isCreating}
			/>

			<MagiClawEditDialog
				open={Boolean(editingClaw)}
				claw={editingClaw}
				isSubmitting={isUpdating}
				onOpenChange={(open) => {
					if (!open) setEditingClaw(null)
				}}
				onSubmit={(payload) => void handleUpdateClaw(payload)}
			/>

			<MagiClawDeleteConfirmSheet
				open={Boolean(deletingClaw)}
				claw={deletingClaw}
				clawBrandValues={clawBrandValues}
				t={tSidebar}
				onClose={() => setDeletingClaw(null)}
				onConfirm={() => void handleConfirmDelete()}
			/>
		</>
	)
}

/** 页面入口只负责接入统一移动端壳层，业务逻辑由容器 hook 承担。 */
export default function MagiClawMobilePage() {
	const shellOutlet = useOptionalSuperMobileShellOutlet()
	const { t } = useTranslation("super")

	if (shellOutlet) {
		return <MagiClawMobilePanel />
	}

	return (
		<SuperMobileShellRouteLayout
			activeView="magiClaw"
			closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
			testIdPrefix="magi-claw-shell"
		>
			<MagiClawMobilePanel />
		</SuperMobileShellRouteLayout>
	)
}
