import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import type {
	FileManagerContext,
	FileManagerStateChangeOptions,
} from "../Detail/components/FilesViewer/types"
import type { UserFileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import { getFileReferenceIdentityKey } from "../../services/userFileReferenceResolver"
import type { AttachmentItem } from "../TopicFilesButton/hooks/types"
import UserSpaceFilesView from "./UserSpaceFilesView"
import UserSpaceMemoryManager from "./UserSpaceMemoryManager"

import type { FileManagerProps } from "../TopicFilesButton/components/FileManager/types"

export default function UserSpaceFileManager({
	context,
	onFileClick,
	onPreviewFile,
	onPreviewRemoved,
	projectId,
	projectName,
	topicId,
	isActive = true,
	initialState,
	onStateChange,
}: {
	onPreviewFile?: FileManagerProps["onPreviewFile"]
	onPreviewRemoved?: FileManagerProps["onPreviewRemoved"]
	context: Extract<FileManagerContext, { spaceType: "user" }>
	onFileClick: (file: AttachmentItem) => void
	projectId?: string
	projectName?: string
	topicId?: string
	isActive?: boolean
	initialState?: UserFileManagerSnapshot
	onStateChange: (state: UserFileManagerSnapshot, options: FileManagerStateChangeOptions) => void
}) {
	const { t } = useTranslation("super")
	const [view, setView] = useState(context.view)
	const saved = useRef<UserFileManagerSnapshot>(
		initialState
			? { ...initialState, view: context.view }
			: {
					spaceType: "user",
					identityKey: getFileReferenceIdentityKey() ?? "",
					view: context.view,
				},
	)
	const [directoryId, setDirectoryId] = useState(
		context.directoryId ?? (saved.current.filesLocation?.directoryId || undefined),
	)
	const previousContext = useRef(context)
	const updateState = useMemoizedFn(
		(patch: Partial<UserFileManagerSnapshot>, options: FileManagerStateChangeOptions = {}) => {
			saved.current = { ...saved.current, ...patch }
			onStateChange(saved.current, options)
		},
	)
	const changeView = (next: UserFileManagerSnapshot["view"]) => {
		setView(next)
		updateState({ view: next }, { userInteraction: true })
	}
	useEffect(() => {
		if (previousContext.current === context) return
		previousContext.current = context
		setView(context.view)
		setDirectoryId(
			context.directoryId ?? (saved.current.filesLocation?.directoryId || undefined),
		)
		updateState({ view: context.view })
	}, [context, updateState])
	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<div
				className="flex shrink-0 gap-1 border-b px-3 py-1"
				role="tablist"
				aria-label={t("userSpace.title")}
			>
				<Button
					role="tab"
					aria-selected={view === "files"}
					variant={view === "files" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => changeView("files")}
				>
					{t("userSpace.allFiles")}
				</Button>
				<Button
					role="tab"
					aria-selected={view === "memory"}
					variant={view === "memory" ? "secondary" : "ghost"}
					size="sm"
					onClick={() => changeView("memory")}
				>
					{t("userSpace.memory")}
				</Button>
			</div>
			{view === "memory" ? (
				<UserSpaceMemoryManager
					initialState={saved.current.memory}
					onStateChange={(memory, options) => updateState({ memory }, options)}
					active={isActive}
					projectId={projectId}
					projectName={projectName}
					topicId={topicId}
					onFileClick={onFileClick}
				/>
			) : (
				<UserSpaceFilesView
					onPreviewFile={onPreviewFile}
					onPreviewRemoved={onPreviewRemoved}
					initialState={saved.current.filesLocation}
					onStateChange={(filesLocation, options) =>
						updateState({ filesLocation }, options)
					}
					compact={false}
					active={isActive}
					directoryId={directoryId}
					onDirectoryChange={setDirectoryId}
					topicId={topicId}
					onFileClick={onFileClick}
				/>
			)}
		</div>
	)
}
