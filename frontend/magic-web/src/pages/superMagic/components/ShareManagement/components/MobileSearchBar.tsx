import { memo } from "react"
import { IconSearch } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"

interface MobileSearchBarProps {
	searchText: string
	onSearchChange: (value: string) => void
	selectedProjectId?: string
	onProjectChange?: (projectId: string) => void
	projects?: Array<{ id: string; name: string }>
	showProjectFilter?: boolean
	searchPlaceholder?: string
}

function MobileSearchBar({
	searchText,
	onSearchChange,
	selectedProjectId = "all",
	onProjectChange,
	projects = [],
	showProjectFilter = false,
	searchPlaceholder,
}: MobileSearchBarProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex w-full items-center gap-2">
			{/* 搜索框 */}
			<div className="relative flex-1">
				<IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={searchText}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder={searchPlaceholder || t("shareManagement.searchPlaceholder")}
					className="h-9 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:ring-0"
				/>
			</div>

			{/* 项目筛选下拉框 */}
			{showProjectFilter && (
				<Select value={selectedProjectId} onValueChange={onProjectChange}>
					<SelectTrigger className="h-9 w-[120px] gap-2">
						<SelectValue placeholder={t("shareManagement.allProjects")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("shareManagement.allProjects")}</SelectItem>
						{projects.map((project) => (
							<SelectItem key={project.id} value={project.id}>
								{project.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</div>
	)
}

export default memo(MobileSearchBar)
