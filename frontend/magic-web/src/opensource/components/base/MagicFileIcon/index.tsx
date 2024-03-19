import { createStyles, cx } from "antd-style"
import type React from "react"
import { memo, useEffect, useState } from "react"
import otherSVG from "./assets/other.svg"
import FileTypeIcon from "../FileTypeIcon"

const iconModules = import.meta.glob<string>("./assets/*.svg", { import: "default" })
const iconCache: Record<string, string> = {}
const iconNameMap: Record<string, string> = {
	txt: "txt",
	log: "txt",
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
	bmp: "image",
	webp: "image",
	svg: "image",
	ico: "image",
	pdf: "pdf",
	md: "markdown",
	doc: "word",
	docx: "word",
	xls: "excel",
	xlsx: "excel",
	csv: "excel",
	ppt: "ppt",
	pptx: "ppt",
	mp3: "audio",
	wav: "audio",
	ogg: "audio",
	flac: "audio",
	aac: "audio",
	mp4: "video",
	avi: "video",
	mov: "video",
	wmv: "video",
	flv: "video",
	mkv: "video",
	zip: "zip",
	rar: "zip",
	"7z": "zip",
	tar: "zip",
	gz: "zip",
	folder: "folder",
	sharefolder: "sharefolder",
	xmind: "xmind",
	wiki: "wiki",
	whiteboard: "whiteboard",
	magictable: "magictable",
	magicdoc: "magicdoc",
	mindmap: "mindmap",
	olddoc: "olddoc",
	link: "link",
	xml: "file-xml",
	json: "file-json",
	html: "file-html",
	css: "file-css",
	java: "file-java",
	php: "file-php",
	py: "file-python",
	python: "file-python",
	sh: "file-sh",
	bash: "file-sh",
	go: "file-go",
	js: "file-js",
	javascript: "file-js",
	ts: "code",
	typescript: "code",
	jsx: "code",
	tsx: "code",
	yaml: "code",
	yml: "code",
	toml: "code",
	ini: "code",
	rb: "code",
	ruby: "code",
	sql: "code",
	vue: "code",
	swift: "code",
	kotlin: "code",
	dart: "code",
	rust: "code",
	dashboard: "dashboard",
	mysql: "mysql",
	design: "design",
	replay: "replay",
	playback: "replay",
}

function normalizeExtension(fileExtension?: string): string | null {
	if (!fileExtension) return null
	return fileExtension.replace(/^\./, "").toLocaleLowerCase()
}

function getIconName(caseType?: string | null): string | null {
	if (!caseType) return null
	return iconNameMap[caseType] ?? null
}

/**
 * 根据文件扩展名获取对应的图标URL
 * @param fileExtension 文件扩展名（可带点或不带点）
 * @returns 图标的URL字符串
 */
export function getFileIconByType(fileExtension?: string): string {
	const caseType = normalizeExtension(fileExtension)
	if (!caseType) return otherSVG

	const iconName = getIconName(caseType)
	if (!iconName) return ""

	if (iconCache[iconName]) return iconCache[iconName]

	const iconPath = `./assets/${iconName}.svg`
	const loader = iconModules[iconPath]

	if (loader)
		loader()
			.then((src) => {
				iconCache[iconName] = src
			})
			.catch(() => {
				iconCache[iconName] = otherSVG
			})

	return ""
}

export async function loadFileIconByType(fileExtension?: string): Promise<string | null> {
	const caseType = normalizeExtension(fileExtension)
	if (!caseType) return otherSVG

	const iconName = getIconName(caseType)
	if (!iconName) return null

	if (iconCache[iconName]) return iconCache[iconName]

	const iconPath = `./assets/${iconName}.svg`
	const loader = iconModules[iconPath]

	if (!loader) return null

	try {
		const src = await loader()
		iconCache[iconName] = src
		return src
	} catch {
		return null
	}
}

interface MagicFileIconProps {
	type?: string
	size?: number
	className?: string
	style?: React.CSSProperties
}

const useStyles = createStyles(() => ({
	fileIcon: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	image: {
		width: "100%",
		height: "100%",
		objectFit: "contain",
		objectPosition: "center",
	},
}))

export default memo(function MagicFileIcon({
	type,
	size = 24,
	className,
	style,
}: MagicFileIconProps) {
	const { styles } = useStyles()

	const [icon, setIcon] = useState<string | null>(() => getFileIconByType(type) || null)

	useEffect(() => {
		let isMounted = true

		loadFileIconByType(type)
			.then((src) => {
				if (!isMounted) return
				setIcon(src)
			})
			.catch(() => {
				if (isMounted) setIcon(null)
			})

		return () => {
			isMounted = false
		}
	}, [type])

	if (!icon) {
		return <FileTypeIcon type={type} size={size} className={className} style={style} />
	}

	return (
		<div
			className={cx(styles.fileIcon, className)}
			style={{ width: size, height: size, ...style }}
		>
			<img src={icon} draggable={false} alt={type} className={styles.image} />
		</div>
	)
})
