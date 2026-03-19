import { useMemo } from "react"
import { Button, Flex, Popover } from "antd"
import { cx } from "antd-style"
import { IconCheck, IconChevronDown, IconVersions } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"
import useStyles from "./styles"
interface CommonFooterProps {
	fileVersion?: number
	changeFileVersion?: (version: number | undefined) => void
	fileVersionsList: FileHistoryVersion[]
	handleVersionRollback?: (version?: number) => void
	quitEditMode?: () => void
	allowEdit?: boolean
	isEditMode?: boolean
}

export default function CommonFooter({
	fileVersion,
	changeFileVersion,
	fileVersionsList,
	handleVersionRollback,
	quitEditMode,
	allowEdit = true,
	isEditMode = false,
}: CommonFooterProps) {
	const { styles } = useStyles()

	const { t } = useTranslation("super")

	/** 切换文件版本 */
	const handleChangeFileVersion = useMemoizedFn((version: number, isNewestVersion = false) => {
		if ((fileVersion && fileVersion === version) || (!fileVersion && isNewestVersion)) return
		if (isEditMode) {
			quitEditMode?.()
		}
		changeFileVersion?.(isNewestVersion ? undefined : version)
	})

	/** 弹窗内容 */
	const popoverContent = useMemo(() => {
		if (fileVersionsList.length > 0) {
			return (
				<div className={styles.versionList}>
					{fileVersionsList.map((item, index) => {
						return (
							<div
								key={item.version}
								className={cx(
									styles.versionItem,
									(item.version === fileVersion ||
										(!fileVersion && index === 0)) &&
									styles.checkedVersionItem,
								)}
								onClick={() => handleChangeFileVersion(item.version, index === 0)}
							>
								<Flex vertical gap={2}>
									<Flex align="center" gap={4}>
										<div>
											{index === 0
												? t("common.latestVersion")
												: t("common.historyVersion")}
										</div>
										<div className={styles.version}>v{item.version}</div>
										<div className={styles.version}>
											{item.edit_type === 1
												? t("common.onlineEdit")
												: t("common.aiEdit")}
										</div>
									</Flex>
									<div className={styles.createdAt}>{item.created_at}</div>
								</Flex>
								{item.version === fileVersion && (
									<div className={styles.checkedIcon}>
										<IconCheck size={20} stroke={2} />
									</div>
								)}
							</div>
						)
					})}
					{fileVersionsList.length > 9 && (
						<div className={styles.loadMoreHint}>{t("common.versionsLimitHint")}</div>
					)}
				</div>
			)
		}
		return null
	}, [fileVersionsList, t, fileVersion])

	return (
		<div className={styles.commonFooter}>
			<Popover
				overlayClassName={styles.popover}
				content={popoverContent}
				title={null}
				arrow={false}
				placement="topLeft"
				trigger="click"
			>
				<div
					className={cx(
						styles.versionSelector,
						fileVersionsList.length > 0 && styles.versionSelectorAvaible,
					)}
				>
					<Flex align="stretch" gap={2}>
						<IconVersions size={16} />
						<div>{t("common.version")}</div>
					</Flex>
					{!!fileVersion && <div className={styles.version}>v{fileVersion}</div>}
					{!fileVersion ||
						(fileVersionsList.length > 0 && fileVersion === fileVersionsList[0].version) ? (
						<div className={styles.version}>{t("common.latest")}</div>
					) : (
						<div className={styles.version}>{t("common.history")}</div>
					)}
					{fileVersionsList.length > 0 && (
						<div className={styles.selectorIcon}>
							<IconChevronDown size={18} />
						</div>
					)}
				</div>
			</Popover>
			{fileVersionsList.length > 1 &&
				fileVersion &&
				fileVersion !== fileVersionsList[0].version && (
					<Flex align="center" gap={10}>
						{changeFileVersion && (
							<Button
								className={styles.returnLatestButton}
								onClick={() =>
									handleChangeFileVersion(fileVersionsList[0].version, true)
								}
							>
								{t("common.returnLatest")}
							</Button>
						)}
						{handleVersionRollback && allowEdit && (
							<Button
								type="primary"
								className={styles.rollbackToVersionButton}
								onClick={() => handleVersionRollback(fileVersion)}
							>
								{t("common.rollbackToVersion")}
							</Button>
						)}
					</Flex>
				)}
		</div>
	)
}
