import { memo, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import { KnowledgeFileService } from "@/services/file/KnowledgeFile"
import { MagicSpin } from "@/components/base"
import type { Knowledge } from "@/types/knowledge"
import type { KnowledgeBaseTabData } from "./FilesViewer/hooks/useKnowledgeBaseTab"
import KnowledgeSourcePreview from "./FilesViewer/components/KnowledgeSourcePreview"
import type { KnowledgeSourcePreviewData } from "./FilesViewer/components/KnowledgeSourcePreview"
import { hasKnowledgeBaseTabTarget } from "@/pages/superMagic/events/openFileTab"

export interface KnowledgeBasePreviewContentProps {
	data: KnowledgeBaseTabData
}

type SourceFileLinkPayload = Partial<Knowledge.KnowledgeSourceFileLink> & {
	fileUrl?: string
	file_url?: string
}

type SourceFileLinkResponse =
	| SourceFileLinkPayload
	| {
			data?: SourceFileLinkPayload
	  }
	| null
	| undefined

function unwrapSourceFileLink(response: SourceFileLinkResponse): SourceFileLinkPayload | null {
	if (!response) return null
	if ("data" in response) return response.data || null
	return response as SourceFileLinkPayload
}

function inferExtension(value?: string) {
	if (!value) return undefined

	const target = (() => {
		try {
			return new URL(value).pathname
		} catch {
			return value.split("?")[0].split("#")[0]
		}
	})()

	const fileName = target.split("/").pop() || target
	const dot = fileName.lastIndexOf(".")
	if (dot === -1 || dot === fileName.length - 1) return undefined
	return fileName.slice(dot + 1).toLowerCase()
}

function normalizeSourceFileLink(
	response: SourceFileLinkResponse,
	fallbackTitle: string,
	explicitExtension?: string,
): KnowledgeSourcePreviewData | null {
	const payload = unwrapSourceFileLink(response)
	if (!payload || payload.available === false) return null

	const url = payload.url || payload.fileUrl || payload.file_url
	if (!url) return null

	const fileName = payload.name || fallbackTitle
	const fileExtension =
		explicitExtension || inferExtension(fileName) || inferExtension(url) || "md"

	return {
		url,
		fileName,
		fileExtension,
		linkType: payload.link_type,
		sourceType: payload.source_type,
		sourceFileKey: payload.file_key,
	}
}

/**
 * 知识库来源文件预览内容。
 * 桌面端放入 FilesViewer tab，移动端放入底部弹层，两端共享同一套取直链和渲染逻辑。
 */
function KnowledgeBasePreviewContent({ data }: KnowledgeBasePreviewContentProps) {
	const { t } = useTranslation("super")
	const { documentCode, fileExtension, fileKey, knowledgeBaseId, title, knowledgeBaseName } = data

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [source, setSource] = useState<KnowledgeSourcePreviewData | null>(null)

	useEffect(() => {
		let cancelled = false

		async function loadFile() {
			setLoading(true)
			setError(null)

			try {
				setSource(null)

				if (!hasKnowledgeBaseTabTarget(data)) {
					setError(t("knowledgeBase.sourceUnavailable", "来源暂不可用"))
					setLoading(false)
					return
				}

				const fileInfo: SourceFileLinkResponse = documentCode
					? await KnowledgeApi.getKnowledgeSourceFileLink({
							knowledgeBaseCode: knowledgeBaseId,
							documentCode,
							fileKey,
						})
					: await KnowledgeFileService.fetchFileUrl(fileKey!)

				if (cancelled) return

				const nextSource = normalizeSourceFileLink(fileInfo, title, fileExtension)

				if (!nextSource) {
					setError(
						documentCode
							? t("knowledgeBase.sourceUnavailable", "来源暂不可用")
							: t("knowledgeBase.fetchFailed", "无法获取知识库文件"),
					)
					setLoading(false)
					return
				}

				setSource(nextSource)
			} catch (err) {
				if (cancelled) return
				console.error("KnowledgeBasePreviewContent: 加载文件失败", err)
				setError(t("knowledgeBase.loadError", "加载知识库文件失败"))
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		loadFile()

		return () => {
			cancelled = true
		}
	}, [data, documentCode, fileExtension, fileKey, knowledgeBaseId, t, title])

	if (loading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<MagicSpin spinning />
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
				<span>{error}</span>
			</div>
		)
	}

	if (!source) return null

	return (
		<KnowledgeSourcePreview
			source={source}
			knowledgeBaseName={knowledgeBaseName}
			title={title}
		/>
	)
}

export default memo(KnowledgeBasePreviewContent)
