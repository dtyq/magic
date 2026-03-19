import { useMemo, useState } from "react"
import { Avatar, Empty, Input } from "antd"
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react"
import { Folder } from "lucide-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { MagicIcon, MagicSelect } from "@/components/base"
import IconMessageTopic from "@/components/icons/IconMessageTopic"
import IconWorkspaceCase from "@/components/icons/IconWorkspaceCase"
import { cn } from "@/lib/utils"
import { SHARE_WORKSPACE_ID } from "@/pages/superMagic/constants"
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
	onChange?: (value: string) => void
	onSelect?: (value: OptionItem | undefined) => void
}

const TYPE_CONFIG = {
	workspace: {
		labelKey: "accountPanel.timedTasks.workspace",
		searchKey: "accountPanel.timedTasks.searchWorkspace",
		addKey: "accountPanel.timedTasks.addWorkspace",
		emptyKey: "super:workspace.unnamedWorkspace",
		icon: IconWorkspaceCase,
	},
	project: {
		labelKey: "accountPanel.timedTasks.project",
		searchKey: "accountPanel.timedTasks.searchProject",
		addKey: "accountPanel.timedTasks.addProject",
		emptyKey: "super:project.unnamedProject",
		icon: Folder,
	},
	topic: {
		labelKey: "accountPanel.timedTasks.topic",
		searchKey: "accountPanel.timedTasks.searchTopic",
		addKey: "accountPanel.timedTasks.addTopic",
		emptyKey: "super:topic.unnamedTopic",
		icon: IconMessageTopic,
	},
} as const

function SelectItem({ type, workspaceId, projectId, value, onChange, onSelect }: SelectItemProps) {
	const { t } = useTranslation("interface")
	const { workspaceOptions, handleAddWorkspace } = useWorkspace()
	const { projectOptions, handleAddProject } = useProjects(workspaceId)
	const { topicOptions, handleAddTopic } = useTopics(workspaceId, projectId)
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")

	const options = useMemo(() => {
		if (type === "workspace") return workspaceOptions
		if (type === "project") return projectOptions
		return topicOptions
	}, [projectOptions, topicOptions, type, workspaceOptions])

	const filteredOptions = useMemo(() => {
		const keyword = searchValue.trim().toLowerCase()
		if (!keyword) return options
		return options.filter((option) => option.label?.toLowerCase().includes(keyword))
	}, [options, searchValue])

	const config = TYPE_CONFIG[type]

	const handleInnerChange = useMemoizedFn((nextValue: string) => {
		onChange?.(nextValue)
		onSelect?.(options.find((option) => option.value === nextValue))
		setOpen(false)
	})

	const handleAddNew = useMemoizedFn(async () => {
		const name = searchValue.trim()
		if (!name) return

		const created =
			type === "workspace"
				? await handleAddWorkspace(name)
				: type === "project"
					? await handleAddProject(name)
					: await handleAddTopic(name)

		if (!created?.id) return

		const createdOption = {
			value: created.id,
			label: created.name || created.project_name || created.topic_name || t(config.emptyKey),
		}

		onChange?.(createdOption.value)
		onSelect?.(createdOption)
		setSearchValue("")
		setOpen(false)
	})

	const currentLabel = options.find((option) => option.value === value)?.label

	return (
		<MagicSelect
			value={value}
			className="w-full"
			placeholder={t(config.labelKey)}
			options={options}
			labelInValue={false}
			onChange={handleInnerChange}
			open={open}
			onOpenChange={setOpen}
			showSearch={false}
			popupRender={() => (
				<div className="-m-1 flex flex-col pb-safe-bottom">
					<div className="relative">
						<IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="rounded-none border-x-0 border-t-0 pl-9 pr-9 shadow-none focus-visible:ring-0"
							placeholder={t(config.searchKey)}
							value={searchValue}
							onChange={(event) => setSearchValue(event.target.value)}
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
					<div className="flex max-h-[250px] flex-col gap-1 overflow-y-auto overflow-x-hidden p-2">
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
										<Avatar
											className="shrink-0"
											size={24}
											src={<MagicIcon size={16} component={config.icon} />}
										/>
										<span className="flex-1 truncate">
											{option.label || t(config.emptyKey)}
										</span>
									</button>
								)
							})
						) : (
							<Empty />
						)}
					</div>
					<Button
						onClick={handleAddNew}
						type="button"
						variant="ghost"
						className="justify-start rounded-none border-t px-3 py-2"
						disabled={type === "project" && workspaceId === SHARE_WORKSPACE_ID}
					>
						<IconPlus className="size-5" />
						{t(config.addKey)}
					</Button>
				</div>
			)}
		>
			{currentLabel}
		</MagicSelect>
	)
}

export default SelectItem
