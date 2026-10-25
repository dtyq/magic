import MagicModal from "@/components/base/MagicModal"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import { IconCheck, IconSearch, IconX, IconFolderPlus, IconFileSearch } from "@tabler/icons-react"
import { Checkbox } from "antd"
import { useEffect, useMemo, useRef, useState } from "react"
import { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { useMemoizedFn } from "ahooks"
import { type FetchWorkspacesParams } from "@/pages/superMagic/hooks/useWorkspace"
import { useWorkspaceCreation } from "./hooks/useWorkspaceCreation"
import IconWorkspace from "../../../icons/IconWorkspace"
import { workspaceStore } from "../../../../stores/core"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

/** Modal body and content styles, including dark mode. */
const modalClassNames = {
	body: "!p-0",
	content: cn("rounded-[10px] border border-border shadow-sm", "bg-background dark:bg-card"),
}

/** Header close button with hover, keyboard focus and disabled states. */
const headerCloseButtonClass = cn(
	"inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground",
	"hover:bg-fill active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
	"[&_svg]:text-foreground",
)

/** Toolbar icon buttons use theme-aware borders and backgrounds. */
const iconButtonClass = cn(
	"inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm",
	"hover:bg-fill hover:text-foreground active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
	"[&_svg]:text-foreground",
)

/** Workspace row with hover and selection states. */
const contentItemBaseClass = cn(
	"flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-0",
	"hover:bg-fill active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
)

/** Inline workspace creation actions. */
const actionIconButtonClass = cn(
	"inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm",
	"hover:bg-fill hover:text-foreground active:bg-fill-secondary",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
)

/** Theme-aware antd checkbox overrides. */
const checkboxWrapperClass =
	"pointer-events-none [&_.magic-checkbox-inner]:rounded-md [&_.magic-checkbox-checked_.magic-checkbox-inner]:border-primary [&_.magic-checkbox-checked_.magic-checkbox-inner]:bg-primary"

interface MoveProjectModalProps {
	/** Compatibility prop; the list reads workspaceStore so newly created workspaces appear. */
	workspaces?: Workspace[]
	selectedWorkspace?: Workspace | null
	isMoveProjectLoading: boolean
	fetchWorkspaces: (params: FetchWorkspacesParams) => void
	open: boolean
	onClose: () => void
	onConfirm: (workspaceId: string) => void
}

function MoveProjectModal({
	selectedWorkspace,
	isMoveProjectLoading,
	fetchWorkspaces,
	open,
	onClose,
	onConfirm,
}: MoveProjectModalProps) {
	const { t } = useTranslation("super")

	/** Read the observable store so fetches and workspace creation refresh the list. */
	const workspaces = workspaceStore.workspaces

	/* Selected workspace. */
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("")
	/* Workspace search. */
	const [searchValue, setSearchValue] = useState("")
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)

	/* Workspace creation state and actions. */
	const {
		isCreatingWorkspace,
		isCreatingWorkspaceLoading,
		newWorkspaceName,
		workspaceInputRef,
		setNewWorkspaceName,
		handleStartCreation,
		handleCancelCreation,
		handleCreateWorkspaceBlur,
		handleCreateWorkspaceKeyDown,
	} = useWorkspaceCreation({
		fetchWorkspaces,
		onWorkspaceCreated: (workspaceId) => {
			setSelectedWorkspaceId(workspaceId)
		},
	})

	/* Include the current workspace even when it has not been fetched yet. */
	const workspacesIncludingCurrent = useMemo(() => {
		if (!selectedWorkspace) return workspaces
		if (workspaces.some((w) => w.id === selectedWorkspace.id)) return workspaces
		return [selectedWorkspace, ...workspaces]
	}, [workspaces, selectedWorkspace])

	/* Filter by search text while retaining the current workspace as a destination. */
	const filteredWorkspaces = useMemo(() => {
		return workspacesIncludingCurrent.filter((workspace) =>
			workspace.name.toLowerCase().includes(searchValue.toLowerCase()),
		)
	}, [workspacesIncludingCurrent, searchValue])
	const isSearchEmpty =
		isSearchOpen && !!searchValue && filteredWorkspaces.length === 0 && !isCreatingWorkspace

	/** Handle create workspace click */
	const handleCreateWorkspace = useMemoizedFn(() => {
		setSelectedWorkspaceId("")
		handleStartCreation()
	})

	const handleToggleSearch = useMemoizedFn(() => {
		if (isSearchOpen) {
			setIsSearchOpen(false)
			setSearchValue("")
			return
		}

		setIsSearchOpen(true)
	})

	useEffect(() => {
		if (isSearchOpen) {
			searchInputRef.current?.focus()
		}
	}, [isSearchOpen])

	/** Confirm the selected destination. */
	const handleConfirm = useMemoizedFn(() => {
		onConfirm(selectedWorkspaceId)
	})
	const searchEmptyTitle = t("selectPathModal.searchEmptyTitle")
	const searchEmptyDescription = t("selectPathModal.searchEmptyDescription", {
		keyword: searchValue,
	})

	return (
		<MagicModal
			width={720}
			classNames={modalClassNames}
			open={open}
			onCancel={onClose}
			footer={null}
			closeIcon={null}
			centered
		>
			<div
				className="flex items-center justify-between gap-1.5 border-b border-border px-3 py-3 text-base font-semibold leading-6 text-foreground"
				data-testid="move-project-modal-header"
			>
				<div data-testid="move-project-modal-title">{t("project.moveProjectTitle")}</div>
				<button
					type="button"
					className={headerCloseButtonClass}
					onClick={onClose}
					aria-label={t("common.cancel")}
					data-testid="move-project-modal-close-button"
				>
					<IconX size={16} />
				</button>
			</div>
			<div
				className="flex h-[500px] flex-col gap-2 p-3"
				data-testid="move-project-modal-content"
			>
				<div
					className="flex items-center justify-between gap-2.5"
					data-testid="move-project-modal-content-header"
				>
					{isSearchOpen ? (
						<div
							className="flex w-full items-center gap-2"
							data-testid="move-project-modal-search-expanded"
						>
							<div
								className="relative min-w-0 flex-1"
								data-testid="move-project-modal-search-wrapper"
							>
								<IconSearch
									size={16}
									className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
								/>
								<Input
									ref={searchInputRef}
									className="h-8 rounded-lg border-border py-1 pl-9 pr-3 text-sm leading-5 placeholder:text-muted-foreground"
									placeholder={t("workspace.searchWorkspace")}
									value={searchValue}
									onChange={(e) => setSearchValue(e.target.value)}
									data-testid="move-project-modal-search-input"
								/>
							</div>
							<Button
								variant="outline"
								size="icon"
								className={cn(iconButtonClass, "size-9")}
								onClick={handleToggleSearch}
								aria-label={t("common.cancel")}
								data-testid="move-project-modal-search-close"
							>
								<IconX size={20} />
							</Button>
						</div>
					) : (
						<>
							<div
								className="text-sm font-medium leading-[14px] text-foreground"
								data-testid="move-project-modal-content-title"
							>
								{t("workspace.selectWorkspaceForStorage")}
							</div>
							<div
								className="flex items-center gap-2"
								data-testid="move-project-modal-toolbar"
							>
								<Button
									variant="outline"
									size="icon"
									className={iconButtonClass}
									onClick={handleCreateWorkspace}
									data-testid="move-project-modal-create-workspace-button"
									aria-label={t("workspace.createWorkspace")}
								>
									<IconFolderPlus size={20} />
								</Button>
								<Button
									variant="outline"
									size="icon"
									className={iconButtonClass}
									onClick={handleToggleSearch}
									aria-label={t("workspace.searchWorkspace")}
									data-testid="move-project-modal-search-toggle"
								>
									<IconSearch size={20} />
								</Button>
							</div>
						</>
					)}
				</div>
				{/* Inset focused controls to avoid clipped rings; stretch the content wrapper to center empty states. */}
				<ScrollArea
					className="min-h-0 flex-1"
					viewportClassName="py-1 [&>div]:!flex [&>div]:min-h-full [&>div]:flex-col [&>div]:gap-0.5"
					viewportProps={{ "data-testid": "move-project-modal-workspace-list" }}
				>
					{isSearchEmpty ? (
						<div
							className="flex flex-1 items-center justify-center"
							data-testid="move-project-modal-search-empty"
						>
							<div className="flex h-80 w-full flex-col items-center justify-center gap-6 rounded-[10px] border border-dashed border-border bg-card">
								<div className="inline-flex size-12 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm">
									<IconFileSearch size={24} />
								</div>
								<div className="flex flex-col items-center gap-2 text-center">
									<div className="text-lg font-medium leading-7 text-foreground">
										{searchEmptyTitle}
									</div>
									<div className="text-center text-sm font-normal leading-5 text-muted-foreground">
										{searchEmptyDescription}
									</div>
								</div>
							</div>
						</div>
					) : (
						<>
							{isCreatingWorkspace && (
								<div
									className={contentItemBaseClass}
									data-testid="move-project-modal-create-workspace-item"
								>
									<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm leading-[14px] text-foreground">
										<div className="flex size-4 shrink-0 items-center justify-center rounded-[4px]">
											<IconWorkspace />
										</div>
										<Input
											ref={workspaceInputRef}
											className="min-w-0 flex-1 rounded-lg border-border px-3 py-1 text-sm leading-5 placeholder:text-muted-foreground"
											value={newWorkspaceName}
											onBlur={handleCreateWorkspaceBlur}
											onKeyDown={handleCreateWorkspaceKeyDown}
											placeholder={t("workspace.createWorkspaceTip")}
											maxLength={100}
											onChange={(e) => setNewWorkspaceName(e.target.value)}
											data-testid="move-project-modal-create-workspace-input"
										/>
									</div>
									<div className="flex items-center gap-1.5">
										<Button
											variant="outline"
											size="icon"
											className={actionIconButtonClass}
											onMouseDown={(e) => e.preventDefault()}
											onClick={handleCreateWorkspaceBlur}
											disabled={isCreatingWorkspaceLoading}
											data-testid="move-project-modal-create-workspace-confirm"
										>
											{isCreatingWorkspaceLoading ? (
												<span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
											) : (
												<IconCheck
													className="text-green-500 dark:text-green-400"
													size={14}
												/>
											)}
										</Button>
										<Button
											variant="outline"
											size="icon"
											className={actionIconButtonClass}
											onMouseDown={(e) => e.preventDefault()}
											onClick={handleCancelCreation}
											disabled={isCreatingWorkspaceLoading}
											data-testid="move-project-modal-create-workspace-cancel"
										>
											<IconX className="text-destructive" size={14} />
										</Button>
									</div>
								</div>
							)}
							{filteredWorkspaces.map((workspace, index) => (
								<div
									key={workspace.id}
									className={cn(
										contentItemBaseClass,
										selectedWorkspaceId === workspace.id &&
											"border-border bg-fill",
									)}
									onClick={() => setSelectedWorkspaceId(workspace.id)}
									data-testid="move-project-modal-workspace-item"
									data-workspace-name={workspace.name}
									data-index={index}
									data-selected={selectedWorkspaceId === workspace.id}
								>
									<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm leading-[14px] text-foreground">
										<div className="flex size-4 shrink-0 items-center justify-center rounded-[4px]">
											<IconWorkspace />
										</div>
										<div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
											{workspace.name || t("workspace.unnamedWorkspace")}
										</div>
									</div>
									{selectedWorkspaceId === workspace.id && (
										<Checkbox
											checked
											className={checkboxWrapperClass}
											data-testid="move-project-modal-workspace-checkbox"
										/>
									)}
								</div>
							))}
						</>
					)}
				</ScrollArea>
			</div>
			<div
				className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-3 text-sm font-normal leading-5"
				data-testid="move-project-modal-footer"
			>
				<Button
					variant="outline"
					className="h-9 px-4"
					onClick={onClose}
					data-testid="move-project-modal-cancel-button"
				>
					{t("common.cancel")}
				</Button>
				<Button
					disabled={!selectedWorkspaceId}
					onClick={handleConfirm}
					data-testid="move-project-modal-confirm-button"
					data-disabled={!selectedWorkspaceId}
					data-loading={isMoveProjectLoading}
					className="h-9 px-4"
				>
					{isMoveProjectLoading ? (
						<span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
					) : (
						t("common.determine")
					)}
				</Button>
			</div>
		</MagicModal>
	)
}

export default observer(MoveProjectModal)
