import { type ComponentProps, useCallback, useMemo, useState } from "react"
import useMicroAppInstallFlow from "./useMicroAppInstallFlow"
import useMicroAppSafetyNoticeConfirmation from "./useMicroAppSafetyNoticeConfirmation"
import useMicroAppShareData from "./useMicroAppShareData"
import HtmlPreviewContent from "@/pages/superMagic/components/Detail/contents/HTML"
import { useMicroAppPreviewFiles } from "@/pages/superMagic/pages/MicroAppPage/hooks/useMicroAppPreviewFiles"
import { resolveSelectedHtmlEntry } from "@/pages/superMagic/pages/MicroAppPage/utils/microAppFiles"
import { resolvePublishedDefaultOpenFileId } from "../utils/publishedMicroAppPreview"

type MicroAppPreviewMode = NonNullable<ComponentProps<typeof HtmlPreviewContent>["viewMode"]>

export interface UsePublishedMicroAppPreviewOptions {
	appId: string
	appName?: string
}

export function usePublishedMicroAppPreview({
	appId,
	appName,
}: UsePublishedMicroAppPreviewOptions) {
	const [previewMode, setPreviewMode] = useState<MicroAppPreviewMode>("desktop")
	const { hasConfirmedSafetyNotice, confirmSafetyNotice } =
		useMicroAppSafetyNoticeConfirmation(appId)
	const shareDataState = useMicroAppShareData({ appId })
	const {
		shareData,
		shareMeta,
		attachmentList,
		loading,
		error,
		isNeedPassword,
		resourceId,
		verifiedPassword,
	} = shareDataState

	const defaultOpenFileId = useMemo(
		() => resolvePublishedDefaultOpenFileId(shareData),
		[shareData],
	)
	const defaultEntryFile = useMemo(
		() =>
			resolveSelectedHtmlEntry({ items: attachmentList, selectedFileId: defaultOpenFileId }),
		[attachmentList, defaultOpenFileId],
	)
	const displayAppName = appName?.trim() || shareMeta.projectName
	const browser = useMicroAppPreviewFiles({
		attachmentList,
		defaultEntryFile,
		scopeKey: `${appId}:${resourceId}:${shareMeta.projectId}`,
	})
	const previewFile = browser.previewEntryFile
	const installFlow = useMicroAppInstallFlow({
		appId,
		hasEntryFile: Boolean(previewFile),
		hasError: Boolean(error),
		hasShareData: Boolean(shareData),
		isLoading: loading,
		isNeedPassword,
		resourceId,
		safetyConfirmed: hasConfirmedSafetyNotice,
		verifiedPassword,
	})

	const rememberVerifiedPassword = installFlow.rememberVerifiedPassword
	const { setError, setVerifiedPassword } = shareDataState
	const handleVerifySuccess = useCallback(
		(_data: unknown, password?: string) => {
			setError(null)
			rememberVerifiedPassword(password)
			setVerifiedPassword(password)
		},
		[rememberVerifiedPassword, setError, setVerifiedPassword],
	)
	const handleOpenFileTab = browser.handlePreviewOpenFile

	return {
		appId,
		...shareDataState,
		hasConfirmedSafetyNotice,
		confirmSafetyNotice,
		displayAppName,
		previewFile,
		browser,
		defaultEntryFile,
		installFlow,
		previewMode,
		setPreviewMode,
		handleVerifySuccess,
		handleOpenFileTab,
	}
}

export type UsePublishedMicroAppPreviewReturn = ReturnType<typeof usePublishedMicroAppPreview>
