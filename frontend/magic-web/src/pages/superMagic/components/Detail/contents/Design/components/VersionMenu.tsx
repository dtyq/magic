import { useMemo } from "react"
import { Dropdown, Flex } from "antd"
import { IconHistory, IconCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { createStyles, cx } from "antd-style"
import type { FileHistoryVersion } from "@/pages/superMagic/pages/Workspace/types"

const useStyles = createStyles(({ token, css, prefixCls }) => ({
	moreOperationsDropdown: css`
		&.${prefixCls}-dropdown-menu {
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 4px;

			&.${prefixCls}-dropdown-menu-submenu-hidden {
				display: none !important;
			}
		}
		.${prefixCls}-dropdown-menu-item {
			padding: 6px 10px;
		}
		.${prefixCls}-dropdown-menu-sub {
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 4px;
			.${prefixCls}-dropdown-menu-item-only-child {
				padding: 0 !important;
			}
		}
	`,
	fileVersionsDropdownItem: {
		display: "flex",
		alignItems: "center",
		gap: 4,
		color: token.magicColorUsages.text[1],
	},
	fileVersionsDropdownItemTitle: {
		minWidth: 140,
		fontSize: 14,
		lineHeight: "20px",
		fontWeight: 400,
	},
	version: css`
		padding: 2px 10px;
		font-size: 10px;
		line-height: 13px;
		border-radius: 4px;
		background-color: ${token.magicColorUsages.fill[0]};
	`,
	versionItem: css`
		padding: 6px 2px 6px 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		font-size: 12px;
		line-height: 16px;
		color: ${token.magicColorUsages.text[1]};
		border-radius: 4px;
		background-color: ${token.magicColorUsages.bg[3]};
		cursor: pointer;
		transition: background-color 0.3s ease;

		&:hover {
			background-color: ${token.magicColorUsages.fill[0]};
		}
	`,
	checkedVersionItem: css`
		background-color: ${token.magicColorUsages.primaryLight.default};
		cursor: default;

		&:hover {
			background-color: ${token.magicColorUsages.primaryLight.default};
		}
	`,
	createdAt: css`
		font-size: 10px;
		line-height: 13px;
		color: ${token.magicColorUsages.text[3]};
	`,
	checkedIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${token.magicColorUsages.primary.default};
	`,
	loadMoreHint: css`
		padding: 6px 8px;
		font-size: 12px;
		line-height: 16px;
		color: ${token.magicColorUsages.text[2]};
		background-color: ${token.magicColorUsages.fill[0]};
		border-radius: 4px;
	`,
	noHistoryVersionHint: css`
		min-width: 120px;
		text-align: center;
	`,
}))

interface VersionMenuProps {
	isShareRoute: boolean
	fileVersionsList: FileHistoryVersion[]
	fileVersion?: number
	onChangeVersion: (version: number, isNewestVersion: boolean) => void
	children: React.ReactNode
}

export function VersionMenu(props: VersionMenuProps) {
	const { isShareRoute, fileVersionsList, fileVersion, onChangeVersion, children } = props
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const moreOperationsDropdownItems = useMemo(() => {
		const items = [
			...(isShareRoute
				? []
				: [
					{
						label: (
							<div className={styles.fileVersionsDropdownItem}>
								<IconHistory size={16} />
								<div className={styles.fileVersionsDropdownItemTitle}>
									{t("common.historyVersion")}
								</div>
							</div>
						),
						key: "historyVersion",
						trigger: ["click"],
						children: [
							...(fileVersionsList || []).map((item, index) => {
								return {
									key: item.created_at,
									label: (
										<div
											key={item.version}
											className={cx(
												styles.versionItem,
												(item.version === fileVersion ||
													(!fileVersion && index === 0)) &&
												styles.checkedVersionItem,
											)}
											onClick={() =>
												onChangeVersion(item.version, index === 0)
											}
										>
											<Flex vertical gap={2}>
												<Flex align="center" gap={4}>
													<div>
														{index === 0
															? t("common.latestVersion")
															: t("common.historyVersion")}
													</div>
													<div className={styles.version}>
														v{item.version}
													</div>
													<div className={styles.version}>
														{item.edit_type === 1
															? t("common.onlineEdit")
															: t("common.aiEdit")}
													</div>
												</Flex>
												<div className={styles.createdAt}>
													{item.created_at}
												</div>
											</Flex>
											{item.version === fileVersion && (
												<div className={styles.checkedIcon}>
													<IconCheck size={20} stroke={2} />
												</div>
											)}
										</div>
									),
								}
							}),
							...((fileVersionsList?.length || 0) > 9
								? [
									{
										key: "loadMoreHint",
										label: (
											<div className={styles.loadMoreHint}>
												{t("common.versionsLimitHint")}
											</div>
										),
									},
								]
								: []),
							...(!fileVersionsList || fileVersionsList.length === 0
								? [
									{
										key: "noHistoryVersion",
										label: (
											<div
												className={cx(
													styles.loadMoreHint,
													styles.noHistoryVersionHint,
												)}
											>
												{t("common.noHistoryVersionHint")}
											</div>
										),
									},
								]
								: []),
						],
					},
				]),
		]

		return items
	}, [isShareRoute, t, fileVersionsList, fileVersion, styles, onChangeVersion])

	return (
		<Dropdown
			menu={{
				rootClassName: styles.moreOperationsDropdown,
				items: moreOperationsDropdownItems,
			}}
			trigger={["click"]}
			placement="bottomRight"
		>
			{children}
		</Dropdown>
	)
}
