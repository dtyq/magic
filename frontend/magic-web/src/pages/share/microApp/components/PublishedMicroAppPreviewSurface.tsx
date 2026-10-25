import MicroAppPreviewTabs from "@/pages/superMagic/pages/MicroAppPage/components/MicroAppPreviewTabs"
import MicroAppPreviewPages from "@/pages/superMagic/pages/MicroAppPage/components/MicroAppPreviewPages"
import { useMemo } from "react"
import { FileCode2, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ErrorDisplay, PasswordVerification, ShareEmptyState } from "@/pages/share/components"
import MicroAppSafetyNotice from "@/pages/share/microApp/components/MicroAppSafetyNotice"
import type { UsePublishedMicroAppPreviewReturn } from "@/pages/share/microApp/hooks/usePublishedMicroAppPreview"
import { buildPreviewFile } from "@/pages/share/microApp/utils/publishedMicroAppPreview"
import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import HtmlPreviewContent from "@/pages/superMagic/components/Detail/contents/HTML"
import { MicroAppPermissionIllustration } from "@/pages/superMagic/components/MicroAppStateIllustration"
import MicroAppSkillsPanel from "@/pages/superMagic/components/MicroAppSkillsPanel"
import { getSkillFiles } from "@/pages/superMagic/components/microAppSkills"
import PublishedMicroAppConversationProvider from "./PublishedMicroAppConversationProvider"

const NOOP_LEAVE = () => undefined

export interface PublishedMicroAppPreviewSurfaceProps {
	preview: UsePublishedMicroAppPreviewReturn
	onLeave?: () => void
	/**
	 * 错误态（无权限、分享失效等）下「返回」按钮的落点。
	 * 不传则不渲染按钮——应用内的微应用预览标签页正是如此，它有自己的外层导航。
	 */
	onErrorBack?: () => void
	testIdPrefix: "micro-app-tab" | "micro-app-share"
	rootTestId?: string
	onHtmlPermissionManagerChange?: (manager: { open: () => void } | null) => void
}

function PublishedMicroAppPreviewEmpty({ testId }: { testId: string }) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/20 px-8 text-center"
			data-testid={testId}
		>
			<div className="flex size-12 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
				<FileCode2 size={22} />
			</div>
			<div className="space-y-1">
				<p className="text-sm font-medium text-foreground">
					{t("microAppShare.noEntryTitle")}
				</p>
				<p className="max-w-[360px] text-sm text-muted-foreground">
					{t("microAppShare.noEntryDescription")}
				</p>
			</div>
		</div>
	)
}

