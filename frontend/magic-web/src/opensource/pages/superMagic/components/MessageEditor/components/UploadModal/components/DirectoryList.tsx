import React from "react"
import { Flex, Tooltip } from "antd"
import { IconChevronRight, IconFolderUp } from "@tabler/icons-react"
import { isEmpty } from "lodash-es"
import { useTranslation } from "react-i18next"

import type { AttachmentItem } from "../../../../TopicFilesButton/hooks"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import { getItemName } from "../utils"
import { useDirectoryStyles } from "../styles"
import CreateDirectoryInput from "./CreateDirectoryInput"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useTheme } from "antd-style"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"

const calcRelativePath = (path?: string, maxLength = Infinity) => {
	if (!path) return path
	const paths = path.split("/").slice(0, -2)
	// 因为倒序显示，所以拼在前面
	let newPath = "/" + paths.join("/")
	newPath = newPath.startsWith("/") ? newPath.slice(1) : newPath
	return newPath.length > maxLength ? "..." + newPath.slice(-maxLength) : newPath
}

interface DirectoryListProps {
	directories: AttachmentItem[]
	loading: boolean
	isSearch: boolean
	emptyTip: string

	// Create directory props
	createDirectoryShown: boolean
	createDirectoryName: string
	createDirectoryErrorMessage: string
	onCreateDirectoryInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
	onCreateDirectoryInputFocus: (e: React.FocusEvent<HTMLInputElement>) => void
	onCreateDirectoryInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
	onSubmitCreateDirectory: () => void

	// Directory click handler
	onDirectoryClick: (directory: AttachmentItem) => void

	isMobile?: boolean
	showCreateDirectory: () => void
}

function DirectoryList({
	directories,
	loading,
	isSearch,
	emptyTip,
	createDirectoryShown,
	createDirectoryName,
	createDirectoryErrorMessage,
	onCreateDirectoryInputChange,
	onCreateDirectoryInputFocus,
	onCreateDirectoryInputKeyDown,
	onSubmitCreateDirectory,
	onDirectoryClick,
	isMobile = false,
	showCreateDirectory,
}: DirectoryListProps) {
	const { t } = useTranslation("super")
	const { styles, cx } = useDirectoryStyles({ isMobile })
	const { magicColorUsages } = useTheme()

	return (
		<div className={styles.folderContainer}>
			<MagicSpin spinning={loading} className={styles.spinContainer}>
				{!isEmpty(directories) || createDirectoryShown ? (
					<>
						{createDirectoryShown && (
							<CreateDirectoryInput
								value={createDirectoryName}
								errorMessage={createDirectoryErrorMessage}
								onChange={onCreateDirectoryInputChange}
								onFocus={onCreateDirectoryInputFocus}
								onKeyDown={onCreateDirectoryInputKeyDown}
								onBlur={onSubmitCreateDirectory}
								onPressEnter={onSubmitCreateDirectory}
								isMobile={isMobile}
							/>
						)}
						{directories.map((directory, index) => (
							<div
								key={index}
								className={cx(styles.textFolderItem, {
									disable: !directory.is_directory,
								})}
								onClick={() => onDirectoryClick(directory)}
							>
								<Flex className={styles.fileItemContainer} gap={10}>
									<Flex
										className={styles.nameContainer}
										gap={4}
										align="center"
										style={{ maxWidth: "50%" }}
									>
										<div className={styles.folderIconContainer}>
											{directory.is_directory ? (
												<img
													src={FoldIcon}
													alt="folder"
													width={14}
													height={14}
												/>
											) : (
												<MagicFileIcon
													type={directory.file_extension}
													size={14}
												/>
											)}
										</div>

										<div className={styles.name}>
											<SmartTooltip>{getItemName(directory)}</SmartTooltip>
										</div>
									</Flex>
									{directory.is_directory && (
										<Flex
											align="center"
											gap={10}
											className={styles.parentPathContainer}
										>
											{isSearch && (
												<Tooltip
													title={calcRelativePath(
														directory.relative_file_path,
													)}
													className={styles.parentPath}
												>
													{calcRelativePath(
														directory.relative_file_path,
														10,
													)}
												</Tooltip>
											)}
											<IconChevronRight
												className={`${styles.icon} chevron`}
												size={16}
											/>
										</Flex>
									)}
								</Flex>
							</div>
						))}
					</>
				) : (
					<div className={styles.emptyBlock}>
						<MagicIcon
							component={IconFolderUp}
							size={60}
							color={magicColorUsages.text[3]}
						/>
						<div className={styles.tip}>
							{t("uploadModal.emptyTip")}
							<br />
							{t("uploadModal.or")}
							<button
								className={styles.createDirectoryButtonLink}
								onClick={showCreateDirectory}
							>
								{t("uploadModal.createNewSubfolder")}
							</button>
						</div>
					</div>
				)}
			</MagicSpin>
		</div>
	)
}

export default DirectoryList
