import { forwardRef, useImperativeHandle, useEffect, useMemo } from "react"
import { Button } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import BaseModal from "@/pages/superMagic/components/SelectPathModal/components/BaseModal"
import FlexBox from "@/components/base/FlexBox"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useWindowSize } from "@/hooks/use-window-size"

import type { UploadModalProps } from "./types"
import { useDirectoryStyles } from "./styles"
import { useUploadModal } from "./hooks"
import { generateBreadcrumbItems } from "./utils"
import {
	UploadFileList,
	UploadDirectoryList,
	SearchBar,
	DirectoryBreadcrumb,
	DirectoryList,
	SearchResultHeader,
} from "./components"
import magicToast from "@/components/base/MagicToaster/utils"

export interface UploadModalRef {
	resetState: () => void
}

const UploadModal = forwardRef<UploadModalRef, UploadModalProps>(function UploadModal(
	{
		uploadFiles,
		visible,
		title,
		defaultPath = [],
		onCreateDirectory,
		onClose,
		isShowCreateDirectory = true,
		onSubmit,
		fileType = [],
		placeholder,
		emptyDataTip,
		tips,
		projectId,
		attachments = [],
		okText,
		cancelText,
		validateFileSize,
		validateFileCount,
		isUploadingFolder = false,
	},
	ref,
) {
	const isMobile = useIsMobile()
	const { styles, cx } = useDirectoryStyles({ isMobile })
	const { t } = useTranslation("super")
	const { width: windowWidth } = useWindowSize()

	// Calculate modal width: screen width - 200px, with minimum 700px and maximum 1200px
	const modalWidth = useMemo(() => {
		if (isMobile || windowWidth === 0) return undefined
		return Math.min(Math.max(700, windowWidth - 200), 1200)
	}, [windowWidth, isMobile])

	// Use the main hook to manage all state and logic
	const {
		loading,
		path,
		directories,
		isSearch,
		fileName,
		createDirectoryShown,
		createDirectoryName,
		createDirectoryErrorMessage,
		fileList,
		navigateToDirectory,
		navigateToBreadcrumb,
		handleSearchChange,
		handleCompositionStart,
		handleCompositionEnd,
		exitSearchMode,
		showCreateDirectory,

		submitCreateDirectory,
		handleCreateDirectoryInputChange,
		handleCreateDirectoryInputFocus,
		handleCreateDirectoryInputKeyDown,

		addFiles,
		removeFile,
		updateFileName,
		resetState,
	} = useUploadModal({
		projectId,
		attachments,
		defaultPath,
		visible,
		uploadFiles: uploadFiles && uploadFiles.length > 0 ? uploadFiles : undefined,
		fileType,
		onCreateDirectory,
		validateFileSize,
		validateFileCount,
	})

	// Expose reset function to parent component
	useImperativeHandle(
		ref,
		() => ({
			resetState,
		}),
		[resetState],
	)

	// Computed values
	const searchPlaceholder = placeholder || t("selectPathModal.searchDirectory")
	const emptyTip = emptyDataTip || t("selectPathModal.noDirectory")

	const breadcrumbItems = useMemo(() => {
		return generateBreadcrumbItems(path, t("selectPathModal.rootDirectory"))
	}, [path, t])

	// Event handlers
	const submit = useMemoizedFn(() => {
		onSubmit && onSubmit({ path, files: fileList.map((item) => item.file) })
		onClose && onClose()
	})

	const handleCancel = useMemoizedFn(() => {
		onClose && onClose()
	})

	const handleBreadcrumbClick = useMemoizedFn(
		async (item: { id: string; operation?: string }) => {
			if (!item.operation) {
				magicToast.info(t("selectPathModal.noDirPermission"))
				return
			}
			await navigateToBreadcrumb(item.id)
		},
	)

	// Keyboard event handler
	const handleKeyDown = useMemoizedFn((event: KeyboardEvent) => {
		if (event.key === "Escape") {
			exitSearchMode()
		}
	})

	useEffect(() => {
		if (visible) {
			window.addEventListener("keydown", handleKeyDown)
			return () => window.removeEventListener("keydown", handleKeyDown)
		} else {
			window.removeEventListener("keydown", handleKeyDown)
		}
	}, [visible, handleKeyDown, exitSearchMode])

	const footerConfig = {
		okText: okText || t("selectPathModal.confirm"),
		cancelText: cancelText || t("common.cancel"),
		onOk: submit,
		onCancel: handleCancel,
		okDisabled: isSearch || fileList.length === 0,
	}

	// Main modal content
	const modalContent = (
		<FlexBox className={styles.container}>
			{/* Upload file list section */}
			{!isMobile && (
				<div className={styles.content}>
					{isUploadingFolder ? (
						<UploadDirectoryList fileList={fileList} onRemoveFile={removeFile} />
					) : (
						<UploadFileList
							fileList={fileList}
							onAddFiles={addFiles}
							onRemoveFile={removeFile}
							onUpdateFileName={updateFileName}
						/>
					)}
				</div>
			)}

			{/* Directory browser section */}
			<div className={cx(styles.content, styles.mobileContent)}>
				<FlexBox align="center" justify="space-between" className={styles.rightHeader}>
					<div>{t("selectPathModal.selectStorageLocation")}</div>
					{/* Search bar */}
					<SearchBar
						value={fileName}
						placeholder={searchPlaceholder}
						onChange={handleSearchChange}
						onCompositionStart={handleCompositionStart}
						onCompositionEnd={handleCompositionEnd}
						isMobile={isMobile}
					/>
				</FlexBox>

				{/* Navigation: Breadcrumb or Search Result Header */}
				{!isSearch ? (
					<FlexBox
						align="center"
						justify="space-between"
						className={styles.directoryHeader}
					>
						<DirectoryBreadcrumb
							items={breadcrumbItems}
							loading={loading}
							onItemClick={handleBreadcrumbClick}
							isMobile={isMobile}
						/>
						<Button
							disabled={isSearch}
							className={styles.createDirectoryButton}
							type="text"
							onClick={showCreateDirectory}
						>
							{t("selectPathModal.newSubfolder")}
						</Button>
					</FlexBox>
				) : (
					<SearchResultHeader onExitSearch={exitSearchMode} isMobile={isMobile} />
				)}

				{/* Directory list */}
				<DirectoryList
					directories={directories}
					loading={loading}
					isSearch={isSearch}
					emptyTip={emptyTip}
					createDirectoryShown={createDirectoryShown}
					createDirectoryName={createDirectoryName}
					createDirectoryErrorMessage={createDirectoryErrorMessage}
					onCreateDirectoryInputChange={handleCreateDirectoryInputChange}
					onCreateDirectoryInputFocus={handleCreateDirectoryInputFocus}
					onCreateDirectoryInputKeyDown={handleCreateDirectoryInputKeyDown}
					onSubmitCreateDirectory={submitCreateDirectory}
					onDirectoryClick={navigateToDirectory}
					isMobile={isMobile}
					showCreateDirectory={showCreateDirectory}
				/>
			</div>
		</FlexBox>
	)

	return (
		<BaseModal
			visible={visible}
			title={title || t("topicFiles.title")}
			tips={tips}
			content={modalContent}
			footer={footerConfig}
			onClose={onClose}
			width={modalWidth}
			customModalProps={{
				maskClosable: false,
			}}
		/>
	)
})

export default UploadModal
