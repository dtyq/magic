import { useCallback, useRef, useState } from "react"
import type { ImageElement } from "../../../runtime/document/types"
import { getActiveImageContent } from "../../../runtime/document/elementContent"
import { GenerationStatus, type CanvasImageRenameFile } from "../../../public/magic-types"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useMagic } from "../../../app/providers/MagicProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { useGenerationRuntime } from "../../../app/hooks/canvas/useGenerationRuntime"
import { splitRenameFileName } from "./useImageRename"
import { getEditableElementName } from "../../../runtime/interaction/rename/renameUtils"
import { useRenameOperationState } from "./useRenameOperationState"

/** 草稿只存在于面板中；文件先完成后再提交标题，失败仍可继续修改。 */
export function useSingleImageRename(element: ImageElement) {
	const { canvas } = useCanvas()
	const { methods } = useMagic()
	const { t } = useCanvasDesignI18n()
	const content = getActiveImageContent(element)
	const runtime = useGenerationRuntime(element.id, content.contentId)
	const processing =
		Boolean(runtime) ||
		content.status === GenerationStatus.Pending ||
		content.status === GenerationStatus.Processing
	const file =
		!processing && content.src
			? methods?.imageRename?.resolveImageRenameFile(content.src)
			: undefined
	const boundFile = useRef<CanvasImageRenameFile>()
	const boundContentId = useRef<string>()
	if (file && !boundFile.current) {
		boundFile.current = file
		boundContentId.current = content.contentId
	}
	const originalTitle = useRef(
		getEditableElementName(element, canvas?.elementManager.getElementInstance(element.id)),
	)
	const [title, setTitle] = useState(originalTitle.current)
	const [fileDraft, setFileDraft] = useState<string>()
	const [linked, setLinked] = useState(true)
	const { saving, error, isSaving, begin, finish, setError, clearError } =
		useRenameOperationState()
	const expectedName =
		runtime?.generateImageRequest?.name || content.generateImageRequest?.name || ""
	const source = splitRenameFileName(boundFile.current?.fileName || expectedName)
	const fileBase = fileDraft ?? source.base
	const fileValue = file && linked && title !== originalTitle.current ? title : fileBase
	const targetFileName = `${fileValue.trim()}${source.extension}`
	const changedFile = Boolean(boundFile.current && targetFileName !== boundFile.current.fileName)
	const dirty = title.trim() !== originalTitle.current || (Boolean(file) && changedFile)
	const close = useCallback(() => {
		if (!isSaving()) canvas?.elementRenameManager.cancelRename()
	}, [canvas, isSaving])
	const save = async () => {
		if (!canvas || isSaving() || !dirty || !title.trim()) return
		const bound = boundFile.current
		if (
			changedFile &&
			(!file ||
				!bound ||
				file.fileId !== bound.fileId ||
				content.contentId !== boundContentId.current)
		) {
			setError(t("rename.fileChanged", "文件已变化，请重新打开命名面板。"))
			return
		}
		if (changedFile && !fileValue.trim()) return
		if (!begin()) return
		try {
			// 即使标题不变也允许只改文件；显式空选项阻止旧入口自动联动文件。
			await canvas.elementRenameManager.commitRename(title, {
				fileChange:
					changedFile && bound
						? {
								elementId: element.id,
								contentId: boundContentId.current || content.contentId,
								fileId: bound.fileId,
								expectedName: bound.fileName,
								targetName: targetFileName,
							}
						: undefined,
			})
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : t("rename.failed", "重命名失败"))
		} finally {
			finish()
		}
	}
	return {
		title,
		setTitle: (value: string) => {
			setTitle(value)
			clearError()
		},
		fileValue: processing ? splitRenameFileName(expectedName).base : fileValue,
		extension: processing ? splitRenameFileName(expectedName).extension : source.extension,
		setFileValue: (value: string) => {
			setFileDraft(value)
			setLinked(false)
			clearError()
		},
		linked,
		setLinked: (value: boolean) => {
			setLinked(value)
			clearError()
		},
		file,
		processing,
		saving,
		error,
		dirty,
		save,
		close,
	}
}
