import { memo, useEffect, useCallback, useRef, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { FilePenLine, Save, X, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Kbd } from "@/components/shadcn-ui/kbd"
import ConditionalTooltip from "./ConditionalTooltip"
import { useIsMobile } from "@/hooks/useIsMobile"
import { runGuardedAction } from "../../utils/actionGuard"
import type { BeforeAction } from "../../utils/actionGuard"
import { cn } from "@/utils/cn"
import { FileSaveSyncBadge } from "../FileSaveSyncBadge"

interface FileEditButtonsProps {
	/** Unique file id used for the unsynced save badge. */
	fileId?: string
	/** Stable test id scope for the edit actions rendered by this component. */
	testIdPrefix?: string
	/** 是否禁用当前工具栏交互（例如 PPT 冷切页等待目标页 ready 时） */
	interactionDisabled?: boolean
	/** 是否处于编辑模式 */
	isEditMode?: boolean
	/** 是否正在保存 */
	isSaving?: boolean
	/** 是否显示按钮文字 */
	showButtonText?: boolean
	/** 编辑入口文案，未传入时使用通用文案 */
	editLabel?: string
	/** 编辑按钮点击回调 */
	onEdit?: () => void | Promise<void>
	/** Optional guard run before entering edit mode. */
	beforeAction?: BeforeAction
	/** 保存按钮点击回调 */
	onSave?: () => void | Promise<void>
	/** 保存并退出按钮点击回调 */
	onSaveAndExit?: () => void | Promise<void>
	/** 取消按钮点击回调 */
	onCancel?: () => void
	/** 全屏等场景下将 Tooltip 挂载到指定容器内 */
	getPopupContainer?: () => HTMLElement | null
}

function FileEditButtons({
	testIdPrefix,
	fileId,
	interactionDisabled = false,
	isEditMode = false,
	isSaving = false,
	showButtonText = false,
	editLabel,
	onEdit,
	beforeAction,
	onSave,
	onSaveAndExit,
	onCancel,
	getPopupContainer,
}: FileEditButtonsProps) {
	const { t } = useTranslation("super")
	// Prevent double-submit without freezing the toolbar on "保存中…".
	// Save progress is shown by the preview corner chip / sync badge instead.
	const saveInFlightRef = useRef(false)
	const isMac =
		typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
	const isMobile = useIsMobile()

	const runGuardedSave = useCallback(
		async (action?: () => void | Promise<void>) => {
			if (interactionDisabled || isSaving || saveInFlightRef.current || !action) return
			saveInFlightRef.current = true
			try {
				await action()
			} catch (error) {
				console.error(error)
			} finally {
				saveInFlightRef.current = false
			}
		},
		[interactionDisabled, isSaving],
	)

	const handleSave = useCallback(() => {
		void runGuardedSave(onSave)
	}, [onSave, runGuardedSave])

	const handleSaveAndExit = useCallback(() => {
		void runGuardedSave(onSaveAndExit)
	}, [onSaveAndExit, runGuardedSave])

	const handleCancel = useCallback(
		(event?: MouseEvent<HTMLButtonElement>) => {
			// Button clicks can land on the iframe after the toolbar unmounts.
			event?.stopPropagation()
			if (!interactionDisabled && onCancel) {
				onCancel()
			}
		},
		[interactionDisabled, onCancel],
	)

	const handleEdit = useCallback(() => {
		if (interactionDisabled || !onEdit) return
		void runGuardedAction(beforeAction, onEdit)
	}, [beforeAction, interactionDisabled, onEdit])

	useEffect(() => {
		if (!isEditMode || interactionDisabled) return

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
					handleSaveAndExit()
				} else {
					handleSave()
				}
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [interactionDisabled, isEditMode, handleSave, handleSaveAndExit, handleCancel, isMac])

	// Only the parent-driven flag may paint "保存中…"; local work must not freeze the chrome.
	const showSaving = isSaving
	const resolvedEditLabel = editLabel ?? t("fileViewer.edit")
	const outlineButtonClassName = getOutlineActionButtonClassName(showButtonText)
	const primaryButtonClassName = getPrimaryActionButtonClassName(showButtonText)

	return (
		<div
			className="flex items-center gap-1"
			data-testid={testIdPrefix ? `${testIdPrefix}-file-actions` : undefined}
		>
			{!isEditMode ? (
				<ConditionalTooltip
					showText={showButtonText}
					title={resolvedEditLabel}
					getPopupContainer={getPopupContainer}
				>
					<Button
						data-testid={testIdPrefix ? `${testIdPrefix}-edit-button` : undefined}
						variant="outline"
						size="sm"
						onClick={handleEdit}
						disabled={interactionDisabled}
						className={outlineButtonClassName}
					>
						<FilePenLine size={16} />
						{showButtonText && <span>{resolvedEditLabel}</span>}
					</Button>
				</ConditionalTooltip>
			) : (
				<>
					<FileSaveSyncBadge fileId={fileId} />
					<ConditionalTooltip
						showText={showButtonText}
						title={showSaving ? t("fileViewer.saving") : t("fileViewer.save")}
						getPopupContainer={getPopupContainer}
					>
						<Button
							data-testid={testIdPrefix ? `${testIdPrefix}-save-button` : undefined}
							variant="default"
							size="sm"
							onClick={handleSave}
							disabled={interactionDisabled || showSaving}
							className={primaryButtonClassName}
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
							{!isMobile && showButtonText && (
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
							getPopupContainer={getPopupContainer}
						>
							<Button
								data-testid={
									testIdPrefix
										? `${testIdPrefix}-save-and-exit-button`
										: undefined
								}
								variant="outline"
								size="sm"
								onClick={handleSaveAndExit}
								disabled={interactionDisabled || showSaving}
								className={outlineButtonClassName}
							>
								{showButtonText && <span>{t("fileViewer.saveAndExit")}</span>}
								{!isMobile && showButtonText && (
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
					<ConditionalTooltip
						showText={showButtonText}
						title={t("fileViewer.cancel")}
						getPopupContainer={getPopupContainer}
					>
						<Button
							data-testid={testIdPrefix ? `${testIdPrefix}-cancel-button` : undefined}
							variant="outline"
							size="sm"
							onClick={handleCancel}
							disabled={interactionDisabled || showSaving}
							className={outlineButtonClassName}
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

const getPrimaryActionButtonClassName = (showButtonText: boolean) =>
	cn(
		"h-6 rounded-[8px] py-0 text-xs font-normal shadow-xs",
		showButtonText ? "gap-1.5 px-3" : "gap-0 px-1.5",
	)

const getOutlineActionButtonClassName = (showButtonText: boolean) =>
	cn(
		"h-6 rounded-[8px] py-0 text-xs font-normal text-foreground shadow-xs",
		showButtonText ? "gap-1.5 px-3" : "gap-0 px-1.5",
	)

const primaryShortcutKbdClassName =
	"h-4 min-w-5 rounded-[4px] border-0 bg-primary-foreground/20 px-1 text-xs font-normal leading-4 text-primary-foreground shadow-none"

const outlineShortcutKbdClassName =
	"h-4 min-w-5 rounded-[4px] border-0 bg-muted px-1 text-xs font-normal leading-4 text-muted-foreground shadow-none"

export default memo(FileEditButtons)
