import { useCallback, useRef, useState } from "react"
import { loadJSZip } from "@/infrastructure/vendors/jszip"
import { saveAs } from "file-saver"
import { logger as rootLogger } from "@/infrastructure/logger"
import type { CardFrameRef } from "../components/CardFrame"
import type { SelfMediaPost } from "../types"
import { DEFAULT_SELF_MEDIA_EXPORT_FORMAT } from "../utils/exportImageFormat"
import type { SelfMediaExportFormat } from "../utils/exportImageFormat"
import {
	captureCardDataUrl,
	dataUrlToBlob,
	imageNameForCard,
	resolvePostBaseName,
	resolveWechatCoverBaseName,
	resolveZipBaseName,
	safeName,
	stitchCardDataUrlsToBlob,
	stitchWechatCoverImagesToBlob,
} from "../utils/exportImageUtils"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

const log = rootLogger.createLogger("useExportZip")

export interface ExportProgress {
	current: number
	total: number
	status: "idle" | "running" | "done" | "error"
	exported?: number
	failedPageNumbers?: number[]
}

interface UseExportZipResult {
	progress: ExportProgress
	exportZip: (args: {
		posts: SelfMediaPost[]
		zipName?: string
		format?: SelfMediaExportFormat
		/** Output pixel ratio for each captured card. Defaults to 2. */
		pixelRatio?: number
		getCardRef: (postIdx: number, cardIdx: number) => CardFrameRef | null
		getCardPageNumber?: (postIdx: number, cardIdx: number) => number
	}) => Promise<void>
	exportLongImage: (args: {
		post: SelfMediaPost
		fileName?: string
		format?: SelfMediaExportFormat
		/** Output pixel ratio for each captured card before stitching. Defaults to 2. */
		pixelRatio?: number
		getCardRef: (cardIdx: number) => CardFrameRef | null
	}) => Promise<void>
	exportWechatCoverImage: (args: {
		post: SelfMediaPost
		fileName?: string
		format?: SelfMediaExportFormat
		/** Output pixel ratio for the stitched cover. Defaults to 2. */
		pixelRatio?: number
	}) => Promise<void>
}

const DEFAULT_PIXEL_RATIO = 2

/**
 * Export each card in the selected image format and package the files in a ZIP.
 *
 * Strategy:
 * 1. Capture the iframe content from `CardFrame.capture()`.
 * 2. Fall back to host-side `htmlToImage` on the iframe element
 *    (only succeeds when iframe is same-origin or tainted-canvas tolerated).
 */
