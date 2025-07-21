import { cx } from "antd-style"
import type React from "react"
import { memo, useMemo } from "react"
import audioSVG from "./assets/audio.svg"
import codeSVG from "./assets/code.svg"
import excelSVG from "./assets/excel.svg"
import cssSVG from "./assets/file-css.svg"
import goSVG from "./assets/file-go.svg"
import htmlSVG from "./assets/file-html.svg"
import javaSVG from "./assets/file-java.svg"
import jsSVG from "./assets/file-js.svg"
import jsonSVG from "./assets/file-json.svg"
import phpSVG from "./assets/file-php.svg"
import pythonSVG from "./assets/file-python.svg"
import shSVG from "./assets/file-sh.svg"
import xmlSVG from "./assets/file-xml.svg"
import folderSVG from "./assets/folder.svg"
import imageSVG from "./assets/image.svg"
import linkSVG from "./assets/link.svg"
import magicdocSVG from "./assets/magicdoc.svg"
import magictableSVG from "./assets/magictable.svg"
import markdownSVG from "./assets/markdown.svg"
import mindmapSVG from "./assets/mindmap.svg"
import olddocSVG from "./assets/olddoc.svg"
import pdfSVG from "./assets/pdf.svg"
import pptSVG from "./assets/ppt.svg"
import sharefolderSVG from "./assets/sharefolder.svg"
import txtSVG from "./assets/txt.svg"
import videoSVG from "./assets/video.svg"
import whiteboardSVG from "./assets/whiteboard.svg"
import wikiSVG from "./assets/wiki.svg"
import wordSVG from "./assets/word.svg"
import xmindSVG from "./assets/xmind.svg"
import zipSVG from "./assets/zip.svg"
import otherSVG from "./assets/other.svg"
import { useStyles } from "./style"

export type MagicFileIconProps = {
	type?: string
	size?: number
	className?: string
	style?: React.CSSProperties
}

export default memo(function MagicFileIcon({
	type,
	size = 24,
	className,
	style,
}: MagicFileIconProps) {
	const { styles } = useStyles()

	const icon = useMemo(() => {
		// 移除文件后缀最前面的点(如果存在)
		const caseType = type?.replace(/^\./, "").toLocaleLowerCase()
		switch (caseType) {
			case "txt":
				return txtSVG
			case "png":
			case "jpg":
			case "jpeg":
			case "gif":
			case "bmp":
			case "webp":
			case "svg":
			case "ico":
				return imageSVG
			case "pdf":
				return pdfSVG
			case "md":
				return markdownSVG
			case "doc":
			case "docx":
				return wordSVG
			case "xls":
			case "xlsx":
			case "csv":
				return excelSVG
			case "ppt":
			case "pptx":
				return pptSVG
			case "mp3":
			case "wav":
			case "ogg":
			case "flac":
			case "aac":
				return audioSVG
			case "mp4":
			case "avi":
			case "mov":
			case "wmv":
			case "flv":
			case "mkv":
				return videoSVG
			case "zip":
			case "rar":
			case "7z":
			case "tar":
			case "gz":
				return zipSVG
			case "folder":
				return folderSVG
			case "sharefolder":
				return sharefolderSVG
			case "xmind":
				return xmindSVG
			case "wiki":
				return wikiSVG
			case "whiteboard":
				return whiteboardSVG
			case "magictable":
				return magictableSVG
			case "magicdoc":
				return magicdocSVG
			case "mindmap":
				return mindmapSVG
			case "olddoc":
				return olddocSVG
			case "link":
				return linkSVG
			case "xml":
				return xmlSVG
			case "json":
				return jsonSVG
			case "html":
				return htmlSVG
			case "css":
				return cssSVG
			case "java":
				return javaSVG
			case "php":
				return phpSVG
			case "py":
			case "python":
				return pythonSVG
			case "sh":
			case "bash":
				return shSVG
			case "go":
				return goSVG
			case "js":
			case "javascript":
				return jsSVG
			case "ts":
			case "typescript":
			case "jsx":
			case "tsx":
			case "yaml":
			case "yml":
			case "toml":
			case "ini":
			case "rb":
			case "ruby":
			case "sql":
			case "vue":
			case "swift":
			case "kotlin":
			case "dart":
			case "rust":
				return codeSVG
			default:
				return otherSVG
		}
	}, [type])

	return (
		<div
			className={cx(styles.fileIcon, className)}
			style={{ width: size, height: size, ...style }}
		>
			<img src={icon} alt={type} className={styles.image} />
		</div>
	)
})
