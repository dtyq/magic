import {
	resolveFilePresentation,
	getFilePresentationIndex,
} from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import MobilePathBreadcrumb from "@/pages/superMagic/components/MobilePathBreadcrumb"
import {
	Box,
	Check,
	ChevronRight,
	Home,
	LibraryBig,
	LayoutGrid,
	MessageCircle,
	Search,
	Share2,
	X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { SuperMagicApi } from "@/apis"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { cn } from "@/utils/cn"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	MY_CLAW_WORKSPACE_ID,
	MICRO_APPS_WORKSPACE_ID,
	SHARE_WORKSPACE_DATA,
	SHARE_WORKSPACE_ID,
	isCollaborationProject,
	isWorkspaceShortcutProject,
} from "@/pages/superMagic/constants"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import type { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"

import type { AttachmentItem } from "../../../TopicFilesButton/hooks"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { getDirectoriesFromPath, getItemId, getItemName } from "../../utils/attachmentUtils"
import type { MobileCrossProjectConfig, SelectDirectorySubmitParams } from "./types"
import { MAX_MENTION_PROJECT_COUNT, type ProjectResourceSelection } from "../../types"
import { isMicroAppEnabled } from "@/services/microAppFeature"
import { loadMicroAppProjectPage } from "../../utils/microAppProjects"
import type { ResourceProject } from "../../resourceProjectTypes"
import { loadSharedWorkspaceProjects } from "../../utils/sharedWorkspaceProjects"
import { ProjectResourceInfo } from "../ProjectResourceSelectorModal/ProjectResourceInfo"

interface MobileFilesMoveSheetProps {
	visible: boolean
	submitting?: boolean
	title: string
	attachments: AttachmentItem[]
	defaultPath?: AttachmentItem[]
	disabledFolderIds?: string[]
	mobileCrossProjectConfig?: MobileCrossProjectConfig
	rootLabel: string
	backLabel: string
	homeLabel: string
	closeLabel: string
	confirmLabel: string
	clearSearchAriaLabel: string
	searchPlaceholder: string
	searchEmptyDescription: string
	emptyTip: string
	closeOnSubmit?: boolean
	onClose: () => void
	onSubmit: (params: SelectDirectorySubmitParams) => void
}

interface DirectorySearchResult {
	directory: AttachmentItem
	pathLabel: string
}

type MobileSheetViewMode = "workspace" | "project" | "directory"

interface BreadcrumbSegment {
	key: string
	label: string
	onClick: () => void
}

type WorkspaceEntryType = "workspace" | "shared" | "chats" | "micro-app"

interface WorkspaceBrowseItem {
	id: string
	name: string
	project_count: number
	entryType: WorkspaceEntryType
}

type BrowsingWorkspace = Pick<Workspace, "id" | "name"> & {
	entryType: WorkspaceEntryType
}

const CHATS_WORKSPACE_ENTRY_ID = "__mobile-chats__"
const FIXED_WORKSPACE_IDS = new Set([SHARE_WORKSPACE_ID, MY_CLAW_WORKSPACE_ID])

const HEADER_BUTTON_CLASS =
	"absolute top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"

/** Builds the normal-workspace list for recording copy while excluding fixed workspace entries. */
function createRegularWorkspaceItems(
	workspaces: Array<Pick<Workspace, "id" | "name" | "project_count" | "workspace_type">>,
): WorkspaceBrowseItem[] {
	return workspaces
		.filter(
			(workspace) =>
				!FIXED_WORKSPACE_IDS.has(workspace.id) && workspace.workspace_type !== "chat",
		)
		.map((workspace) => ({
			id: workspace.id,
			name: workspace.name,
			project_count: workspace.project_count || 0,
			entryType: "workspace" as const,
		}))
}

function getTemporaryToken() {
	return ""
}

/**
 * 目录选择器只展示可见文件夹，避免隐藏节点在移动端搜索和移动目标里重新暴露。
 */
function getVisibleDirectories(items: AttachmentItem[]): AttachmentItem[] {
	return items.filter((item) => item.is_directory && !item.is_hidden)
}

function getVisibleEntries(items: AttachmentItem[]): AttachmentItem[] {
	return items.filter((item) => !item.is_hidden)
}

/**
 * 搜索态需要恢复完整目录路径，因此这里从整棵树中回溯目标目录的祖先链。
 */
function findDirectoryPath(
	items: AttachmentItem[],
	targetId: string,
	ancestorPath: AttachmentItem[] = [],
): AttachmentItem[] | null {
	for (const item of getVisibleDirectories(items)) {
		const nextPath = [...ancestorPath, item]
		if (getItemId(item) === targetId) return nextPath

		if (item.children) {
			const matchedPath = findDirectoryPath(item.children, targetId, nextPath)
			if (matchedPath) return matchedPath
		}
	}

	return null
}

/**
 * 搜索结果遵循原型语义：只返回目录，并附带父路径文案帮助用户判断命中位置。
 */
function searchDirectories(
	items: AttachmentItem[],
	keyword: string,
	ancestorNames: string[] = [],
): DirectorySearchResult[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	if (!normalizedKeyword) return []

	const results: DirectorySearchResult[] = []
	for (const item of getVisibleDirectories(items)) {
		const directoryName = getItemName(item)
		if (directoryName.toLowerCase().includes(normalizedKeyword)) {
			results.push({
				directory: item,
				pathLabel: ancestorNames.join(" / "),
			})
		}

		if (item.children) {
			results.push(
				...searchDirectories(item.children, keyword, [...ancestorNames, directoryName]),
			)
		}
	}

	return results
}

function searchResourceEntries(
	items: AttachmentItem[],
	keyword: string,
	ancestorNames: string[] = [],
): DirectorySearchResult[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	if (!normalizedKeyword) return []

	const results: DirectorySearchResult[] = []
	for (const item of getVisibleEntries(items)) {
		const itemName = getItemName(item)
		if (itemName.toLowerCase().includes(normalizedKeyword)) {
			results.push({
				directory: item,
				pathLabel: ancestorNames.join(" / "),
			})
		}

		if (item.is_directory && item.children) {
			results.push(
				...searchResourceEntries(item.children, keyword, [...ancestorNames, itemName]),
			)
		}
	}

	return results
}

/**
 * 行级箭头只在存在子目录时展示，避免对不可继续下钻的目标制造误导。
 */
function hasChildDirectories(item: AttachmentItem): boolean {
	return getVisibleDirectories(item.children || []).length > 0
}

function searchWorkspaceItems(
	items: WorkspaceBrowseItem[],
	keyword: string,
	t: ReturnType<typeof useTranslation>["t"],
): WorkspaceBrowseItem[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	if (!normalizedKeyword) return items

	return items.filter((item) =>
		getWorkspaceDisplayName(item, t).toLowerCase().includes(normalizedKeyword),
	)
}

function resolveChatWorkspaceName(t: ReturnType<typeof useTranslation>["t"]) {
	return t("mobile.shell.navChats")
}

function getWorkspaceDisplayName(
	workspace: Pick<WorkspaceBrowseItem, "name">,
	t: ReturnType<typeof useTranslation>["t"],
) {
	// Workspace names can be empty strings from the API; render a stable fallback instead of blank UI.
	return workspace.name?.trim() || t("workspace.unnamedWorkspace")
}

function getProjectDisplayName(
	project: Pick<ProjectListItem, "project_name">,
	t: ReturnType<typeof useTranslation>["t"],
	workspaceEntryType?: WorkspaceEntryType,
) {
	const trimmedName = project.project_name?.trim()
	if (trimmedName) return trimmedName

	return workspaceEntryType === "chats" ? t("chat.unnamedChat") : t("project.unnamedProject")
}

function searchProjectItems(
	items: ResourceProject[],
	keyword: string,
	t: ReturnType<typeof useTranslation>["t"],
	workspaceEntryType?: WorkspaceEntryType,
): ResourceProject[] {
	const normalizedKeyword = keyword.trim().toLowerCase()
	if (!normalizedKeyword) return items

	return items.filter((item) =>
		getProjectDisplayName(item, t, workspaceEntryType)
			.toLowerCase()
			.includes(normalizedKeyword),
	)
}

/**
 * 卡片容器统一目录行的圆角和阴影，避免根目录与普通目录在密度上分裂。
 */
function DirectoryCard({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="overflow-hidden rounded-xl bg-card"
			style={{ boxShadow: "0px 2px 8px 0px rgba(0,0,0,0.04)" }}
		>
			{children}
		</div>
	)
}

function LoadingCards() {
	return (
		<div
			className="flex flex-col gap-2 px-[14px] py-2 pb-4"
			data-testid="select-directory-mobile-loading"
		>
			{Array.from({ length: 3 }).map((_, index) => (
				<div
					key={index}
					className="h-14 animate-pulse rounded-xl bg-card/70"
					style={{ boxShadow: "0px 2px 8px 0px rgba(0,0,0,0.04)" }}
				/>
			))}
		</div>
	)
}

/**
 * 根目录入口只在顶层显示，保留原型里“先选根，再确认”的选择语义。
 */
function RootRow({
	rootLabel,
	selected,
	onSelect,
}: {
	rootLabel: string
	selected: boolean
	onSelect: () => void
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex min-h-[56px] w-full items-center gap-3 px-[14px] py-3 text-left active:bg-foreground/[0.04]"
			data-testid="select-directory-mobile-root-select-button"
		>
			<div
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full border-2",
					selected
						? "border-primary bg-primary text-primary-foreground"
						: "border-border bg-transparent",
				)}
			>
				{selected ? <div className="size-2 rounded-full bg-primary-foreground" /> : null}
			</div>
			<Home className="size-[22px] shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1 truncate text-[16px] font-medium leading-5 text-foreground">
				{rootLabel}
			</span>
		</button>
	)
}

