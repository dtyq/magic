import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { SmoothTabs } from "@/components/shadcn-ui/smooth-tabs"
import { SharedResourceType } from "../types"

interface ShareManagementTabsProps {
	value: SharedResourceType
	onChange: (value: SharedResourceType) => void
	className?: string
}

function ShareManagementTabs({ value, onChange, className }: ShareManagementTabsProps) {
	const { t } = useTranslation("super")

	const tabs = useMemo(
		() => [
			{ value: SharedResourceType.File, label: t("shareManagement.file") },
			{ value: SharedResourceType.Project, label: t("shareManagement.project") },
			{ value: SharedResourceType.Topic, label: t("shareManagement.topic") },
		],
		[t],
	)

	return (
		<SmoothTabs<SharedResourceType>
			tabs={tabs}
			value={value}
			onChange={onChange}
			variant="background"
			className={cn("h-7 w-fit bg-muted p-[3px]", className)}
			buttonClassName="h-full px-2 py-1 text-xs"
			indicatorClassName="h-[22px] inset-y-[3px]"
		/>
	)
}

export default memo(ShareManagementTabs)
