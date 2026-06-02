import { lazy, memo, Suspense, useEffect, useMemo, useState } from "react"
import Markdown from "markdown-to-jsx"
import { useTranslation } from "react-i18next"
import { MagicImagePreview, MagicPdfRender, MagicSpin } from "@/components/base"
import MemoizedMagicDocxRender from "@/components/base/MagicDocxRender"
import { cn } from "@/lib/utils"
import { downloadFileContent } from "@/pages/superMagic/utils/api"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { DetailType } from "../../../types"

const UniverComponent = lazy(() => import("@/components/UniverComponent"))
const OnlyOfficeViewer = lazy(() => import("../../../contents/OnlyOffice"))

export interface KnowledgeSourcePreviewData {
	url: string
	fileName: string
	fileExtension: string
	linkType?: string
	sourceType?: string
	sourceFileKey?: string
}

interface KnowledgeSourcePreviewProps {
	source: KnowledgeSourcePreviewData
	knowledgeBaseName?: string
	title: string
}

function openSourceUrl(url: string) {
	window.open(url, "_blank", "noopener,noreferrer")
}

function isTextDetailType(type: DetailType) {
	return type === DetailType.Md || type === DetailType.Text || type === DetailType.Code
}

function getMimeType(fileExtension: string) {
	switch (fileExtension) {
		case "xlsx":
			return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		case "xls":
			return "application/vnd.ms-excel"
		case "csv":
			return "text/csv"
		case "docx":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case "txt":
		case "md":
			return "text/plain"
		default:
			return "application/octet-stream"
	}
}

function SourceHeader({
	fileName,
	knowledgeBaseName,
	url,
}: {
	fileName: string
	knowledgeBaseName?: string
	url: string
}) {
	const { t } = useTranslation("super")

	return (
		<div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
			<div className="min-w-0 truncate">
				{knowledgeBaseName ? (
					<span>
						{t("knowledgeBase.sourceLabel", "来源知识库")}:{" "}
						<span className="font-medium text-foreground/80">{knowledgeBaseName}</span>
					</span>
				) : (
					<span className="font-medium text-foreground/80">{fileName}</span>
				)}
			</div>
			<button
				type="button"
				className="shrink-0 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
				onClick={() => openSourceUrl(url)}
			>
				{t("knowledgeBase.openInNewWindow", "新窗口打开")}
			</button>
		</div>
	)
}

