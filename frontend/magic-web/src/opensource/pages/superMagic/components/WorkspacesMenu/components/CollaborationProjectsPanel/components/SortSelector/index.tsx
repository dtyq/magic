import { memo } from "react"
import { useTranslation } from "react-i18next"
import { IconArrowsSort, IconCheck, IconChevronDown } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import { type SortSelectorProps } from "../types"
import { SortType } from "@/opensource/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem"

function SortSelectorComponent({ value, onChange }: SortSelectorProps) {
	const { t } = useTranslation("super")

	const getSortLabel = (sortValue: SortType) => {
		switch (sortValue) {
			case SortType.PROJECT_UPDATE_TIME:
				return t("workspace.sortByProjectUpdateTime")
			case SortType.MY_LAST_ACTIVE_TIME:
				return t("workspace.sortByMyLastActiveTime")
			case SortType.PROJECT_CREATE_TIME:
				return t("workspace.sortByProjectCreateTime")
			default:
				return t("workspace.sortByProjectUpdateTime")
		}
	}

	return (
		<MagicDropdown
			menu={{
				items: [
					{
						key: SortType.PROJECT_UPDATE_TIME,
						label: (
							<div className="flex items-center justify-between gap-1">
								{t("workspace.sortByProjectUpdateTime")}
								{value === SortType.PROJECT_UPDATE_TIME && (
									<MagicIcon
										component={IconCheck}
										size={16}
										className="text-primary"
									/>
								)}
							</div>
						),
					},
					{
						key: SortType.MY_LAST_ACTIVE_TIME,
						label: (
							<div className="flex items-center justify-between gap-1">
								{t("workspace.sortByMyLastActiveTime")}
								{value === SortType.MY_LAST_ACTIVE_TIME && (
									<MagicIcon
										component={IconCheck}
										size={16}
										className="text-primary"
									/>
								)}
							</div>
						),
					},
					{
						key: SortType.PROJECT_CREATE_TIME,
						label: (
							<div className="flex items-center justify-between gap-1">
								{t("workspace.sortByProjectCreateTime")}
								{value === SortType.PROJECT_CREATE_TIME && (
									<MagicIcon
										component={IconCheck}
										size={16}
										className="text-primary"
									/>
								)}
							</div>
						),
					},
				],
				onClick: ({ key }) => onChange(key as SortType),
			}}
		>
			<div className="flex h-8 cursor-pointer items-center rounded-lg px-2.5 transition-all duration-200 hover:bg-fill">
				<div className="flex items-center gap-1">
					<MagicIcon component={IconArrowsSort} size={16} />
					<span className="text-xs font-normal leading-4 text-muted-foreground">
						{t("workspace.sort")}
					</span>
					<span className="text-xs font-normal leading-4 text-foreground">
						{getSortLabel(value)}
					</span>
					<MagicIcon component={IconChevronDown} size={14} />
				</div>
			</div>
		</MagicDropdown>
	)
}

export default memo(SortSelectorComponent)