function WorkspaceRow({
	workspace,
	onDrillIn,
}: {
	workspace: WorkspaceBrowseItem
	onDrillIn: () => void
}) {
	const { t } = useTranslation("super")
	const isSharedWorkspace = workspace.entryType === "shared"
	const isChatsWorkspace = workspace.entryType === "chats"
	const workspaceName = getWorkspaceDisplayName(workspace, t)
	const subtitle =
		workspace.entryType === "micro-app"
			? t("selectPathModal.microAppSourceFiles")
			: isChatsWorkspace
				? t("selectPathModal.chatCount", { count: workspace.project_count })
				: t("workspace.projectCount", { count: workspace.project_count })
	const Icon =
		workspace.entryType === "micro-app"
			? LayoutGrid
			: isSharedWorkspace
				? Share2
				: isChatsWorkspace
					? MessageCircle
					: Box

	return (
		<button
			type="button"
			onClick={onDrillIn}
			className="flex min-h-[56px] w-full items-center gap-3 px-[14px] py-3 text-left active:bg-foreground/[0.04]"
			data-testid={`select-directory-mobile-workspace-${workspace.id}`}
		>
			<Icon className="size-[22px] shrink-0 text-muted-foreground" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-[16px] font-medium leading-5 text-foreground">
					{workspaceName}
				</p>
				<p className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground">
					{subtitle}
				</p>
			</div>
			<ChevronRight className="size-[18px] shrink-0 text-muted-foreground" />
		</button>
	)
}

export function MobileProjectRow({
	project,
	workspaceEntryType,
	selected,
	onSelect,
	onDrillIn,
}: {
	project: ResourceProject
	workspaceEntryType?: WorkspaceEntryType
	selected?: boolean
	onSelect?: () => void
	onDrillIn: () => void
}) {
	const { t } = useTranslation("super")
	const Icon = workspaceEntryType === "chats" ? MessageCircle : LibraryBig

	return (
		<div className="flex min-h-[56px] items-center">
			<button
				type="button"
				onClick={onSelect || onDrillIn}
				className="flex min-w-0 flex-1 items-center gap-3 px-[14px] py-3 text-left active:bg-foreground/[0.04]"
				data-testid={`select-directory-mobile-project-${project.id}`}
			>
				{onSelect ? (
					<div
						className={cn(
							"flex size-5 shrink-0 items-center justify-center rounded-full border-2",
							selected
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-transparent",
						)}
					>
						{selected ? (
							<div className="size-2 rounded-full bg-primary-foreground" />
						) : null}
					</div>
				) : null}
				<ProjectResourceInfo
					project={project}
					name={getProjectDisplayName(project, t, workspaceEntryType)}
					mobile
					list
					icon={
						project.resourceType ? undefined : (
							<Icon
								className="size-8 shrink-0 text-muted-foreground"
								data-testid={`select-directory-mobile-project-icon-${project.id}`}
							/>
						)
					}
					titleTrailing={
						<>
							{project.is_pinned && <PinnedTag />}
							{(isWorkspaceShortcutProject(project) ||
								isCollaborationProject(project)) && (
								<CollaborationProjectTag
									visible
									project={project}
									showText={false}
								/>
							)}
						</>
					}
				/>
			</button>
			{onSelect ? (
				<>
					<div className="h-8 w-px shrink-0 bg-border" />
					<button
						type="button"
						onClick={onDrillIn}
						className="flex h-full min-h-[56px] w-12 shrink-0 items-center justify-center text-muted-foreground active:bg-foreground/[0.04]"
						data-testid={`select-directory-mobile-project-drill-${project.id}`}
						aria-label={getProjectDisplayName(project, t, workspaceEntryType)}
					>
						<ChevronRight className="size-[18px]" />
					</button>
				</>
			) : (
				<ChevronRight className="mr-[14px] size-[18px] shrink-0 text-muted-foreground" />
			)}
		</div>
	)
}

