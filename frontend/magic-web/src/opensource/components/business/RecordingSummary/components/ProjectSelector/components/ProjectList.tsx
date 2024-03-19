import { createStyles } from "antd-style"
import { Empty, Input } from "antd"
import ProjectItem from "./ProjectItem"
import { ProjectListProps, ProjectListRef } from "../types"
import { ProjectListItem } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useRef, forwardRef, useImperativeHandle, useEffect } from "react"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useProjectCreation } from "@/opensource/hooks/useProjectCreation"
import useScrollLoad from "@/opensource/hooks/use-scroll-load"
import IconProject from "@/opensource/pages/superMagic/components/icons/IconProject"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/opensource/apis"
import { useUpdateEffect } from "ahooks"

const useStyles = createStyles(({ css, token, prefixCls }) => ({
	projectList: css`
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		padding: 10px;
		height: 100%;
		overflow-y: auto;
		height: 400px;
		max-height: 60vh;

		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background-color: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background-color: ${token.colorFillTertiary};
			border-radius: 2px;

			&:hover {
				background-color: ${token.colorFillSecondary};
			}
		}
	`,

	loadingContainer: css`
		.${prefixCls}-spin-container {
			height: unset;
		}
	`,

	emptyContainer: css`
		padding: 20px;
		text-align: center;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;

		.${prefixCls}-empty-description {
			color: ${token.colorTextTertiary};
			font-size: 14px;
		}
	`,

	contentItem: css`
		padding: 8px 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border-radius: 8px;
		border: 1px solid transparent;
	`,
	contentItemSelected: css`
		background-color: ${token.magicColorUsages.primaryLight.default};
		border: 1px solid ${token.magicColorUsages.primary.default};
	`,
	contentItemName: css`
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[0]};
		overflow: hidden;
	`,
	contentItemIcon: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		background-color: ${token.magicColorUsages.fill[0]};
	`,
	contentItemNameText: css`
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	contentItemInput: css`
		min-width: 220px;
	`,
	emptyDescription: css`
		height: calc(400px - 40px);
		max-height: calc(60vh - 40px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	`,
}))

const ProjectList = forwardRef<ProjectListRef, ProjectListProps>(
	({ selectedProject, selectedWorkspace, onProjectClick, keyword = "", emptyText }, ref) => {
		const { t } = useTranslation("super")
		const { styles } = useStyles()
		const scrollRef = useRef<HTMLDivElement>(null)

		// Track current workspace ID to prevent race conditions
		const currentWorkspaceIdRef = useRef<string | undefined>(selectedWorkspace?.id)

		// Use scroll load hook for infinite loading
		const {
			data: projects,
			loading,
			onScroll,
			reload,
			reset,
		} = useScrollLoad<ProjectListItem>({
			loadFn: async ({ page, pageSize }) => {
				if (!selectedWorkspace) {
					return { list: [], hasMore: false }
				}

				// Store current workspace ID at request time
				const requestWorkspaceId = selectedWorkspace.id

				// If keyword exists, use getProjects API for server-side search
				// Otherwise, use getProjectsWithCollaboration API
				let result
				if (keyword?.trim()) {
					result = await SuperMagicApi.getProjectsWithCollaboration({
						workspace_id: requestWorkspaceId,
						project_name: keyword.trim(),
						page,
						page_size: pageSize,
					})
				} else {
					result = await SuperMagicApi.getProjectsWithCollaboration({
						workspace_id: requestWorkspaceId,
						page,
						page_size: pageSize,
					})
				}

				// Verify workspace hasn't changed during request
				// If workspace changed, return empty result to prevent stale data
				if (currentWorkspaceIdRef.current !== requestWorkspaceId) {
					return { list: [], hasMore: false }
				}

				return {
					list: result.list,
					hasMore: result.list.length >= pageSize,
				}
			},
		})

		useUpdateEffect(() => {
			if (!projects.find((project) => project.id === selectedProject?.id)) {
				onProjectClick?.(null)
			}
		}, [projects.length])

		/* Project creation logic */
		const {
			isCreatingProject,
			newProjectName,
			projectInputRef,
			setNewProjectName,
			handleStartCreation,
			handleCreateProjectBlur,
			handleCreateProjectKeyDown,
		} = useProjectCreation({
			selectedWorkspace,
			onProjectCreated: (project) => {
				onProjectClick?.(project)
			},
			onProjectsRefresh: () => {
				// Reload projects data
				reload()
			},
		})

		// Update workspace ref and reload when workspace or keyword changes
		useEffect(() => {
			const newWorkspaceId = selectedWorkspace?.id

			// If workspace changed, update ref and reset data immediately
			// This prevents stale data from previous workspace being displayed
			if (currentWorkspaceIdRef.current !== newWorkspaceId) {
				currentWorkspaceIdRef.current = newWorkspaceId
				reset()
			}

			// Reload data for current workspace
			// Use requestAnimationFrame to ensure reset completes before reload
			if (selectedWorkspace) {
				const frameId = requestAnimationFrame(() => {
					reload()
				})

				return () => cancelAnimationFrame(frameId)
			}
		}, [selectedWorkspace, keyword, reload, reset])

		// Remove client-side filtering since we're using server-side search
		// When keyword exists, results are already filtered by server
		// When keyword is empty, show all projects from getProjectsWithCollaboration
		const displayProjects = projects

		// Expose methods to parent component
		useImperativeHandle(
			ref,
			() => ({
				createNewProject: handleStartCreation,
				startProjectCreation: handleStartCreation,
			}),
			[handleStartCreation],
		)

		return (
			<MagicSpin spinning={loading} className={styles.loadingContainer}>
				{!displayProjects.length && !isCreatingProject ? (
					<FlexBox align="center" justify="center" className={styles.emptyContainer}>
						<Empty
							image={Empty.PRESENTED_IMAGE_SIMPLE}
							description={emptyText}
							style={{ margin: 0 }}
							className={styles.emptyDescription}
						/>
					</FlexBox>
				) : (
					<div
						ref={scrollRef}
						className={styles.projectList}
						onScroll={(e) => onScroll(e.currentTarget)}
					>
						{isCreatingProject && (
							<div className={styles.contentItem}>
								<div className={styles.contentItemName}>
									<div className={styles.contentItemIcon}>
										<IconProject />
									</div>
									<Input
										className={styles.contentItemInput}
										ref={projectInputRef}
										value={newProjectName}
										onBlur={handleCreateProjectBlur}
										onKeyDown={handleCreateProjectKeyDown}
										placeholder={t(
											"recordingSummary.projectSelector.enterProjectName",
										)}
										maxLength={100}
										autoFocus
										onChange={(e) => setNewProjectName(e.target.value)}
									/>
								</div>
							</div>
						)}
						{displayProjects.map((project) => (
							<ProjectItem
								key={project.id}
								project={project}
								selected={project.id === selectedProject?.id}
								onClick={onProjectClick}
							/>
						))}
					</div>
				)}
			</MagicSpin>
		)
	},
)

// Export project creation hook for other components
export { useProjectCreation }

export default ProjectList
