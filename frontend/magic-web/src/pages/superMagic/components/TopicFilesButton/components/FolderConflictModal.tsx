import { Button, Checkbox, Flex, Modal } from "antd"
import { createStyles } from "antd-style"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import IconInfo from "./icons/IconInfo"
import { useIsMobile } from "@/hooks/useIsMobile"

export interface FolderConflictModalProps {
	visible: boolean
	folderName: string
	totalConflicts?: number
	canMerge?: boolean
	onCancel: () => void
	onMerge: (applyToAll: boolean) => void
	onKeepBoth: (applyToAll: boolean) => void
	onReplace?: (applyToAll: boolean) => void
}

const useStyles = createStyles(({ css, token, prefixCls }) => ({
	modal: css`
		.${prefixCls}-modal-content {
			border-radius: 12px;
			box-shadow:
				0px 4px 14px 0px rgba(0, 0, 0, 0.1),
				0px 0px 1px 0px rgba(0, 0, 0, 0.3);
			padding: 0;
		}
		.${prefixCls}-modal-body {
			padding: 0;
		}
		.${prefixCls}-modal-header, .${prefixCls}-modal-footer {
			display: none;
		}
	`,
	container: css`
		width: 460px;
		display: flex;
		flex-direction: column;
	`,
	header: css`
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 24px 24px 0;
	`,
	iconWrapper: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	`,
	content: css`
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 8px;
	`,
	title: css`
		font-weight: 600;
		font-size: 18px;
		line-height: 24px;
		color: ${token.colorText};
		margin: 0;
	`,
	message: css`
		font-weight: 400;
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		word-break: break-word;
		margin: 0;
	`,
	folderName: css`
		font-weight: 600;
		word-break: break-word;
	`,
	footer: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 20px 24px;
	`,
	buttonGroup: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	`,
	leftSection: css`
		display: flex;
		align-items: center;
		gap: 8px;
	`,
	rightSection: css`
		display: flex;
		align-items: center;
		gap: 12px;
	`,
	button: css`
		height: 32px;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 14px;
		border: none;
		color: ${token.colorText};
	`,
	primaryButton: css`
		height: 32px;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 14px;
		border: none;
		color: ${token.colorPrimary};
		min-width: 72px;
	`,
	checkboxLabel: css`
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
		user-select: none;
		cursor: pointer;
	`,
	mobileContainer: css`
		display: flex;
		flex-direction: column;
		padding: 0;
	`,
	mobileHeader: css`
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 24px;
	`,
	mobileFooter: css`
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 24px 24px;
	`,
	mobileButtonGroup: css`
		display: flex;
		flex-direction: column;
		gap: 12px;
	`,
	mobileButton: css`
		width: 100%;
		height: 44px;
		border-radius: 8px;
		font-size: 16px;
		border: none;
		color: ${token.colorPrimary};
	`,
	mobileCancelButton: css`
		width: 100%;
		height: 44px;
		border-radius: 8px;
		font-size: 16px;
		border: none;
		color: ${token.magicColorUsages.text[1]};
	`,
}))

export function FolderConflictModal({
	visible,
	folderName,
	totalConflicts,
	canMerge = true,
	onCancel,
	onMerge,
	onKeepBoth,
	onReplace,
}: FolderConflictModalProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const [applyToAll, setApplyToAll] = useState(false)
	const isMobile = useIsMobile()
	const showApplyToAll = (totalConflicts || 0) > 1

	const resetApplyToAll = () => setApplyToAll(false)
	const handleCancel = () => {
		onCancel()
		resetApplyToAll()
	}
	const handleKeepBoth = () => {
		onKeepBoth(applyToAll)
		resetApplyToAll()
	}
	const handleReplace = () => {
		onReplace?.(applyToAll)
		resetApplyToAll()
	}
	const handleMerge = () => {
		onMerge(applyToAll)
		resetApplyToAll()
	}

	const renderMessage = () => {
		const key = canMerge
			? "topicFiles.duplicateFolder.message"
			: "topicFiles.duplicateFolder.cannotMergeMessage"
		const message = t(key, { folderName: "FOLDER_NAME_PLACEHOLDER" })
		const parts = message.split("FOLDER_NAME_PLACEHOLDER")
		if (parts.length !== 2) return t(key, { folderName })

		return (
			<>
				{parts[0]}
				<strong className={styles.folderName}>{folderName}</strong>
				{parts[1]}
			</>
		)
	}

	const applyToAllCheckbox = showApplyToAll ? (
		<div className={styles.leftSection}>
			<Checkbox
				checked={applyToAll}
				onChange={(event) => setApplyToAll(event.target.checked)}
			/>
			<span className={styles.checkboxLabel} onClick={() => setApplyToAll(!applyToAll)}>
				{t("topicFiles.duplicateFolder.applyToAll")}
			</span>
		</div>
	) : (
		<div />
	)

	if (isMobile) {
		return (
			<CommonPopup
				title={
					<Flex align="center" gap={4}>
						<div className={styles.iconWrapper}>
							<IconInfo size={24} />
						</div>
						<span className={styles.title}>
							{t("topicFiles.duplicateFolder.title")}
						</span>
					</Flex>
				}
				popupProps={{ visible, onClose: handleCancel, bodyStyle: { height: "auto" } }}
			>
				<div className={styles.mobileContainer}>
					<div className={styles.mobileHeader}>
						<p className={styles.message}>{renderMessage()}</p>
					</div>
					<div className={styles.mobileFooter}>
						{showApplyToAll ? applyToAllCheckbox : null}
						<div className={styles.mobileButtonGroup}>
							{onReplace && (
								<Button className={styles.mobileButton} onClick={handleReplace}>
									{t("topicFiles.duplicateFolder.replace")}
								</Button>
							)}
							<Button className={styles.mobileButton} onClick={handleKeepBoth}>
								{t("topicFiles.duplicateFolder.keepBoth")}
							</Button>
							{canMerge && (
								<Button className={styles.mobileButton} onClick={handleMerge}>
									{t("topicFiles.duplicateFolder.merge")}
								</Button>
							)}
							<Button className={styles.mobileCancelButton} onClick={handleCancel}>
								{t("topicFiles.duplicateFolder.cancel")}
							</Button>
						</div>
					</div>
				</div>
			</CommonPopup>
		)
	}

	return (
		<Modal
			open={visible}
			onCancel={handleCancel}
			className={styles.modal}
			width={460}
			centered
			footer={null}
			closable
			maskClosable={false}
		>
			<div className={styles.container}>
				<div className={styles.header}>
					<div className={styles.iconWrapper}>
						<IconInfo size={24} />
					</div>
					<div className={styles.content}>
						<h5 className={styles.title}>{t("topicFiles.duplicateFolder.title")}</h5>
						<p className={styles.message}>{renderMessage()}</p>
					</div>
				</div>
				<div className={styles.footer}>
					<div className={styles.buttonGroup}>
						{applyToAllCheckbox}
						<div className={styles.rightSection}>
							<Button className={styles.button} onClick={handleCancel}>
								{t("topicFiles.duplicateFolder.cancel")}
							</Button>
							<Button className={styles.primaryButton} onClick={handleKeepBoth}>
								{t("topicFiles.duplicateFolder.keepBoth")}
							</Button>
							{onReplace && (
								<Button className={styles.primaryButton} onClick={handleReplace}>
									{t("topicFiles.duplicateFolder.replace")}
								</Button>
							)}
							{canMerge && (
								<Button className={styles.primaryButton} onClick={handleMerge}>
									{t("topicFiles.duplicateFolder.merge")}
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</Modal>
	)
}
