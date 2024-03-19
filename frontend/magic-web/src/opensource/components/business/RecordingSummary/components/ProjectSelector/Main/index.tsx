import { memo, useMemo, useRef, useState } from "react"
import { createStyles } from "antd-style"
import { SearchInput, ProjectList } from "../components"
import { ProjectSelectorMainProps, ProjectListRef, WorkspaceListRef } from "../types"
import WorkspaceList from "../components/WorkspaceList"
import FlexBox from "@/opensource/components/base/FlexBox"
import { IconChevronRight, IconFolder, IconPlus } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import SearchedProjectList from "../components/SearchedProjectList"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useMemoizedFn, useDebounce } from "ahooks"
import { useTranslation } from "react-i18next"
import { ProjectListItem, Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { MagicEmpty } from "@/opensource/components/base"

const useStyles = createStyles(({ css, token }) => ({
	projectSelector: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		height: 100%;
	`,

	selectorPanel: css`
		display: flex;
		flex-direction: column;
		height: 100%;
		border: 1px solid ${token.colorBorderSecondary};
		overflow: hidden;
	`,

	searchHeaderMobileContainer: css`
		border-bottom: 1px solid ${token.colorBorderSecondary};
	`,

	// Desktop dual panel layout
	dualPanelContainer: css`
		display: flex;
		border: 1px solid ${token.colorBorderSecondary};
		border-radius: 12px;
		overflow: hidden;
		background-color: ${token.colorBgContainer};
		margin: 0 10px;
	`,

	leftPanel: css`
		width: 300px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid ${token.colorBorderSecondary};
		border-radius: 12px 0 0 12px;
		overflow: hidden;
		background-color: ${token.colorBgContainer};
	`,

	rightPanel: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		border-radius: 0 12px 12px 0;
		overflow: hidden;
		background-color: ${token.colorBgContainer};
	`,

	panelHeader: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 50px;
		padding: 0 14px;
		flex-shrink: 0;
		border-bottom: 1px solid ${token.colorBorderSecondary};
	`,

	panelTitle: css`
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
		color: ${token.magicColorUsages.text[0]};
	`,

	createButton: css`
		font-size: 14px;
		color: ${token.magicColorUsages.primary.default};
		cursor: pointer;
		padding: 0;
		background: none;
		border: none;

		&:hover {
			color: ${token.magicColorUsages.primary.hover};
		}
	`,

	searchHeaderMobile: css`
		padding: 10px 12px;
	`,

	searchInputMobile: css`
		background-color: ${token.magicColorUsages.fill[0]};

		&:hover,
		&:focus {
			background-color: ${token.magicColorUsages.fill[0]};
		}

		border: none;
		flex: 1;
	`,

	searchHeader: css`
		padding: 5px;
		border-bottom: 1px solid ${token.colorBorderSecondary};
		background-color: ${token.colorFillQuaternary};
	`,

	selectWorkspace: css`
		padding: 0 12px 10px 12px;
	`,

	selectWorkspaceText: css`
		color: ${token.magicColorUsages.primary.default};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,

	selectWorkspaceIcon: css`
		color: ${token.magicColorUsages.text[3]};
	`,

	footer: css`
		padding: 0 12px 10px 12px;
	`,
	useNewProjectStorageButton: css`
		padding: 0 12px;
	`,

	searchResult: css`
		color: ${token.magicColorUsages.text[0]};
		text-align: justify;
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
	`,

	searchResultContainer: css`
		padding: 0 12px 10px 12px;
	`,
}))

function ProjectSelectorMain({
	selectedProject,
	selectedWorkspace,
	onProjectSelect: _onProjectSelect,
	onWorkspaceChange: _onWorkspaceChange,
	onWorkspaceArrowClick: _onWorkspaceArrowClick,
	onProjectConfirm,
	onCancel: onCancelProp,
}: ProjectSelectorMainProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const isMobile = useIsMobile()

	// Mobile: single search keyword
	const [searchKeyword, setSearchKeyword] = useState("")
	const debouncedSearchKeyword = useDebounce(searchKeyword, { wait: 300 })

	// Desktop: separate search keywords
	const [workspaceSearchKeyword, setWorkspaceSearchKeyword] = useState("")
	const [projectSearchKeyword, setProjectSearchKeyword] = useState("")
	const debouncedWorkspaceKeyword = useDebounce(workspaceSearchKeyword, { wait: 300 })
	const debouncedProjectKeyword = useDebounce(projectSearchKeyword, { wait: 300 })

	const onWorkspaceChange = useMemoizedFn((workspace: Workspace | null) => {
		// Toggle workspace selection: if same workspace clicked, deselect it
		const finalWorkspace = selectedWorkspace?.id === workspace?.id ? null : workspace
		_onWorkspaceChange?.(finalWorkspace)

		// Clear project search keyword when workspace changes (desktop only)
		if (!isMobile && selectedWorkspace?.id !== finalWorkspace?.id) {
			setProjectSearchKeyword("")
		}
	})

	const onProjectSelect = useMemoizedFn((project: ProjectListItem | null) => {
		// Toggle project selection: if same project clicked, deselect it
		_onProjectSelect?.(selectedProject?.id === project?.id ? null : project)
	})

	const onWorkspaceArrowClick = useMemoizedFn((workspace: Workspace) => {
		// Clear project search keyword when switching to a workspace (desktop only)
		if (!isMobile && selectedWorkspace?.id !== workspace.id) {
			setProjectSearchKeyword("")
		}
		_onWorkspaceArrowClick?.(workspace)
	})

	const resetState = useMemoizedFn(() => {
		setSearchKeyword("")
		setWorkspaceSearchKeyword("")
		setProjectSearchKeyword("")
	})

	const onCancel = useMemoizedFn(() => {
		onCancelProp?.()
		onWorkspaceChange(null)
		onProjectSelect(null)
		resetState()
	})

	// const handleUseNewProjectStorage = useMemoizedFn(() => {
	// 	onProjectConfirm?.(null, null)
	// 	onCancel()
	// })

	const onBackWorkspace = useMemoizedFn(() => {
		onWorkspaceChange(null)
		onProjectSelect(null)
		resetState()
	})

	const confirmDisabled = useMemo(() => {
		// Both mobile and desktop require workspace and project to be selected
		return !selectedWorkspace
	}, [selectedWorkspace])

	const onConfirm = useMemoizedFn(() => {
		if (confirmDisabled || !selectedWorkspace) return
		onProjectConfirm?.(selectedProject ?? null, selectedWorkspace)
	})

	const projectListRef = useRef<ProjectListRef>(null)
	const workspaceListRef = useRef<WorkspaceListRef>(null)

	const handleCreateWorkspace = useMemoizedFn(() => {
		workspaceListRef.current?.createNewWorkspace?.()
	})

	const handleCreateProject = useMemoizedFn(() => {
		projectListRef.current?.createNewProject?.()
	})

	const handleCreate = useMemoizedFn(() => {
		// Mobile: create project if workspace is selected, otherwise create workspace
		if (selectedWorkspace) {
			projectListRef.current?.createNewProject?.()
		} else {
			workspaceListRef.current?.createNewWorkspace?.()
		}
	})

	// Mobile: single panel UI
	if (isMobile) {
		const showWorkspaceList = !selectedWorkspace && !debouncedSearchKeyword
		const showProjectList = !!selectedWorkspace && !debouncedSearchKeyword
		const showSearchResults = !!debouncedSearchKeyword

		return (
			<div className={styles.projectSelector}>
				<div className={styles.selectorPanel}>
					<div className={styles.searchHeaderMobileContainer}>
						<FlexBox
							align="center"
							justify="space-between"
							gap={10}
							className={styles.searchHeaderMobile}
						>
							<SearchInput
								placeholder={t("recordingSummary.projectSelector.searchProject")}
								value={searchKeyword}
								onChange={setSearchKeyword}
								inputClassName={styles.searchInputMobile}
							/>
							{!debouncedSearchKeyword && (
								<MagicButton
									icon={<MagicIcon component={IconPlus} size={20} />}
									color="default"
									variant="filled"
									onClick={handleCreate}
								>
									{selectedWorkspace
										? t("recordingSummary.projectSelector.createProject")
										: t("recordingSummary.projectSelector.createWorkspace")}
								</MagicButton>
							)}
						</FlexBox>

						{showSearchResults && (
							<FlexBox
								align="center"
								justify="space-between"
								className={styles.searchResultContainer}
							>
								<div className={styles.searchResult}>
									{t("recordingSummary.projectSelector.searchResults")}
								</div>
								<MagicButton
									size="small"
									style={{ padding: 0 }}
									type="link"
									onClick={() => setSearchKeyword("")}
								>
									{t("recordingSummary.projectSelector.exitSearch")}
								</MagicButton>
							</FlexBox>
						)}

						{showProjectList && selectedWorkspace && (
							<FlexBox align="center" className={styles.selectWorkspace}>
								<div
									className={styles.selectWorkspaceText}
									style={{ cursor: "pointer" }}
									onClick={onBackWorkspace}
								>
									{t("recordingSummary.projectSelector.select")}
								</div>
								<MagicIcon
									component={IconChevronRight}
									size={24}
									className={styles.selectWorkspaceIcon}
									color="currentColor"
								/>
								<div>
									{selectedWorkspace.name || t("workspace.unnamedWorkspace")}
								</div>
							</FlexBox>
						)}
					</div>

					{showSearchResults && (
						<SearchedProjectList
							selectedProject={selectedProject}
							onProjectClick={onProjectSelect}
							emptyText={t("recordingSummary.projectSelector.noMatchingProjects")}
							setKeyword={setSearchKeyword}
							keyword={debouncedSearchKeyword}
						/>
					)}

					{showWorkspaceList && (
						<WorkspaceList
							selectedWorkspaceId={undefined}
							onWorkspaceChange={onWorkspaceChange}
							onWorkspaceArrowClick={onWorkspaceArrowClick}
							emptyText={t("recordingSummary.projectSelector.noWorkspace")}
							ref={workspaceListRef}
						/>
					)}

					{showProjectList && selectedWorkspace && (
						<ProjectList
							selectedProject={selectedProject}
							selectedWorkspace={selectedWorkspace}
							onProjectClick={onProjectSelect}
							emptyText={t("recordingSummary.projectSelector.noProjects")}
							ref={projectListRef}
						/>
					)}
				</div>
				<FlexBox align="center" justify="flex-end" className={styles.footer} gap={10}>
					{/* <MagicButton
						icon={<MagicIcon component={IconFolder} />}
						block
						type="default"
						onClick={handleUseNewProjectStorage}
					>
						{t("recordingSummary.projectSelector.useNewProjectStorage")}
					</MagicButton> */}
					<MagicButton
						block
						type="primary"
						disabled={confirmDisabled}
						onClick={onConfirm}
					>
						{t("common.confirm")}
					</MagicButton>
				</FlexBox>
			</div>
		)
	}

	// Desktop: dual panel layout
	return (
		<div className={styles.projectSelector}>
			<div className={styles.dualPanelContainer}>
				{/* Left Panel: Workspace List */}
				<div className={styles.leftPanel}>
					<div className={styles.panelHeader}>
						<div className={styles.panelTitle}>
							{t("recordingSummary.projectSelector.workspace")}
						</div>
						<button className={styles.createButton} onClick={handleCreateWorkspace}>
							{t("recordingSummary.projectSelector.createWorkspace")}
						</button>
					</div>
					<div className={styles.searchHeader}>
						<SearchInput
							placeholder={t("recordingSummary.projectSelector.searchWorkspace")}
							value={workspaceSearchKeyword}
							onChange={setWorkspaceSearchKeyword}
						/>
					</div>
					<WorkspaceList
						selectedWorkspaceId={selectedWorkspace?.id}
						onWorkspaceChange={onWorkspaceChange}
						onWorkspaceArrowClick={onWorkspaceArrowClick}
						emptyText={t("recordingSummary.projectSelector.noWorkspace")}
						keyword={debouncedWorkspaceKeyword}
						ref={workspaceListRef}
					/>
				</div>

				{/* Right Panel: Project List */}
				<div className={styles.rightPanel}>
					<div className={styles.panelHeader}>
						<div className={styles.panelTitle}>
							{selectedWorkspace?.name || t("workspace.unnamedWorkspace")}
						</div>
						{selectedWorkspace && (
							<button className={styles.createButton} onClick={handleCreateProject}>
								{t("recordingSummary.projectSelector.createProject")}
							</button>
						)}
					</div>
					{selectedWorkspace ? (
						<>
							<div className={styles.searchHeader}>
								<SearchInput
									placeholder={t(
										"recordingSummary.projectSelector.searchProject",
									)}
									value={projectSearchKeyword}
									onChange={setProjectSearchKeyword}
								/>
							</div>
							<ProjectList
								selectedProject={selectedProject}
								selectedWorkspace={selectedWorkspace}
								onProjectClick={onProjectSelect}
								emptyText={t("recordingSummary.projectSelector.noProjects")}
								keyword={debouncedProjectKeyword}
								ref={projectListRef}
							/>
						</>
					) : (
						<FlexBox
							align="center"
							justify="center"
							style={{ flex: 1, color: "var(--semi-color-text-3)" }}
						>
							<MagicEmpty
								description={t(
									"recordingSummary.projectSelector.selectWorkspaceFirst",
								)}
							/>
						</FlexBox>
					)}
				</div>
			</div>
			<FlexBox align="center" justify="flex-end" gap={10} className={styles.footer}>
				{/* <MagicButton
					icon={<MagicIcon component={IconFolder} />}
					type="default"
					onClick={handleUseNewProjectStorage}
					className={styles.useNewProjectStorageButton}
				>
					{t("recordingSummary.projectSelector.useNewProjectStorage")}
				</MagicButton> */}
				<FlexBox align="center" justify="flex-end" gap={10}>
					<MagicButton type="default" onClick={onCancel}>
						{t("common.cancel")}
					</MagicButton>
					<MagicButton type="primary" disabled={confirmDisabled} onClick={onConfirm}>
						{t("common.confirm")}
					</MagicButton>
				</FlexBox>
			</FlexBox>
		</div>
	)
}

export default memo(ProjectSelectorMain)
