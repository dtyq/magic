import { Modal } from "antd"
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react"
import CodeEditor from "@/components/base/CodeEditor"
import magicToast from "@/components/base/MagicToaster/utils"
import { decompressCanvasData, isCompressedCanvas } from "../utils/magicProjectCompression"

interface MagicProjectCodeInspectorProps {
	fileName?: string
	content?: string
	fallbackContent?: string
	scopeRef: RefObject<HTMLElement>
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function parseMagicProjectConfig(content: string) {
	let jsonStr = content.trim()
	const assignMatch = jsonStr.match(/=\s*([\s\S]+?)\s*;?\s*$/)
	if (assignMatch) {
		jsonStr = assignMatch[1]
	}
	return JSON.parse(jsonStr)
}

export default function MagicProjectCodeInspector({
	fileName,
	content,
	fallbackContent,
	scopeRef,
}: MagicProjectCodeInspectorProps) {
	const [decompressedModalOpen, setDecompressedModalOpen] = useState(false)
	const [decompressedContent, setDecompressedContent] = useState("")
	const [compressSizeInfo, setCompressSizeInfo] = useState<{
		before: number
		after: number
		elementCount: number
	} | null>(null)

	const currentContent = content || fallbackContent || ""
	const isCompressedMagicProjectFile = useMemo(() => {
		return (
			fileName === "magic.project.js" && currentContent.includes("MAGICPROJECTDESIGNDATA://")
		)
	}, [currentContent, fileName])

	const handleDecompressCanvas = useCallback(() => {
		try {
			const parsed = parseMagicProjectConfig(currentContent)

			if (parsed.canvas && isCompressedCanvas(parsed.canvas)) {
				const compressedSize = new TextEncoder().encode(parsed.canvas).length
				const decompressed = decompressCanvasData(parsed.canvas) as { elements?: unknown[] }
				const elementCount = Array.isArray(decompressed?.elements)
					? decompressed.elements.length
					: 0
				const result = { ...parsed, canvas: decompressed }
				const decompressedStr = JSON.stringify(result, null, 2)
				const decompressedSize = new TextEncoder().encode(
					JSON.stringify(decompressed),
				).length
				setDecompressedContent(decompressedStr)
				setCompressSizeInfo({
					before: compressedSize,
					after: decompressedSize,
					elementCount,
				})
			} else {
				const canvasObj = parsed.canvas as { elements?: unknown[] } | undefined
				const elementCount = Array.isArray(canvasObj?.elements)
					? canvasObj.elements.length
					: 0
				const formatted = JSON.stringify(parsed, null, 2)
				setDecompressedContent(formatted)
				setCompressSizeInfo(elementCount > 0 ? { before: 0, after: 0, elementCount } : null)
			}
			setDecompressedModalOpen(true)
		} catch (error) {
			console.error("[MagicProjectCodeInspector] Decompress canvas failed:", error)
			magicToast.error("解压失败: " + (error instanceof Error ? error.message : "未知错误"))
		}
	}, [currentContent])

	useEffect(() => {
		if (!isCompressedMagicProjectFile) return
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
				const scope = scopeRef.current
				if (!scope) return
				if (
					!scope.contains(document.activeElement) &&
					document.activeElement !== document.body
				) {
					return
				}
				e.preventDefault()
				handleDecompressCanvas()
			}
		}
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [handleDecompressCanvas, isCompressedMagicProjectFile, scopeRef])

	if (!isCompressedMagicProjectFile) return null

	return (
		<Modal
			title="Decompressed Canvas Data"
			open={decompressedModalOpen}
			onCancel={() => setDecompressedModalOpen(false)}
			footer={null}
			width="80vw"
			styles={{ body: { maxHeight: "70vh", overflow: "auto", padding: 0 } }}
		>
			{compressSizeInfo && (
				<div
					style={{
						padding: "8px 16px",
						fontSize: 13,
						color: "#666",
						borderBottom: "1px solid #f0f0f0",
						display: "flex",
						gap: 16,
						flexWrap: "wrap",
					}}
				>
					<span>
						元素数量: <strong>{compressSizeInfo.elementCount}</strong>
					</span>
					{compressSizeInfo.before > 0 && compressSizeInfo.after > 0 && (
						<>
							<span>
								压缩前 (canvas):{" "}
								<strong>{formatBytes(compressSizeInfo.after)}</strong>
							</span>
							<span>
								压缩后 (canvas):{" "}
								<strong>{formatBytes(compressSizeInfo.before)}</strong>
							</span>
							<span>
								压缩率:{" "}
								<strong>
									{(
										(1 - compressSizeInfo.before / compressSizeInfo.after) *
										100
									).toFixed(1)}
									%
								</strong>
							</span>
						</>
					)}
				</div>
			)}
			<CodeEditor
				content={decompressedContent}
				fileName="canvas.json"
				isEditMode={false}
				theme="light"
				height="70vh"
			/>
		</Modal>
	)
}
