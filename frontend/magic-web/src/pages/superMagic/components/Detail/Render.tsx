import ContentRenderer from "./components/ContentRenderer"
import { SuperMagicApi } from "@/apis"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { Suspense, useEffect, useRef, useState } from "react"
import { useDeepCompareEffect } from "ahooks"
import { useTranslation } from "react-i18next"
import {
	exportSingleFileToPdf,
	exportSingleFileToPpt,
} from "@/pages/superMagic/components/TopicFilesButton/utils/exportSingleFile"
import { getExportAllFileIds } from "./contents/HTML/utils"
import MagicProgressToast from "@/components/base/MagicProgressToast"
import useEditMode from "./hooks/useEditMode"
import useCheckBeforeCloseWithSave from "./hooks/useCheckBeforeCloseWithSave"
import MagicModal from "@/components/base/MagicModal"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { DownloadImageMode } from "../../pages/Workspace/types"
import { MagicSpin } from "@/components/base"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import magicToast from "@/components/base/MagicToaster/utils"

export default function Render(props: any) {
	const {
		type,
		data,
		attachments,
		setUserSelectDetail,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		hasUserSelectDetail,
		isFromNode,
		onClose,
		userSelectDetail,
		isFullscreen,
		attachmentList,
		allowEdit,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		onShare,
		onFavorite,
		fileContent,
		isFavorited,
		// File sharing props
		topicId,
		baseShareUrl,
		currentFile,
		className,
		updatedAt,
		detailMode,
		metadata,
		openFileTab,
		selectedProject,
		selectedTopic,
		showFileHeader = true,
		onRefreshFile,
		activeFileId,
		onActiveFileChange,
		showFooter = true,
		isPlaybackMode = false,
		// Register/unregister checkBeforeClose callback
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
		projectId,
		allowDownload,
	} = props
	const { t } = useTranslation("super")
	const { isEditMode, setIsEditMode, checkBeforeClose } = useEditMode({
		fileId: data?.file_id,
		fileName: data?.file_name || data?.display_filename || data?.filename,
	})

	// Use hook to manage save handler registration and wrapped checkBeforeClose
	const { registerSaveHandler } = useCheckBeforeCloseWithSave({
		checkBeforeClose,
		fileId: data?.file_id,
		onRegisterCheckBeforeClose,
		onUnregisterCheckBeforeClose,
	})

	const [exportProgress, setExportProgress] = useState(0)
	const [isExporting, setIsExporting] = useState(false)
	const shouldRefreshAfterSave = useRef(false)

	// 订阅进入编辑状态事件
	useEffect(() => {
		const handleEnterEditMode = (fileId: string) => {
			// 只有当事件中的 fileId 与当前文件的 fileId 匹配时才触发
			if (fileId === data?.file_id) {
				setIsEditMode(true)
			}
		}
		pubsub.subscribe(PubSubEvents.Enter_Edit_Mode, handleEnterEditMode)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Enter_Edit_Mode, handleEnterEditMode)
		}
	}, [data?.file_id, setIsEditMode])

	// 当数据变化时，如果并且用户处于编辑状态，则需要记录保存之后刷新文件
	useDeepCompareEffect(() => {
		if (isEditMode) {
			shouldRefreshAfterSave.current = true
		}
	}, [data])

	// 当用户退出编辑状态时，如果需要刷新文件，则刷新文件
	useEffect(() => {
		if (!isEditMode && shouldRefreshAfterSave.current) {
			// onRefreshFile?.()
			shouldRefreshAfterSave.current = false
		}
	}, [isEditMode])

	//支持批量，但是现在只需要保存单个文件即可,html内容需要混淆后才能保存
	const saveEditContent = async (
		newContent: any,
		fileId?: string,
		enable_shadow: boolean = false,
		fetchFileVersions?: (fileId: string) => void,
		// 在 PPT 编辑子页场景，会传递对应的 isEditMode 参数
		isPPTEditMode?: boolean,
		// 是否在保存后退出编辑模式，默认为 false（保持编辑状态）
		shouldExitEditMode: boolean = false,
	) => {
		const targetFileId = fileId || data.file_id
		const { editing_user_count } = await SuperMagicApi.getFileEditCount(targetFileId)
		const threshold = isPPTEditMode || isEditMode ? 1 : 0
		if (editing_user_count > threshold) {
			await new Promise((resolve, reject) => {
				const modal = MagicModal.confirm({
					title: t("detail.editingConflictPrompt"),
					variant: "default",
					showIcon: true,
					okText: t("common.continue"),
					cancelText: t("common.cancel"),
					closable: false,
					maskClosable: false,
					centered: true,
					onOk: async () => {
						await doSave(
							targetFileId,
							newContent,
							enable_shadow,
							undefined,
							shouldExitEditMode,
						)
						modal.destroy()
						resolve(true)
					},
					onCancel: () => {
						modal.destroy()
						reject("cancel")
					},
				})
			})
			return
		}
		await doSave(targetFileId, newContent, enable_shadow, fetchFileVersions, shouldExitEditMode)
	}

	async function doSave(
		targetFileId: string,
		newContent: any,
		enable_shadow: boolean,
		fetchFileVersions?: (
			fileId: string,
			page_size?: number,
			isLoadMore?: boolean,
			isSelectNewest?: boolean,
		) => void,
		shouldExitEditMode: boolean = false,
	) {
		const key = `save-${targetFileId}`
		magicToast.loading({
			content: t("common.saving"),
			key,
		})
		try {
			const res = await SuperMagicApi.saveFileContent([
				{
					file_id: targetFileId,
					content: newContent,
					enable_shadow,
				},
			])
			if (res?.success_files?.length > 0) {
				await fetchFileVersions?.(targetFileId, 10, undefined, true)
				magicToast.success({
					content: t("common.saveSuccess"),
					key,
				})
				// Only exit edit mode if explicitly requested
				if (shouldExitEditMode) {
					setIsEditMode(false)
				}
			} else {
				magicToast.error({
					content: t("common.saveFailed"),
					key,
				})
			}
		} catch (err) {
			magicToast.error({
				content: t("common.saveFailed"),
				key,
			})
		}
	}

	const exportFile = async (fileId: string, fileVersion?: number) => {
		getTemporaryDownloadUrl({
			file_ids: [fileId],
			file_versions: fileVersion ? { [fileId]: fileVersion } : undefined,
			download_mode: DownloadImageMode.Download,
			is_download: true,
		}).then((res: any) => {
			downloadFileWithAnchor(res[0]?.url)
		})
		// const fileIds = getExportAllFileIds(fileId, attachments)
		// batchExportFile({
		// 	projectId: selectedProject?.id,
		// 	fileIds,
		// 	t,
		// 	onStart: startExport,
		// 	onEnd: endExport,
		// 	onProgress,
		// 	onError,
		// })
	}
	const startExport = () => {
		setIsExporting(true)
		setExportProgress(0)
	}
	const onProgress = (progress: number) => {
		setExportProgress(Math.round(progress))
	}
	const endExport = () => {
		setExportProgress(100)
		setTimeout(() => {
			setIsExporting(false)
			setExportProgress(0)
			// magicToast.success(t("topicFiles.exportSuccess"))
		}, 500)
	}
	const onError = () => {
		setIsExporting(false)
		setExportProgress(0)
		magicToast.error(t("topicFiles.contextMenu.fileExport.exportFailed"))
	}

	const exportPdf = async (fileId: string) => {
		const fileIds = getExportAllFileIds(fileId, attachments)
		fileIds?.length > 0 &&
			exportSingleFileToPdf({
				fileId: fileId,
				projectId: selectedProject?.id || projectId,
				t,
				onStart: startExport,
				onEnd: endExport,
				onProgress,
				onError,
			})
	}
	const exportPpt = async (fileId: string) => {
		const fileIds = getExportAllFileIds(fileId, attachments)
		fileIds?.length > 0 &&
			exportSingleFileToPpt({
				fileId: fileId,
				projectId: selectedProject?.id || projectId,
				t,
				onStart: startExport,
				onEnd: endExport,
				onProgress,
				onError,
			})
	}

	// Common props object for passing to content components
	const commonProps = {
		type,
		attachments,
		setUserSelectDetail,
		currentIndex,
		onPrevious,
		onNext,
		onFullscreen,
		onDownload,
		totalFiles,
		hasUserSelectDetail,
		isFromNode,
		onClose,
		userSelectDetail,
		isFullscreen,
		attachmentList,
		isEditMode,
		setIsEditMode,
		saveEditContent,
		allowEdit,
		// Register save handler from content component
		onRegisterSaveHandler: registerSaveHandler,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		onShare,
		onFavorite,
		fileContent,
		isFavorited,
		// File sharing props
		topicId,
		baseShareUrl,
		currentFile,
		className,
		updatedAt,
		detailMode,
		// metadata: metadata || data?.metadata,
		metadata: data?.metadata,
		openFileTab,
		exportFile,
		exportPdf,
		exportPpt,
		isExporting,
		selectedProject,
		selectedTopic,
		showFileHeader,
		onRefreshFile,
		activeFileId,
		onActiveFileChange,
		showFooter,
		isPlaybackMode,
		isTabActive: props.isTabActive,
		allowDownload,
		projectId,
	}

	return (
		<>
			<Suspense
				fallback={
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							minHeight: "400px",
						}}
					>
						<MagicSpin />
					</div>
				}
			>
				<ContentRenderer type={type} data={data} commonProps={commonProps} />
			</Suspense>

			{/* 使用封装的进度条组件 */}
			<MagicProgressToast
				visible={isExporting}
				progress={exportProgress}
				text={t("topicFiles.exportingTip")}
				position="top"
				width={280}
				showPercentage={true}
				progressHeight={4}
			/>
		</>
	)
}
