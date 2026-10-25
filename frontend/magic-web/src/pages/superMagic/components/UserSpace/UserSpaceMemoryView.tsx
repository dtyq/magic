import { lazy, useCallback, useEffect, useMemo, useState, useRef } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Brain,
	CircleHelp,
	Folder,
	Folders,
	FolderOpen,
	FilePlus2,
	Loader2,
	RefreshCw,
} from "lucide-react"
import { SidebarExpandableItem, type SidebarSectionOptions } from "../SidebarSection"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import type { MagicFSFile } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { ContextHelp } from "@/components/shadcn-composed/context-help"
import magicToast from "@/components/base/MagicToaster/utils"
import userFilesStore from "@/stores/userFiles"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import {
	getUserMemoryPath,
	USER_MEMORY_ENTRY,
	USER_MEMORY_NOTES,
} from "../LongTremMemory/components/memoryTreeNodeUtils"
import { toUserAttachment, userSpaceFileService } from "./services/userSpaceFileService"
import { useUserMemoryProjects } from "./hooks/useUserMemoryProjects"
import { useFileManagerConfirmation } from "../TopicFilesButton/hooks/useFileManagerConfirmation"
import { FileManagerConfirmationDialog } from "../TopicFilesButton/components/FileManager/FileManagerConfirmationDialog"
import { buildAttachmentIndex } from "../TopicFilesButton/utils/attachmentIndex"
import UserSpaceFilesView from "./UserSpaceFilesView"
import { useUserFileHelp } from "./useUserFileHelp"
import type { FileManagerProps } from "../TopicFilesButton/components/FileManager/types"

const FileHelpBrowser = lazy(() => import("../TopicFilesButton/components/FileHelpBrowser"))

interface MemoryGroupProps {
	initialManagerState?: FileManagerProps["initialState"]
	onManagerStateChange?: FileManagerProps["onStateChange"]
	manager?: boolean
	active?: boolean
	projectId?: string | null
	projectName?: string
	onFileClick?: (file: AttachmentItem) => void
	title?: string
	defaultExpanded?: boolean
	activeFileId?: string | null
	topicId?: string | null
	compact?: boolean
	onBrowseDirectory?: (id: string) => void
	scrollElementRef?: React.RefObject<HTMLElement>
}
const emptyIndex = buildAttachmentIndex([])

// 只调整记忆标题的留白与反馈；文件行密度、工具按钮和其它侧栏栏目沿用原样。
const memoryHeaderClassName = cn(
	"mx-2 w-auto rounded-lg px-2 focus-within:bg-accent/60 hover:bg-accent active:bg-foreground/10 motion-reduce:transition-none",
	"[&_[data-header-chevron]]:transition-colors [&_[data-header-chevron]]:duration-200 hover:[&_[data-header-chevron]]:text-foreground",
	"motion-reduce:[&_[data-header-chevron]]:transition-none motion-reduce:[&_[data-header-chevron]_svg]:transition-none",
)