/**
 * 目录行保持“左选右钻”双操作区，避免用户点击整行后直接丢失当前浏览上下文。
 */
function DirectoryRow({
	directory,
	resourceTree,
	secondaryText,
	selected,
	disabled,
	onSelect,
	onDrillIn,
}: {
	directory: AttachmentItem
	resourceTree: AttachmentItem[]
	secondaryText?: string
	selected: boolean
	disabled: boolean
	onSelect: () => void
	onDrillIn?: () => void
}) {
	const directoryId = getItemId(directory)

	return (
		<div className={cn("flex min-h-[56px] items-center", disabled && "opacity-50")}>
			<button
				type="button"
				onClick={onSelect}
				disabled={disabled}
				className="flex min-w-0 flex-1 items-center gap-3 px-[14px] py-3 text-left active:bg-foreground/[0.04] disabled:pointer-events-none"
				data-testid={`select-directory-mobile-folder-select-${directoryId}`}
			>
				<div
					className={cn(
						"flex size-5 shrink-0 items-center justify-center rounded-full border-2",
						selected
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-transparent",
					)}
				>
					{selected ? (
						<div className="size-2 rounded-full bg-primary-foreground" />
					) : null}
				</div>
				<div className="flex size-[22px] shrink-0 items-center justify-center">
					<FileResourceIcon
						presentation={resolveFilePresentation(directory, {
							index: getFilePresentationIndex(resourceTree),
						})}
						size={20}
						folderWidth={22}
						folderHeight={18}
						folderClassName="h-[18px] w-[22px] shrink-0 object-contain"
						folderTestId="mobile-files-move-sheet-image"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[16px] font-medium leading-5 text-foreground">
						{getItemName(directory)}
					</p>
					{secondaryText ? (
						<p className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground">
							{secondaryText}
						</p>
					) : null}
				</div>
			</button>
			{onDrillIn ? (
				<>
					<div className="h-8 w-px shrink-0 bg-border" />
					<button
						type="button"
						onClick={onDrillIn}
						className="flex h-full min-h-[56px] w-12 shrink-0 items-center justify-center text-muted-foreground active:bg-foreground/[0.04]"
						data-testid={`select-directory-mobile-folder-drill-${directoryId}`}
						aria-label={getItemName(directory)}
					>
						<ChevronRight className="size-[18px]" />
					</button>
				</>
			) : null}
		</div>
	)
}

/**
 * 移动端专用 View 只承载浏览、搜索和选择目标目录的展示逻辑，不接入创建目录等桌面扩展能力。
 */