export function useExportZip(): UseExportZipResult {
	const fileApi = useFileApi()
	const [progress, setProgress] = useState<ExportProgress>({
		current: 0,
		total: 0,
		status: "idle",
	})
	const runningRef = useRef(false)

	const exportZip = useCallback<UseExportZipResult["exportZip"]>(
		async ({
			posts,
			zipName,
			format = DEFAULT_SELF_MEDIA_EXPORT_FORMAT,
			pixelRatio,
			getCardRef,
			getCardPageNumber,
		}) => {
			if (runningRef.current) return
			runningRef.current = true
			const effectivePixelRatio =
				typeof pixelRatio === "number" && pixelRatio > 0 ? pixelRatio : DEFAULT_PIXEL_RATIO
			const total = posts.reduce((sum, p) => sum + p.cards.length, 0)
			setProgress({ current: 0, total, status: "running" })

			const zip = new (await loadJSZip())()
			let processed = 0
			let captured = 0
			const failedPageNumbers: number[] = []
			const startedAt = Date.now()
			const rootZipName = resolveZipBaseName(posts, zipName)
			log.log("📤 开始导出 ZIP", {
				zipName: rootZipName,
				posts: posts.length,
				totalCards: total,
				pixelRatio: effectivePixelRatio,
				format,
			})

			try {
				for (let p = 0; p < posts.length; p++) {
					const post = posts[p]
					const folderName = safeName(post.meta.title || post.meta.id, `post-${p + 1}`)
					const folder = zip.folder(folderName)
					if (!folder) continue
					for (let c = 0; c < post.cards.length; c++) {
						const dataUrl = await captureCardDataUrl({
							cardRef: getCardRef(p, c),
							pixelRatio: effectivePixelRatio,
							format,
							postIdx: p,
							cardIdx: c,
						})
						if (dataUrl) {
							captured += 1
							const fileName = imageNameForCard(post.cards[c], c + 1, format)
							folder.file(fileName, dataUrlToBlob(dataUrl))
						} else {
							failedPageNumbers.push(getCardPageNumber?.(p, c) ?? c + 1)
						}
						processed += 1
						setProgress({ current: processed, total, status: "running" })
					}
				}
				if (captured === 0) throw new Error("No card images were captured")
				const blob = await zip.generateAsync({ type: "blob" })
				saveAs(blob, `${rootZipName}.zip`)
				setProgress({
					current: total,
					total,
					status: "done",
					exported: captured,
					failedPageNumbers,
				})
				log.log("✅ 导出 ZIP 完成", {
					zipName: rootZipName,
					totalCards: total,
					capturedCards: captured,
					failedPageNumbers,
					durationMs: Date.now() - startedAt,
				})
			} catch (err) {
				log.error({
					eventKey: "export_zip_failed",
					errorKind: "render",
					error: err,
					message: "❌ 导出 ZIP 失败",
					context: {
						processed,
						total,
						rootZipName,
						durationMs: Date.now() - startedAt,
					},
				})
				setProgress((prev) => ({ ...prev, status: "error" }))
			} finally {
				runningRef.current = false
			}
		},
		[],
	)

	const exportLongImage = useCallback<UseExportZipResult["exportLongImage"]>(
		async ({
			post,
			fileName,
			format = DEFAULT_SELF_MEDIA_EXPORT_FORMAT,
			pixelRatio,
			getCardRef,
		}) => {
			if (runningRef.current) return
			runningRef.current = true
			const effectivePixelRatio =
				typeof pixelRatio === "number" && pixelRatio > 0 ? pixelRatio : DEFAULT_PIXEL_RATIO
			const total = post.cards.length
			setProgress({ current: 0, total, status: "running" })

			let processed = 0
			const startedAt = Date.now()
			const imageName = resolvePostBaseName(post, fileName)
			const dataUrls: string[] = []
			log.log("📤 开始导出长图", {
				fileName: imageName,
				totalCards: total,
				pixelRatio: effectivePixelRatio,
				format,
			})

			try {
				for (let c = 0; c < post.cards.length; c++) {
					const dataUrl = await captureCardDataUrl({
						cardRef: getCardRef(c),
						pixelRatio: effectivePixelRatio,
						format,
						postIdx: 0,
						cardIdx: c,
					})
					if (dataUrl) dataUrls.push(dataUrl)
					processed += 1
					setProgress({ current: processed, total, status: "running" })
				}
				if (!dataUrls.length) throw new Error("No card images were captured")
				if (dataUrls.length !== total) {
					throw new Error(`Only captured ${dataUrls.length} of ${total} card images`)
				}
				const separatorHeight = Math.max(1, Math.round(effectivePixelRatio))
				const blob = await stitchCardDataUrlsToBlob(dataUrls, separatorHeight, format)
				saveAs(blob, `${imageName}.${format}`)
				setProgress({ current: total, total, status: "done" })
				log.log("✅ 导出长图完成", {
					fileName: imageName,
					totalCards: total,
					durationMs: Date.now() - startedAt,
				})
			} catch (err) {
				log.error({
					eventKey: "export_failed",
					errorKind: "render",
					error: err,
					message: "❌ 导出长图失败",
					context: {
						processed,
						total,
						durationMs: Date.now() - startedAt,
					},
				})
				setProgress((prev) => ({ ...prev, status: "error" }))
			} finally {
				runningRef.current = false
			}
		},
		[],
	)

	const exportWechatCoverImage = useCallback<UseExportZipResult["exportWechatCoverImage"]>(
		async ({ post, fileName, format = DEFAULT_SELF_MEDIA_EXPORT_FORMAT, pixelRatio }) => {
			if (runningRef.current) return
			runningRef.current = true
			const effectivePixelRatio =
				typeof pixelRatio === "number" && pixelRatio > 0 ? pixelRatio : DEFAULT_PIXEL_RATIO
			const imageName = resolveWechatCoverBaseName(post, fileName)
			setProgress({ current: 0, total: 1, status: "running" })
			const startedAt = Date.now()
			log.log("📤 开始导出微信公众号封面拼图", {
				fileName: imageName,
				pixelRatio: effectivePixelRatio,
				format,
			})

			try {
				const blob = await stitchWechatCoverImagesToBlob({
					thumbnailFileId: post.thumbnailCover?.fileId,
					heroFileId: post.heroCover?.fileId,
					pixelRatio: effectivePixelRatio,
					format,
					fileApi,
				})
				saveAs(blob, `${imageName}-wechat-cover.${format}`)
				setProgress({ current: 1, total: 1, status: "done" })
				log.log("✅ 导出微信公众号封面拼图完成", {
					fileName: imageName,
					durationMs: Date.now() - startedAt,
				})
			} catch (err) {
				log.error({
					eventKey: "export_failed",
					errorKind: "render",
					error: err,
					message: "❌ 导出微信公众号封面拼图失败",
					context: { durationMs: Date.now() - startedAt },
				})
				setProgress((prev) => ({ ...prev, status: "error" }))
			} finally {
				runningRef.current = false
			}
		},
		[fileApi],
	)

	return { progress, exportZip, exportLongImage, exportWechatCoverImage }
}
