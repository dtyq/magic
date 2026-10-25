import { useDeferredValue, useMemo, useRef, useState, useEffect, useLayoutEffect } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Brain, Folder, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import userFilesStore from "@/stores/userFiles"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import { MemoryGroup } from "./UserSpaceMemoryView"
import { useUserMemoryProjects } from "./hooks/useUserMemoryProjects"
import type { UserFileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import type { FileManagerStateChangeOptions } from "../Detail/components/FilesViewer/types"
import magicToast from "@/components/base/MagicToaster/utils"

interface Props {
	initialState?: UserFileManagerSnapshot["memory"]
	onStateChange: (
		state: NonNullable<UserFileManagerSnapshot["memory"]>,
		options: FileManagerStateChangeOptions,
	) => void
	projectId?: string
	projectName?: string
	topicId?: string
	onFileClick: (file: AttachmentItem) => void
	active: boolean
}

/** 项目目录只负责选定记忆范围；文件读取、创建和操作仍由原 MemoryGroup 管理。 */
export default observer(function UserSpaceMemoryManager(props: Props) {
	const identity = userFilesStore.currentIdentityKey
	return <MemoryProjects key={identity} {...props} />
})

const MemoryProjects = observer(function MemoryProjects({
	projectId,
	projectName,
	topicId,
	onFileClick,
	active,
	initialState,
	onStateChange,
}: Props) {
	const { t, i18n } = useTranslation("super")
	const [selectedId, setSelectedId] = useState<string | null>(
		initialState ? initialState.projectId : (projectId ?? null),
	)
	const [search, setSearch] = useState(initialState?.query ?? "")
	const saved = useRef(initialState)
	const scrollTop = useRef(initialState?.scrollTop ?? 0)
	const scrollRestored = useRef(false)
	const emitState = useMemoizedFn((options: FileManagerStateChangeOptions = {}) => {
		saved.current = {
			projectId: selectedId,
			query: search,
			scrollTop: scrollTop.current,
			location: saved.current?.projectId === selectedId ? saved.current.location : undefined,
		}
		onStateChange(saved.current, options)
	})
	useEffect(() => emitState(), [selectedId, search, emitState])
	const selectProject = (id: string | null) => {
		if (id === selectedId) return
		saved.current = { projectId: id, query: search, scrollTop: scrollTop.current }
		setSelectedId(id)
		onStateChange(saved.current, { userInteraction: true })
	}
	const query = useDeferredValue(search.trim().toLocaleLowerCase())
	const { projects, loading, error, loaded, refresh } = useUserMemoryProjects(projectId, active)
	const viewport = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (
			!loaded ||
			loading ||
			error ||
			!selectedId ||
			selectedId === projectId ||
			projects.some(({ id }) => id === selectedId)
		)
			return
		setSelectedId(null)
		magicToast.info(t("fileManager.restoredDirectoryUnavailable"))
	}, [loaded, loading, error, selectedId, projectId, projects, t])
	useLayoutEffect(() => {
		if (
			scrollRestored.current ||
			!active ||
			!loaded ||
			loading ||
			error ||
			!viewport.current?.clientHeight
		)
			return
		viewport.current.scrollTop = scrollTop.current
		scrollRestored.current = true
	}, [active, loaded, loading, error])
	const namedProjects = projects.map((project) => ({
		...project,
		name: userFilesStore.projectNames.get(project.id) ?? t("userSpace.projectNameUnavailable"),
	}))
	const visibleProjects = useMemo(() => {
		const collator = new Intl.Collator(i18n.language.replaceAll("_", "-"), { numeric: true })
		return namedProjects
			.filter((project) => !query || project.name.toLocaleLowerCase().includes(query))
			.sort((a, b) => collator.compare(a.name, b.name))
	}, [namedProjects, query, i18n.language])
	const rows = useVirtualizer({
		count: visibleProjects.length,
		getScrollElement: () => viewport.current,
		estimateSize: () => 36,
		overscan: 6,
	})
	const title = !selectedId
		? t("userSpace.globalMemory")
		: selectedId === projectId
			? projectName || t("userSpace.projectMemory")
			: (userFilesStore.projectNames.get(selectedId) ?? t("userSpace.projectNameUnavailable"))
	const rowClass = (selected: boolean) =>
		cn(
			"flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			selected
				? "bg-accent text-accent-foreground"
				: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
		)
	return (
		<div className="flex min-h-0 flex-1">
			<aside
				className="flex min-h-0 w-56 shrink-0 flex-col gap-1 border-r border-border/60 bg-muted/30 p-3 max-md:w-44"
				aria-label={t("fileManager.memory.projects")}
			>
				<div className="flex items-center justify-between pb-2">
					<span className="text-[11px] font-medium text-muted-foreground">
						{t("fileManager.memory.projects")}
					</span>
					<Button
						variant="ghost"
						size="icon"
						className="size-6"
						disabled={loading}
						onClick={refresh}
						aria-label={t("topicFiles.refreshList")}
					>
						<RefreshCw size={13} className={cn(loading && "animate-spin")} />
					</Button>
				</div>
				<button
					className={rowClass(selectedId === null)}
					aria-current={selectedId === null ? "page" : undefined}
					onClick={() => selectProject(null)}
				>
					<Brain size={15} />
					{t("userSpace.globalMemory")}
				</button>
				{projectId && (
					<button
						className={rowClass(selectedId === projectId)}
						aria-current={selectedId === projectId ? "page" : undefined}
						title={projectName}
						onClick={() => selectProject(projectId)}
					>
						<Folder size={15} className="shrink-0" />
						<span className="truncate">
							{projectName || t("userSpace.projectMemory")}
						</span>
						<span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
							{t("fileManager.memory.current")}
						</span>
					</button>
				)}
				<p className="pb-1 pt-4 text-[11px] font-medium text-muted-foreground">
					{t("userSpace.otherProjectMemories")}
				</p>
				<div className="relative mb-2">
					<Search size={13} className="absolute left-2 top-2 text-muted-foreground" />
					<Input
						className="h-7 rounded-md bg-background/70 pl-7 text-xs"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value)
							onStateChange(
								{
									projectId: selectedId,
									...saved.current,
									query: event.target.value,
									scrollTop: scrollTop.current,
								},
								{ userInteraction: true },
							)
						}}
						placeholder={t("fileManager.memory.search")}
						aria-label={t("fileManager.memory.search")}
					/>
				</div>
				{error && (
					<div role="alert" className="text-xs text-muted-foreground">
						{t("userSpace.projectNamesLoadFailed")}
						<Button variant="ghost" size="sm" onClick={refresh}>
							{t("userSpace.retry")}
						</Button>
					</div>
				)}
				{loading && !loaded && (
					<p className="py-2 text-xs text-muted-foreground">{t("userSpace.loading")}</p>
				)}
				{loaded && !visibleProjects.length && (
					<p className="py-2 text-xs text-muted-foreground">
						{t(
							query
								? "fileManager.memory.noMatches"
								: "userSpace.noOtherProjectMemories",
						)}
					</p>
				)}
				<div
					ref={viewport}
					className="min-h-0 flex-1 overflow-y-auto"
					onWheelCapture={() => {
						scrollRestored.current = true
					}}
					onScroll={(event) => {
						if (scrollRestored.current && active) {
							scrollTop.current = event.currentTarget.scrollTop
							emitState({ deferred: true })
						}
					}}
				>
					<div className="relative" style={{ height: rows.getTotalSize() }}>
						{rows.getVirtualItems().map((row) => {
							const project = visibleProjects[row.index]
							return (
								<button
									key={project.id}
									style={{ position: "absolute", top: row.start }}
									className={rowClass(selectedId === project.id)}
									aria-current={selectedId === project.id ? "page" : undefined}
									onClick={() => selectProject(project.id)}
									title={project.name}
								>
									<Folder size={15} className="shrink-0" />
									<span className="truncate">{project.name}</span>
								</button>
							)
						})}
					</div>
				</div>
				<p className="pt-3 text-[11px] leading-relaxed text-muted-foreground">
					{t("fileManager.memory.scope")}
				</p>
			</aside>
			<MemoryGroup
				initialManagerState={
					saved.current?.projectId === selectedId ? saved.current.location : undefined
				}
				onManagerStateChange={(location, options = {}) => {
					saved.current = {
						projectId: selectedId,
						query: search,
						scrollTop: scrollTop.current,
						location,
					}
					onStateChange(saved.current, options)
				}}
				key={selectedId ?? "global"}
				manager
				active={active}
				projectId={selectedId}
				projectName={title}
				topicId={topicId}
				onFileClick={onFileClick}
			/>
		</div>
	)
})
