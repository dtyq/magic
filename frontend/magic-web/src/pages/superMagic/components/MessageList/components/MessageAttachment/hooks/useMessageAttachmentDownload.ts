import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import {
	mergeStaticDependencyFileIds,
	resolveSingleDocumentStaticDependencies,
	supportsStaticDependencies,
} from "@/pages/superMagic/utils/staticDependencies"
import type { AttachmentProps } from "../type"

/** Downloads message attachments with registered dependencies. */
export function useMessageAttachmentDownload(messageAttachments?: AttachmentProps[]) {
	const { t } = useTranslation("super")
	const { permissions: access } = useFileAccess()
	const { projectFilesStore } = useMessageListContext()
	const downloadProgress = useDownloadProgress()
	// Bind the ambient share/session identity so attachment downloads work on share
	// previews instead of failing closed.
	const fileApi = useFileApi()

	const downloadOriginalFile = useMemoizedFn(async (fileId: string) => {
		const res = await fileApi.getTemporaryDownloadUrl({
			file_ids: [fileId],
			is_download: true,
			download_mode: DownloadImageMode.Download,
		})
		if (res[0]?.url) downloadFileWithAnchor(res[0].url)
	})

	return useMemoizedFn(async (fileId: string) => {
		if (!access.download) return
		const projectAttachments = projectFilesStore?.workspaceFilesList || []
		const projectFile = projectAttachments.find((file) => file.file_id === fileId)
		const messageFile = messageAttachments?.find((file) => file.file_id === fileId)
		const sourceFile = projectFile || messageFile

		if (!sourceFile || !supportsStaticDependencies(sourceFile)) {
			await downloadOriginalFile(fileId)
			return
		}

		const attachments = projectFile
			? projectAttachments
			: messageFile
				? [...projectAttachments, messageFile]
				: projectAttachments

		try {
			const result = await resolveSingleDocumentStaticDependencies({
				fileIds: [fileId],
				attachments,
				fileApi,
			})
			const fileIds = mergeStaticDependencyFileIds([fileId], result.dependencyFileIds, true)

			if (fileIds.length === 1) {
				await downloadOriginalFile(fileId)
				return
			}

			const baseName = (sourceFile.file_name || sourceFile.filename || "document").replace(
				/\.[^.]+$/,
				"",
			)
			await downloadProgress.startDownload({
				projectId: projectFilesStore?.currentSelectedProject?.id,
				fileIds,
				fileName: `${baseName}-with-assets.zip`,
				label: t("topicFiles.downloading"),
				onSuccess: () => magicToast.success(t("topicFiles.downloadSuccess")),
				onError: () => magicToast.error(t("topicFiles.downloadFailed")),
				onCancel: () => magicToast.info(t("topicFiles.downloadAbort")),
			})
		} catch (error) {
			console.error("Failed to resolve message attachment dependencies:", error)
			magicToast.warning(t("share.documentDependenciesAnalysisFailed"))
			await downloadOriginalFile(fileId)
		}
	})
}
