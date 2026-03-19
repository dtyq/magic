import { Modal, Button, Checkbox, Flex } from "antd"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { createStyles, useResponsive } from "antd-style"
import IconInfo from "./icons/IconInfo"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"

interface DuplicateFileModalProps {
	visible: boolean
	fileName: string
	totalDuplicates?: number
	onCancel: () => void
	onReplace: (applyToAll: boolean) => void
	onKeepBoth: (applyToAll: boolean) => void
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
		.${prefixCls}-modal-header {
			display: none;
		}
		.${prefixCls}-modal-footer {
			display: none;
		}
	`,
	container: css`
		width: 440px;
		display: flex;
		flex-direction: column;
	`,
	header: css`
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 24px 24px 0 24px;
		position: relative;
	`,
	iconWrapper: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	`,
	icon: css`
		color: ${token.colorWarning};
		width: 24px;
		height: 24px;
	`,
	content: css`
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
		position: relative;
	`,
	title: css`
		font-weight: 600;
		font-size: 18px;
		line-height: 1.3333333333333333;
		color: ${token.colorText};
		margin: 0;
	`,
	message: css`
		font-weight: 400;
		font-size: 14px;
		line-height: 1.4285714285714286;
		color: ${token.colorText};
		word-break: break-word;
		margin-bottom: 0;
	`,
	fileName: css`
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
	cancelButton: css`
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
	`,
	replaceButton: css`
		height: 32px;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 14px;
		border: none;
		color: ${token.colorPrimary};
		min-width: 80px;
	`,
	checkboxWrapper: css`
		display: flex;
		align-items: center;
		gap: 8px;
	`,
	checkboxLabel: css`
		font-weight: 400;
		font-size: 14px;
		line-height: 1.4285714285714286;
		color: ${token.colorText};
		margin: 0;
		user-select: none;
		cursor: pointer;
	`,
	// 移动端样式
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
	mobileContent: css`
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
	`,
	mobileFooter: css`
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 24px 24px 24px;
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
	mobileMessage: css`
		font-size: 14px;
		line-height: 20px;
		color: ${token.colorText};
	`,
}))

export function DuplicateFileModal({
	visible,
	fileName,
	totalDuplicates,
	onCancel,
	onReplace,
	onKeepBoth,
}: DuplicateFileModalProps) {
	const { t } = useTranslation("super")
	const { styles, cx } = useStyles()
	const [applyToAll, setApplyToAll] = useState(false)
	const isMobile = useResponsive().md === false

	// 只有冲突文件数 > 1 时才显示 "全部应用" checkbox
	const showApplyToAll = (totalDuplicates || 0) > 1

	const handleReplace = () => {
		onReplace(applyToAll)
		setApplyToAll(false)
	}

	const handleKeepBoth = () => {
		onKeepBoth(applyToAll)
		setApplyToAll(false)
	}

	const handleCancel = () => {
		onCancel()
		setApplyToAll(false)
	}

	const toggleApplyToAll = () => {
		setApplyToAll(!applyToAll)
	}

	// 渲染带加粗文件名的消息
	const renderMessage = () => {
		const message = t("topicFiles.duplicateFile.message", { fileName: "FILENAME_PLACEHOLDER" })
		const parts = message.split("FILENAME_PLACEHOLDER")

		if (parts.length === 2) {
			return (
				<>
					{parts[0]}
					<strong className={styles.fileName}>{fileName}</strong>
					{parts[1]}
				</>
			)
		}

		// 如果分割失败，fallback 到原始显示
		return t("topicFiles.duplicateFile.message", { fileName })
	}

	// 移动端渲染
	if (isMobile) {
		return (
			<CommonPopup
				title={
					<Flex align="center" gap={4}>
						<div className={styles.iconWrapper}>
							<IconInfo size={24} />
						</div>
						<span className={styles.title}>{t("topicFiles.duplicateFile.title")}</span>
					</Flex>
				}
				popupProps={{
					visible,
					onClose: handleCancel,
					bodyStyle: {
						height: "auto",
					},
				}}
			>
				<div className={styles.mobileContainer}>
					<div className={styles.mobileHeader}>
						<div className={styles.mobileContent}>
							<p className={cx(styles.message, styles.mobileMessage)}>
								{renderMessage()}
							</p>
						</div>
					</div>

					<div className={styles.mobileFooter}>
						{showApplyToAll && (
							<div className={styles.checkboxWrapper}>
								<Checkbox
									checked={applyToAll}
									onChange={(e) => setApplyToAll(e.target.checked)}
								/>
								<span className={styles.checkboxLabel} onClick={toggleApplyToAll}>
									{t("topicFiles.duplicateFile.applyToAll")}
								</span>
							</div>
						)}
						<div className={styles.mobileButtonGroup}>
							<Button
								type="default"
								className={styles.mobileButton}
								onClick={handleKeepBoth}
							>
								{t("topicFiles.duplicateFile.keepBoth")}
							</Button>
							<Button
								type="default"
								className={styles.mobileButton}
								onClick={handleReplace}
							>
								{t("topicFiles.duplicateFile.replace")}
							</Button>
							<Button
								type="default"
								className={styles.mobileCancelButton}
								onClick={handleCancel}
							>
								{t("topicFiles.duplicateFile.cancel")}
							</Button>
						</div>
					</div>
				</div>
			</CommonPopup>
		)
	}

	// PC 端渲染
	return (
		<Modal
			open={visible}
			onCancel={handleCancel}
			className={styles.modal}
			width={440}
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
						<h5 className={styles.title}>{t("topicFiles.duplicateFile.title")}</h5>
						<p className={styles.message}>{renderMessage()}</p>
					</div>
				</div>

				<div className={styles.footer}>
					<div className={styles.buttonGroup}>
						{/* 左侧：Checkbox（条件显示） */}
						{showApplyToAll ? (
							<div className={styles.leftSection}>
								<Checkbox
									checked={applyToAll}
									onChange={(e) => setApplyToAll(e.target.checked)}
								/>
								<span className={styles.checkboxLabel} onClick={toggleApplyToAll}>
									{t("topicFiles.duplicateFile.applyToAll")}
								</span>
							</div>
						) : (
							<div />
						)}

						{/* 右侧：按钮组 */}
						<div className={styles.rightSection}>
							<Button
								type="default"
								className={styles.cancelButton}
								onClick={handleCancel}
							>
								{t("topicFiles.duplicateFile.cancel")}
							</Button>
							<Button
								type="default"
								className={styles.primaryButton}
								onClick={handleKeepBoth}
							>
								{t("topicFiles.duplicateFile.keepBoth")}
							</Button>
							<Button
								type="default"
								className={styles.replaceButton}
								onClick={handleReplace}
							>
								{t("topicFiles.duplicateFile.replace")}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</Modal>
	)
}
