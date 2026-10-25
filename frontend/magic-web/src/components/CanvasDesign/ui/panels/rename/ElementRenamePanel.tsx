import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import type { LayerElement } from "../../../runtime/document/types"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { getEditableElementName } from "../../../runtime/interaction/rename/renameUtils"
import styles from "./index.module.css"
import RenameNameField from "./RenameNameField"
import RenamePanelShell from "./RenamePanelShell"
import { useRenameOperationState } from "./useRenameOperationState"

interface ElementRenamePanelProps {
	element: LayerElement
}

/**
 * Shared rename surface for elements without an element-specific file rename flow.
 * Keeping this panel independent from media-specific form state makes the common name
 * update path reusable for frames, groups, shapes, text and future element types.
 */
export default function ElementRenamePanel({ element }: ElementRenamePanelProps) {
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const inputRef = useRef<HTMLTextAreaElement>(null)
	const initialNameRef = useRef(
		getEditableElementName(element, canvas?.elementManager.getElementInstance(element.id)),
	)
	const [value, setValue] = useState(initialNameRef.current)
	const { saving, error, isSaving, begin, finish, setError, clearError } =
		useRenameOperationState()

	const close = useCallback(() => {
		if (isSaving()) return
		canvas?.elementRenameManager.cancelRename()
	}, [canvas, isSaving])

	const save = useCallback(async () => {
		if (!canvas || isSaving()) return
		const name = value.trim()
		if (!name) {
			setError(t("rename.emptyName", "元素名称不能为空"))
			return
		}
		if (name === initialNameRef.current.trim()) {
			close()
			return
		}

		if (!begin()) return
		try {
			await canvas.elementRenameManager.commitRename(name)
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : t("rename.failed", "重命名失败"))
		} finally {
			finish()
		}
	}, [begin, canvas, close, finish, isSaving, setError, t, value])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			event.stopPropagation()
			if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
			if (event.key === "Enter") {
				event.preventDefault()
				void save()
				return
			}
			if (event.key === "Escape") {
				event.preventDefault()
				close()
			}
		},
		[close, save],
	)

	useLayoutEffect(() => {
		const frame = requestAnimationFrame(() => {
			inputRef.current?.focus()
			inputRef.current?.select()
		})
		return () => cancelAnimationFrame(frame)
	}, [element.id])

	const dirty = value.trim() !== initialNameRef.current.trim()

	return (
		<RenamePanelShell
			elementId={element.id}
			onClose={close}
			isCloseBlocked={saving}
			footer={
				<div className={`${styles.renameActions} ${styles.renameSingleFooter}`}>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={saving}
						onClick={close}
					>
						{t("rename.cancel", "取消")}
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={saving || !dirty || !value.trim()}
						onClick={() => void save()}
					>
						{saving && <Loader2 size={16} className="animate-spin" />}
						{t("rename.save", "确认重命名")}
					</Button>
				</div>
			}
		>
			<div className={styles.renameBody}>
				<div className={styles.renameSection}>
					<div className={styles.renameSectionHeader}>
						<label htmlFor="element-rename-name" className={styles.renameSectionLabel}>
							{t("rename.elementName", "元素名称")}
						</label>
						<span className={styles.renameSectionHint}>
							{t("rename.titleUsage", "画布中显示")}
						</span>
					</div>
					<div className={styles.renameField}>
						<RenameNameField
							id="element-rename-name"
							inputRef={inputRef}
							value={value}
							onChange={(nextValue) => {
								setValue(nextValue)
								clearError()
							}}
							label={t("rename.elementName", "元素名称")}
							disabled={saving}
							onKeyDown={handleKeyDown}
						/>
					</div>
					{error && (
						<p role="alert" className="m-0 text-xs text-destructive">
							{error}
						</p>
					)}
				</div>
			</div>
		</RenamePanelShell>
	)
}
