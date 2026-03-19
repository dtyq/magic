import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { SharedTopicFilterStatus } from "../types"

interface StatusTabsProps {
	value: SharedTopicFilterStatus
	onChange: (value: SharedTopicFilterStatus) => void
	tabListClassName?: string
}

function StatusTabs({ value, onChange, tabListClassName }: StatusTabsProps) {
	const { t } = useTranslation("super")

	return (
		<Tabs value={value} onValueChange={(val) => onChange(val as SharedTopicFilterStatus)}>
			<TabsList className={tabListClassName}>
				<TabsTrigger value={SharedTopicFilterStatus.Active}>
					{t("shareManagement.filterStatus.active")}
				</TabsTrigger>
				<TabsTrigger value={SharedTopicFilterStatus.Expired}>
					{t("shareManagement.filterStatus.expired")}
				</TabsTrigger>
				<TabsTrigger value={SharedTopicFilterStatus.Cancelled}>
					{t("shareManagement.filterStatus.cancelled")}
				</TabsTrigger>
			</TabsList>
		</Tabs>
	)
}

export default memo(StatusTabs)
