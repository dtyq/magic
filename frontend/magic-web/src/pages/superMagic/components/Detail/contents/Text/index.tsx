import { useFileData } from "@/pages/superMagic/hooks/useFileData"
import { cn } from "@/lib/utils"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import { Input } from "antd"
import { useState, useEffect, useRef, useMemo } from "react"
import { useMemoizedFn, useResponsive } from "ahooks"
import { shadow } from "@/utils/shadow"
import AIOptimization from "@/pages/superMagic/components/Detail/components/AIOptimization"
import CommonFooter from "../../components/CommonFooter"
import Deleted from "../../components/Deleted"
import useSaveHandlerRegistration from "../../hooks/useSaveHandlerRegistration"
import FileEditButtons from "@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons"
import type { HeaderActionConfig } from "../../components/CommonHeaderV2/types"
import { useTranslation } from "react-i18next"

export default function Text(props: any) {
	const {
		type,
		data,
		updatedAt,
		attachmentList,
		onFullscreen,
		onDownload,
		isFromNode,
		isFullscreen,
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		currentFile,
		detailMode,
		isEditMode,
		saveEditContent,
		setIsEditMode,
		allowEdit,
		onRegisterSaveHandler,
		activeFileId,
		showFooter,
		showFileHeader = true,
		isPlaybackMode,
		allowDownload,
	} = props

	const { file_id } = data
	const { t } = useTranslation("super")

	const {
		fileData: initialContent,
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
	const responsive = useResponsive()
	const isMobile = responsive.md === false
	const textAreaRef = useRef<any>(null)

	const [content, setContent] = useState<string>("")
	const [editingContent, setEditingContent] = useState<string>("")

	// 初始化 content
	useEffect(() => {
		const displayContent = fileContent || initialContent
		setContent(displayContent || "")
	}, [fileContent, initialContent])

	// 当进入编辑模式时，自动聚焦到 TextArea
	useEffect(() => {
		if (isEditMode && textAreaRef.current) {
			// 使用 setTimeout 确保 DOM 更新完成后再聚焦
			setTimeout(() => {
				textAreaRef.current?.focus()
			}, 100)
		}
	}, [isEditMode])

	// 按钮处理函数
	const handleEdit = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(true)
			// 初始化编辑内容
			setEditingContent(content || "")
		}
	})

	const handleSave = useMemoizedFn(async () => {
		if ((editingContent || editingContent === "") && editingContent !== content) {
			// 保存文本编辑内容，使用 shadow 函数加密
			const enable_shadow = true
			await saveEditContent?.(
				shadow(editingContent),
				file_id,
				enable_shadow,
				fetchFileVersions,
			)
			// 更新 content 状态
			setContent(editingContent)
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
		setEditingContent("")
	})

	const quitEditMode = useMemoizedFn(() => {
		if (setIsEditMode) {
			setIsEditMode(false)
		}
		setEditingContent("")
	})

	// 当 viewMode 变化时，退出编辑模式
	useEffect(() => {
		if (setIsEditMode && isEditMode) {
			setIsEditMode(false)
		}
		// 重置编辑内容
		setEditingContent("")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewMode])

	const headerActionConfig = useMemo<HeaderActionConfig>(
		() => ({
			customActions: [
				{
					key: "text-ai-optimization",
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
					key: "text-edit-actions",
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
			isMobile,
			data?.file_id,
			isEditMode,
			isNewestVersion,
			attachmentList,
			setIsEditMode,
			file_id,
			handleEdit,
			handleSave,
			handleSaveAndExit,
			handleCancel,
		],
	)

	const headerContext = {
		type,
		onFullscreen,
		onDownload: () => onDownload?.(file_id, fileVersion),
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
		actionConfig: headerActionConfig,
	}

	return (
		<div className={cn("flex h-full flex-col")}>
			{showFileHeader && <CommonHeaderV2 {...headerContext} />}
			{isEditMode ? (
				<Input.TextArea
					ref={textAreaRef}
					value={editingContent}
					onChange={(e) => {
						setEditingContent(e.target.value)
					}}
					style={{
						height: "calc(100% - 40px)",
						minHeight: "400px",
						resize: "none",
						fontSize: "14px",
						padding: 12,
						lineHeight: "20px",
						borderRadius: 0,
					}}
					placeholder={t("common.enterText") || "Enter text..."}
				/>
			) : isDeleted ? (
				<Deleted data={data} showHeader={false} />
			) : (
				<div
					key={data.id}
					className={cn(
						"h-[calc(100%-40px)] overflow-y-auto overflow-x-hidden p-3",
						"whitespace-pre-wrap break-words text-sm leading-5 text-foreground",
						"bg-background",
					)}
				>
					{content}
				</div>
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
		</div>
	)
}
