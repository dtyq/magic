import { useEffect, useMemo, useRef, useState } from "react"
import { Empty, Input, type InputRef } from "antd"
import { IconCheck, IconPlus, IconSearch, IconX } from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicSelect from "@/components/base/MagicSelect"
import magicToast from "@/components/base/MagicToaster/utils"
import IconMessageTopic from "@/components/icons/IconMessageTopic"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
import IconProject from "@/pages/superMagic/components/icons/IconProject"
import IconWorkspace from "@/pages/superMagic/components/icons/IconWorkspace"
import { useProjects } from "../hooks/useProjects"
import { useTopics } from "../hooks/useTopics"
import { useWorkspace } from "../hooks/useWorkspace"

export interface OptionItem {
	label: string
	value: string
}

interface SelectItemProps {
	type: "workspace" | "project" | "topic"
	workspaceId?: string
	projectId?: string
	value?: string
	autoSelectFirstOption?: boolean
	onChange?: (value: string) => void
	onSelect?: (value: OptionItem | undefined) => void
}

const TYPE_CONFIG = {
	workspace: {
		labelKey: "accountPanel.timedTasks.workspace",
		searchKey: "accountPanel.timedTasks.searchWorkspace",
		addKey: "accountPanel.timedTasks.addWorkspace",
		emptyKey: "super:workspace.unnamedWorkspace",
		renderIcon: () => <IconWorkspace />,
	},
	project: {
		labelKey: "accountPanel.timedTasks.project",
		searchKey: "accountPanel.timedTasks.searchProject",
		addKey: "accountPanel.timedTasks.addProject",
		emptyKey: "super:project.unnamedProject",
		renderIcon: () => <IconProject />,
	},
	topic: {
		labelKey: "accountPanel.timedTasks.topic",
		searchKey: "accountPanel.timedTasks.searchTopic",
		addKey: "accountPanel.timedTasks.addTopic",
		emptyKey: "super:topic.unnamedTopic",
		renderIcon: () => <IconMessageTopic size={16} className="text-muted-foreground" />,
	},
} as const

