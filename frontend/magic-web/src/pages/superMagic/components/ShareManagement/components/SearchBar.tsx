import { memo, useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useDebounce } from "ahooks"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Input } from "@/components/shadcn-ui/input"
import { SharedResourceType, WorkspaceProjectTree } from "../types"
import { ResourceType } from "../../Share/types"
import { SuperMagicApi } from "@/apis"
import { Search } from "lucide-react"
import { cn } from "@/lib/tiptap-utils"

// 特殊值，表示"所有项目"
const ALL_PROJECTS = "__all__"

interface SearchBarProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	resourceType: SharedResourceType
	// 受控的项目选择
	selectedProjectId?: string
	onProjectChange?: (projectId: string | undefined) => void
	// 是否显示"项目筛选"文本标签
	showFilterLabel?: boolean
}

function SearchBar({
	value,
	onChange,
	placeholder,
	resourceType,
	selectedProjectId,
	onProjectChange,
	showFilterLabel = true,
}: SearchBarProps) {
	const { t } = useTranslation("super")
	const [projectsTree, setProjectsTree] = useState<WorkspaceProjectTree[]>([])
	const [loading, setLoading] = useState(false)
	const [projectSearchQuery, setProjectSearchQuery] = useState("")
	// 防抖处理搜索关键词
	const debouncedSearchQuery = useDebounce(projectSearchQuery, { wait: 300 })

	// 是否显示项目过滤（仅文件和话题分享需要）
	const showProjectFilter =
		resourceType === SharedResourceType.File || resourceType === SharedResourceType.Topic

	// 加载项目列表
	useEffect(() => {
		if (!showProjectFilter) return

		async function loadProjects() {
			try {
				setLoading(true)

				// 根据资源类型确定 resource_type 参数
				let resourceTypes: number[]
				switch (resourceType) {
					case SharedResourceType.Topic:
						// 话题分享
						resourceTypes = [ResourceType.Topic]
						break
					case SharedResourceType.File:
						// 文件分享（包含文件集合和单文件）
						resourceTypes = [ResourceType.FileCollection]
						break
					default:
						resourceTypes = [ResourceType.Topic]
						break
				}

				const response = await SuperMagicApi.getShareProjectsTree({
					resource_type: resourceTypes,
				})
				const newProjectsTree = response || []
				setProjectsTree(newProjectsTree)

				// 验证当前选中的项目是否在新的项目列表中
				if (selectedProjectId && selectedProjectId !== ALL_PROJECTS) {
					const projectExists = newProjectsTree.some((workspace) =>
						workspace.projects.some(
							(project) => project.project_id === selectedProjectId,
						),
					)
					// 如果当前选中的项目不在列表中，重置为"全部项目"
					if (!projectExists) {
						onProjectChange?.(undefined)
					}
				}
			} catch (error) {
				console.error("Failed to load projects tree:", error)
				setProjectsTree([])
			} finally {
				setLoading(false)
			}
		}

		loadProjects()
	}, [showProjectFilter, resourceType, selectedProjectId, onProjectChange])

	// 处理项目选择变化
	function handleProjectChange(value: string) {
		const newProjectId = value === ALL_PROJECTS ? undefined : value
		// 调用父组件的回调，而不是直接修改 store
		onProjectChange?.(newProjectId)
		// 清空搜索关键词
		setProjectSearchQuery("")
	}

	// 过滤项目树（使用防抖后的搜索关键词）
	const filteredProjectsTree = useMemo(() => {
		if (!debouncedSearchQuery.trim()) {
			return projectsTree
		}

		const query = debouncedSearchQuery.toLowerCase()
		return projectsTree
			.map((workspace) => ({
				...workspace,
				projects: workspace.projects.filter((project) => {
					const projectName = project.project_name || t("common.untitledProject")
					return projectName.toLowerCase().includes(query)
				}),
			}))
			.filter((workspace) => workspace.projects.length > 0) // 过滤掉项目为空的工作区
	}, [projectsTree, debouncedSearchQuery, t])

	return (
		<div className="flex w-full items-center gap-3">
			<div className="relative flex-1">
				<Search
					size={16}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
				/>
				<Input
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className={cn("h-9 pl-8")}
				/>
			</div>

			{showProjectFilter && (
				<div className="flex flex-shrink-0 items-center gap-2">
					{showFilterLabel && (
						<span className="text-sm font-medium leading-none text-gray-900">
							{t("shareManagement.projectFilter")}
						</span>
					)}
					<Select
						value={selectedProjectId || ALL_PROJECTS}
						onValueChange={handleProjectChange}
						disabled={loading}
					>
						<SelectTrigger
							className={cn(
								"w-[140px] overflow-hidden text-ellipsis text-left",
								"[&_span[data-slot='select-value']]:max-w-[100px] [&_span[data-slot='select-value']]:overflow-hidden [&_span[data-slot='select-value']]:text-ellipsis",
							)}
						>
							<SelectValue placeholder={t("shareManagement.allProjects")} />
						</SelectTrigger>
						<SelectContent
							className="max-h-[280px]"
							align="start"
							style={{ zIndex: 1300 }}
							showScrollButtons={false}
							viewportClassName="pt-0"
						>
							{/* 搜索输入框 */}
							<div
								className="sticky top-0 z-10 bg-popover px-2 pb-2 pt-2"
								onPointerDown={(e) => e.stopPropagation()}
								onMouseDown={(e) => e.stopPropagation()}
							>
								<Input
									placeholder={t("shareManagement.searchProject")}
									value={projectSearchQuery}
									onChange={(e) => setProjectSearchQuery(e.target.value)}
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => {
										e.stopPropagation()
										// 阻止 Enter 键关闭 Select
										if (e.key === "Enter") {
											e.preventDefault()
										}
									}}
									onPointerDown={(e) => e.stopPropagation()}
									onMouseDown={(e) => e.stopPropagation()}
									className="h-8"
									autoFocus
								/>
							</div>

							{/* 所有项目选项 */}
							<SelectItem value={ALL_PROJECTS}>
								{t("shareManagement.allProjects")}
							</SelectItem>

							{/* 二级分组展示 */}
							{filteredProjectsTree.length > 0
								? filteredProjectsTree.map((workspace) => (
									<SelectGroup key={workspace.workspace_id}>
										<SelectLabel>
											{workspace.workspace_name ||
												t("share.unNamedWorkspace")}
										</SelectLabel>
										{workspace.projects.map((project) => (
											<SelectItem
												key={project.project_id}
												value={project.project_id}
											>
												{project.project_name ||
													t("common.untitledProject")}
											</SelectItem>
										))}
									</SelectGroup>
								))
								: debouncedSearchQuery.trim() && (
									<div className="px-2 py-1.5 text-sm text-muted-foreground">
										{t("shareManagement.noProjectFound")}
									</div>
								)}
						</SelectContent>
					</Select>
				</div>
			)}
		</div>
	)
}

export default memo(SearchBar)
