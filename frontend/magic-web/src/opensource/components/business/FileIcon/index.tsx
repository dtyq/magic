import MagicIcon from "@/opensource/components/base/MagicIcon"
import TSIcon from "@/opensource/components/base/TSIcon"
import { IconFile } from "@tabler/icons-react"
import { EXTENSION_ICON_MAP, IMAGE_EXTENSIONS } from "@/opensource/constants/file"

interface FileIconProps {
	ext?: string
	size?: number
	src?: string
}

const SupportedFileExt = Object.keys(EXTENSION_ICON_MAP)

const FileIcon = ({ ext, src, size = 16 }: FileIconProps) => {
	switch (true) {
		case IMAGE_EXTENSIONS.includes(ext ?? "") && Boolean(src):
			return <img src={src} width={size} alt={src} />
		case ext && SupportedFileExt.includes(ext):
			return <TSIcon type={EXTENSION_ICON_MAP[ext]} size={`${size}px`} />
		default:
			return <MagicIcon component={IconFile} size={size} color="currentColor" />
	}
}

export default FileIcon
