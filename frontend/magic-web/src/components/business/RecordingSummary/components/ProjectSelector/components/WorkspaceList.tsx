import { createStyles } from "antd-style"
import { Empty, Input } from "antd"
import { WorkspaceListProps, WorkspaceListRef } from "../types"
import WorkspaceItem from "./WorkspaceItem"
import { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { useMemo, forwardRef, useImperativeHandle, useEffect } from "react"
import MagicSpin from "@/components/base/MagicSpin"
import { useWorkspaceCreation } from "@/pages/superMagic/components/EmptyWorkspacePanel/components/MoveProjectModal/hooks/useWorkspaceCreation"
import useScrollLoad from "@/hooks/use-scroll-load"
import { useTranslation } from "react-i18next"
import IconWorkspace from "@/pages/superMagic/components/icons/IconWorkspace"
import { SuperMagicApi } from "@/apis"

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
		height: 100%;
	`,

	emptyContainer: css`
		padding: 20px;
		text-align: center;
		height: 100%;

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

const WorkspaceList = forwardRef<WorkspaceListRef, WorkspaceListProps>(
	(
		{ selectedWorkspaceId, onWorkspaceChange, onWorkspaceArrowClick, keyword = "", emptyText },
		ref,
	) => {
		const { t } = useTranslation("super")
		const { styles } = useStyles()

		// Use scroll load hook for workspaces
		const {
			data: workspaces,
			loading,
			onScroll,
			reload,
		} = useScrollLoad<Workspace>({
			loadFn: async ({ page, pageSize }) => {
				const result = await SuperMagicApi.getWorkspaces({
					page,
					page_size: pageSize,
				})

				return {
					list: result.list,
					hasMore: result.list.length >= pageSize,
				}
			},
		})

		/* Workspace creation logic */
		const {
			isCreatingWorkspace,
			newWorkspaceName,
			workspaceInputRef,
			setNewWorkspaceName,
			handleStartCreation,
			handleCreateWorkspaceBlur,
			handleCreateWorkspaceKeyDown,
		} = useWorkspaceCreation({
			fetchWorkspaces: () => {
				// Reload workspaces data
				reload()
			},
			onWorkspaceCreated: (workspaceId) => {
				// Find and select the created workspace
				const createdWorkspace = workspaces.find((w) => w.id === workspaceId)
				if (createdWorkspace) {
					onWorkspaceChange?.(createdWorkspace)
				}
			},
		})

		// Load workspaces on mount
		useEffect(() => {
			reload()
		}, [reload])

		const filteredWorkspaces = useMemo(() => {
			if (!keyword.trim()) return workspaces
			return workspaces.filter((workspace) =>
				workspace.name.toLowerCase().includes(keyword.toLowerCase()),
			)
		}, [workspaces, keyword])

		// Expose methods to parent component
		useImperativeHandle(
			ref,
			() => ({
				createNewWorkspace: handleStartCreation,
				startWorkspaceCreation: handleStartCreation,
			}),
			[handleStartCreation],
		)

		return (
			<MagicSpin spinning={loading} className={styles.loadingContainer}>
				{!filteredWorkspaces.length && !isCreatingWorkspace ? (
					<div className={styles.emptyContainer}>
						<Empty
							image={Empty.PRESENTED_IMAGE_SIMPLE}
							description={emptyText}
							style={{ margin: 0 }}
							className={styles.emptyDescription}
						/>
					</div>
				) : (
					<div className={styles.projectList} onScroll={(e) => onScroll(e.currentTarget)}>
						{isCreatingWorkspace && (
							<div className={styles.contentItem}>
								<div className={styles.contentItemName}>
									<div className={styles.contentItemIcon}>
										<IconWorkspace />
									</div>
									<Input
										className={styles.contentItemInput}
										ref={workspaceInputRef}
										value={newWorkspaceName}
										onBlur={handleCreateWorkspaceBlur}
										onKeyDown={handleCreateWorkspaceKeyDown}
										placeholder={t(
											"recordingSummary.projectSelector.enterWorkspaceName",
										)}
										autoFocus
										maxLength={100}
										onChange={(e) => setNewWorkspaceName(e.target.value)}
									/>
								</div>
							</div>
						)}
						{filteredWorkspaces.map((workspace) => (
							<WorkspaceItem
								key={workspace.id}
								workspace={workspace}
								selected={workspace.id === selectedWorkspaceId}
								onClick={onWorkspaceChange}
								onArrowClick={onWorkspaceArrowClick}
							/>
						))}
					</div>
				)}
			</MagicSpin>
		)
	},
)

// Export workspace creation hook for other components
export { useWorkspaceCreation }

export default WorkspaceList
