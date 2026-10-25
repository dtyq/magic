import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { useNamedPageTitle } from "@/pages/superMagic/hooks/useNamedPageTitle"
import PublishedMicroAppPreviewSurface from "./components/PublishedMicroAppPreviewSurface"
import MicroAppInstallDialog from "./components/MicroAppInstallDialog"
import MicroAppShareHeader from "./components/MicroAppShareHeader"
import useMicroAppManifestLinks from "./hooks/useMicroAppManifestLinks"
import { usePublishedMicroAppPreview } from "./hooks/usePublishedMicroAppPreview"
import { useIsMobile } from "@/hooks/useIsMobile"
import useNavigate from "@/routes/hooks/useNavigate"
import { resolveShareErrorBackNavigation } from "../utils/share-error-back"

function MicroAppSharePage() {
	const { t } = useTranslation("super")
	const { appId = "" } = useParams<{ appId: string }>()
	useMicroAppManifestLinks(appId)
	const navigate = useNavigate()
	const isMobile = useIsMobile()
	// 分享页隐藏了 HTML 文件头，通过管理句柄复用预览内部的同一个授权面板。
	const [permissionManager, setPermissionManager] = useState<{ open: () => void } | null>(null)
	const preview = usePublishedMicroAppPreview({ appId })
	const {
		displayAppName,
		fullScreen,
		displayModeResolved,
		installFlow,
		hasConfirmedSafetyNotice,
	} = preview
	useNamedPageTitle({
		entityName: displayAppName,
		fallbackName: t("microAppsPage.unnamedApp"),
	})

	useEffect(() => {
		setPermissionManager(null)
	}, [appId])

	const handleLeave = useCallback(() => {
		window.location.replace("/")
	}, [])
	// 无权限等错误态的「返回」：与项目/文件分享页一致，直接回当前端首页，
	// 不落站点根路由、也不整页刷新；replace 避免把错误页留在历史栈里。
	const handleErrorBack = useCallback(() => {
		navigate(resolveShareErrorBackNavigation(isMobile))
	}, [isMobile, navigate])
	const handleOpenPermissionManager = useCallback(() => {
		permissionManager?.open()
	}, [permissionManager])

	if (preview.emptyStateInfo) {
		return (
			<PublishedMicroAppPreviewSurface
				preview={preview}
				onLeave={handleLeave}
				onErrorBack={handleErrorBack}
				testIdPrefix="micro-app-share"
			/>
		)
	}

	return (
		<div
			className="flex h-screen w-screen flex-col overflow-hidden bg-background"
			data-testid="micro-app-share-page"
		>
			{displayModeResolved && !fullScreen ? (
				<MicroAppShareHeader
					appName={displayAppName}
					showInstall={installFlow.showInstall}
					showPermissionManager={hasConfirmedSafetyNotice && Boolean(permissionManager)}
					onInstall={installFlow.handleInstall}
					onOpenPermissionManager={handleOpenPermissionManager}
				/>
			) : null}
			<MicroAppInstallDialog {...installFlow.dialog} />
			<main className="min-h-0 flex-1 overflow-hidden">
				<PublishedMicroAppPreviewSurface
					preview={preview}
					onLeave={handleLeave}
					onErrorBack={handleErrorBack}
					testIdPrefix="micro-app-share"
					onHtmlPermissionManagerChange={setPermissionManager}
				/>
			</main>
		</div>
	)
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<MicroAppSharePage />
		</FileAccessProvider>
	)
}
