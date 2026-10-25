import { useEffect, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import type { MagicFSFile } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import userFilesStore from "@/stores/userFiles"
import TopicFilesPanel from "../TopicFilesButton/TopicFilesPanel"
import { FileManager } from "../TopicFilesButton/components/FileManager/FileManager"
import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import { FileResourceIcon } from "../TopicFilesButton/components/FileResourceIcon"
import { UserSpaceFileTag } from "../TopicFilesButton/components/TopicFileTag"
import {
	resolveFilePresentation,
	getFilePresentationIndex,
} from "../TopicFilesButton/utils/file-presentation"
import { getUserResourceKind } from "./userSpaceFilePresentation"
import { toUserAttachment } from "./services/userSpaceFileService"
import { useUserSpaceFileActions } from "./hooks/useUserSpaceFileActions"
import { SidebarExpandableItem, type SidebarSectionOptions } from "../SidebarSection"
import type { FileManagerProps } from "../TopicFilesButton/components/FileManager/types"
import { useUserFileManagerDirectory } from "./hooks/useUserFileManagerDirectory"

export interface UserSpaceFilesViewProps {
	onPreviewFile?: FileManagerProps["onPreviewFile"]
	onPreviewRemoved?: FileManagerProps["onPreviewRemoved"]
	initialState?: FileManagerProps["initialState"]
	onStateChange?: FileManagerProps["onStateChange"]
	hidePlaces?: boolean
	defaultView?: "list" | "grid"
	defaultWritePath?: string
	directoryId?: string
	onDirectoryChange: (id?: string) => void
	onFileClick?: (file: AttachmentItem) => void
	activeFileId?: string | null
	topicId?: string | null
	compact?: boolean
	/** 缺失范围仍显示文件 UI；路径是视图身份，null 不得回退到用户根目录。 */
	scope?: {
		path: string
		rootId: string | null
		loading: boolean
		error: boolean
		onRefresh: () => void
	}
	rootName?: string
	resolveParent?: () => Promise<MagicFSFile>
	headerTrailingAction?: ReactNode
	section?: SidebarSectionOptions
	contentBefore?: ReactNode
	active?: boolean
	scrollElementRef?: React.RefObject<HTMLElement>
}

export default observer(function UserSpaceFilesView({
	hidePlaces,
	defaultView,
	defaultWritePath,
	directoryId,
	onDirectoryChange,
	onFileClick,
	onPreviewFile,
	onPreviewRemoved,
	activeFileId,
	topicId,
	compact = true,
	scope,
	rootName,
	resolveParent,
	headerTrailingAction,
	section,
	contentBefore,
	active = true,
	scrollElementRef,
	initialState,
	onStateChange,
}: UserSpaceFilesViewProps) {
	const { t } = useTranslation("super")
	const identity = userFilesStore.currentIdentityKey
	const mutationVersion = userFilesStore.mutationVersion
	const hasScope = Boolean(scope)
	const rootId = scope ? scope.rootId : userFilesStore.rootId
	const parentId = hasScope && !rootId ? null : compact ? rootId : (directoryId ?? rootId)
	const state = parentId ? userFilesStore.getDirectory(parentId) : undefined
	const rootState = userFilesStore.getDirectory()
	const loading = scope?.loading || (parentId ? !state?.loaded || state.loading : !scope)
	const error = Boolean(scope?.error || state?.error || rootState.error)
	const viewKey = scope?.path ?? "root"
	const path = parentId ? userFilesStore.getPath(parentId) : []
	const items = parentId ? userFilesStore.getTree(parentId) : []
	const restoredDirectory = useUserFileManagerDirectory({
		enabled:
			active &&
			!compact &&
			(!scope || (Boolean(scope.rootId) && !scope.loading && !scope.error)),
		directoryId,
		rootId: scope?.rootId ?? undefined,
		initialState,
		onDirectoryChange,
	})
	useEffect(() => {
		if (!active || !compact || (hasScope && !rootId)) return
		void userFilesStore
			.getRoot()
			.then((root) => {
				if (identity !== userFilesStore.currentIdentityKey) return
				const baseId = rootId ?? root.id
				return userFilesStore.loadTree(compact ? (parentId ?? baseId) : baseId).then(() => {
					if (
						identity !== userFilesStore.currentIdentityKey ||
						!parentId ||
						parentId === baseId
					)
						return
					return userFilesStore.loadTree(parentId)
				})
			})
			.catch(() => undefined)
	}, [identity, parentId, rootId, hasScope, active, mutationVersion, compact])
	const parent = async () => {
		if (scope && (scope.loading || scope.error)) throw new Error("Directory is unavailable")
		if (resolveParent && (!parentId || !directoryId || directoryId === scope?.rootId))
			return resolveParent()
		if (scope && !parentId) throw new Error("Directory is unavailable")
		const root = await userFilesStore.getRoot()
		const file = userFilesStore.files.get(parentId ?? root.id)
		if (!file?.is_directory) throw new Error("Directory is unavailable")
		return file
	}
	const { spaceConfig, isSelectable, filterMenuItems } = useUserSpaceFileActions({
		rootId: parentId ?? undefined,
		resolveParent: parent,
		viewKey: scope ? `${viewKey}:${directoryId ?? "root"}` : (parentId ?? "root"),
		locateFileId: compact ? directoryId : undefined,
		topicId,
	})
	const refresh = async () => {
		if (!compact) restoredDirectory.retry()
		if (scope) {
			scope.onRefresh()
			if (parentId) await userFilesStore.loadTree(parentId, true)
			return
		}
		const root = await userFilesStore.getRoot()
		if (identity !== userFilesStore.currentIdentityKey) return
		await userFilesStore.loadTree(parentId ?? root.id, true)
	}
	const renderSection = (content: ReactNode) =>
		section ? (
			<SidebarExpandableItem
				wrapLabel
				label={rootName ?? t("userSpace.title")}
				{...section}
				testId="memory-manager-section"
			>
				{section.description}
				{content}
			</SidebarExpandableItem>
		) : compact ? (
			<>
				<h3 className="shrink-0 break-words px-3 py-2 text-[13px] font-medium leading-5 [overflow-wrap:anywhere]">
					{rootName ?? t("userSpace.allFiles")}
				</h3>
				{content}
			</>
		) : (
			content
		)
	if (!scope && error && (compact || !parentId))
		return renderSection(
			<div role="alert" className="p-3 text-xs">
				{t("userSpace.loadFailed")}
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void refresh().catch(() => undefined)}
				>
					{t("userSpace.retry")}
				</Button>
			</div>,
		)
	if (!scope && (!parentId || !spaceConfig.directorySource))
		return renderSection(
			<p className="p-3 text-xs text-muted-foreground">{t("userSpace.loading")}</p>,
		)
	const file = parentId ? userFilesStore.files.get(parentId) : undefined
	const operationRoot = file
		? toUserAttachment(file, path.map((node) => node.name).join("/"))
		: undefined
	const commonProps = {
		attachments: items,
		onFileClick,
		activeFileId,
		spaceConfig,
		operationRoot,
		isItemSelectable: isSelectable,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems: filterMenuItems,
		resolveTopicFileRowDecoration: ({
			item,
			isVirtual,
		}: {
			item: AttachmentItem
			isVirtual: boolean
		}) =>
			isVirtual
				? undefined
				: {
						icon: (
							<FileResourceIcon
								presentation={resolveFilePresentation(item, {
									context: { kind: "user" },
									index: getFilePresentationIndex(items),
								})}
								size={16}
							/>
						),
						tag:
							getUserResourceKind(item) || item.directoryLoadState === "error" ? (
								<>
									<UserSpaceFileTag item={item} />
									{item.directoryLoadState === "error" ? (
										<span className="text-xs text-destructive">
											{t("userSpace.retry")}
										</span>
									) : null}
								</>
							) : undefined,
					},
	}
	if (compact)
		return (
			<TopicFilesPanel
				headerLayout="adaptive"
				key={`${identity}:${viewKey}`}
				{...commonProps}
				title={rootName ?? t("userSpace.allFiles")}
				loading={Boolean(loading)}
				fitContent={Boolean(scope)}
				showEmptyState={!(scope && (error || contentBefore))}
				scrollElementRef={scrollElementRef}
				refreshAttachments={refresh}
				headerTrailingAction={headerTrailingAction}
				section={section}
				contentBefore={
					error ? (
						<div role="alert" className="p-3 text-xs">
							{t("userSpace.loadFailed")}
							<Button
								variant="ghost"
								size="sm"
								onClick={() => void refresh().catch(() => undefined)}
							>
								{t("userSpace.retry")}
							</Button>
						</div>
					) : (
						contentBefore
					)
				}
			/>
		)
	const content = (
		<FileManager
			onPreviewFile={onPreviewFile}
			onPreviewRemoved={onPreviewRemoved}
			initialState={initialState}
			onStateChange={onStateChange}
			dataReady={
				scope && scope.rootId === null
					? !scope.loading && !scope.error
					: restoredDirectory.ready
			}
			hidePlaces={hidePlaces}
			defaultView={defaultView}
			defaultWritePath={defaultWritePath}
			key={`${identity}:${viewKey}`}
			scopeKey={`${identity}:user:${viewKey}`}
			identityKey={identity ?? ""}
			rootId={rootId}
			rootName={rootName ?? t("userSpace.title")}
			initialDirectoryId={directoryId}
			attachments={rootId ? userFilesStore.getTree(rootId) : []}
			context={{ kind: "user" }}
			isActive={active}
			loading={Boolean(loading)}
			error={error || Boolean(restoredDirectory.error)}
			onRefresh={() => void refresh().catch(() => undefined)}
			onOpen={(item) => onFileClick?.(item)}
			onDirectoryChange={onDirectoryChange}
			renderTag={(item) => <UserSpaceFileTag item={item} />}
			spaceConfig={spaceConfig}
			isItemMutable={isSelectable}
			allowEdit
			allowDownload
		/>
	)
	return renderSection(
		<>
			{contentBefore}
			{content}
		</>,
	)
})
