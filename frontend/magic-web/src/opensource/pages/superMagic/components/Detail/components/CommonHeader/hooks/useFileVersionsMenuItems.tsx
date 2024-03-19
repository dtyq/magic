import { useMemo } from "react"
import { Flex } from "antd"
import { IconHistory, IconCheck } from "@tabler/icons-react"
import type { FileHistoryVersion } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { ItemType } from "antd/es/menu/interface"
import { cn } from "@/opensource/lib/utils"

interface UseFileVersionsMenuItemsParams {
	/** File versions list */
	fileVersionsList?: FileHistoryVersion[]
	/** Current selected file version */
	fileVersion?: number
	/** Handle file version change callback */
	handleChangeFileVersion?: (version: number, isLatest: boolean) => void
	/** i18n translation function */
	t: (key: string) => string
	/** Styles object */
	styles: Record<string, string>
}

/**
 * Hook to generate file versions menu items
 * Manages version list rendering, selection state, and empty states
 */
function useFileVersionsMenuItems({
	fileVersionsList,
	fileVersion,
	handleChangeFileVersion,
	t,
	styles,
}: UseFileVersionsMenuItemsParams): ItemType {
	return useMemo(() => {
		const versionItems = (fileVersionsList || []).map((item, index) => ({
			key: item.created_at,
			label: (
				<div
					key={item.version}
					className={cn(
						styles.versionItem,
						(item.version === fileVersion || (!fileVersion && index === 0)) &&
							styles.checkedVersionItem,
					)}
					onClick={() => handleChangeFileVersion?.(item.version, index === 0)}
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
								{item.edit_type === 1 ? t("common.onlineEdit") : t("common.aiEdit")}
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
			),
		}))

		const loadMoreHintItem =
			(fileVersionsList?.length || 0) > 9
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
				: []

		const noHistoryVersionItem =
			!fileVersionsList || fileVersionsList.length === 0
				? [
						{
							key: "noHistoryVersion",
							label: (
								<div
									className={cn(styles.loadMoreHint, styles.noHistoryVersionHint)}
								>
									{t("common.noHistoryVersionHint")}
								</div>
							),
						},
					]
				: []

		return {
			label: (
				<div className={styles.fileVersionsDropdownItem}>
					<IconHistory size={16} />
					<div className={styles.fileVersionsDropdownItemTitle}>
						{t("common.historyVersion")}
					</div>
				</div>
			),
			key: "historyVersion",
			trigger: ["click"] as any,
			children: [...versionItems, ...loadMoreHintItem, ...noHistoryVersionItem],
		} as ItemType
	}, [fileVersionsList, fileVersion, handleChangeFileVersion, t, styles])
}

export default useFileVersionsMenuItems
