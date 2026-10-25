import type { AttachmentItem } from "../hooks/types"
import type { FileHelpContext } from "../utils/magic-system-folder"
import type { SkillFileKind } from "../utils/skill-file-structure"
import { getFilePresentationIndex } from "../utils/file-presentation"
import { useFilePresentation } from "../hooks/useFilePresentation"
import { FileResourceIcon } from "./FileResourceIcon"
import { ProjectFileImageThumbnailIcon } from "./ProjectFileImageThumbnailIcon"
interface MobileAttachmentRowIconProps {
	filePath?: string
	fileHelpContext?: FileHelpContext
	skillKind?: SkillFileKind
	item: AttachmentItem
	attachments: AttachmentItem[]
	size?: number
	className?: string
	dataTestId?: string
}

/** Shares the mobile file-row icon rules between project detail and share default-file picker. */
export function MobileAttachmentRowIcon({
	filePath,
	fileHelpContext,
	skillKind,
	item,
	attachments,
	size = 24,
	className,
	dataTestId,
}: MobileAttachmentRowIconProps) {
	const presentation = useFilePresentation(item, {
		context: fileHelpContext,
		index: getFilePresentationIndex(attachments),
		skillKind,
		path: filePath,
	})
	return (
		<ProjectFileImageThumbnailIcon
			item={item}
			size={size}
			className={className}
			dataTestId={dataTestId}
			fallback={
				<FileResourceIcon presentation={presentation} size={size} className={className} />
			}
		/>
	)
}
