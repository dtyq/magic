import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import magicToast from "@/components/base/MagicToaster/utils"
import { buildAttachmentIndex, type AttachmentIndex } from "../utils/attachmentIndex"
import type { ConfirmFileOperation, FileOperationConfirmation, AttachmentItem } from "./types"

interface ConfirmationItem {
	id: string
	name: string
	path: string
	folder: boolean
	dependency: boolean
}

interface ConfirmationState {
	operation: FileOperationConfirmation["operation"]
	items: ConfirmationItem[]
	source: string
	target: string
	selectedCount: number
	skippedCount: number
	warning: string
}

/** 确认只保存轻量快照。取消、关闭或身份变化均结束等待，不保留待执行队列。 */
export function useFileManagerConfirmation({
	scopeKey,
	isActive,
	rootName,
	index,
	attachments,
}: {
	scopeKey: string
	isActive: boolean
	rootName: string
	index: AttachmentIndex
	attachments: AttachmentItem[]
}) {
	const { t } = useTranslation("super")
	const [state, setState] = useState<ConfirmationState | null>(null)
	const pending = useRef<{ resolve: (value: boolean) => void; valid: () => boolean } | null>(null)
	const active = useRef(isActive)
	active.current = isActive
	const latestAttachments = useRef(attachments)
	latestAttachments.current = attachments
	const latestIndex = useRef(index)
	latestIndex.current = index
	const finish = useMemoizedFn((accepted: boolean) => {
		const current = pending.current
		if (!current) return
		pending.current = null
		const valid = !accepted || current.valid()
		setState(null)
		if (!valid) magicToast.warning(t("fileManager.confirmation.changed"))
		current.resolve(accepted && valid)
	})
	useEffect(() => {
		if (!isActive) finish(false)
		return () => finish(false)
	}, [scopeKey, isActive, finish])

	const confirm: ConfirmFileOperation = useMemoizedFn(
		async (request: FileOperationConfirmation) => {
			if (!active.current || pending.current) return false
			let items: ConfirmationItem[]
			let source = rootName
			let target = ""
			let selectedCount = 0
			let skippedCount = 0
			let warning = ""
			const identity = getFileReferenceIdentityKey()
			const children = new Map<string, ReadonlySet<string>>()
			const originals = new Map<
				string,
				{ parent: string | null | undefined; name: string | undefined }
			>()
			if ("fileIds" in request) {
				const sourceIndex = buildAttachmentIndex(request.sourceAttachments, {
					includeHidden: true,
				})
				const selected = new Set(request.selectedIds ?? request.fileIds)
				items = []
				for (const id of new Set(request.fileIds)) {
					const file = sourceIndex.getItemById(id)
					if (!file) {
						magicToast.warning(t("fileManager.confirmation.changed"))
						return false
					}
					const name = file.file_name || file.filename || file.name || id
					items.push({
						id,
						name,
						folder: Boolean(file.is_directory),
						path:
							file.relative_file_path ||
							[
								...sourceIndex
									.getParentItemsById(id)
									.map(
										(parent) =>
											parent.file_name || parent.filename || parent.name,
									),
								name,
							]
								.filter(Boolean)
								.join(" / "),
						dependency: request.operation !== "delete" && !selected.has(id),
					})
					const current = latestIndex.current.getItemById(id)
					if (current || request.operation === "delete") {
						originals.set(id, { parent: file.parent_id, name: file.file_name })
						if (request.operation === "delete" && file.is_directory)
							children.set(id, new Set(sourceIndex.getChildKeysById(id)))
					}
				}
				for (const target of request.targetPath ?? []) {
					const current = latestIndex.current.getItemById(target.file_id)
					if (current && target.file_id)
						originals.set(target.file_id, {
							parent: current.parent_id,
							name: current.file_name,
						})
				}
				source = request.sourceName || rootName
				target = [
					request.targetName || rootName,
					...(request.targetPath ?? []).map(
						(item) => item.file_name || item.filename || item.name,
					),
				]
					.filter(Boolean)
					.join(" / ")
				selectedCount = selected.size
				skippedCount = request.skippedCount ?? 0
				warning = request.warning ?? ""
			} else {
				const names =
					"files" in request
						? request.files.map((file) => file.webkitRelativePath || file.name)
						: request.names
				items = names.map((name, id) => ({
					id: String(id),
					name,
					path: name,
					folder: false,
					dependency: false,
				}))
				target = request.targetPath
				selectedCount = items.length
				if ("target" in request && request.target?.file_id) {
					const current = latestIndex.current.getItemById(request.target.file_id)
					if (current)
						originals.set(request.target.file_id, {
							parent: current.parent_id,
							name: current.file_name,
						})
				}
			}
			if (!items.length) return false
			return new Promise<boolean>((resolve) => {
				pending.current = {
					resolve,
					valid: () => {
						const currentIndex = buildAttachmentIndex(latestAttachments.current, {
							includeHidden: true,
						})
						return (
							active.current &&
							identity === getFileReferenceIdentityKey() &&
							[...children].every(([id, keys]) => {
								const current = currentIndex.getChildKeysById(id)
								return (
									current.length === keys.size &&
									current.every((key) => keys.has(key))
								)
							}) &&
							[...originals].every(([id, original]) => {
								const current = currentIndex.getItemById(id)
								return (
									current &&
									current.parent_id === original.parent &&
									current.file_name === original.name
								)
							})
						)
					},
				}
				setState({
					operation: request.operation,
					items,
					source,
					target,
					selectedCount,
					skippedCount,
					warning,
				})
			})
		},
	)
	return { state, confirm, cancel: () => finish(false), accept: () => finish(true) }
}
