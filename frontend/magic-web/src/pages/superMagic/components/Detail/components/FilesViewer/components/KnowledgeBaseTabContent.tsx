import { memo, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { KnowledgeFileService } from "@/services/file/KnowledgeFile"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { downloadFileContent } from "@/pages/superMagic/utils/api"
import { MagicSpin } from "@/components/base"
import { DetailType } from "../../../types"
import type { KnowledgeBaseTabData } from "../hooks/useKnowledgeBaseTab"
import ContentRenderer from "../../ContentRenderer"

export interface KnowledgeBaseTabContentProps {
	data: KnowledgeBaseTabData
}

/**
 * 知识库文件预览内容组件
 * 根据 fileKey 获取文件下载链接，推断文件类型后委托给对应的 ContentRenderer 渲染
 */
function KnowledgeBaseTabContent({ data }: KnowledgeBaseTabContentProps) {
	const { t } = useTranslation("super")
	const { fileKey, title, knowledgeBaseName } = data

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [fileContent, setFileContent] = useState<string | null>(null)
	const [fileUrl, setFileUrl] = useState<string | null>(null)
	const [detailType, setDetailType] = useState<DetailType>(DetailType.Empty)

	// 从文件名推断扩展名
	const inferExtension = useCallback((fileName: string): string => {
		const dot = fileName.lastIndexOf(".")
		if (dot === -1 || dot === fileName.length - 1) return "md" // 默认当 markdown 处理
		return fileName.slice(dot + 1).toLowerCase()
	}, [])

	useEffect(() => {
		let cancelled = false

		async function loadFile() {
			setLoading(true)
			setError(null)

			try {
				// 1. 获取知识库文件的下载链接
				const fileInfo = await KnowledgeFileService.fetchFileUrl(fileKey)
				if (cancelled) return

				if (!fileInfo?.url) {
					setError(t("knowledgeBase.fetchFailed", "无法获取知识库文件"))
					setLoading(false)
					return
				}

				setFileUrl(fileInfo.url)

				// 2. 根据文件名推断类型
				const fileName = fileInfo.name || title
				const ext = inferExtension(fileName)
				const type = getFileType(ext) as DetailType
				setDetailType(type || DetailType.Md)

				// 3. 对文本类内容直接拉取内容；二进制类使用 URL
				const textTypes: string[] = [
					DetailType.Md,
					DetailType.Text,
					DetailType.Code,
					DetailType.Html,
				]

				if (textTypes.includes(type)) {
					const content = (await downloadFileContent(fileInfo.url, {
						responseType: "text",
					})) as string
					if (cancelled) return
					setFileContent(content)
				}
			} catch (err) {
				if (cancelled) return
				console.error("KnowledgeBaseTabContent: 加载文件失败", err)
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileKey])

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

	// 构造 Render 所需的 data 对象
	const renderData = {
		file_id: `kb_${data.knowledgeBaseId}_${fileKey}`,
		file_name: title,
		file_extension: inferExtension(title),
		file_url: fileUrl,
		content: fileContent,
		knowledge_base_name: knowledgeBaseName,
	}

	const commonProps = {
		showFileHeader: true,
		isPlaybackMode: false,
		data: renderData,
		fileContent,
	}

	return (
		<div className={cn("flex h-full w-full flex-col overflow-hidden")}>
			{/* 知识库来源标识 */}
			{knowledgeBaseName && (
				<div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5 text-xs text-muted-foreground">
					<span>{t("knowledgeBase.sourceLabel", "来源知识库")}:</span>
					<span className="font-medium text-foreground/80">{knowledgeBaseName}</span>
				</div>
			)}
			{/* 内容渲染区 */}
			<div className="min-h-0 flex-1">
				<ContentRenderer type={detailType} data={renderData} commonProps={commonProps} />
			</div>
		</div>
	)
}

export default memo(KnowledgeBaseTabContent)
