import React from "react"
import { useTranslation } from "react-i18next"

import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { InputWithError } from "@/pages/superMagic/components/TopicFilesButton/components"
import { useDirectoryStyles } from "../styles"

interface CreateDirectoryInputProps {
	value: string
	errorMessage: string
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
	onFocus: (e: React.FocusEvent<HTMLInputElement>) => void
	onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
	onBlur: () => void
	onPressEnter: () => void
	isMobile?: boolean
}

function CreateDirectoryInput({
	value,
	errorMessage,
	onChange,
	onFocus,
	onKeyDown,
	onBlur,
	onPressEnter,
	isMobile = false,
}: CreateDirectoryInputProps) {
	const { t } = useTranslation("super")
	const { styles } = useDirectoryStyles({ isMobile })

	return (
		<div className={styles.textFolderItem}>
			<div className={styles.folderIconContainer}>
				<img src={FoldIcon} alt="folder" width={14} height={14} />
			</div>
			<InputWithError
				className={styles.input}
				autoFocus
				size="small"
				value={value}
				onChange={onChange}
				onFocus={onFocus}
				onPressEnter={onPressEnter}
				onKeyDown={onKeyDown}
				onBlur={onBlur}
				placeholder={t("selectPathModal.inputFolderName")}
				errorMessage={errorMessage}
				showError={!!errorMessage}
			/>
		</div>
	)
}

export default CreateDirectoryInput
