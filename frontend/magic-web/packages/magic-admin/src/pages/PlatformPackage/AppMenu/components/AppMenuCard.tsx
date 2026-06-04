import { memo } from "react"
import { Flex, Switch } from "antd"
import { useTranslation } from "react-i18next"
import { MagicButton, MobileCard } from "@admin-components"
import { AppMenu } from "@admin/types/appMenu"

interface AppMenuCardProps {
	data?: AppMenu.MenuItem
	onClick?: (data: AppMenu.MenuItem) => void
	statusLoadingIds: Set<string>
	hasEditRight: boolean
	openMethodLabel: (value: AppMenu.OpenMethod) => string
	handleStatusChange: (record: AppMenu.MenuItem, checked: boolean) => void
	handleEdit: (record: AppMenu.MenuItem) => void
	handleDelete: (record: AppMenu.MenuItem) => void
}

function AppMenuCard({
	data,
	onClick,
	statusLoadingIds,
	hasEditRight,
	openMethodLabel,
	handleStatusChange,
	handleEdit,
	handleDelete,
}: AppMenuCardProps) {
	const { t } = useTranslation("admin/common")

	if (!data) return null

	return (
		<MobileCard
			title={data.name_i18n?.zh_CN || data.name_i18n?.en_US || "-"}
			onClick={() => onClick?.(data)}
		>
			<Flex vertical gap={6}>
				<span>
					{t("appMenu.columns.path")}: {data.path || "-"}
				</span>
				<span>
					{t("appMenu.columns.openMethod")}: {openMethodLabel(data.open_method)}
				</span>
				<span>
					{t("appMenu.columns.sortOrder")}: {data.sort_order ?? "-"}
				</span>
				<Flex align="center" gap={8}>
					<span>{t("appMenu.columns.status")}:</span>
					<Switch
						checked={data.status === AppMenu.StatusMap.enabled}
						loading={statusLoadingIds.has(data.id)}
						disabled={!hasEditRight || statusLoadingIds.has(data.id)}
						onChange={(checked) => handleStatusChange(data, checked)}
					/>
				</Flex>
				<Flex justify="end" gap={8}>
					<MagicButton
						type="link"
						disabled={!hasEditRight}
						onClick={() => handleEdit(data)}
					>
						{t("button.edit")}
					</MagicButton>
					<MagicButton
						type="link"
						danger
						disabled={!hasEditRight}
						onClick={() => handleDelete(data)}
					>
						{t("button.delete")}
					</MagicButton>
				</Flex>
			</Flex>
		</MobileCard>
	)
}

export default memo(AppMenuCard)