export const MemoryGroup = observer(function MemoryGroup({
	manager = false,
	active = true,
	projectId,
	projectName,
	onFileClick,
	title: titleOverride,
	labelVariant = "section",
	defaultExpanded = true,
	activeFileId,
	topicId,
	compact = true,
	onBrowseDirectory,
	scrollElementRef,
	initialManagerState,
	onManagerStateChange,
}: MemoryGroupProps & { labelVariant?: "section" | "item" }) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(defaultExpanded)
	const [visited, setVisited] = useState(defaultExpanded)
	const identity = userFilesStore.currentIdentityKey
	const mutationVersion = userFilesStore.mutationVersion
	const segments = useMemo(() => getUserMemoryPath(projectId), [projectId])
	const scopePath = segments.join("/")
	const scopeKey = `${identity}:${scopePath}`
	const currentScope = useRef<string | null>(scopeKey)
	currentScope.current = active ? scopeKey : null
	const [rootSnapshot, setRootSnapshot] = useState<{
		scopeKey: string
		file: MagicFSFile | null
	}>()
	const root = rootSnapshot?.scopeKey === scopeKey ? rootSnapshot.file : null
	const setRoot = useCallback(
		(file: MagicFSFile | null) => setRootSnapshot({ scopeKey, file }),
		[scopeKey],
	)
	const initialLocation = useRef({ identity, projectId, state: initialManagerState })
	const [directoryId, setDirectoryId] = useState<string | undefined>(
		initialManagerState?.directoryId || undefined,
	)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)
	const [creating, setCreating] = useState(false)
	const pendingCreation = useRef<{ scopeKey: string } | null>(null)
	const [retry, setRetry] = useState(0)
	const memoryKind = projectId ? "projectCoreMemory" : "coreMemory"
	const help = useUserFileHelp(memoryKind)
	const confirmation = useFileManagerConfirmation({
		scopeKey,
		isActive: active,
		rootName:
			projectName || t(projectId ? "userSpace.projectMemory" : "userSpace.globalMemory"),
		index: emptyIndex,
		attachments: [],
	})
	useEffect(() => {
		currentScope.current = active ? scopeKey : null
		setCreating(false)
		pendingCreation.current = null
		return () => {
			currentScope.current = null
			pendingCreation.current = null
		}
	}, [scopeKey, active])
	useEffect(() => {
		setRoot(null)
		setDirectoryId(
			initialLocation.current.identity === identity &&
				initialLocation.current.projectId === projectId
				? initialLocation.current.state?.directoryId || undefined
				: undefined,
		)
		setLoading(true)
		setError(false)
	}, [identity, scopePath, projectId, setRoot])
	useEffect(() => {
		if (!visited || !active) return
		let cancelled = false
		void userFilesStore
			.findPath(segments)
			.then(async (file) => {
				if (file) await userFilesStore.loadTree(file.id)
				if (!cancelled) {
					setRoot(file)
					setError(false)
				}
			})
			.catch(() => {
				if (!cancelled) setError(true)
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [identity, segments, mutationVersion, retry, visited, active, setRoot])
	const entryExists =
		root &&
		userFilesStore
			.getChildren(root.id)
			.some((file) => file.name === USER_MEMORY_ENTRY && !file.is_directory)
	const destination = () => userFilesStore.ensureDirectory([...segments, USER_MEMORY_NOTES])
	const createEntry = async () => {
		if (pendingCreation.current?.scopeKey === scopeKey) return
		const request = { scopeKey }
		pendingCreation.current = request
		const isCurrent = () =>
			pendingCreation.current === request &&
			currentScope.current === scopeKey &&
			identity === userFilesStore.currentIdentityKey
		let entryReady = false
		try {
			if (
				!(await confirmation.confirm({
					operation: "create",
					names: [USER_MEMORY_ENTRY],
					targetPath: scopePath,
				}))
			)
				return
			if (!isCurrent()) return
			setCreating(true)
			const directory = await userFilesStore.ensureDirectory(segments)
			if (!isCurrent()) return
			const children = await userFilesStore.loadDirectory(directory.id, true)
			if (!isCurrent()) return
			let file = children.find(
				(item) => item.name === USER_MEMORY_ENTRY && !item.is_directory,
			)
			if (!file) {
				try {
					file = await userSpaceFileService.createNode({
						name: USER_MEMORY_ENTRY,
						parentId: directory.id,
						isDirectory: false,
					})
				} catch (error) {
					if (!isCurrent()) return
					file = (await userFilesStore.loadDirectory(directory.id, true)).find(
						(item) => item.name === USER_MEMORY_ENTRY && !item.is_directory,
					)
					if (!file) throw error
				}
			}
			if (!isCurrent()) return
			entryReady = true
			userFilesStore.notifyMutation()
			await userFilesStore.loadDirectory(directory.id, true)
			if (isCurrent())
				onFileClick?.(toUserAttachment(file, `${scopePath}/${USER_MEMORY_ENTRY}`))
		} catch {
			if (isCurrent())
				magicToast.error(
					t(
						entryReady
							? "userSpace.memoryCreatedOpenFailed"
							: "userSpace.operationFailed",
					),
				)
		} finally {
			if (isCurrent()) setCreating(false)
			if (pendingCreation.current === request) pendingCreation.current = null
		}
	}
	const title =
		titleOverride ?? (projectId ? t("userSpace.projectMemory") : t("userSpace.globalMemory"))
	const section: SidebarSectionOptions = {
		labelVariant,
		headerClassName: memoryHeaderClassName,
		wrapLabel: true,
		isExpanded: expanded,
		onClick: () => {
			setExpanded(!expanded)
			setVisited(true)
		},
		leading: projectId ? <Folder size={16} /> : <Brain size={16} />,
		// 项目名只占一行；按工具栏留下的实际宽度省略，由公共提示显示完整名称。
		description:
			projectId && projectName && !titleOverride ? (
				<SmartTooltip
					elementType="span"
					className="block min-w-0 max-w-full text-xs font-normal leading-4 text-muted-foreground"
					placement="top"
					align="start"
				>
					{projectName}
				</SmartTooltip>
			) : undefined,
	}
	const browseAction =
		root && onBrowseDirectory ? (
			<MagicTooltip title={t("fileManager.browseFolder")}>
				<Button
					variant="ghost"
					size="icon"
					className="size-6"
					aria-label={t("fileManager.browseFolder")}
					onClick={() => onBrowseDirectory(root.id)}
				>
					<FolderOpen size={16} />
				</Button>
			</MagicTooltip>
		) : undefined
	const emptyState = !loading && !error && (!entryExists || creating) && (
		<div className="flex shrink-0 flex-col gap-2 px-4 py-3 text-xs text-muted-foreground">
			<p className="font-medium text-foreground">{t("userSpace.noMemory")}</p>
			<p className="leading-relaxed">
				{t(
					projectId
						? "userSpace.projectMemoryEmptyHint"
						: "userSpace.globalMemoryEmptyHint",
				)}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				{help && (
					<ContextHelp
						mode="dialog"
						help={help.help}
						renderDialog={(props) => (
							<FileHelpBrowser
								{...props}
								initialArticleId={
									projectId ? "user.projectCoreMemory" : "user.coreMemory"
								}
							/>
						)}
					>
						<Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
							<CircleHelp size={16} />
							{t("userSpace.memoryHowToUse")}
						</Button>
					</ContextHelp>
				)}
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1.5 px-2 text-xs"
					disabled={creating || Boolean(confirmation.state)}
					onClick={() => void createEntry()}
				>
					{creating ? (
						<Loader2 size={16} className="animate-spin" />
					) : (
						<FilePlus2 size={16} />
					)}
					<span role={creating ? "status" : undefined}>
						{t(creating ? "userSpace.creatingMemory" : "userSpace.createMemory")}
					</span>
				</Button>
			</div>
		</div>
	)

	const files = (
		<UserSpaceFilesView
			initialState={manager ? initialManagerState : undefined}
			onStateChange={manager ? onManagerStateChange : undefined}
			key={scopeKey}
			scope={{
				path: scopePath,
				rootId: root?.id ?? null,
				loading,
				error,
				onRefresh: () => {
					setLoading(true)
					setRetry((value) => value + 1)
				},
			}}
			rootName={manager ? projectName || title : title}
			resolveParent={destination}
			defaultWritePath={`${scopePath}/${USER_MEMORY_NOTES}`}
			hidePlaces={manager}
			defaultView={manager ? "list" : undefined}
			directoryId={rootSnapshot?.scopeKey === scopeKey ? directoryId : undefined}
			onDirectoryChange={setDirectoryId}
			onFileClick={onFileClick}
			activeFileId={activeFileId}
			topicId={topicId}
			compact={manager ? false : compact}
			active={active && visited}
			scrollElementRef={scrollElementRef}
			section={manager ? undefined : section}
			headerTrailingAction={manager ? undefined : browseAction}
			contentBefore={emptyState}
		/>
	)
	return (
		<section
			className={cn(
				"flex min-h-0 min-w-0 flex-col",
				manager ? "flex-1" : "shrink-0",
				!manager &&
					(labelVariant === "item"
						? "pl-2"
						: "after:mx-3 after:my-2 after:border-b after:border-border/60 after:content-['']"),
			)}
		>
			{files}
			<FileManagerConfirmationDialog
				controller={confirmation}
				title={t("userSpace.createMemoryTitle")}
				description={t("userSpace.createMemoryDescription")}
				confirmText={t("userSpace.createMemoryConfirm")}
			/>
		</section>
	)
})
const OtherProjectMemories = observer(function OtherProjectMemories(props: MemoryGroupProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(false)
	const [visited, setVisited] = useState(false)
	const { projects, loading, error, loaded, refresh } = useUserMemoryProjects(
		props.projectId,
		visited,
	)
	return (
		<SidebarExpandableItem
			label={t("userSpace.otherProjectMemories")}
			labelVariant="section"
			headerClassName={memoryHeaderClassName}
			wrapLabel
			isExpanded={expanded}
			onClick={() => {
				setExpanded(!expanded)
				setVisited(true)
			}}
			leading={<Folders size={16} />}
			testId="other-project-memories"
			trailing={
				loaded && (
					<MagicTooltip title={t("topicFiles.refreshList")}>
						<Button
							variant="ghost"
							size="icon"
							className="size-6 shrink-0"
							disabled={loading}
							aria-label={t("topicFiles.refreshList")}
							onClick={() => refresh()}
						>
							<RefreshCw size={16} />
						</Button>
					</MagicTooltip>
				)
			}
		>
			{error ? (
				<div role="alert" className="p-3 text-xs">
					{t("userSpace.projectNamesLoadFailed")}
					<Button variant="ghost" size="sm" onClick={() => refresh()}>
						{t("userSpace.retry")}
					</Button>
				</div>
			) : (
				<>
					{loading && (
						<p className="p-3 text-xs text-muted-foreground">
							{t("userSpace.loading")}
						</p>
					)}
					{loaded &&
						(projects.length ? (
							projects.map(({ id, fileId }) => (
								<MemoryGroup
									key={fileId}
									{...props}
									projectId={id}
									projectName={undefined}
									title={
										userFilesStore.projectNames.get(id) ??
										t("userSpace.projectNameUnavailable")
									}
									defaultExpanded={false}
									labelVariant="item"
								/>
							))
						) : (
							<p className="p-3 text-xs text-muted-foreground">
								{t("userSpace.noOtherProjectMemories")}
							</p>
						))}
				</>
			)}
		</SidebarExpandableItem>
	)
})

export default observer(function UserSpaceMemoryView(props: MemoryGroupProps) {
	const scrollElementRef = useRef<HTMLDivElement>(null)
	const { t } = useTranslation("super")
	const identity = userFilesStore.currentIdentityKey
	return (
		<div ref={scrollElementRef} className="h-full min-h-0 overflow-auto">
			<div key={identity} className="flex flex-col pb-2 pt-3">
				<MemoryGroup {...props} scrollElementRef={scrollElementRef} projectId={undefined} />
				{props.projectId ? (
					<MemoryGroup
						key={props.projectId}
						{...props}
						scrollElementRef={scrollElementRef}
					/>
				) : (
					<div className="p-4 text-xs text-muted-foreground">
						{t("userSpace.enterProject")}
					</div>
				)}
				<OtherProjectMemories {...props} scrollElementRef={scrollElementRef} />
			</div>
		</div>
	)
})