function PublishedMicroAppPreviewSurface({
	preview,
	onLeave,
	onErrorBack,
	testIdPrefix,
	rootTestId,
	onHtmlPermissionManagerChange,
}: PublishedMicroAppPreviewSurfaceProps) {
	const { t } = useTranslation("super")
	const {
		emptyStateInfo,
		handleSwitchOrganization,
		isSwitching,
		loading,
		error,
		isNeedPassword,
		shareData,
		previewFile,
		hasConfirmedSafetyNotice,
		confirmSafetyNotice,
		displayAppName,
		coverUrl,
		resourceId,
		sourceOrganizationCode,
		passwordFromUrl,
		handleVerifySuccess,
		getShareData,
		setError,
		installFlow,
		previewMode,
		setPreviewMode,
		browser,
		attachmentsTree,
		attachmentList,
		shareMeta,
		appId,
		defaultEntryFile,
	} = preview

	const fileAccess = useMemo(
		() =>
			shareMeta.temporaryToken && shareMeta.projectId
				? createShareFileAccess({
						token: shareMeta.temporaryToken,
						projectId: shareMeta.projectId,
						topicId: shareMeta.topicId || "",
					})
				: null,
		[shareMeta.projectId, shareMeta.temporaryToken, shareMeta.topicId],
	)

	// 没有技能文件时整条工具栏都不渲染，避免只剩一个打开后为空的入口；memo 避免大项目每次渲染都遍历附件。
	const hasSkills = useMemo(() => getSkillFiles(attachmentList).length > 0, [attachmentList])

	if (emptyStateInfo) {
		return (
			<ShareEmptyState
				currentOrgName={emptyStateInfo.currentOrgName}
				targetOrgName={emptyStateInfo.targetOrgName}
				targetOrgLogo={emptyStateInfo.targetOrgLogo || undefined}
				userInfo={emptyStateInfo.userInfo}
				onSwitch={handleSwitchOrganization}
				isLoading={isSwitching}
				isFileShare
			/>
		)
	}

	return (
		<FileAccessProvider value={fileAccess}>
			<div className="h-full min-h-0 w-full overflow-hidden" data-testid={rootTestId}>
				{loading ? (
					<div
						className="flex h-full items-center justify-center"
						data-testid={`${testIdPrefix}-loading`}
					>
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{isNeedPassword && !shareData && !previewFile && !error && !loading ? (
					<PasswordVerification
						resourceId={resourceId}
						initialPassword={passwordFromUrl}
						onVerifySuccess={handleVerifySuccess}
						onVerifyFail={() => setError(null)}
						getShareData={getShareData}
						isFileShare
						maxLength={32}
						uppercase={false}
						title={t("microAppShare.passwordTitle")}
						description={t("microAppShare.passwordDescription")}
						rememberPassword={installFlow.rememberPasswordControl}
					/>
				) : null}

				{error && !loading ? (
					<ErrorDisplay
						errorMessage={t("microAppShare.errorTitle")}
						onBack={onErrorBack}
						isFileShare
						illustration={
							<MicroAppPermissionIllustration
								size="md"
								className="w-[180px]"
								testId={`${testIdPrefix}-error-illustration`}
							/>
						}
					/>
				) : null}

				{!loading && !error && shareData && !previewFile ? (
					<PublishedMicroAppPreviewEmpty testId={`${testIdPrefix}-empty`} />
				) : null}

				{!loading && !error && previewFile && !hasConfirmedSafetyNotice ? (
					<MicroAppSafetyNotice
						appName={displayAppName}
						coverUrl={coverUrl}
						onConfirm={confirmSafetyNotice}
						onLeave={onLeave ?? NOOP_LEAVE}
					/>
				) : null}

				{!loading && !error && previewFile && hasConfirmedSafetyNotice ? (
					fileAccess ? (
						<PublishedMicroAppConversationProvider
							appId={appId}
							appName={displayAppName}
							sourceOrganizationCode={sourceOrganizationCode}
							enabled={testIdPrefix === "micro-app-share"}
						>
							<div
								className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
								data-testid={`${testIdPrefix}-preview`}
							>
								{testIdPrefix === "micro-app-tab" && hasSkills ? (
									<header className="flex h-10 shrink-0 items-center justify-end border-b border-border bg-background px-3">
										<MicroAppSkillsPanel
											attachmentList={attachmentList}
											microAppId={appId}
											microAppName={displayAppName}
										/>
									</header>
								) : null}
								{browser.previewTabs.length > 1 && (
									<div className="flex shrink-0 border-b border-border bg-muted/10">
										<MicroAppPreviewTabs {...browser} />
									</div>
								)}
								<div className="min-h-0 flex-1 overflow-hidden">
									<MicroAppPreviewPages browser={browser}>
										{({ tab, active, onOpenFile }) => (
											<HtmlPreviewContent
												key={`${tab.id}:${tab.revision}`}
												data={buildPreviewFile(tab.file)}
												attachments={attachmentsTree}
												attachmentList={attachmentList}
												allowEdit={false}
												showFileHeader={false}
												showFooter={false}
												viewMode={previewMode}
												onViewModeChange={setPreviewMode}
												activeFileId={tab.file.file_id}
												projectId={shareMeta.projectId}
												microAppId={appId}
												microAppName={displayAppName}
												virtualStorageMarkerId={defaultEntryFile?.file_id}
												openFileTab={onOpenFile}
												onHtmlPermissionManagerChange={
													active
														? onHtmlPermissionManagerChange
														: undefined
												}
												isSharePreview
												className="h-full"
											/>
										)}
									</MicroAppPreviewPages>
								</div>
							</div>
						</PublishedMicroAppConversationProvider>
					) : (
						<div
							className="flex h-full items-center justify-center"
							data-testid={`${testIdPrefix}-loading`}
						>
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					)
				) : null}
			</div>
		</FileAccessProvider>
	)
}

export default PublishedMicroAppPreviewSurface
