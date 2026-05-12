import { useCallback, useRef, useState } from "react"
import JSZip from "jszip"
import { saveAs } from "file-saver"
import * as htmlToImage from "html-to-image"
import { logger as rootLogger } from "@/utils/log"
import type { CardFrameRef } from "../components/CardFrame"
import type { SelfMediaCard, SelfMediaPost } from "../types"

const log = rootLogger.createLogger("useExportZip")

export interface ExportProgress {
	current: number
	total: number
	status: "idle" | "running" | "done" | "error"
}

interface UseExportZipResult {
	progress: ExportProgress
	exportZip: (args: {
		posts: SelfMediaPost[]
		zipName?: string
		/** Output pixel ratio for each captured card. Defaults to 2. */
		pixelRatio?: number
		getCardRef: (postIdx: number, cardIdx: number) => CardFrameRef | null
	}) => Promise<void>
}

const DEFAULT_PIXEL_RATIO = 2
const PER_CARD_TIMEOUT = 20000

function dataUrlToBlob(dataUrl: string): Blob {
	const [meta, base64] = dataUrl.split(",")
	const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/png"
	const binary = atob(base64)
	const len = binary.length
	const buffer = new Uint8Array(len)
	for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i)
	return new Blob([buffer], { type: mime })
}

function safeName(input: string, fallback: string): string {
	const trimmed = (input || "").trim().replace(/[\\/:*?"<>|]+/g, "_")
	return trimmed || fallback
}

/** Last path segment, without .html/.htm. */
function stemFromCardHtmlPath(path: string): string {
	const trimmed = (path || "").trim()
	if (!trimmed) return ""
	const base = trimmed.split(/[/\\]/).pop() || trimmed
	return base.replace(/\.html?$/i, "").trim()
}

/** 01_foo.png from HTML stem "foo", ordered by export index within the post. */
function pngNameForCard(card: SelfMediaCard, oneBasedIndex: number): string {
	const idx = String(oneBasedIndex).padStart(2, "0")
	const stem = stemFromCardHtmlPath(card.path)
	const safeStem = safeName(stem, "card")
	return `${idx}_${safeStem}.png`
}

function resolveZipBaseName(posts: SelfMediaPost[], zipName: string | undefined): string {
	if (zipName && zipName.trim()) return safeName(zipName.trim(), "self-media")
	const first = posts[0]
	const title = first?.meta?.title
	const id = first?.meta?.id
	return safeName((title && title.trim()) || id || "", "self-media")
}

/**
 * Export each card as PNG packaged in a ZIP.
 *
 * Strategy:
 * 1. Capture the iframe content from `CardFrame.capture()`.
 * 2. Fall back to host-side `htmlToImage` on the iframe element
 *    (only succeeds when iframe is same-origin or tainted-canvas tolerated).
 */
export function useExportZip(): UseExportZipResult {
	const [progress, setProgress] = useState<ExportProgress>({
		current: 0,
		total: 0,
		status: "idle",
	})
	const runningRef = useRef(false)

	const exportZip = useCallback<UseExportZipResult["exportZip"]>(
		async ({ posts, zipName, pixelRatio, getCardRef }) => {
			if (runningRef.current) return
			runningRef.current = true
			const effectivePixelRatio =
				typeof pixelRatio === "number" && pixelRatio > 0 ? pixelRatio : DEFAULT_PIXEL_RATIO
			const total = posts.reduce((sum, p) => sum + p.cards.length, 0)
			setProgress({ current: 0, total, status: "running" })

			const zip = new JSZip()
			let processed = 0
			const startedAt = Date.now()
			const rootZipName = resolveZipBaseName(posts, zipName)
			log.log("📤 开始导出 ZIP", {
				zipName: rootZipName,
				posts: posts.length,
				totalCards: total,
				pixelRatio: effectivePixelRatio,
			})

			try {
				for (let p = 0; p < posts.length; p++) {
					const post = posts[p]
					const folderName = safeName(post.meta.title || post.meta.id, `post-${p + 1}`)
					const folder = zip.folder(folderName)
					if (!folder) continue
					for (let c = 0; c < post.cards.length; c++) {
						const cardRef = getCardRef(p, c)
						let dataUrl: string | null = null
						let usedHostFallback = false
						if (cardRef) {
							try {
								dataUrl = await cardRef.capture({
									pixelRatio: effectivePixelRatio,
									timeoutMs: PER_CARD_TIMEOUT,
								})
							} catch (err) {
								log.warn("⚠️ 卡片截图失败，尝试回退到宿主截图", {
									postIdx: p,
									cardIdx: c,
									error: err,
								})
							}
							if (!dataUrl) {
								const iframe = cardRef.getIframeElement()
								if (iframe) {
									usedHostFallback = true
									try {
										dataUrl = await htmlToImage.toPng(iframe, {
											pixelRatio: effectivePixelRatio,
											cacheBust: true,
										})
									} catch (hostErr) {
										log.warn("⚠️ 宿主截图回退也失败，跳过当前卡片", {
											postIdx: p,
											cardIdx: c,
											error: hostErr,
										})
										dataUrl = null
									}
								}
							}
						}
						if (dataUrl) {
							const fileName = pngNameForCard(post.cards[c], c + 1)
							folder.file(fileName, dataUrlToBlob(dataUrl))
						} else {
							log.warn("⚠️ 当前卡片未产出图像，已跳过", {
								postIdx: p,
								cardIdx: c,
								usedHostFallback,
							})
						}
						processed += 1
						setProgress({ current: processed, total, status: "running" })
					}
				}
				const blob = await zip.generateAsync({ type: "blob" })
				saveAs(blob, `${rootZipName}.zip`)
				setProgress({ current: total, total, status: "done" })
				log.log("✅ 导出 ZIP 完成", {
					zipName: rootZipName,
					totalCards: total,
					durationMs: Date.now() - startedAt,
				})
			} catch (err) {
				log.error("❌ 导出 ZIP 失败", {
					zipName: rootZipName,
					processed,
					total,
					durationMs: Date.now() - startedAt,
					error: err,
				})
				setProgress((prev) => ({ ...prev, status: "error" }))
			} finally {
				runningRef.current = false
			}
		},
		[],
	)

	return { progress, exportZip }
}
