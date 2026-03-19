import { memo, useEffect, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { FilePenLine, Save, X, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Kbd } from "@/components/shadcn-ui/kbd"
import { HTMLGuideTourElementId } from "@/pages/superMagic/hooks/useHTMLGuideTour"
import ConditionalTooltip from "./ConditionalTooltip"
import { useIsMobile } from "@/hooks/useIsMobile"

interface FileEditButtonsProps {
	/** 是否处于编辑模式 */
	isEditMode?: boolean
	/** 是否正在保存 */
	isSaving?: boolean
	/** 是否显示按钮文字 */
	showButtonText?: boolean
	/** 编辑按钮点击回调 */
	onEdit?: () => void
	/** 保存按钮点击回调 */
	onSave?: () => void | Promise<void>
	/** 保存并退出按钮点击回调 */
	onSaveAndExit?: () => void | Promise<void>
	/** 取消按钮点击回调 */
	onCancel?: () => void
}

function FileEditButtons({
	isEditMode = false,
	isSaving = false,
	showButtonText = false,
	onEdit,
	onSave,
	onSaveAndExit,
	onCancel,
}: FileEditButtonsProps) {
	const { t } = useTranslation("super")
	const [isSavingLocal, setIsSavingLocal] = useState(false)
	const isMac =
		typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
	const isMobile = useIsMobile()

	const handleSave = useCallback(async () => {
		if (isSaving || isSavingLocal || !onSave) return
		setIsSavingLocal(true)
		try {
			await onSave()
		} finally {
			setIsSavingLocal(false)
		}
	}, [onSave, isSaving, isSavingLocal])

	const handleSaveAndExit = useCallback(async () => {
		if (isSaving || isSavingLocal || !onSaveAndExit) return
		setIsSavingLocal(true)
		try {
			await onSaveAndExit()
		} finally {
			setIsSavingLocal(false)
		}
	}, [onSaveAndExit, isSaving, isSavingLocal])

	const handleCancel = useCallback(() => {
		if (onCancel) {
			onCancel()
		}
	}, [onCancel])

	useEffect(() => {
		if (!isEditMode) return

		const handleKeyDown = (e: KeyboardEvent) => {
			const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

			// Escape 退出编辑模式
			if (e.key === "Escape") {
				e.preventDefault()
				handleCancel()
				return
			}

			// Cmd/Ctrl + S 保存
			if (isCmdOrCtrl && e.key === "s") {
				e.preventDefault()
				if (e.shiftKey) {
					void handleSaveAndExit()
				} else {
					void handleSave()
				}
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [isEditMode, handleSave, handleSaveAndExit, handleCancel, isMac])

	const showSaving = isSaving || isSavingLocal

	return (
		<div className="flex items-center gap-1" id={HTMLGuideTourElementId.HTMLFileEditButton}>
			{!isEditMode ? (
				<ConditionalTooltip showText={showButtonText} title={t("fileViewer.edit")}>
					<Button
						variant="outline"
						size="sm"
						onClick={onEdit}
						className={outlineActionButtonClassName}
					>
						<FilePenLine size={16} />
						{showButtonText && <span>{t("fileViewer.edit")}</span>}
					</Button>
				</ConditionalTooltip>
			) : (
				<>
					<ConditionalTooltip
						showText={showButtonText}
						title={showSaving ? t("fileViewer.saving") : t("fileViewer.save")}
					>
						<Button
							variant="default"
							size="sm"
							onClick={handleSave}
							disabled={showSaving}
							className={primaryActionButtonClassName}
						>
							{showSaving ? (
								<Loader2 size={16} className="animate-spin" />
							) : (
								<Save size={16} />
							)}
							{showButtonText && (
								<span>
									{showSaving ? t("fileViewer.saving") : t("fileViewer.save")}
								</span>
							)}
							{!isMobile && (
								<div className="flex h-4 items-center gap-0.5">
									<Kbd className={primaryShortcutKbdClassName}>
										{isMac ? "⌘" : "Ctrl"}
									</Kbd>
									<Kbd className={primaryShortcutKbdClassName}>S</Kbd>
								</div>
							)}
						</Button>
					</ConditionalTooltip>
					{onSaveAndExit && (
						<ConditionalTooltip
							showText={showButtonText}
							title={t("fileViewer.saveAndExit")}
						>
							<Button
								variant="outline"
								size="sm"
								onClick={handleSaveAndExit}
								disabled={showSaving}
								className={outlineActionButtonClassName}
							>
								{showButtonText && <span>{t("fileViewer.saveAndExit")}</span>}
								{!isMobile && (
									<div className="flex h-4 items-center gap-0.5">
										<Kbd className={outlineShortcutKbdClassName}>
											{isMac ? "⇧" : "Shift"}
										</Kbd>
										<Kbd className={outlineShortcutKbdClassName}>
											{isMac ? "⌘" : "Ctrl"}
										</Kbd>
										<Kbd className={outlineShortcutKbdClassName}>S</Kbd>
									</div>
								)}
							</Button>
						</ConditionalTooltip>
					)}
					<ConditionalTooltip showText={showButtonText} title={t("fileViewer.cancel")}>
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancel}
							disabled={showSaving}
							className={outlineActionButtonClassName}
						>
							{showButtonText ? (
								<span>{t("fileViewer.cancel")}</span>
							) : (
								<X size={16} />
							)}
						</Button>
					</ConditionalTooltip>
				</>
			)}
		</div>
	)
}

const primaryActionButtonClassName =
	"h-6 gap-1.5 rounded-[8px] px-3 py-0 text-xs font-normal shadow-xs"

const outlineActionButtonClassName =
	"h-6 gap-1.5 rounded-[8px] px-3 py-0 text-xs font-normal text-foreground shadow-xs"

const primaryShortcutKbdClassName =
	"h-4 min-w-5 rounded-[4px] border-0 bg-primary-foreground/20 px-1 text-xs font-normal leading-4 text-primary-foreground shadow-none"

const outlineShortcutKbdClassName =
	"h-4 min-w-5 rounded-[4px] border-0 bg-muted px-1 text-xs font-normal leading-4 text-muted-foreground shadow-none"

export default memo(FileEditButtons)
