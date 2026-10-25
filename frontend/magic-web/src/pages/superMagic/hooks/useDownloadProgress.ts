import { createElement, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import magicToast from "@/components/base/MagicToaster/utils"
import { createRandomUuidV4 } from "@/utils/create-random-uuid-v4"
import DownloadProgressToast from "@/pages/superMagic/components/DownloadProgressToast"

const DEFAULT_POLL_INTERVAL_MS = 2000
const DEFAULT_SUCCESS_VISIBLE_MS = 500

interface BatchDownloadTaskResponse {
	status?: "ready" | "processing" | "failed" | string
	batch_key?: string
	download_url?: string
	progress?: number | string
	message?: string
}

export interface StartDownloadOptions {
	fileIds: string[]
	projectId?: string
	fileName?: string
	target?: string
	token?: string
	label?: string
	allowEmptyFileIds?: boolean
	pollIntervalMs?: number
	successVisibleMs?: number
	cancelText?: string
	onSuccess?: () => void
	onError?: (error: unknown) => void
	onCancel?: () => void
}

export interface CustomDownloadTaskContext {
	signal: AbortSignal
	reportProgress: (progress: number) => void
}

export interface StartCustomDownloadOptions<TResult = void> {
	label?: string
	successVisibleMs?: number
	cancelText?: string
	task: (context: CustomDownloadTaskContext) => Promise<TResult>
	onSuccess?: (result: TResult) => void
	onError?: (error: unknown) => void
	onCancel?: () => void
}

interface DownloadProgressState {
	isDownloading: boolean
	progress: number
	label?: string
}

function normalizeProgress(progress: unknown): number {
	const value = Number(progress)
	if (!Number.isFinite(value)) return 0
	return Math.min(Math.max(value, 0), 100)
}

function createDownloadError(message?: string) {
	return new Error(message || "Download failed")
}

export function useDownloadProgress() {
	const { t } = useTranslation("super")
	const [state, setState] = useState<DownloadProgressState>({
		isDownloading: false,
		progress: 0,
	})
	const taskIdRef = useRef(0)
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const settleRef = useRef<((result: boolean) => void) | null>(null)
	const onCancelRef = useRef<(() => void) | undefined>()
	const taskAbortControllerRef = useRef<AbortController | null>(null)
	const toastIdRef = useRef<string | number | null>(null)
	const labelRef = useRef<string | undefined>()
	const cancelTextRef = useRef<string | undefined>()

	const clearPollTimer = useCallback(() => {
		if (pollTimerRef.current) {
			clearInterval(pollTimerRef.current)
			pollTimerRef.current = null
		}
	}, [])

	const clearResetTimer = useCallback(() => {
		if (resetTimerRef.current) {
			clearTimeout(resetTimerRef.current)
			resetTimerRef.current = null
		}
	}, [])

	const settle = useCallback((result: boolean) => {
		settleRef.current?.(result)
		settleRef.current = null
	}, [])

	const dismissDownloadToast = useCallback(() => {
		if (!toastIdRef.current) return
		magicToast.destroy(toastIdRef.current)
		toastIdRef.current = null
	}, [])

	const resetDownloadProgress = useCallback(() => {
		clearPollTimer()
		clearResetTimer()
		dismissDownloadToast()
		setState({ isDownloading: false, progress: 0 })
	}, [clearPollTimer, clearResetTimer, dismissDownloadToast])

	const finishDownload = useCallback(
		(taskId: number, successVisibleMs: number) => {
			clearPollTimer()
			clearResetTimer()
			setState((prev) => ({ ...prev, isDownloading: true, progress: 100 }))
			dismissDownloadToast()
			resetTimerRef.current = setTimeout(() => {
				if (taskIdRef.current !== taskId) return
				setState({ isDownloading: false, progress: 0 })
			}, successVisibleMs)
		},
		[clearPollTimer, clearResetTimer, dismissDownloadToast],
	)

	const cancelDownload = useCallback(() => {
		taskIdRef.current += 1
		taskAbortControllerRef.current?.abort()
		taskAbortControllerRef.current = null
		resetDownloadProgress()
		onCancelRef.current?.()
		onCancelRef.current = undefined
		settle(false)
	}, [resetDownloadProgress, settle])

	const showDownloadToast = useCallback(
		(progress: number, label?: string) => {
			const toastId = toastIdRef.current ?? createRandomUuidV4()
			toastIdRef.current = toastId
			labelRef.current = label ?? labelRef.current
			magicToast.loading({
				key: toastId,
				icon: null,
				className: "download-progress-toast",
				dismissible: false,
				content: createElement(DownloadProgressToast, {
					progress,
					text: labelRef.current || t("topicFiles.downloading"),
					cancelText: cancelTextRef.current || t("common.cancel"),
					onCancel: cancelDownload,
				}),
				duration: 0,
			})
		},
		[cancelDownload, t],
	)

	const startDownload = useCallback(
		async (options: StartDownloadOptions): Promise<boolean> => {
			const fileIds = options.fileIds.filter(Boolean)
			if (!options.allowEmptyFileIds && fileIds.length === 0) return false

			taskIdRef.current += 1
			const taskId = taskIdRef.current
			taskAbortControllerRef.current?.abort()
			taskAbortControllerRef.current = null
			clearPollTimer()
			clearResetTimer()
			settle(false)
			onCancelRef.current = options.onCancel
			labelRef.current = options.label
			cancelTextRef.current = options.cancelText
			setState({
				isDownloading: true,
				progress: 0,
				label: options.label,
			})
			showDownloadToast(0, options.label)

			const isCurrentTask = () => taskIdRef.current === taskId
			const failTask = (error: unknown) => {
				if (!isCurrentTask()) return false
				onCancelRef.current = undefined
				resetDownloadProgress()
				options.onError?.(error)
				settle(false)
				return false
			}

			const completeTask = async (downloadUrl: string) => {
				if (!isCurrentTask()) return false
				try {
					await downloadFileWithAnchor(downloadUrl, options.fileName, options.target)
					onCancelRef.current = undefined
					finishDownload(taskId, options.successVisibleMs ?? DEFAULT_SUCCESS_VISIBLE_MS)
					options.onSuccess?.()
					settle(true)
					return true
				} catch (error) {
					return failTask(error)
				}
			}

			try {
				const data = (await SuperMagicApi.createBatchDownload({
					project_id: options.projectId,
					file_ids: fileIds,
					token: options.token,
				})) as BatchDownloadTaskResponse

				if (!isCurrentTask()) return false

				if (data.status === "ready" && data.download_url) {
					setState((prev) => ({ ...prev, progress: 100 }))
					showDownloadToast(100, options.label)
					return await completeTask(data.download_url)
				}

				if (data.status === "processing" && data.batch_key) {
					const batchKey = data.batch_key
					return await new Promise<boolean>((resolve) => {
						let checking = false
						settleRef.current = resolve
						pollTimerRef.current = setInterval(async () => {
							if (checking || !isCurrentTask()) return
							checking = true
							try {
								const checkData = (await SuperMagicApi.checkBatchDownloadStatus(
									batchKey,
									options.token,
								)) as BatchDownloadTaskResponse

								if (!isCurrentTask()) return

								if (checkData.status === "processing") {
									const progress = normalizeProgress(checkData.progress)
									setState((prev) => ({
										...prev,
										progress,
									}))
									showDownloadToast(progress, options.label)
									return
								}

								if (checkData.status === "ready" && checkData.download_url) {
									clearPollTimer()
									await completeTask(checkData.download_url)
									return
								}

								if (checkData.status === "failed") {
									failTask(createDownloadError(checkData.message))
								}
							} catch (error) {
								failTask(error)
							} finally {
								checking = false
							}
						}, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
					})
				}

				return failTask(createDownloadError(data.message))
			} catch (error) {
				return failTask(error)
			}
		},
		[
			clearPollTimer,
			clearResetTimer,
			finishDownload,
			resetDownloadProgress,
			settle,
			showDownloadToast,
		],
	)

	const startCustomDownload = useCallback(
		async <TResult>(options: StartCustomDownloadOptions<TResult>): Promise<boolean> => {
			taskIdRef.current += 1
			const taskId = taskIdRef.current
			taskAbortControllerRef.current?.abort()
			const abortController = new AbortController()
			taskAbortControllerRef.current = abortController
			clearPollTimer()
			clearResetTimer()
			settle(false)
			onCancelRef.current = options.onCancel
			labelRef.current = options.label
			cancelTextRef.current = options.cancelText
			setState({
				isDownloading: true,
				progress: 0,
				label: options.label,
			})
			showDownloadToast(0, options.label)

			const isCurrentTask = () => taskIdRef.current === taskId
			const reportProgress = (progress: number) => {
				if (!isCurrentTask() || abortController.signal.aborted) return
				const normalized = normalizeProgress(progress)
				setState((prev) => ({ ...prev, progress: normalized }))
				showDownloadToast(normalized, options.label)
			}

			try {
				const result = await options.task({
					signal: abortController.signal,
					reportProgress,
				})
				if (!isCurrentTask() || abortController.signal.aborted) return false

				taskAbortControllerRef.current = null
				onCancelRef.current = undefined
				finishDownload(taskId, options.successVisibleMs ?? DEFAULT_SUCCESS_VISIBLE_MS)
				options.onSuccess?.(result)
				settle(true)
				return true
			} catch (error) {
				if (!isCurrentTask() || abortController.signal.aborted) return false

				taskAbortControllerRef.current = null
				onCancelRef.current = undefined
				resetDownloadProgress()
				options.onError?.(error)
				settle(false)
				return false
			}
		},
		[
			clearPollTimer,
			clearResetTimer,
			finishDownload,
			resetDownloadProgress,
			settle,
			showDownloadToast,
		],
	)

	useEffect(() => {
		return () => {
			taskIdRef.current += 1
			taskAbortControllerRef.current?.abort()
			taskAbortControllerRef.current = null
			clearPollTimer()
			clearResetTimer()
			dismissDownloadToast()
			settle(false)
		}
	}, [clearPollTimer, clearResetTimer, dismissDownloadToast, settle])

	return {
		isDownloading: state.isDownloading,
		progress: state.progress,
		label: state.label,
		startDownload,
		startCustomDownload,
		cancelDownload,
		resetDownloadProgress,
	}
}

export type DownloadProgressController = ReturnType<typeof useDownloadProgress>
