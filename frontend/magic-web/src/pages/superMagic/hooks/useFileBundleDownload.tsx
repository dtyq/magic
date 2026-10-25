import { useEffect, useRef, useState, type ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"
import { IMAGE_EXTENSIONS } from "@/constants/file"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { FileDownloadData, FileDownloadItem } from "../components/Detail/types"
import { useFileApi } from "../fileAccess/fileApi"
import { DownloadImageMode } from "../pages/Workspace/types"
import { downloadFileWithAnchor } from "../utils/handleFIle"
import { useDownloadImageMenu } from "@/pages/superMagic/components/Detail/contents/Image/hooks/useDownloadImageMenu"
import { useDownloadProgress } from "./useDownloadProgress"
import {
	FileBundleCapacityError,
	FileBundleDownloadError,
	packAndDownloadFileEntries,
} from "../services/fileBundleDownload"

export const FILE_BUNDLE_DOWNLOAD_LIMITS = {
	desktopBytes: 256 * 1024 * 1024,
	mobileBytes: 64 * 1024 * 1024,
	concurrency: 4,
} as const

export interface FileBundleDownloadState {
	toolId?: string
	fileId?: string
	phase: "idle" | "running" | "saved" | "error" | "cancelled"
	error?: string
	failedFiles?: string[]
}

export interface FileBundleDownloadCapability {
	state: FileBundleDownloadState
	progress: number
	canDownload: boolean
	noWatermarkRequiresVip: boolean
	start: (toolId: string, data: FileDownloadData, noWatermark?: boolean) => void
	startFile: (
		toolId: string,
		data: FileDownloadData,
		fileId: string,
		noWatermark?: boolean,
	) => void
	cancel: () => void
	agreementModal: ReactNode
}

interface DownloadTarget {
	toolId: string
	data: FileDownloadData
	scopeKey: string
	fileId?: string
}

function isDownloadImage(item: FileDownloadItem): boolean {
	return IMAGE_EXTENSIONS.includes(item.file_name.split(".").pop()?.toLowerCase() || "")
}

export function containsDownloadImages(data: FileDownloadData): boolean {
	return data.items.some(isDownloadImage)
}

/** 挂在消息列表而不是虚拟行：滚动卸载卡片不取消，切换话题／身份才取消。 */
export function useFileBundleDownload(
	topicKey: string,
	filesStore: ProjectFilesStore,
	allowDownload = true,
): FileBundleDownloadCapability {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const fileApi = useFileApi()
	const { startCustomDownload, cancelDownload, progress } = useDownloadProgress()
	const [state, setState] = useState<FileBundleDownloadState>({ phase: "idle" })
	const running = useRef(false)
	const runVersion = useRef(0)
	const pendingTarget = useRef<DownloadTarget>()
	const scopeKey = `${topicKey}:${fileApi.identityKey}`

	const execute = useMemoizedFn(async (mode: DownloadImageMode, target?: DownloadTarget) => {
		if (!target || target.scopeKey !== scopeKey || !allowDownload || running.current) return
		if (
			filesStore.currentSelectedProject?.id &&
			String(filesStore.currentSelectedProject.id) !== target.data.project_id
		)
			return
		const selectedFile = target.fileId
			? target.data.items.find((item) => item.file_id === target.fileId)
			: undefined
		if (target.fileId && !selectedFile) return
		const maxBytes = isMobile
			? FILE_BUNDLE_DOWNLOAD_LIMITS.mobileBytes
			: FILE_BUNDLE_DOWNLOAD_LIMITS.desktopBytes
		// 单文件交给浏览器直接保存，不经过 ZIP 内存缓冲，打包容量限制仅适用于集合。
		if (!selectedFile && target.data.total_bytes > maxBytes) {
			setState({ toolId: target.toolId, phase: "error", error: t("fileDownload.tooLarge") })
			return
		}
		running.current = true
		const currentRun = ++runVersion.current
		const taskIdentity = { toolId: target.toolId, fileId: target.fileId }
		setState({ ...taskIdentity, phase: "running" })
		try {
			await startCustomDownload({
				label: selectedFile
					? t("fileDownload.downloadingFile", { name: selectedFile.file_name })
					: t("fileDownload.downloading"),
				task: async ({ signal, reportProgress }) => {
					if (selectedFile) {
						const urls = await fileApi.getTemporaryDownloadUrl({
							file_ids: [selectedFile.file_id],
							download_mode: isDownloadImage(selectedFile)
								? mode
								: DownloadImageMode.Download,
							is_download: true,
						})
						if (signal.aborted) throw new DOMException("Download aborted", "AbortError")
						const url = urls.find((item) => item.file_id === selectedFile.file_id)?.url
						if (!url) throw new Error("No authorized download URL was returned")
						await downloadFileWithAnchor(url, selectedFile.file_name)
						reportProgress(100)
						return
					}
					return packAndDownloadFileEntries(
						target.data.items.map((item) => ({
							key: item.file_id,
							file: item,
							// 高清接口只服务图片；混合文件集合中的其他类型走普通文件授权。
							downloadMode: isDownloadImage(item) ? mode : DownloadImageMode.Download,
						})),
						undefined,
						target.data.archive_name,
						{
							signal,
							onProgress: reportProgress,
							fileApi,
							maxBytes,
							concurrency: FILE_BUNDLE_DOWNLOAD_LIMITS.concurrency,
							failureMode: "all_required",
							pathMode: "workspace_relative",
						},
					)
				},
				onSuccess: () => setState({ ...taskIdentity, phase: "saved" }),
				onCancel: () => setState({ ...taskIdentity, phase: "cancelled" }),
				onError: (error) =>
					setState({
						...taskIdentity,
						phase: "error",
						error:
							error instanceof FileBundleCapacityError
								? t("fileDownload.tooLarge")
								: t(
										selectedFile
											? "fileDownload.fileFailed"
											: "fileDownload.failed",
									),
						failedFiles:
							error instanceof FileBundleDownloadError
								? error.results
										.filter((item) => !item.success)
										.map((item) => item.fileName)
								: selectedFile
									? [selectedFile.relative_file_path]
									: undefined,
					}),
			})
		} finally {
			if (runVersion.current === currentRun) running.current = false
		}
	})
	// 使用图片预览的正式入口；商业覆盖在这里处理 VIP，公共实现处理协议，不复制会员流程。
	const policy = useDownloadImageMenu({
		onDownload: (mode) => {
			const target = pendingTarget.current
			pendingTarget.current = undefined
			void execute(mode ?? DownloadImageMode.NormalDownload, target)
		},
	})
	const requestDownload = useMemoizedFn((target: DownloadTarget, noWatermark: boolean) => {
		if (running.current || !allowDownload) return
		const hasImages = target.fileId
			? target.data.items.some(
					(item) => item.file_id === target.fileId && isDownloadImage(item),
				)
			: containsDownloadImages(target.data)
		if (hasImages && noWatermark) {
			pendingTarget.current = target
			policy.preloadWaterMarkFreeModal()
			policy.handleDownloadNoWaterMark()
		} else {
			// 用户取消勾选后明确走普通图片模式，不被全局无水印偏好重新覆盖。
			void execute(DownloadImageMode.NormalDownload, target)
		}
	})
	const start = useMemoizedFn((toolId: string, data: FileDownloadData, noWatermark = true) => {
		requestDownload({ toolId, data, scopeKey }, noWatermark)
	})
	const startFile = useMemoizedFn(
		(toolId: string, data: FileDownloadData, fileId: string, noWatermark = true) => {
			requestDownload({ toolId, data, scopeKey, fileId }, noWatermark)
		},
	)
	const cancel = useMemoizedFn(() => {
		pendingTarget.current = undefined
		runVersion.current += 1
		running.current = false
		cancelDownload()
	})
	useEffect(() => {
		pendingTarget.current = undefined
		runVersion.current += 1
		cancelDownload()
		running.current = false
		setState({ phase: "idle" })
		return () => cancelDownload()
	}, [scopeKey, allowDownload, cancelDownload])

	return {
		state,
		progress,
		canDownload: allowDownload,
		noWatermarkRequiresVip: policy.isFreeTrialVersion,
		start,
		startFile,
		cancel,
		agreementModal: policy.agreementModal,
	}
}