function RemoteFileLoader({
	source,
	responseType,
	children,
}: {
	source: KnowledgeSourcePreviewData
	responseType: "blob" | "text"
	children: (data: Blob | string) => JSX.Element
}) {
	const { t } = useTranslation("super")
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [data, setData] = useState<Blob | string | null>(null)

	useEffect(() => {
		let cancelled = false

		async function load() {
			setLoading(true)
			setError(null)
			setData(null)

			try {
				const content = await downloadFileContent(source.url, { responseType })
				if (!cancelled) {
					setData(content as Blob | string)
				}
			} catch (err) {
				if (!cancelled) {
					console.error("KnowledgeSourcePreview: 加载来源文件失败", err)
					setError(t("knowledgeBase.loadError", "加载知识库文件失败"))
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		load()

		return () => {
			cancelled = true
		}
	}, [responseType, source.url, t])

	if (loading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<MagicSpin spinning />
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
				{error}
			</div>
		)
	}

	if (data === null) return null

	return children(data)
}

function SpreadsheetPreview({ source }: { source: KnowledgeSourcePreviewData }) {
	const fileName = source.fileName

	return (
		<RemoteFileLoader source={source} responseType="blob">
			{(blob) => {
				const file = new File([blob as Blob], fileName, {
					type: (blob as Blob).type || getMimeType(source.fileExtension),
				})

				return (
					<Suspense
						fallback={
							<div className="flex h-full w-full items-center justify-center">
								<MagicSpin spinning />
							</div>
						}
					>
						<UniverComponent data={file} mode="readonly" type="sheet" />
					</Suspense>
				)
			}}
		</RemoteFileLoader>
	)
}

function DocxPreview({ source }: { source: KnowledgeSourcePreviewData }) {
	const fileName = source.fileName

	return (
		<RemoteFileLoader source={source} responseType="blob">
			{(blob) => {
				const file = new File([blob as Blob], fileName, {
					type: (blob as Blob).type || getMimeType(source.fileExtension),
				})

				return (
					<MemoizedMagicDocxRender
						file={file}
						height="100%"
						showDownload={false}
						showFullscreen={false}
						showReload={false}
					/>
				)
			}}
		</RemoteFileLoader>
	)
}

function OnlyOfficeSourcePreview({ source }: { source: KnowledgeSourcePreviewData }) {
	return (
		<Suspense
			fallback={
				<div className="flex h-full w-full items-center justify-center">
					<MagicSpin spinning />
				</div>
			}
		>
			<OnlyOfficeViewer
				data={{
					content: null,
					file_id: "",
					file_name: source.fileName,
					file_url: source.url,
				}}
				type={DetailType.Doc}
				file_extension={source.fileExtension}
				showFileHeader={false}
				showFooter={false}
				allowEdit={false}
				allowDownload={false}
			/>
		</Suspense>
	)
}

function TextSourcePreview({
	source,
	detailType,
}: {
	source: KnowledgeSourcePreviewData
	detailType: DetailType
}) {
	return (
		<RemoteFileLoader source={source} responseType="text">
			{(content) => {
				const text = String(content)

				if (detailType === DetailType.Md) {
					return (
						<div className="h-full overflow-auto bg-background px-6 py-5 text-sm leading-6 text-foreground">
							<Markdown>{text}</Markdown>
						</div>
					)
				}

				return (
					<pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words bg-background p-5 font-mono text-sm leading-6 text-foreground">
						{text}
					</pre>
				)
			}}
		</RemoteFileLoader>
	)
}

function UnsupportedPreview({ source }: { source: KnowledgeSourcePreviewData }) {
	const { t } = useTranslation("super")

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
			<span>
				{t(
					"knowledgeBase.unsupportedPreview",
					"暂不支持预览该知识库来源文件，请在新窗口打开",
				)}
			</span>
			<button
				type="button"
				className="rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
				onClick={() => openSourceUrl(source.url)}
			>
				{t("knowledgeBase.openInNewWindow", "新窗口打开")}
			</button>
		</div>
	)
}

function KnowledgeSourcePreview({ source, knowledgeBaseName, title }: KnowledgeSourcePreviewProps) {
	const detailType = useMemo(() => {
		if (source.linkType === "web") return DetailType.Browser
		return (getFileType(source.fileExtension) || DetailType.NotSupport) as DetailType
	}, [source.fileExtension, source.linkType])

	const content = (() => {
		if (detailType === DetailType.Browser) {
			return (
				<iframe
					className="h-full w-full border-0"
					src={source.url}
					title={title}
					referrerPolicy="no-referrer"
				/>
			)
		}

		if (detailType === DetailType.Pdf) {
			return <MagicPdfRender file={source.url} height="100%" />
		}

		if (detailType === DetailType.Image) {
			return (
				<MagicImagePreview rootClassName="h-full w-full">
					<img
						src={source.url}
						alt={source.fileName}
						draggable={false}
						className="h-full w-full object-contain"
					/>
				</MagicImagePreview>
			)
		}

		if (detailType === DetailType.Excel) {
			return <SpreadsheetPreview source={source} />
		}

		if (detailType === DetailType.Docx) {
			return <DocxPreview source={source} />
		}

		if (detailType === DetailType.Doc) {
			return <OnlyOfficeSourcePreview source={source} />
		}

		if (isTextDetailType(detailType)) {
			return <TextSourcePreview source={source} detailType={detailType} />
		}

		return <UnsupportedPreview source={source} />
	})()

	return (
		<div className={cn("flex h-full w-full flex-col overflow-hidden")}>
			<SourceHeader
				fileName={source.fileName}
				knowledgeBaseName={knowledgeBaseName}
				url={source.url}
			/>
			<div className="min-h-0 flex-1 overflow-hidden">{content}</div>
		</div>
	)
}

export default memo(KnowledgeSourcePreview)
