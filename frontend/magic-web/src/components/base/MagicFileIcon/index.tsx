import { getMagicProjectType } from "@/constants/magicProjectTypes"
import { createStyles, cx } from "antd-style"
import type React from "react"
import { memo, useEffect, useState } from "react"
import FileTypeIcon from "../FileTypeIcon"
import otherIcon from "./assets/other.svg"

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
	markdown: "markdown",
	doc: "word",
	docx: "word",
	docm: "word",
	wps: "word",
	xls: "excel",
	xlsx: "excel",
	csv: "excel",
	ppt: "ppt",
	pptx: "ppt",
	mp3: "audio",
	wav: "audio",
	ogg: "audio",
	opus: "audio",
	m4a: "audio",
	flac: "audio",
	aac: "audio",
	mp4: "video",
	webm: "video",
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
	url: "link",
	xml: "file-xml",
	json: "file-json",
	html: "file-html",
	htm: "file-html",
	css: "file-css",
	java: "file-java",
	php: "file-php",
	py: "file-python",
	python: "file-python",
	sh: "file-sh",
	bash: "file-sh",
	go: "file-go",
	js: "file-js",
	mjs: "file-js",
	cjs: "file-js",
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
	mysql: "mysql",
	replay: "replay",
	playback: "replay",
	customfile: "custom",
}

function normalizeExtension(fileExtension?: string): string | null {
	if (!fileExtension) return null
	return fileExtension.replace(/^\./, "").toLocaleLowerCase()
}

function getIconName(caseType?: string | null): string {
	if (!caseType) return "other"
	return getMagicProjectType(caseType)?.iconName ?? iconNameMap[caseType] ?? "other"
}

/**
 * 根据文件扩展名获取对应的图标URL
 * @param fileExtension 文件扩展名（可带点或不带点）
 * @returns 图标的URL字符串
 */
export function getFileIconByType(fileExtension?: string): string {
	const caseType = normalizeExtension(fileExtension)
	const iconName = getIconName(caseType)

	if (iconCache[iconName]) return iconCache[iconName]

	const iconPath = `./assets/${iconName}.svg`
	const loader = iconModules[iconPath]

	if (loader)
		loader()
			.then((src) => {
				iconCache[iconName] = src
			})
			.catch(() => {
				console.error(`Failed to load icon for ${iconName}`)
			})

	return ""
}

export async function loadFileIconByType(fileExtension?: string): Promise<string | null> {
	const caseType = normalizeExtension(fileExtension)
	const iconName = getIconName(caseType)

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
	/** 例如 custom 文件夹 icon 解析后的临时 URL；加载失败时回退内置类型图标 */
	remoteIconUrl?: string
	/** 仅未知扩展名使用；文件内容分类由业务调用方提供，不在基础图标中读取文件。 */
	fallbackIcon?: React.ReactNode
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
	remoteIconUrl,
	fallbackIcon,
}: MagicFileIconProps) {
	const { styles } = useStyles()

	const [icon, setIcon] = useState<string | null>(() => getFileIconByType(type) || null)
	const [remoteFailed, setRemoteFailed] = useState(false)

	useEffect(() => {
		setRemoteFailed(false)
	}, [remoteIconUrl])

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

	if (remoteIconUrl && !remoteFailed) {
		return (
			<div
				className={cx(styles.fileIcon, className)}
				style={{ width: size, height: size, ...style }}
			>
				<img
					src={remoteIconUrl}
					draggable={false}
					alt={type}
					className={styles.image}
					onError={() => setRemoteFailed(true)}
				/>
			</div>
		)
	}

	if (getIconName(normalizeExtension(type)) === "other") {
		return fallbackIcon ? (
			<>{fallbackIcon}</>
		) : (
			<div
				className={cx(styles.fileIcon, className)}
				style={{ width: size, height: size, ...style }}
			>
				<img src={otherIcon} draggable={false} alt={type} className={styles.image} />
			</div>
		)
	}

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