function MobileFilesMoveSheet({
	visible,
	submitting = false,
	title,
	attachments,
	defaultPath = [],
	disabledFolderIds = [],
	mobileCrossProjectConfig,
	rootLabel,
	backLabel,
	homeLabel,
	closeLabel,
	confirmLabel,
	clearSearchAriaLabel,
	searchPlaceholder,
	searchEmptyDescription,
	emptyTip,
	closeOnSubmit = true,
	onClose,
	onSubmit,
}: MobileFilesMoveSheetProps) {
	const { t } = useTranslation("super")
	const supportsCrossProject = Boolean(mobileCrossProjectConfig)
	const isMentionMode = mobileCrossProjectConfig?.selectionMode === "mention"
	const isResourceSelectionMode =
		isMentionMode || mobileCrossProjectConfig?.selectionMode === "import"
	const initialViewMode = mobileCrossProjectConfig?.initialViewMode || "directory"
	const includeSpecialWorkspaces = mobileCrossProjectConfig?.includeSpecialWorkspaces ?? true
	const allowWorkspaceSubmit = mobileCrossProjectConfig?.allowWorkspaceSubmit ?? false
	const initialBrowsingWorkspace = useMemo<BrowsingWorkspace | null>(() => {
		if (!mobileCrossProjectConfig) return null
		if (initialViewMode === "workspace") return null

		if (mobileCrossProjectConfig.isChatProject) {
			return {
				id: CHATS_WORKSPACE_ENTRY_ID,
				name: resolveChatWorkspaceName(t),
				entryType: "chats",
			}
		}

		if (
			mobileCrossProjectConfig.currentProject?.workspace_id === SHARE_WORKSPACE_ID ||
			mobileCrossProjectConfig.currentWorkspace?.id === SHARE_WORKSPACE_ID
		) {
			return {
				id: SHARE_WORKSPACE_ID,
				name: SHARE_WORKSPACE_DATA(t).name,
				entryType: "shared",
			}
		}

		if (!mobileCrossProjectConfig.currentWorkspace) return null

		return {
			id: mobileCrossProjectConfig.currentWorkspace.id,
			name: mobileCrossProjectConfig.currentWorkspace.name,
			entryType: "workspace",
		}
	}, [initialViewMode, mobileCrossProjectConfig, t])
	const [viewMode, setViewMode] = useState<MobileSheetViewMode>(
		supportsCrossProject ? initialViewMode : "directory",
	)
	const [workspaceItems, setWorkspaceItems] = useState<WorkspaceBrowseItem[]>([])
	const [projectItems, setProjectItems] = useState<ResourceProject[]>([])
	const [browsingWorkspace, setBrowsingWorkspace] = useState<BrowsingWorkspace | null>(
		initialBrowsingWorkspace,
	)
	const [browsingProject, setBrowsingProject] = useState<Pick<
		ProjectListItem,
		"id" | "project_name" | "workspace_id"
	> | null>(mobileCrossProjectConfig?.currentProject || null)
	const [activeAttachments, setActiveAttachments] = useState<AttachmentItem[]>(attachments)
	const [pathStack, setPathStack] = useState<AttachmentItem[]>(defaultPath)
	const [selectedPath, setSelectedPath] = useState<AttachmentItem[] | null>(null)
	const [selectedResources, setSelectedResources] = useState<ProjectResourceSelection[]>([])
	const [query, setQuery] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const chatWorkspaceRef = useRef<Workspace | null>(null)
	const microAppWorkspaceRef = useRef<Workspace | null>(null)
	const projectRequestRef = useRef<AbortController | null>(null)
	const workspaceRequestRef = useRef<AbortController | null>(null)
	const openStateResetRef = useRef(false)
	const initialWorkspaceLoadRef = useRef(false)
	useEffect(() => {
		return () => {
			projectRequestRef.current?.abort()
			workspaceRequestRef.current?.abort()
			microAppWorkspaceRef.current = null
		}
	}, [visible])

	useEffect(() => {
		if (!visible) {
			openStateResetRef.current = false
			initialWorkspaceLoadRef.current = false
			return
		}
		if (openStateResetRef.current) return
		openStateResetRef.current = true

		setViewMode(supportsCrossProject ? initialViewMode : "directory")
		setWorkspaceItems([])
		setProjectItems([])
		setBrowsingWorkspace(initialBrowsingWorkspace)
		setBrowsingProject(mobileCrossProjectConfig?.currentProject || null)
		setActiveAttachments(attachments)
		setPathStack(defaultPath)
		setSelectedPath(null)
		setSelectedResources([])
		setQuery("")
		setIsLoading(false)
	}, [
		attachments,
		defaultPath,
		initialBrowsingWorkspace,
		initialViewMode,
		mobileCrossProjectConfig,
		isResourceSelectionMode,
		supportsCrossProject,
		visible,
	])

	/**
	 * chat workspace 不在普通工作区列表里，弹窗内单独缓存它，避免 workspace 层和 project 层重复请求。
	 */
	const ensureChatWorkspace = useCallback(async () => {
		if (chatWorkspaceRef.current?.id) return chatWorkspaceRef.current

		try {
			const workspace = await SuperMagicApi.getChatWorkspace()
			chatWorkspaceRef.current = workspace || null
			return chatWorkspaceRef.current
		} catch (error) {
			console.error("Failed to fetch chat workspace:", error)
			chatWorkspaceRef.current = null
			return null
		}
	}, [])

	const loadWorkspaces = useCallback(async () => {
		workspaceRequestRef.current?.abort()
		const request = new AbortController()
		workspaceRequestRef.current = request
		setIsLoading(true)
		try {
			if (!includeSpecialWorkspaces) {
				const regularWorkspaces =
					mobileCrossProjectConfig?.workspaces ||
					(
						await SuperMagicApi.getWorkspaces({
							page: 1,
							page_size: 999,
						})
					)?.list ||
					[]

				// Recording copy must start from normal workspaces only; fixed entries are handled elsewhere.
				request.signal.throwIfAborted()
				setWorkspaceItems(createRegularWorkspaceItems(regularWorkspaces))
				return
			}

			const [workspaceResult, collaborationResult, chatWorkspaceResult] =
				await Promise.allSettled([
					SuperMagicApi.getWorkspaces({
						page: 1,
						page_size: 999,
					}),
					loadSharedWorkspaceProjects({ signal: request.signal }),
					ensureChatWorkspace(),
				])

			const regularWorkspaces: Workspace[] =
				workspaceResult.status === "fulfilled" ? workspaceResult.value?.list || [] : []
			request.signal.throwIfAborted()
			const sharedProjectsTotal =
				collaborationResult.status === "fulfilled" ? collaborationResult.value.length : 0
			const chatWorkspace =
				chatWorkspaceResult.status === "fulfilled" ? chatWorkspaceResult.value : null
			let chatProjectsTotal = 0

			if (chatWorkspace?.id) {
				try {
					// Chat workspace metadata count is not always in sync with the actual list,
					// so the card count should reuse a bounded list query instead of stale metadata.
					const chatProjectsResponse = await SuperMagicApi.getProjects({
						workspace_id: chatWorkspace.id,
						page: 1,
						page_size: 100,
					})
					chatProjectsTotal = chatProjectsResponse?.list?.length ?? 0
				} catch (error) {
					console.error("Failed to fetch chat projects count:", error)
				}
			}

			request.signal.throwIfAborted()
			setWorkspaceItems([
				{
					id: SHARE_WORKSPACE_ID,
					name: SHARE_WORKSPACE_DATA(t).name,
					project_count: sharedProjectsTotal,
					entryType: "shared",
				},
				{
					id: CHATS_WORKSPACE_ENTRY_ID,
					name: resolveChatWorkspaceName(t),
					project_count: chatProjectsTotal,
					entryType: "chats",
				},
				...(isResourceSelectionMode && isMicroAppEnabled()
					? [
							{
								id: MICRO_APPS_WORKSPACE_ID,
								name: t("selectPathModal.myMicroApps"),
								project_count: 0,
								entryType: "micro-app" as const,
							},
						]
					: []),
				...regularWorkspaces.map((workspace) => ({
					id: workspace.id,
					name: workspace.name,
					project_count: workspace.project_count,
					entryType: "workspace" as const,
				})),
			])
		} catch (error) {
			if (request.signal.aborted) return
			console.error("Failed to fetch workspaces:", error)
			setWorkspaceItems([])
		} finally {
			if (workspaceRequestRef.current === request && !request.signal.aborted)
				setIsLoading(false)
		}
	}, [
		ensureChatWorkspace,
		includeSpecialWorkspaces,
		isResourceSelectionMode,
		mobileCrossProjectConfig?.workspaces,
		t,
	])

	const loadProjects = useCallback(
		async (workspace: BrowsingWorkspace) => {
			projectRequestRef.current?.abort()
			const request = new AbortController()
			projectRequestRef.current = request
			setIsLoading(true)
			try {
				if (
					workspace.entryType === "micro-app" &&
					isResourceSelectionMode &&
					isMicroAppEnabled()
				) {
					const microWorkspace = await SuperMagicApi.getMicroAppWorkspace()
					request.signal.throwIfAborted()
					microAppWorkspaceRef.current = microWorkspace
					const projects: ResourceProject[] = []
					let page = 1
					// H5 保留原列表交互；逐页读取项目元数据，不预取任何项目附件。
					while (!request.signal.aborted) {
						const result = await loadMicroAppProjectPage({
							workspace: microWorkspace,
							page,
							pageSize: 100,
							signal: request.signal,
						})
						projects.push(...result.list)
						if (projects.length >= result.total || result.list.length === 0) break
						page += 1
					}
					request.signal.throwIfAborted()
					setProjectItems(projects)
					return
				}
				if (workspace.entryType === "shared") {
					const projects = await loadSharedWorkspaceProjects({ signal: request.signal })
					request.signal.throwIfAborted()
					setProjectItems(
						projects.map((project) => ({
							...project,
							tag: "collaboration" as const,
						})),
					)
					return
				}

				if (workspace.entryType === "chats") {
					const chatWorkspace = await ensureChatWorkspace()
					request.signal.throwIfAborted()
					if (!chatWorkspace?.id) {
						setProjectItems([])
						return
					}

					const response = await SuperMagicApi.getProjects({
						workspace_id: chatWorkspace.id,
						page: 1,
						page_size: 99,
					})
					request.signal.throwIfAborted()
					setProjectItems(response?.list || [])
					return
				}

				const response = await SuperMagicApi.getProjectsWithCollaboration({
					workspace_id: workspace.id,
					page: 1,
					page_size: 99,
				})
				request.signal.throwIfAborted()
				setProjectItems(response?.list || [])
			} catch (error) {
				if (request.signal.aborted) return
				console.error("Failed to fetch projects:", error)
				setProjectItems([])
				magicToast.error(t("selectPathModal.fetchProjectsFailed"))
			} finally {
				if (!request.signal.aborted) setIsLoading(false)
			}
		},
		[ensureChatWorkspace, isResourceSelectionMode, t],
	)

	useEffect(() => {
		if (!visible || !supportsCrossProject || initialViewMode !== "workspace") return
		if (initialWorkspaceLoadRef.current) return
		initialWorkspaceLoadRef.current = true
		void loadWorkspaces()
	}, [initialViewMode, loadWorkspaces, supportsCrossProject, visible])

	useEffect(() => {
		if (
			!visible ||
			initialViewMode !== "workspace" ||
			includeSpecialWorkspaces ||
			!mobileCrossProjectConfig?.workspaces
		) {
			return
		}

		// Recording copy opens before the workspace request resolves, so keep the first screen in sync.
		setWorkspaceItems(createRegularWorkspaceItems(mobileCrossProjectConfig.workspaces))
	}, [includeSpecialWorkspaces, initialViewMode, mobileCrossProjectConfig?.workspaces, visible])

	const loadProjectAttachments = useCallback(async (project: ProjectListItem) => {
		setIsLoading(true)
		try {
			const response = await SuperMagicApi.getAttachmentsByProjectId({
				projectId: project.id,
				temporaryToken: getTemporaryToken(),
			})
			setActiveAttachments(response?.tree || [])
		} catch (error) {
			console.error("Failed to fetch attachments:", error)
			setActiveAttachments([])
		} finally {
			setIsLoading(false)
		}
	}, [])

	const isSearching = query.trim().length > 0
	const effectiveSearchPlaceholder = useMemo(() => {
		if (!supportsCrossProject) return searchPlaceholder
		if (viewMode === "workspace") return t("selectPathModal.searchWorkspace")
		if (viewMode === "project") return t("selectPathModal.searchProject")
		return t("selectPathModal.searchDirectory")
	}, [searchPlaceholder, supportsCrossProject, t, viewMode])
	const effectiveSearchEmptyDescription = useMemo(() => {
		const keyword = query.trim()
		if (!keyword) return searchEmptyDescription
		return t("selectPathModal.searchEmptyDescription", { keyword })
	}, [query, searchEmptyDescription, t])
	const currentDirectories = useMemo(() => {
		const currentItems = getDirectoriesFromPath(activeAttachments, pathStack)
		return isResourceSelectionMode
			? getVisibleEntries(currentItems)
			: getVisibleDirectories(currentItems)
	}, [activeAttachments, isResourceSelectionMode, pathStack])
	const searchResults = useMemo(() => {
		if (!isSearching || viewMode !== "directory") return []
		return isResourceSelectionMode
			? searchResourceEntries(activeAttachments, query)
			: searchDirectories(activeAttachments, query)
	}, [activeAttachments, isResourceSelectionMode, isSearching, query, viewMode])
	const filteredWorkspaces = useMemo(() => {
		return searchWorkspaceItems(workspaceItems, query, t)
	}, [query, t, workspaceItems])
	const pinnedWorkspaceItems = useMemo(() => {
		return filteredWorkspaces.filter((workspace) => workspace.entryType !== "workspace")
	}, [filteredWorkspaces])
	const personalWorkspaceItems = useMemo(() => {
		return filteredWorkspaces.filter((workspace) => workspace.entryType === "workspace")
	}, [filteredWorkspaces])
	const filteredProjects = useMemo(() => {
		return searchProjectItems(projectItems, query, t, browsingWorkspace?.entryType).filter(
			(project) => !mobileCrossProjectConfig?.excludeProjectIds?.includes(project.id),
		)
	}, [
		browsingWorkspace?.entryType,
		mobileCrossProjectConfig?.excludeProjectIds,
		projectItems,
		query,
		t,
	])
	const selectedAttachmentIds = useMemo(
		() =>
			new Set(
				selectedResources
					.filter(
						(selection) =>
							selection.level === "attachment" &&
							selection.project.id === browsingProject?.id,
					)
					.map((selection) =>
						selection.level === "attachment" ? getItemId(selection.attachment) : "",
					),
			),
		[browsingProject?.id, selectedResources],
	)
	const selectedDirectoryId = useMemo(() => {
		if (selectedPath === null) return null

		const selectedDirectory = selectedPath.at(-1)
		return selectedDirectory ? getItemId(selectedDirectory) : "root"
	}, [selectedPath])
	const canSubmitWorkspace = Boolean(
		allowWorkspaceSubmit &&
		viewMode === "project" &&
		browsingWorkspace?.id &&
		browsingWorkspace.entryType === "workspace",
	)
	const canConfirm = isResourceSelectionMode
		? selectedResources.length > 0
		: selectedPath !== null || canSubmitWorkspace
	const breadcrumbSegments = useMemo<BreadcrumbSegment[]>(() => {
		if (!supportsCrossProject) {
			return pathStack.map((item, index) => ({
				key: getItemId(item),
				label: getItemName(item),
				onClick: () => {
					setPathStack((previousPath) => previousPath.slice(0, index + 1))
				},
			}))
		}

		if (viewMode === "workspace") {
			return []
		}

		const segments: BreadcrumbSegment[] = []
		if (browsingWorkspace) {
			segments.push({
				key: `workspace-${browsingWorkspace.id}`,
				label: getWorkspaceDisplayName(browsingWorkspace, t),
				onClick: async () => {
					setSelectedPath(null)
					setQuery("")
					await loadProjects(browsingWorkspace)
					setViewMode("project")
				},
			})
		}
		if (viewMode === "directory" && browsingProject) {
			segments.push({
				key: `project-${browsingProject.id}`,
				label: getProjectDisplayName(browsingProject, t, browsingWorkspace?.entryType),
				onClick: () => {
					setQuery("")
					setViewMode("directory")
					setPathStack([])
				},
			})
		}
		return [
			...segments,
			...pathStack.map((item, index) => ({
				key: getItemId(item),
				label: getItemName(item),
				onClick: () => {
					setPathStack((previousPath) => previousPath.slice(0, index + 1))
				},
			})),
		]
	}, [
		browsingProject,
		browsingWorkspace,
		loadProjects,
		pathStack,
		supportsCrossProject,
		t,
		viewMode,
	])
	const canBack = useMemo(() => {
		if (viewMode === "directory") {
			return pathStack.length > 0 || supportsCrossProject
		}
		return supportsCrossProject && viewMode === "project"
	}, [pathStack.length, supportsCrossProject, viewMode])

	/**
	 * 面包屑导航只回退浏览路径，不自动替换已选目标，避免误提交到非预期目录。
	 */
	const handleBack = useCallback(async () => {
		if (viewMode === "directory") {
			if (pathStack.length > 0) {
				setPathStack((previousPath) => previousPath.slice(0, -1))
				return
			}

			if (supportsCrossProject && browsingWorkspace) {
				setSelectedPath(null)
				setQuery("")
				await loadProjects(browsingWorkspace)
				setViewMode("project")
			}
			return
		}

		if (viewMode === "project") {
			setSelectedPath(null)
			setQuery("")
			await loadWorkspaces()
			setViewMode("workspace")
		}
	}, [
		browsingWorkspace,
		loadProjects,
		loadWorkspaces,
		pathStack.length,
		supportsCrossProject,
		viewMode,
	])

	const handleGoHome = useCallback(async () => {
		if (!supportsCrossProject) {
			setPathStack([])
			return
		}

		setSelectedPath(null)
		setQuery("")
		await loadWorkspaces()
		setViewMode("workspace")
	}, [loadWorkspaces, supportsCrossProject])

	/**
	 * 根目录是合法目标，因此用空路径数组表达“已选择根目录”而不是回退为未选择态。
	 */
	function handleSelectRoot() {
		setSelectedPath([])
	}

	function getSelectedWorkspace(
		project?: Pick<ProjectListItem, "workspace_id">,
	): Workspace | null {
		if (!browsingWorkspace) return null
		if (browsingWorkspace.entryType === "micro-app") {
			const workspace = microAppWorkspaceRef.current
			return workspace ? { ...workspace, name: browsingWorkspace.name } : null
		}
		const workspaceId = project?.workspace_id || browsingWorkspace.id

		const configuredWorkspace = mobileCrossProjectConfig?.workspaces?.find(
			(workspace) => workspace.id === workspaceId,
		)
		return {
			...configuredWorkspace,
			id: workspaceId,
			name: browsingWorkspace.name,
		} as Workspace
	}

	function getSelectionKey(selection: ProjectResourceSelection) {
		if (selection.level === "project") return `project:${selection.project.id}`
		return `attachment:${selection.project.id}:${getItemId(selection.attachment)}`
	}

	function toggleMentionSelection(selection: ProjectResourceSelection) {
		const selectionKey = getSelectionKey(selection)
		const existingIndex = selectedResources.findIndex(
			(item) => getSelectionKey(item) === selectionKey,
		)
		if (existingIndex >= 0) {
			setSelectedResources((previous) =>
				previous.filter((_, index) => index !== existingIndex),
			)
			return
		}

		const selectedProjectIds = new Set(selectedResources.map((item) => item.project.id))
		if (
			!selectedProjectIds.has(selection.project.id) &&
			selectedProjectIds.size >= MAX_MENTION_PROJECT_COUNT
		) {
			magicToast.info(t("selectPathModal.mentionProjectLimit"))
			return
		}

		setSelectedResources((previous) => [...previous, selection])
	}

	function handleSelectProject(project: ProjectListItem) {
		const workspace = getSelectedWorkspace(project)
		if (!workspace) return

		toggleMentionSelection({
			level: "project",
			workspace,
			project,
		})
	}

	/**
	 * 搜索结果和当前层列表最终都要回落为完整路径，保证提交给旧链路的数据结构不变。
	 */
	function handleSelectDirectory(directory: AttachmentItem, shouldResolveFromTree = false) {
		const directoryId = getItemId(directory)
		if (disabledFolderIds.includes(directoryId)) return
		if (isResourceSelectionMode) {
			const workspace = getSelectedWorkspace(browsingProject || undefined)
			if (!workspace || !browsingProject) return
			toggleMentionSelection({
				level: "attachment",
				workspace,
				project: browsingProject as ProjectListItem,
				attachment: directory,
			})
			return
		}

		if (shouldResolveFromTree) {
			const matchedPath = findDirectoryPath(activeAttachments, directoryId)
			if (matchedPath) {
				setSelectedPath(matchedPath)
			}
			return
		}

		setSelectedPath([...pathStack, directory])
	}

	/**
	 * 下钻操作只改变浏览上下文，不直接改变选中目标，保持和原型一致的双区域交互。
	 */
	function handleDrillIn(directory: AttachmentItem, shouldResolveFromTree = false) {
		const nextPath = shouldResolveFromTree
			? findDirectoryPath(activeAttachments, getItemId(directory)) || [
					...pathStack,
					directory,
				]
			: [...pathStack, directory]
		setPathStack(nextPath)
	}

	const handleWorkspaceDrillIn = useCallback(
		async (workspace: WorkspaceBrowseItem) => {
			setBrowsingWorkspace({
				id: workspace.id,
				name: getWorkspaceDisplayName(workspace, t),
				entryType: workspace.entryType,
			})
			setQuery("")
			setSelectedPath(null)
			setPathStack([])
			await loadProjects({
				id: workspace.id,
				name: getWorkspaceDisplayName(workspace, t),
				entryType: workspace.entryType,
			})
			setViewMode("project")
		},
		[loadProjects, t],
	)

	const handleProjectDrillIn = useCallback(
		async (project: ProjectListItem) => {
			setBrowsingProject(project)
			setQuery("")
			setSelectedPath(null)
			setPathStack([])

			const isCurrentProject =
				mobileCrossProjectConfig &&
				mobileCrossProjectConfig.currentProject &&
				project.id === mobileCrossProjectConfig.currentProject.id
			if (isCurrentProject) {
				setActiveAttachments(attachments)
			} else {
				await loadProjectAttachments(project)
			}

			setViewMode("directory")
		},
		[attachments, loadProjectAttachments, mobileCrossProjectConfig],
	)

	/**
	 * 搜索输入沿用原型行为：一旦进入搜索态就回到根层搜索整棵目录树。
	 */
	function handleSearchValueChange(nextValue: string) {
		setQuery(nextValue)
		if (viewMode === "directory" && nextValue.trim()) {
			setPathStack([])
		}
	}

	/**
	 * 确认动作继续向旧的 `onSubmit({ path })` 契约回传，避免改动原有移动文件链路。
	 */
	function handleConfirm() {
		if (isResourceSelectionMode) {
			const firstSelection = selectedResources[0]
			if (!firstSelection) return
			onSubmit({
				path: pathStack,
				targetWorkspaceId: firstSelection.workspace.id,
				targetProjectId: firstSelection.project.id,
				targetAttachments: activeAttachments,
				sourceAttachments: mobileCrossProjectConfig?.sourceAttachments || [],
				selection: firstSelection,
				selections: selectedResources,
			})
			if (closeOnSubmit) onClose()
			return
		}

		if (canSubmitWorkspace && browsingWorkspace) {
			onSubmit({
				path: [],
				targetWorkspaceId: browsingWorkspace.id,
				targetProjectId: "",
				targetAttachments: [],
				sourceAttachments: mobileCrossProjectConfig?.sourceAttachments || [],
			})
			if (closeOnSubmit) onClose()
			return
		}

		if (selectedPath === null || viewMode !== "directory") return

		if (
			supportsCrossProject &&
			browsingProject?.id &&
			mobileCrossProjectConfig &&
			(!mobileCrossProjectConfig.currentProject ||
				browsingProject.id !== mobileCrossProjectConfig.currentProject.id)
		) {
			onSubmit({
				path: selectedPath,
				...(allowWorkspaceSubmit ? { targetWorkspaceId: browsingWorkspace?.id } : {}),
				targetProjectId: browsingProject.id,
				targetAttachments: activeAttachments,
				sourceAttachments: mobileCrossProjectConfig.sourceAttachments,
			})
		} else {
			onSubmit({ path: selectedPath })
		}
		if (closeOnSubmit) onClose()
	}

	return (
		<Sheet
			open={visible}
			onOpenChange={(nextVisible) => {
				if (!nextVisible && !isResourceSelectionMode) onClose()
			}}
		>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				className="flex h-[calc(100dvh-var(--safe-area-inset-top,0px))] max-h-[calc(100dvh-var(--safe-area-inset-top,0px))] min-h-[calc(100dvh-var(--safe-area-inset-top,0px))] flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0 !pb-0"
				data-testid="select-directory-mobile-sheet-root"
				onPointerDown={(event) => {
					if (isResourceSelectionMode) event.stopPropagation()
				}}
				onClick={(event) => {
					if (isResourceSelectionMode) event.stopPropagation()
				}}
			>
				<div className="flex flex-col items-center py-1.5">
					<div className="h-1 w-20 rounded-full bg-muted-foreground/30" aria-hidden />
				</div>

				<div className="relative flex h-14 shrink-0 items-center justify-center px-16 py-2">
					<button
						type="button"
						onClick={onClose}
						className={cn(HEADER_BUTTON_CLASS, "left-[10px] bg-card text-foreground")}
						data-testid="select-directory-mobile-close-button"
						aria-label={closeLabel}
					>
						<X className="size-[22px]" />
					</button>

					<SheetTitle className="max-w-[247px] truncate text-center text-[18px] font-semibold leading-6 text-foreground">
						{title}
					</SheetTitle>

					<button
						type="button"
						onClick={handleConfirm}
						disabled={!canConfirm || submitting}
						className={cn(
							HEADER_BUTTON_CLASS,
							"right-[10px] bg-primary text-primary-foreground active:opacity-80 disabled:opacity-40",
						)}
						data-testid="select-directory-mobile-confirm-button"
						aria-label={confirmLabel}
					>
						<Check className="size-[22px]" strokeWidth={2.5} />
					</button>
				</div>

				{!isSearching ? (
					<div className="shrink-0 pr-[14px]">
						<MobilePathBreadcrumb
							className="px-[14px] py-1"
							segments={breadcrumbSegments.map((segment) => ({
								...segment,
								testId: `select-directory-mobile-breadcrumb-${segment.key}`,
							}))}
							canBack={canBack}
							onBack={handleBack}
							onGoHome={handleGoHome}
							backLabel={backLabel}
							homeLabel={homeLabel}
							backButtonTestId="select-directory-mobile-back-button"
							homeButtonTestId="select-directory-mobile-home-button"
							scrollTestId="select-directory-mobile-breadcrumb-scroll"
						/>
					</div>
				) : null}

				<div
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
					data-testid="select-directory-mobile-scroll-area"
				>
					<ScrollEdgeFadeContainer
						fadeColor="muted"
						className="min-h-0 flex-1"
						scrollClassName="no-scrollbar h-full"
						contentDeps={[
							viewMode,
							query,
							isLoading,
							filteredWorkspaces.length,
							filteredProjects.length,
							currentDirectories.length,
							searchResults.length,
						]}
					>
						{isLoading ? (
							<LoadingCards />
						) : (
							<div
								className={cn(
									"flex flex-col pb-4",
									// 项目行自身已有内边距；这里不再叠加卡片间距和左右留白。
									viewMode === "project" ? "bg-card" : "gap-2 px-[14px] py-2",
								)}
								data-testid="select-directory-mobile-list"
							>
								{viewMode === "workspace" ? (
									filteredWorkspaces.length === 0 ? (
										<div
											className="flex items-center justify-center px-6 py-12 text-center text-[14px] text-muted-foreground"
											data-testid="select-directory-mobile-search-empty"
										>
											<div className="flex items-center gap-2">
												<Search className="size-4 shrink-0" />
												<span>{effectiveSearchEmptyDescription}</span>
											</div>
										</div>
									) : (
										<>
											{pinnedWorkspaceItems.map((workspace) => (
												<DirectoryCard key={workspace.id}>
													<WorkspaceRow
														workspace={workspace}
														onDrillIn={() =>
															handleWorkspaceDrillIn(workspace)
														}
													/>
												</DirectoryCard>
											))}
											{personalWorkspaceItems.length > 0 ? (
												<p className="px-2 pb-1 pt-2 text-[13px] font-medium leading-4 text-muted-foreground">
													{t("selectPathModal.myWorkspaces")}
												</p>
											) : null}
											{personalWorkspaceItems.map((workspace) => (
												<DirectoryCard key={workspace.id}>
													<WorkspaceRow
														workspace={workspace}
														onDrillIn={() =>
															handleWorkspaceDrillIn(workspace)
														}
													/>
												</DirectoryCard>
											))}
										</>
									)
								) : viewMode === "project" ? (
									filteredProjects.length === 0 ? (
										<div
											className="flex items-center justify-center px-6 py-12 text-center text-[14px] text-muted-foreground"
											data-testid="select-directory-mobile-search-empty"
										>
											<div className="flex items-center gap-2">
												<Search className="size-4 shrink-0" />
												<span>{effectiveSearchEmptyDescription}</span>
											</div>
										</div>
									) : (
										filteredProjects.map((project) => (
											<div
												key={project.id}
												className="border-b border-border bg-card last:border-b-0"
											>
												<MobileProjectRow
													project={project}
													workspaceEntryType={
														browsingWorkspace?.entryType
													}
													selected={selectedResources.some(
														(selection) =>
															selection.level === "project" &&
															selection.project.id === project.id,
													)}
													onSelect={
														isMentionMode
															? () => handleSelectProject(project)
															: undefined
													}
													onDrillIn={() => handleProjectDrillIn(project)}
												/>
											</div>
										))
									)
								) : isSearching ? (
									searchResults.length === 0 ? (
										<div
											className="flex items-center justify-center px-6 py-12 text-center text-[14px] text-muted-foreground"
											data-testid="select-directory-mobile-search-empty"
										>
											<div className="flex items-center gap-2">
												<Search className="size-4 shrink-0" />
												<span>{effectiveSearchEmptyDescription}</span>
											</div>
										</div>
									) : (
										searchResults.map(({ directory, pathLabel }) => {
											const directoryId = getItemId(directory)
											const isDisabled =
												disabledFolderIds.includes(directoryId)
											return (
												<DirectoryCard key={directoryId}>
													<DirectoryRow
														directory={directory}
														resourceTree={activeAttachments}
														secondaryText={pathLabel || undefined}
														selected={
															isResourceSelectionMode
																? selectedAttachmentIds.has(
																		directoryId,
																	)
																: selectedDirectoryId ===
																	directoryId
														}
														disabled={isDisabled}
														onSelect={() =>
															handleSelectDirectory(directory, true)
														}
														onDrillIn={
															hasChildDirectories(directory)
																? () =>
																		handleDrillIn(
																			directory,
																			true,
																		)
																: undefined
														}
													/>
												</DirectoryCard>
											)
										})
									)
								) : (
									<>
										{!isResourceSelectionMode && pathStack.length === 0 ? (
											<DirectoryCard>
												<RootRow
													rootLabel={rootLabel}
													selected={selectedDirectoryId === "root"}
													onSelect={handleSelectRoot}
												/>
											</DirectoryCard>
										) : null}
										{currentDirectories.length === 0 ? (
											<div
												className="px-6 py-12 text-center text-[14px] text-muted-foreground"
												data-testid="select-directory-mobile-empty"
											>
												{emptyTip}
											</div>
										) : (
											currentDirectories.map((directory) => {
												const directoryId = getItemId(directory)
												const isDisabled =
													disabledFolderIds.includes(directoryId)
												return (
													<DirectoryCard key={directoryId}>
														<DirectoryRow
															directory={directory}
															resourceTree={activeAttachments}
															selected={
																isResourceSelectionMode
																	? selectedAttachmentIds.has(
																			directoryId,
																		)
																	: selectedDirectoryId ===
																		directoryId
															}
															disabled={isDisabled}
															onSelect={() =>
																handleSelectDirectory(directory)
															}
															onDrillIn={
																hasChildDirectories(directory)
																	? () => handleDrillIn(directory)
																	: undefined
															}
														/>
													</DirectoryCard>
												)
											})
										)}
									</>
								)}
							</div>
						)}
					</ScrollEdgeFadeContainer>

					<div
						className="relative z-10 shrink-0 bg-muted"
						data-testid="select-directory-mobile-search-dock"
					>
						<MobileBottomSearchBar
							value={query}
							placeholder={effectiveSearchPlaceholder}
							clearAriaLabel={clearSearchAriaLabel}
							onValueChange={handleSearchValueChange}
							testIdPrefix="select-directory-mobile-search"
						/>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	)
}

export default MobileFilesMoveSheet
