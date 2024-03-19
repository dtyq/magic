import CommonHeaderV2 from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2"
import { useStyles } from "./style"
import { Flex } from "antd"
import { useMemo, useState, useEffect } from "react"
import { useFileData } from "@/opensource/pages/superMagic/hooks/useFileData"
import CodeEditor from "@/opensource/components/base/CodeEditor"
import { shadow } from "@/opensource/utils/shadow"
import { useMemoizedFn, useResponsive } from "ahooks"
import AIOptimization from "@/opensource/pages/superMagic/components/Detail/components/AIOptimization"
import CommonFooter from "../../components/CommonFooter"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import FileEditButtons from "@/opensource/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import type { HeaderActionConfig } from "@/opensource/pages/superMagic/components/Detail/components/CommonHeaderV2/types"

export default function CodeViewer(props: any) {
	const {
		data,
		attachments,
		attachmentList,
		file_name,
		type,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		className,
		updatedAt,
		detailMode,
		isEditMode,
		saveEditContent,
		setIsEditMode,
		allowEdit,
		onRegisterSaveHandler,
		showFileHeader = true,
		activeFileId,
		showFooter,
		isPlaybackMode,
		allowDownload,
	} = props

	const { styles, cx } = useStyles()
	const responsive = useResponsive()
	const isMobile = responsive.md === false

	const { content: displayContent, file_id } = data

	const {
		fileData,
		fileVersion,
		changeFileVersion,
		fileVersionsList,
		handleVersionRollback,
		fetchFileVersions,
		isNewestVersion,
		isDeleted,
	} = useFileData({
		file_id,
		updatedAt,
		isEditing: isEditMode,
		activeFileId,
		isFromNode,
		disabledUrlCache: isPlaybackMode,
	})

	const [content, setContent] = useState<string>("")
	const [editingCodeContent, setEditingCodeContent] = useState<string>("")

	// 初始化 content
	useEffect(() => {
		const initialContent = displayContent ? displayContent : fileData
		setContent(initialContent || "")
	}, [displayContent, fileData])

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(true)
			// 初始化编辑内容
			setEditingCodeContent(content || "")
		}
	})

	const handleSave = useMemoizedFn(async () => {
		if (editingCodeContent && editingCodeContent !== content) {
			// 保存代码编辑内容，使用 shadow 函数加密
			const enable_shadow = true
			await saveEditContent?.(
				shadow(editingCodeContent),
				file_id,
				enable_shadow,
				fetchFileVersions,
			)
			// 更新 content 状态
			setContent(editingCodeContent)
			if (data?.file_name === "magic.project.js") {
				pubsub.publish(PubSubEvents.Update_Attachments)
			}
		}
		// 不再退出编辑模式
	})

	// Register save handler when in edit mode
	useSaveHandlerRegistration({
		isEditMode,
		handleSave,
		onRegisterSaveHandler,
	})

	const handleSaveAndExit = useMemoizedFn(async () => {
		await handleSave()
		if (setIsEditMode) {
			setIsEditMode(false)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setEditingCodeContent("")
	})

	// 当 viewMode 变化时，退出编辑模式
	useEffect(() => {
		if (setIsEditMode && isEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingCodeContent("")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewMode])

	const headerActionConfig = useMemo<HeaderActionConfig>(
		() => ({
			customActions: [
				{
					key: "code-ai-optimization",
					zone: "primary",
					visible: () =>
						Boolean(
							allowEdit &&
							!isMobile &&
							data?.file_id &&
							!isEditMode &&
							isNewestVersion,
						),
					render: (context) => (
						<AIOptimization
							attachmentList={attachmentList}
							file_id={data?.file_id}
							showButtonText={context.showButtonText}
						/>
					),
				},
				{
					key: "code-edit-actions",
					zone: "primary",
					visible: () =>
						Boolean(
							setIsEditMode && allowEdit && !isMobile && file_id && isNewestVersion,
						),
					render: (context) => (
						<FileEditButtons
							isEditMode={isEditMode}
							isSaving={false}
							showButtonText={context.showButtonText}
							onEdit={handleEdit}
							onSave={handleSave}
							onSaveAndExit={handleSaveAndExit}
							onCancel={handleCancel}
						/>
					),
				},
			],
		}),
		[
			allowEdit,
			attachmentList,
			data?.file_id,
			file_id,
			handleCancel,
			handleEdit,
			handleSave,
			isEditMode,
			isMobile,
			isNewestVersion,
			setIsEditMode,
		],
	)

	const headerContext = useMemo(
		() => ({
			type,
			onFullscreen,
			onDownload: () => onDownload(file_id, fileVersion),
			isFromNode,
			isFullscreen,
			viewMode,
			onViewModeChange,
			onCopy,
			fileContent: fileContent || content,
			currentFile,
			detailMode,
			showDownload: allowDownload !== false,
			isEditMode,
			fileVersion,
			isNewestFileVersion: isNewestVersion,
			changeFileVersion,
			fileVersionsList,
			handleVersionRollback,
			quitEditMode,
			allowEdit,
			attachments,
			actionConfig: headerActionConfig,
		}),
		[
			allowDownload,
			allowEdit,
			attachments,
			changeFileVersion,
			content,
			currentFile,
			detailMode,
			fileContent,
			file_id,
			fileVersion,
			fileVersionsList,
			handleVersionRollback,
			isEditMode,
			isFromNode,
			isFullscreen,
			isNewestVersion,
			onCopy,
			onDownload,
			onFullscreen,
			onViewModeChange,
			quitEditMode,
			type,
			viewMode,
			headerActionConfig,
		],
	)

	return (
		<Flex vertical className={cx(styles.container, className)}>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			{isEditMode ? (
				<CodeEditor
					content={content || ""}
					fileName={file_name || "file"}
					isEditMode={isEditMode}
					onChange={(value) => {
						setEditingCodeContent(value)
					}}
					height="100%"
					showLineNumbers={true}
					theme="light"
				/>
			) : isDeleted ? (
				<Deleted data={data} showHeader={false} />
			) : (
				<CodeEditor
					fileName={file_name || "file"}
					isEditMode={false}
					content={content || ""}
					theme="light"
				/>
			)}
			{/* 底部 */}
			{showFooter && (
				<CommonFooter
					fileVersion={fileVersion}
					changeFileVersion={changeFileVersion}
					fileVersionsList={fileVersionsList}
					handleVersionRollback={handleVersionRollback}
					quitEditMode={quitEditMode}
					allowEdit={allowEdit}
					isEditMode={isEditMode}
				/>
			)}
		</Flex>
	)
}
