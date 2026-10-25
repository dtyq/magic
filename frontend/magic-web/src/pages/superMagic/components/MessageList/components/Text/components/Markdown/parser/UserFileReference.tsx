import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { observer } from "mobx-react-lite"
import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type {
	FileReferenceSelector,
	FileReference as FileReferenceMetadata,
} from "@/apis/modules/superMagic"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { createUserFileMention } from "@/components/business/MentionPanel/utils/fileReferenceMention"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "@/pages/superMagic/services/userFileReferenceResolver"
import {
	createUserFileHref,
	getFileDisplayPath,
} from "@/pages/superMagic/utils/markdownFileReference"
import { useMessageListContext } from "@/pages/superMagic/components/MessageList/context"
import { openUserFileReference } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import { FileReference } from "./FileReference"
import { getFileMediaMetadata } from "@/pages/superMagic/services/useFileMediaSource"

type UserReference = Extract<FileReferenceMetadata, { space_type: "user" }>

interface Resolution {
	key: string
	reference: UserReference | null
}

interface UserFileReferenceProps {
	selector: FileReferenceSelector
	label: ReactNode
	href?: string
	/** 富引用保留真实 ID；无权访问时也不能退回同路径查询。 */
	mentionAttrs?: TiptapMentionAttributes
}

export const UserFileReference = observer(function UserFileReference({
	selector,
	label,
	href,
	mentionAttrs,
}: UserFileReferenceProps) {
	const { t } = useTranslation("super")
	const { allowUserFileReferences = false } = useMessageListContext()
	const identity = getFileReferenceIdentityKey()
	const id = "file_id" in selector ? selector.file_id : undefined
	const path = "space_relative_path" in selector ? selector.space_relative_path : undefined
	const key = JSON.stringify([identity, id, path])
	const [resolution, setResolution] = useState<Resolution | null>(null)
	const enabled = allowUserFileReferences && Boolean(identity)

	useEffect(() => {
		if (!enabled) return
		const controller = new AbortController()
		const target: FileReferenceSelector = id
			? { file_id: id }
			: { space_type: "user", space_relative_path: path || "" }
		void resolveFileReference(target, controller.signal)
			.then((result) => {
				if (controller.signal.aborted) return
				setResolution({
					key,
					reference:
						result.status === "resolved" && result.reference.space_type === "user"
							? result.reference
							: null,
				})
			})
			.catch(() => {
				if (!controller.signal.aborted) setResolution({ key, reference: null })
			})
		return () => controller.abort()
	}, [enabled, id, key, path])

	const current = enabled && resolution?.key === key ? resolution : null
	const reference = current?.reference
	const loading = enabled && current === null
	const canonicalHref = reference
		? createUserFileHref(reference.space_relative_path, reference.is_directory) || href
		: href
	const attrs = reference ? createUserFileMention(reference) : undefined

	return (
		<FileReference
			mediaFile={
				reference ? getFileMediaMetadata({ ...reference, file_reference: reference }) : null
			}
			presentation={
				reference
					? resolveFilePresentation(
							{ ...reference, file_reference: reference },
							{ context: { kind: "user" } },
						)
					: undefined
			}
			label={reference?.file_name || label}
			href={canonicalHref}
			mentionAttrs={attrs ?? mentionAttrs}
			fileType={reference?.file_extension}
			isDirectory={reference?.is_directory}
			disabled={!reference}
			loading={loading}
			onClick={
				reference && !reference.is_directory
					? () => openUserFileReference(reference)
					: undefined
			}
			title={
				loading
					? t("common.loading")
					: reference
						? getFileDisplayPath({ file_reference: reference })
						: t("common.fileNotFoundOrLoadFailed")
			}
		/>
	)
})
