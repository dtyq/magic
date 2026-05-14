import fileAudioIcon from "../assets/file-audio.svg"
import fileCodeIcon from "../assets/file-code.svg"
import fileCssIcon from "../assets/file-css.svg"
import fileExcelIcon from "../assets/file-excel.svg"
import fileGoIcon from "../assets/file-go.svg"
import fileHtmlIcon from "../assets/file-html.svg"
import fileImageIcon from "../assets/file-image.svg"
import fileJavaIcon from "../assets/file-java.svg"
import fileJsIcon from "../assets/file-js.svg"
import fileJsonIcon from "../assets/file-json.svg"
import fileLinkIcon from "../assets/file-link.svg"
import fileMarkdownIcon from "../assets/file-markdown.svg"
import fileAgentIcon from "../assets/file-md-agent.svg"
import fileBootstrapIcon from "../assets/file-md-bootstrap.svg"
import fileHeartbeatIcon from "../assets/file-md-heartbeat.svg"
import fileIdentityIcon from "../assets/file-md-identity.svg"
import fileMemoryIcon from "../assets/file-md-memory.svg"
import fileSkillsIcon from "../assets/file-md-skills.svg"
import fileSoulIcon from "../assets/file-md-soul.svg"
import fileToolsIcon from "../assets/file-md-tools.svg"
import fileUserIcon from "../assets/file-md-user.svg"
import fileOtherIcon from "../assets/file-other.svg"
import filePdfIcon from "../assets/file-pdf.svg"
import filePhpIcon from "../assets/file-php.svg"
import filePptIcon from "../assets/file-ppt.svg"
import fileProjectDesignIcon from "../assets/file-project-design.svg"
import filePythonIcon from "../assets/file-python.svg"
import fileShIcon from "../assets/file-sh.svg"
import fileTxtIcon from "../assets/file-txt.svg"
import fileVideoIcon from "../assets/file-video.svg"
import fileWikiIcon from "../assets/file-wiki.svg"
import fileWordIcon from "../assets/file-word.svg"
import fileXmlIcon from "../assets/file-xml.svg"
import fileZipIcon from "../assets/file-zip.svg"
import folderCronIcon from "../assets/folder-cron-icon.svg"
import folderIcon from "../assets/folder-icon.svg"
import folderMagicIcon from "../assets/folder-magic-icon.svg"
import folderMemoryIcon from "../assets/folder-memory-icon.svg"
import folderNonEmptyIcon from "../assets/folder-non-empty-icon.svg"
import folderSkillIcon from "../assets/folder-skill-icon.svg"

export type TopicFileMagicVariant =
	| "magic-root"
	| "magic-cron"
	| "magic-skills"
	| "magic-memory"
	| "magic-file-skills"
	| "magic-file-agent"
	| "magic-file-heartbeat"
	| "magic-file-identity"
	| "magic-file-soul"
	| "magic-file-tools"
	| "magic-file-user"
	| "magic-file-bootstrap"
	| "magic-file-memory"

interface TopicFileIconProps {
	isDirectory?: boolean
	isMagicFolder?: boolean
	magicVariant?: TopicFileMagicVariant
	hasChildren?: boolean
	fileExtension?: string
	className?: string
	dataTestId?: string
}

const FILE_ICON_SRC_MAP: Record<string, string> = {
	txt: fileTxtIcon,
	md: fileMarkdownIcon,
	markdown: fileMarkdownIcon,
	html: fileHtmlIcon,
	htm: fileHtmlIcon,
	wiki: fileWikiIcon,
	json: fileJsonIcon,
	xml: fileXmlIcon,
	pdf: filePdfIcon,
	js: fileJsIcon,
	jsx: fileJsIcon,
	mjs: fileJsIcon,
	cjs: fileJsIcon,
	ts: fileJsIcon,
	tsx: fileJsIcon,
	css: fileCssIcon,
	py: filePythonIcon,
	java: fileJavaIcon,
	go: fileGoIcon,
	php: filePhpIcon,
	sh: fileShIcon,
	ppt: filePptIcon,
	pptx: filePptIcon,
	doc: fileWordIcon,
	docx: fileWordIcon,
	xls: fileExcelIcon,
	xlsx: fileExcelIcon,
	csv: fileExcelIcon,
	zip: fileZipIcon,
	rar: fileZipIcon,
	"7z": fileZipIcon,
	png: fileImageIcon,
	jpg: fileImageIcon,
	jpeg: fileImageIcon,
	gif: fileImageIcon,
	webp: fileImageIcon,
	svg: fileImageIcon,
	mp4: fileVideoIcon,
	mov: fileVideoIcon,
	webm: fileVideoIcon,
	mp3: fileAudioIcon,
	wav: fileAudioIcon,
	m4a: fileAudioIcon,
	link: fileLinkIcon,
	url: fileLinkIcon,
	custom: fileCodeIcon,
	customfile: fileCodeIcon,
	design: fileProjectDesignIcon,
}

const MAGIC_ICON_SRC_MAP: Record<TopicFileMagicVariant, string> = {
	"magic-root": folderMagicIcon,
	"magic-cron": folderCronIcon,
	"magic-skills": folderSkillIcon,
	"magic-memory": folderMemoryIcon,
	"magic-file-skills": fileSkillsIcon,
	"magic-file-agent": fileAgentIcon,
	"magic-file-heartbeat": fileHeartbeatIcon,
	"magic-file-identity": fileIdentityIcon,
	"magic-file-soul": fileSoulIcon,
	"magic-file-tools": fileToolsIcon,
	"magic-file-user": fileUserIcon,
	"magic-file-bootstrap": fileBootstrapIcon,
	"magic-file-memory": fileMemoryIcon,
}

/**
 * 统一标准化扩展名，避免 `.md`、`MD` 这类输入导致同一图标映射分叉。
 */
function normalizeFileExtension(fileExtension?: string): string {
	return fileExtension?.replace(/^\./, "").toLowerCase() || "other"
}

/**
 * 文件扩展名映射与移动端原型保持同一基线，避免真实附件在重构后大量退回为通用图标。
 * 未覆盖或后端新增的类型继续回退通用图标，保证列表渲染稳定。
 */
function getFileIconSrc(fileExtension?: string): string {
	const normalizedFileExtension = normalizeFileExtension(fileExtension)

	return FILE_ICON_SRC_MAP[normalizedFileExtension] || fileOtherIcon
}

/**
 * 目录图标只区分空目录和非空目录，保持与当前原型视觉反馈一致。
 */
function getFolderIconSrc(hasChildren?: boolean): string {
	if (hasChildren) return folderNonEmptyIcon

	return folderIcon
}

/**
 * 统一渲染 TopicFiles 当前真实使用到的图标，避免页面组件反复分支判断资源。
 */
export function TopicFileIcon({
	isDirectory = false,
	isMagicFolder = false,
	magicVariant,
	hasChildren = false,
	fileExtension,
	className = "block size-6 shrink-0 object-contain",
	dataTestId,
}: TopicFileIconProps) {
	const resolvedMagicVariant = magicVariant || (isMagicFolder ? "magic-root" : undefined)

	if (resolvedMagicVariant) {
		return (
			<img
				src={MAGIC_ICON_SRC_MAP[resolvedMagicVariant]}
				alt=""
				className={className}
				data-testid={dataTestId}
				aria-hidden
			/>
		)
	}

	const iconSrc = isDirectory ? getFolderIconSrc(hasChildren) : getFileIconSrc(fileExtension)

	return <img src={iconSrc} alt="" className={className} data-testid={dataTestId} aria-hidden />
}
