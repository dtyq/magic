import { FilePlus2, Pencil, RefreshCw, Save, X } from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import EditorBody from "@/pages/superMagic/components/Detail/contents/Md/components/EditorBody"
import type { MagicFSFile } from "@/apis"
import { memoryFileService } from "../services/memoryFileService"
import {
	userSpaceFileService,
	UserFileConcurrentModificationError,
	type UserFileSnapshot,
} from "../../UserSpace/services/userSpaceFileService"
import { mergeMemoryContent } from "../services/memoryThreeWayMerge"
import { MemoryEditConflictDialog } from "./MemoryEditConflictDialog"
import { GlobalMemoryUsageGuide } from "./GlobalMemoryUsageGuide"

type GlobalMemoryLoadState = "loading" | "ready" | "empty" | "error"

/** 编辑期间检测到的服务器最新快照。 */
interface MemoryConflictState {
	latestSnapshot: UserFileSnapshot
}

/** 个人中心全局长期记忆单文件编辑器。 */
export const GlobalMemoryEditor = memo(function GlobalMemoryEditor() {
	const { t } = useTranslation("super/longMemory")
	const requestIdRef = useRef(0)
	const [loadState, setLoadState] = useState<GlobalMemoryLoadState>("loading")
	const [memoryFile, setMemoryFile] = useState<MagicFSFile | null>(null)
	const [content, setContent] = useState("")
	const [draft, setDraft] = useState("")
	const [baseContent, setBaseContent] = useState("")
	const [baseRevision, setBaseRevision] = useState<number | null>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [enteringEdit, setEnteringEdit] = useState(false)
	const [saving, setSaving] = useState(false)
	const [conflictState, setConflictState] = useState<MemoryConflictState | null>(null)
	const isMemoryEmpty = content.trim() === ""

	/** 加载固定路径 global/MEMORY.md 的最新内容。 */
	const loadGlobalMemory = useCallback(async () => {
		const requestId = ++requestIdRef.current
		setLoadState("loading")
		setIsEditing(false)
		setConflictState(null)

		try {
			const file = await memoryFileService.findGlobalMemoryFile()
			if (requestId !== requestIdRef.current) return
			if (!file) {
				setMemoryFile(null)
				setContent("")
				setDraft("")
				setBaseContent("")
				setBaseRevision(null)
				setLoadState("empty")
				return
			}

			const snapshot = await userSpaceFileService.readStableSnapshot(file.id)
			if (requestId !== requestIdRef.current) return
			setMemoryFile(snapshot.file)
			setContent(snapshot.content)
			setDraft(snapshot.content)
			setBaseContent(snapshot.content)
			setBaseRevision(snapshot.revision)
			setLoadState("ready")
		} catch (error) {
			if (requestId !== requestIdRef.current) return
			console.error("加载全局长期记忆失败", error)
			setLoadState("error")
		}
	}, [])

	useEffect(() => {
		void loadGlobalMemory()
		return () => {
			requestIdRef.current += 1
		}
	}, [loadGlobalMemory])

	/** 拉取冲突发生后的服务器最新稳定快照。 */
	const loadConflictSnapshot = useCallback(async (fileId: string) => {
		const latestSnapshot = await userSpaceFileService.readStableSnapshot(fileId)
		setConflictState({ latestSnapshot })
	}, [])

	/** 使用指定编辑基准保存当前草稿。 */
	const saveGlobalMemory = useCallback(
		async (expectedRevision: number | null = baseRevision) => {
			setSaving(true)
			let targetFile = memoryFile
			let targetRevision = expectedRevision
			try {
				if (!targetFile || targetRevision === null) {
					const snapshot = await memoryFileService.ensureGlobalMemoryFile()
					targetFile = snapshot.file
					targetRevision = snapshot.revision
					setMemoryFile(snapshot.file)

					if (snapshot.content !== baseContent) {
						setConflictState({ latestSnapshot: snapshot })
						return
					}
				}

				const result = await userSpaceFileService.saveFileContent(
					targetFile.id,
					draft,
					targetRevision,
				)
				setMemoryFile({
					...targetFile,
					version: result.revision,
				})
				setContent(draft)
				setBaseContent(draft)
				setBaseRevision(result.revision)
				setLoadState("ready")
				setConflictState(null)
				setIsEditing(false)
				magicToast.success(t("globalEditor.saveSuccess"))
			} catch (error) {
				console.error("保存全局长期记忆失败", error)
				if (error instanceof UserFileConcurrentModificationError) {
					try {
						if (targetFile) {
							await loadConflictSnapshot(targetFile.id)
						} else {
							magicToast.error(t("globalEditor.editLoadFailed"))
						}
					} catch (snapshotError) {
						console.error("加载冲突后的最新长期记忆失败", snapshotError)
						magicToast.error(t("globalEditor.editLoadFailed"))
					}
				} else {
					magicToast.error(t("globalEditor.saveFailed"))
				}
			} finally {
				setSaving(false)
			}
		},
		[baseContent, baseRevision, draft, loadConflictSnapshot, memoryFile, t],
	)

	/** 取消编辑并恢复最后一次成功加载或保存的内容。 */
	const cancelEditing = useCallback(() => {
		setDraft(content)
		setConflictState(null)
		setIsEditing(false)
	}, [content])

	/** 拉取最新稳定快照后进入 Markdown 源码编辑模式。 */
	const startEditing = useCallback(async () => {
		if (!memoryFile) {
			setDraft(content)
			setBaseContent(content)
			setBaseRevision(null)
			setConflictState(null)
			setIsEditing(true)
			return
		}

		setEnteringEdit(true)
		try {
			const snapshot = await userSpaceFileService.readStableSnapshot(memoryFile.id)
			setMemoryFile(snapshot.file)
			setContent(snapshot.content)
			setDraft(snapshot.content)
			setBaseContent(snapshot.content)
			setBaseRevision(snapshot.revision)
			setConflictState(null)
			setIsEditing(true)
		} catch (error) {
			console.error("进入编辑前加载最新长期记忆失败", error)
			magicToast.error(t("globalEditor.editLoadFailed"))
		} finally {
			setEnteringEdit(false)
		}
	}, [content, memoryFile, t])

	/** 主动获取并展示服务器上的最新长期记忆内容。 */
	const refreshLatestContent = useCallback(async () => {
		setRefreshing(true)
		try {
			const latestFile = memoryFile ?? (await memoryFileService.findGlobalMemoryFile())
			if (!latestFile) {
				setContent("")
				setDraft("")
				setBaseContent("")
				setBaseRevision(null)
				setConflictState(null)
				setLoadState("empty")
				magicToast.success(t("globalEditor.refreshSuccess"))
				return
			}

			const snapshot = await userSpaceFileService.readStableSnapshot(latestFile.id)
			setMemoryFile(snapshot.file)
			setContent(snapshot.content)
			setDraft(snapshot.content)
			setBaseContent(snapshot.content)
			setBaseRevision(snapshot.revision)
			setConflictState(null)
			setLoadState("ready")
			magicToast.success(t("globalEditor.refreshSuccess"))
		} catch (error) {
			console.error("刷新全局长期记忆失败", error)
			magicToast.error(t("globalEditor.refreshFailed"))
		} finally {
			setRefreshing(false)
		}
	}, [memoryFile, t])

	/** 放弃本地草稿并切换到服务器最新内容。 */
	const useLatestContent = useCallback(() => {
		if (!conflictState) return

		const { latestSnapshot } = conflictState
		setMemoryFile(latestSnapshot.file)
		setContent(latestSnapshot.content)
		setDraft(latestSnapshot.content)
		setBaseContent(latestSnapshot.content)
		setBaseRevision(latestSnapshot.revision)
		setConflictState(null)
		setIsEditing(false)
	}, [conflictState])

	/** 将本地草稿与服务器最新内容进行三方合并后继续编辑。 */
	const mergeLatestContent = useCallback(() => {
		if (!conflictState) return

		const { latestSnapshot } = conflictState
		const mergeResult = mergeMemoryContent(baseContent, draft, latestSnapshot.content, {
			local: t("globalEditor.conflict.localLabel"),
			remote: t("globalEditor.conflict.remoteLabel"),
		})

		setMemoryFile(latestSnapshot.file)
		setContent(latestSnapshot.content)
		setBaseContent(latestSnapshot.content)
		setBaseRevision(latestSnapshot.revision)
		setDraft(mergeResult.content)
		setConflictState(null)
		setIsEditing(true)
		magicToast.info(
			t(
				mergeResult.hasConflicts
					? "globalEditor.conflict.mergeHasConflicts"
					: "globalEditor.conflict.mergeReady",
			),
		)
	}, [baseContent, conflictState, draft, t])

	/** 以刚获取的服务器最新修订号重试覆盖保存。 */
	const overwriteLatestContent = useCallback(() => {
		if (!conflictState) return
		void saveGlobalMemory(conflictState.latestSnapshot.revision)
	}, [conflictState, saveGlobalMemory])

	if (loadState === "loading") {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
				<RefreshCw className="mr-2 size-4 animate-spin" />
				{t("loading")}
			</div>
		)
	}

	if (loadState === "error") {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
				<div className="text-sm text-muted-foreground">{t("globalEditor.loadFailed")}</div>
				<Button variant="outline" size="sm" onClick={() => void loadGlobalMemory()}>
					{t("fileTree.retry")}
				</Button>
			</div>
		)
	}

	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col border-t border-border">
				<div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
					<div className="min-w-0">
						<div className="truncate text-sm font-medium">
							~/.magic/memory/global/MEMORY.md
						</div>
						<div className="text-xs text-muted-foreground">
							{t("globalEditor.pathDescription")}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{isEditing ? (
							<>
								<Button
									variant="outline"
									size="sm"
									disabled={saving}
									onClick={cancelEditing}
								>
									<X size={16} />
									{t("cancel")}
								</Button>
								<Button
									size="sm"
									disabled={saving}
									onClick={() => void saveGlobalMemory()}
								>
									<Save size={16} />
									{t("globalEditor.save")}
								</Button>
							</>
						) : (
							<>
								<Button
									variant="outline"
									size="sm"
									className="h-8 w-20"
									disabled={refreshing || enteringEdit}
									onClick={() => void refreshLatestContent()}
								>
									<RefreshCw
										className={refreshing ? "animate-spin" : undefined}
										size={16}
									/>
									{t("globalEditor.refresh")}
								</Button>
								<Button
									size="sm"
									className="h-8 w-20"
									disabled={enteringEdit || refreshing}
									onClick={() => void startEditing()}
								>
									{enteringEdit ? (
										<RefreshCw className="animate-spin" size={16} />
									) : !isMemoryEmpty ? (
										<Pencil size={16} />
									) : (
										<FilePlus2 size={16} />
									)}
									{t(!isMemoryEmpty ? "edit" : "globalEditor.create")}
								</Button>
							</>
						)}
					</div>
				</div>
				<GlobalMemoryUsageGuide />
				<div className="min-h-0 flex-1 overflow-hidden">
					{isMemoryEmpty && !isEditing ? (
						<div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
							<div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
								<FilePlus2 size={24} />
							</div>
							<div>
								<div className="text-sm font-medium">
									{t("globalEditor.emptyTitle")}
								</div>
								<div className="mt-1 text-sm text-muted-foreground">
									{t("globalEditor.emptyDescription")}
								</div>
							</div>
							<Button size="sm" onClick={() => void startEditing()}>
								<FilePlus2 size={16} />
								{t("globalEditor.create")}
							</Button>
						</div>
					) : (
						<EditorBody
							isLoading={false}
							viewMode={isEditing ? "code" : "markdown"}
							language="markdown"
							content={content}
							processedContent={content}
							className={
								isEditing
									? "h-full min-h-0 overflow-hidden"
									: "h-full overflow-auto px-5 py-4 [&_.simple-editor]:!p-0"
							}
							isEditMode={isEditing}
							editContent={draft}
							setEditContent={setDraft}
							onSave={() => void saveGlobalMemory()}
							placeholder={t("globalEditor.placeholder")}
							data-testid="global-memory-editor"
						/>
					)}
				</div>
			</div>
			<MemoryEditConflictDialog
				open={Boolean(conflictState)}
				loading={saving}
				onCancel={() => setConflictState(null)}
				onUseLatest={useLatestContent}
				onMerge={mergeLatestContent}
				onOverwrite={overwriteLatestContent}
			/>
		</>
	)
})