/** Renders a task context selector and optionally preselects the first mobile topic. */
function SelectItem({
	type,
	workspaceId,
	projectId,
	value,
	autoSelectFirstOption = false,
	onChange,
	onSelect,
}: SelectItemProps) {
	const { t } = useTranslation("interface")
	const isMobile = useIsMobile()
	const { workspaceOptions, handleAddWorkspace } = useWorkspace()
	const { projectOptions, handleAddProject } = useProjects(workspaceId)
	const { topicOptions, handleAddTopic } = useTopics(workspaceId, projectId)
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [viewMode, setViewMode] = useState<"select" | "create">("select")
	const [newItemName, setNewItemName] = useState("")
	const [creating, setCreating] = useState(false)
	const [selectInstanceKey, setSelectInstanceKey] = useState(0)
	const [localCreatedOption, setLocalCreatedOption] = useState<{
		option: OptionItem
		workspaceId?: string
		projectId?: string
	}>()
	const creatingRef = useRef(false)
	const createInputRef = useRef<InputRef>(null)
	const autoSelectedContextRef = useRef<string>()

	const sourceOptions = useMemo(() => {
		if (type === "workspace") return workspaceOptions
		if (type === "project") return projectOptions
		return topicOptions
	}, [projectOptions, topicOptions, type, workspaceOptions])
	// Keep the newly created value renderable until the refreshed API list contains it.
	const scopedCreatedOption =
		localCreatedOption &&
		localCreatedOption.workspaceId === workspaceId &&
		localCreatedOption.projectId === projectId
			? localCreatedOption.option
			: undefined
	const options = useMemo(() => {
		if (
			!scopedCreatedOption ||
			sourceOptions.some((option) => option.value === scopedCreatedOption.value)
		) {
			return sourceOptions
		}
		return [scopedCreatedOption, ...sourceOptions]
	}, [scopedCreatedOption, sourceOptions])

	const filteredOptions = useMemo(() => {
		const keyword = searchValue.trim().toLowerCase()
		if (!keyword) return options
		return options.filter((option) => option.label?.toLowerCase().includes(keyword))
	}, [options, searchValue])

	const config = TYPE_CONFIG[type]
	const createPlaceholder =
		type === "workspace"
			? t("accountPanel.timedTasks.createWorkspacePlaceholder")
			: type === "project"
				? t("accountPanel.timedTasks.createProjectPlaceholder")
				: t("accountPanel.timedTasks.createTopicPlaceholder")
	const createDisabledReason = useMemo(() => {
		if (type === "project") {
			if (!workspaceId) return t("super:project.pleaseSelectWorkspace")
			if (workspaceId === SHARE_WORKSPACE_ID) {
				return t("accountPanel.timedTasks.sharedWorkspaceProjectCreateDisabled")
			}
		}

		if (type === "topic" && (!workspaceId || !projectId)) {
			return t("super:topic.pleaseSelectWorkspaceAndProject")
		}

		return undefined
	}, [projectId, t, type, workspaceId])

	useEffect(() => {
		if (viewMode === "create") createInputRef.current?.focus()
	}, [viewMode])

	const closePopup = useMemoizedFn(() => {
		setOpen(false)
		// MagicSelect's mobile popup owns its open state, so remount this local instance to close custom content.
		if (isMobile) setSelectInstanceKey((key) => key + 1)
	})

	const handleInnerChange = useMemoizedFn((nextValue: string) => {
		onChange?.(nextValue)
		onSelect?.(options.find((option) => option.value === nextValue))
		closePopup()
	})

	const handleAddNew = useMemoizedFn(async () => {
		if (creatingRef.current) return

		const name = newItemName.trim()
		if (!name) return

		creatingRef.current = true
		setCreating(true)
		try {
			const created =
				type === "workspace"
					? await handleAddWorkspace(name)
					: type === "project"
						? await handleAddProject(name)
						: await handleAddTopic(name)

			if (!created?.id) {
				magicToast.error(t("accountPanel.timedTasks.createFailed"))
				return
			}

			const createdOption = {
				value: created.id,
				label:
					created.name ||
					created.project_name ||
					created.topic_name ||
					t(config.emptyKey),
			}

			setLocalCreatedOption({ option: createdOption, workspaceId, projectId })
			onChange?.(createdOption.value)
			onSelect?.(createdOption)
			setSearchValue("")
			setNewItemName("")
			setViewMode("select")
			closePopup()
		} finally {
			creatingRef.current = false
			setCreating(false)
		}
	})

	const handleStartCreate = useMemoizedFn(() => {
		if (createDisabledReason) return
		setNewItemName("")
		setViewMode("create")
	})

	const handleCancelCreate = useMemoizedFn(() => {
		setNewItemName("")
		setViewMode("select")
	})

	const handleOpenChange = useMemoizedFn((nextOpen: boolean) => {
		if (!nextOpen && creating) return
		setOpen(nextOpen)
		if (!nextOpen) {
			setNewItemName("")
			setViewMode("select")
		}
	})

	const currentLabel = options.find((option) => option.value === value)?.label

	useEffect(() => {
		if (
			!autoSelectFirstOption ||
			type !== "topic" ||
			!workspaceId ||
			!projectId ||
			value ||
			options.length === 0
		)
			return

		const contextKey = `${workspaceId}:${projectId}`
		if (autoSelectedContextRef.current === contextKey) return

		// Prefill only new mobile task forms when no topic was provided by the route.
		const firstOption = options[0]
		autoSelectedContextRef.current = contextKey
		onChange?.(firstOption.value)
		onSelect?.(firstOption)
	}, [autoSelectFirstOption, onChange, onSelect, options, projectId, type, value, workspaceId])

	return (
		<MagicSelect
			key={selectInstanceKey}
			value={value}
			className="w-full"
			// Prevent the mobile shell from scrolling when its fixed create input receives focus.
			classNames={{
				popup: { root: isMobile ? "supports-[overflow:clip]:overflow-clip" : undefined },
			}}
			placeholder={t(config.labelKey)}
			options={options}
			labelInValue={false}
			onChange={handleInnerChange}
			open={open}
			onOpenChange={handleOpenChange}
			showSearch={false}
			popupRender={() => (
				// Only desktop SelectContent adds an inset; mobile popups already span the screen.
				<div className={cn("flex flex-col pb-safe-bottom", !isMobile && "-m-1")}>
					<div className="relative">
						<IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="rounded-none border-x-0 border-t-0 pl-9 pr-9 shadow-none focus-visible:ring-0"
							placeholder={t(config.searchKey)}
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
							onKeyDown={(event) => event.stopPropagation()}
						/>
						{searchValue ? (
							<button
								type="button"
								onClick={() => setSearchValue("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
								aria-label={t("accountPanel.timedTasks.clear")}
							>
								<IconX className="size-4" />
							</button>
						) : null}
					</div>
					{/* Keep search and creation controls outside the content-sized options viewport. */}
					<ScrollArea viewportClassName="h-auto max-h-[250px] p-2 [&>div]:!flex [&>div]:flex-col [&>div]:gap-1">
						{filteredOptions.length > 0 ? (
							filteredOptions.map((option) => {
								const isSelected = option.value === value
								return (
									<button
										key={option.value}
										type="button"
										className={cn(
											"flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
											isSelected && "bg-accent",
										)}
										onClick={() => handleInnerChange(option.value)}
									>
										<span
											className="flex size-6 shrink-0 items-center justify-center rounded bg-muted"
											data-testid={`scheduled-task-option-icon-${type}-${option.value}`}
											data-icon-kind={type}
											aria-hidden
										>
											{config.renderIcon()}
										</span>
										<span className="flex-1 truncate">
											{option.label || t(config.emptyKey)}
										</span>
									</button>
								)
							})
						) : (
							<Empty />
						)}
					</ScrollArea>
					<div className="border-t p-2">
						{viewMode === "create" ? (
							<div className="flex items-center gap-1.5">
								<Input
									ref={createInputRef}
									className="h-8 min-w-0 flex-1"
									autoComplete="off"
									placeholder={createPlaceholder}
									value={newItemName}
									disabled={creating}
									onChange={(event) => setNewItemName(event.target.value)}
									onKeyDown={(event) => event.stopPropagation()}
									onPressEnter={handleAddNew}
								/>
								<Button
									type="button"
									size="icon-sm"
									aria-label={t("accountPanel.timedTasks.create")}
									disabled={!newItemName.trim() || creating}
									onClick={handleAddNew}
								>
									{creating ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<IconCheck className="size-4" />
									)}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("accountPanel.timedTasks.cancel")}
									disabled={creating}
									onClick={handleCancelCreate}
								>
									<IconX className="size-4" />
								</Button>
							</div>
						) : (
							<>
								<Button
									onClick={handleStartCreate}
									type="button"
									variant="ghost"
									className="w-full justify-start px-1 py-2"
									disabled={!!createDisabledReason}
								>
									<IconPlus className="size-5" />
									{t(config.addKey)}
								</Button>
								{createDisabledReason ? (
									<div className="px-1 pb-1 text-xs text-muted-foreground">
										{createDisabledReason}
									</div>
								) : null}
							</>
						)}
					</div>
				</div>
			)}
		>
			{currentLabel}
		</MagicSelect>
	)
}

export default SelectItem
