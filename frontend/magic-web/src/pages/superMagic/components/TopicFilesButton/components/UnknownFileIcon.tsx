import { observer } from "mobx-react-lite"
import { useLocation } from "react-router"
import type { CSSProperties } from "react"
import otherIcon from "@/components/base/MagicFileIcon/assets/other.svg"
import textIcon from "@/components/base/MagicFileIcon/assets/text-generic.svg"
import binaryIcon from "@/components/base/MagicFileIcon/assets/binary.svg"
import { fileIconStore } from "@/pages/superMagic/stores/fileIconStore"
import { getSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"
import {
	getFileContentKey,
	type FileContentMetadata,
} from "@/pages/superMagic/utils/fileContentType"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"

interface UnknownFileIconProps {
	file: FileContentMetadata
	size?: number
	className?: string
	style?: CSSProperties
}

/** 只观察一个文件的分类；图标渲染不能触发内容下载或遍历附件树。 */
export const UnknownFileIcon = observer(function UnknownFileIcon({
	file,
	size = 16,
	className,
	style,
}: UnknownFileIconProps) {
	const { pathname } = useLocation()
	const scope = JSON.stringify([getSharedMediaResourceScope(), pathname])
	const kind = fileIconStore.getContentKind(getFileContentKey(scope, file))
	const fileType = getFileType(file.file_extension || "")
	const isKnownText = ["text", "md", "code", "html"].includes(fileType)
	const src =
		kind === "binary" ? binaryIcon : kind === "text" || isKnownText ? textIcon : otherIcon

	return (
		<img
			src={src}
			alt=""
			aria-hidden
			draggable={false}
			width={size}
			height={size}
			className={className}
			style={{ flexShrink: 0, objectFit: "contain", ...style }}
		/>
	)
})
