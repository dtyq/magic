import useStyles from "./styles"
import { useTranslation } from "react-i18next"
import type { ProjectListItem, WithPage } from "../../pages/Workspace/types"
import IconWorkspaceProjectFolder from "@/opensource/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import { useState, useEffect, useRef, useCallback, memo } from "react"
import { IconArrowUpRight } from "@tabler/icons-react"
import { Spin } from "antd"

interface AllProjectsProps {
	projects: ProjectListItem[]
	allProjectsPage: number
	fetchAllProjects: ({ page }: { page: number }) => void
	isAllProjectsLoaded: boolean
	handleProjectClick: (project: ProjectListItem) => void
	handleWorkspaceClick: (workspaceId: string) => void
}

function AllProjects({
	projects,
	allProjectsPage,
	isAllProjectsLoaded,
	fetchAllProjects,
	handleProjectClick,
	handleWorkspaceClick,
}: AllProjectsProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
	const [wasHoveredProjects, setWasHoveredProjects] = useState<Set<string>>(new Set())
	const [loading, setLoading] = useState(false)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const isRequestingRef = useRef(false)

	// 检查是否滚动到底部
	const checkScrollBottom = useCallback((element: HTMLElement) => {
		const { scrollTop, scrollHeight, clientHeight } = element
		// 提前100px开始加载，提升用户体验
		return scrollTop + clientHeight >= scrollHeight - 100
	}, [])

	// 加载更多数据
	const loadMoreData = useCallback(async () => {
		if (loading || isAllProjectsLoaded || isRequestingRef.current) return

		try {
			isRequestingRef.current = true
			setLoading(true)

			const nextPage = allProjectsPage + 1
			await fetchAllProjects({
				page: nextPage,
			})
		} catch (error) {
			console.error("Failed to load more projects:", error)
		} finally {
			setLoading(false)
			isRequestingRef.current = false
		}
	}, [loading, isAllProjectsLoaded, allProjectsPage, fetchAllProjects])

	// 滚动事件处理
	const handleScroll = useCallback(
		(event: Event) => {
			const element = event.target as HTMLElement
			if (checkScrollBottom(element)) {
				loadMoreData()
			}
		},
		[checkScrollBottom, loadMoreData],
	)

	// 监听滚动事件
	useEffect(() => {
		const scrollContainer = scrollContainerRef.current
		if (!scrollContainer) return

		scrollContainer.addEventListener("scroll", handleScroll, { passive: true })

		return () => {
			scrollContainer.removeEventListener("scroll", handleScroll)
		}
	}, [handleScroll])

	return (
		<div className={styles.container}>
			<div className={styles.title}>
				{t("project.allProjectsCount", {
					count: projects.length,
				})}
			</div>
			<div ref={scrollContainerRef} className={styles.projects}>
				{projects.map((item) => {
					const isProjectHovered = hoveredProjectId === item.id
					const wasProjectHovered = wasHoveredProjects.has(item.id)

					return (
						<div
							key={item.id}
							className={styles.projectItem}
							onMouseEnter={() => {
								setHoveredProjectId(item.id)
								setWasHoveredProjects((prev) => new Set(prev).add(item.id))
							}}
							onMouseLeave={() => setHoveredProjectId(null)}
						>
							<div
								className={styles.projectItemContentWrapper}
								onClick={() => handleProjectClick(item)}
							>
								<div className={styles.projectItemIcon}>
									<IconWorkspaceProjectFolder
										isHovered={isProjectHovered}
										wasHovered={wasProjectHovered}
									/>
								</div>
								<div className={styles.projectItemContent}>
									<SmartTooltip className={styles.projectItemTitle}>
										{item.project_name || t("project.unnamedProject")}
									</SmartTooltip>
									<div className={styles.projectItemUpdatedAt}>
										{t("common.lastUpdatedAt", {
											time: (
												item.last_active_at || item.updated_at
											).replaceAll("-", "/"),
										})}
									</div>
								</div>
							</div>
							<div className={styles.divider} />
							<div className={styles.projectItemFooter}>
								<div>{t("project.belongTo")}</div>
								<div
									className={styles.projectItemFooterContent}
									onClick={() => handleWorkspaceClick(item.workspace_id)}
								>
									<div>{item.workspace_name || t("common.unknown")}</div>
									<IconArrowUpRight size={12} />
								</div>
							</div>
						</div>
					)
				})}

				{/* 加载状态 */}
				{loading && (
					<div className={styles.loadingContainer}>
						<Spin size="small" />
						<span className={styles.loadingText}>{t("common.loading")}</span>
					</div>
				)}

				{/* 没有更多数据提示 */}
				{isAllProjectsLoaded && projects.length > 0 && (
					<div className={styles.noMoreContainer}>
						<span className={styles.noMoreText}>{t("common.noMoreData")}</span>
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(AllProjects)
