import { useCallback, useRef, useState } from "react"
import { ListOrdered, Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import type { ImageElement } from "../../../runtime/document/types"
import styles from "./index.module.css"
import { useImageRename } from "./useImageRename"
import RenameNameField from "./RenameNameField"
import ImageRenameFileRow from "./ImageRenameFileRow"
import RenamePanelShell from "./RenamePanelShell"

export default function ImageRenamePanel({ element }: { element: ImageElement }) {
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const form = useImageRename(element)
	const [batchOpen, setBatchOpen] = useState(false)
	const baseBeforeFocus = useRef(form.baseName)
	const readyCount = new Set(form.rows.flatMap((row) => (row.file ? [row.file.fileId] : []))).size
	const pendingCount = form.rows.filter((row) => row.processing).length
	const titleChanged = form.elementName.trim() !== form.originalName.trim()
	const close = useCallback(() => {
		if (!form.saving) canvas?.elementRenameManager.cancelRename()
	}, [canvas, form.saving])
	return (
		<RenamePanelShell
			elementId={element.id}
			onClose={close}
			isCloseBlocked={form.saving}
			footer={
				<div className={styles.renameFooter}>
					{form.error && (
						<p role="alert" className="m-0 text-xs text-destructive">
							{form.error}
						</p>
					)}
					<div className={styles.renameFooterRow}>
						<div className={styles.renameStatus} aria-live="polite">
							{form.titleSaved && (
								<span className="text-success">
									{t("rename.titleSaved", "元素名称已保存")}
								</span>
							)}
							{form.successCount > 0 && (
								<span className="text-success">
									{t("rename.succeeded", {
										defaultValue: "{{count}} 个文件已改名",
										count: form.successCount,
									})}
								</span>
							)}
							{form.failedCount > 0 && (
								<span className="text-destructive">
									{t("rename.failedCount", {
										defaultValue: "{{count}} 个文件未改名",
										count: form.failedCount,
									})}
								</span>
							)}
							{!form.successCount &&
								!form.failedCount &&
								!form.titleSaved &&
								(form.changes.length > 0 ? (
									<span>
										{t("rename.changesCount", {
											defaultValue: "{{count}} 个文件待重命名",
											count: form.changes.length,
										})}
										{titleChanged && (
											<> · {t("rename.titleChanged", "标题待修改")}</>
										)}
									</span>
								) : (
									<span>
										{titleChanged
											? t("rename.titleChanged", "标题待修改")
											: t("rename.unchanged", "名称尚未修改")}
									</span>
								))}
						</div>
						<div className={styles.renameActions}>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={form.saving ? form.requestStop : close}
							>
								{form.saving
									? t("rename.stop", "停止后续操作")
									: form.titleSaved || form.successCount > 0
										? t("rename.close", "关闭")
										: t("rename.cancel", "取消")}
							</Button>
							<Button
								type="button"
								size="sm"
								disabled={form.saving || !form.dirty || !form.elementName.trim()}
								onClick={() => void form.save()}
							>
								{form.saving && <Loader2 size={16} className="animate-spin" />}
								{form.failedCount
									? t("rename.retry", "重试未完成项")
									: t("rename.save", "确认重命名")}
							</Button>
						</div>
					</div>
				</div>
			}
		>
			<p className="sr-only">
				{t("rename.description", "修改图片标题和各版本文件名，确认后生效。")}
			</p>
			<div className={styles.renameBody}>
				<div className={styles.renameSection}>
					<div
						className={`${styles.renameSectionHeader} ${styles.renameImageTitleHeader}`}
					>
						<span className={styles.renameSectionLabel}>
							{t("rename.imageTitle", "图片标题（元素名称）")}
						</span>
						<span className={styles.renameSectionHint}>
							{t("rename.sharedTitle", "各版本共用，文件名独立")}
						</span>
					</div>
					<div className={styles.renameField}>
						<RenameNameField
							value={form.elementName}
							onChange={form.setElementName}
							label={t("rename.imageTitle", "图片标题（元素名称）")}
							disabled={form.saving}
						/>
					</div>
					<div className={styles.renameVersionHeader}>
						<span className={styles.renameVersionLabel}>
							{t("rename.versionFiles", "版本文件名")}
						</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							className={`${styles.renameCompactButton} gap-1.5`}
							disabled={form.saving}
							aria-expanded={batchOpen}
							onClick={() => setBatchOpen(!batchOpen)}
						>
							<ListOrdered size={16} />
							{batchOpen
								? t("rename.collapseBatch", "收起批量命名")
								: t("rename.batch", "批量命名")}
						</Button>
					</div>
					{!batchOpen && form.appliedBaseName && (
						<div className={styles.renameSummary}>
							<span className="shrink-0">
								{t("rename.filledCount", {
									defaultValue: "已填写 {{count}} 个文件",
									count: form.appliedFileCount,
								})}
							</span>
							<span className={styles.renameSummaryValue}>
								{form.appliedBaseName}_v1、_v2…
							</span>
						</div>
					)}
					{batchOpen && (
						<div className={styles.renameBatch}>
							<div className={styles.renameBatchHeader}>
								<span className={styles.renameSectionLabel}>
									{t("rename.batchSetting", "批量设置名称")}
								</span>
								<span className={styles.renameBatchMeta}>
									{t("rename.fileCount", {
										defaultValue: "{{count}} 个文件",
										count: readyCount,
									})}{" "}
									·{" "}
									{form.appliedBaseName === form.baseName.trim() &&
									form.appliedFileCount === readyCount
										? t("rename.filled", "已填写")
										: t("rename.unapplied", "待应用")}
								</span>
							</div>
							<div className={styles.renameBatchInputRow}>
								<div className={styles.renameBatchInput}>
									<div className={styles.renameBatchInputContent}>
										<Input
											aria-label={t("rename.baseName", "批量命名基础名称")}
											className="h-9 min-w-0 border-0 text-sm shadow-none focus-visible:ring-0"
											value={form.baseName}
											disabled={form.saving}
											onFocus={() => {
												baseBeforeFocus.current = form.baseName
											}}
											onKeyDown={(event) => {
												if (
													event.nativeEvent.isComposing ||
													event.nativeEvent.keyCode === 229
												)
													return
												if (event.key === "Enter") {
													event.preventDefault()
													event.currentTarget.blur()
												}
												if (event.key === "Escape") {
													event.preventDefault()
													event.stopPropagation()
													form.setBaseName(baseBeforeFocus.current)
													event.currentTarget.blur()
												}
											}}
											onChange={(event) =>
												form.setBaseName(event.target.value)
											}
										/>
										<span className={styles.renameBatchSuffix}>_v1、_v2…</span>
									</div>
								</div>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="h-9 shrink-0 text-xs"
									disabled={form.saving || !form.baseName.trim() || !readyCount}
									onClick={form.applyUniformNames}
								>
									{t("rename.uniform", "批量应用到下方")}
								</Button>
							</div>
							<p className={styles.renameBatchHint}>
								{t(
									"rename.uniformHint",
									"点击「批量应用到下方」填写各版本名称，确认后才改文件。",
								)}
								{pendingCount > 0 && (
									<>
										{" "}
										{t("rename.pendingExcluded", {
											defaultValue: "{{count}} 个生成中版本暂不参与。",
											count: pendingCount,
										})}
									</>
								)}
							</p>
						</div>
					)}
				</div>
			</div>
			{/* 少量版本按内容决定高度；达到窗口上限时只有文件列表滚动。 */}
			<div className={styles.renameFileList}>
				<ScrollArea
					data-floating-scroll-trap="dynamic"
					className={`${styles.renameScrollable} min-h-0`}
					viewportClassName={`${styles.renameFileScrollViewport} [&>div]:!block`}
				>
					<ul className={`${styles.renameFileRows} divide-y divide-border`}>
						{form.rows.map((row) => (
							<ImageRenameFileRow
								key={row.content.contentId}
								row={row}
								element={element}
								saving={form.saving}
								onChange={form.setFileName}
							/>
						))}
					</ul>
				</ScrollArea>
			</div>
		</RenamePanelShell>
	)
}
