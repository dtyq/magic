import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { message } from "antd"
import { ChevronDown, Eye, History } from "lucide-react"
import { cn } from "@/utils/cn"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"

import type { SelfMediaBrandRecordService, StoredBrandRecord } from "@/services/selfMedia"
import type { AttachmentNode } from "../../../../services"
import type { SelfMediaFileStorageService } from "../../../../services/SelfMediaFileStorageService"
import type { BrandImageItem } from "../../types"
import { BrandInfoFields } from "./components/BrandInfoFields"
import { HistoryRecordPicker } from "./components/HistoryRecordPicker"
import { SaveConfirmDialog } from "./components/SaveConfirmDialog"

export type BrandAutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "failed"

interface BrandRecord {
	id: string
	author: string
	brandPosition: string
	targetAudience: string
	createdAt: number
}

export interface StepBrandInfoRef {
	checkBeforeNext: () => boolean
	isBrandAssetsReady: () => boolean
}

interface StepBrandInfoProps {
	author: string
	brandPosition: string
	targetAudience: string
	brandImages: BrandImageItem[]
	onChange: (field: "author" | "brandPosition" | "targetAudience", value: string) => void
	onBrandImagesChange: (images: BrandImageItem[]) => void
	fileStorageService?: SelfMediaFileStorageService | null
	brandService?: SelfMediaBrandRecordService | null
	attachmentList?: AttachmentNode[]
	onConfirmNext?: () => void
	onBrandImagesUploadingChange?: (uploading: boolean) => void
	brandImageUploadTarget?: "draft" | "brand"
	brandAutoSaveStatus?: BrandAutoSaveStatus
}

function getBrandAutoSaveMeta(
	status: BrandAutoSaveStatus,
	t: ReturnType<typeof useTranslation>["t"],
) {
	switch (status) {
		case "pending":
			return {
				label: t("detail.selfMedia.initPanel.stepBrand.autoSavePending", "稍后自动保存"),
				dotClassName: "bg-[#ffd637]",
			}
		case "saving":
			return {
				label: t("detail.selfMedia.initPanel.stepBrand.autoSaveSaving", "正在保存"),
				dotClassName: "animate-pulse bg-[#18181b]",
			}
		case "saved":
			return {
				label: t("detail.selfMedia.initPanel.stepBrand.autoSaveSaved", "已自动保存"),
				dotClassName: "bg-[#ffd637]",
			}
		case "failed":
			return {
				label: t("detail.selfMedia.initPanel.stepBrand.autoSaveFailed", "自动保存失败"),
				dotClassName: "bg-[#ff776c]",
			}
		default:
			return null
	}
}

const StepBrandInfo = forwardRef<StepBrandInfoRef, StepBrandInfoProps>(function StepBrandInfo(
	{
		author,
		brandPosition,
		targetAudience,
		brandImages,
		onChange,
		onBrandImagesChange,
		fileStorageService,
		brandService,
		attachmentList,
		onConfirmNext,
		onBrandImagesUploadingChange,
		brandImageUploadTarget = "draft",
		brandAutoSaveStatus = "idle",
	},
	ref,
) {
	const { t } = useTranslation("super")
	const [records, setRecords] = useState<BrandRecord[]>([])
	const [showRecordPicker, setShowRecordPicker] = useState(false)
	const [showSaveConfirm, setShowSaveConfirm] = useState(false)
	const [isSaveConfirming, setIsSaveConfirming] = useState(false)
	const [isBrandFormOpen, setIsBrandFormOpen] = useState(false)
	const hasAutoFilled = useRef(false)
	const hasAutoOpenedEmptyBrand = useRef(false)
	const hasUserEditedBrand = useRef(false)
	const hasResolvedSavePrompt = useRef(false)
	const saveConfirmingRef = useRef(false)
	const initialized = useRef(false)
	const hasBrandSummary = Boolean(author.trim() && brandPosition.trim())
	const brandHeaderStatus = hasBrandSummary
		? t("detail.selfMedia.initPanel.stepBrand.readyStatus", "品牌信息已就绪")
		: t("detail.selfMedia.initPanel.stepBrand.skippableStatus", "可跳过")
	const brandHeaderDescription = hasBrandSummary
		? t("detail.selfMedia.initPanel.stepBrand.readySummary", {
				author: author.trim(),
				brandPosition: brandPosition.trim(),
				defaultValue: "{{author}} · {{brandPosition}}",
			})
		: t("detail.selfMedia.initPanel.stepBrand.skippableHint", "后续可在品牌设置里补充。")
	const brandAutoSaveMeta = getBrandAutoSaveMeta(brandAutoSaveStatus, t)

	const isBrandAssetsReady = useCallback(() => {
		return !brandImages.some((img) => img.file.size > 0 && !img.uploadedPath)
	}, [brandImages])

	useImperativeHandle(
		ref,
		() => ({
			checkBeforeNext: () => {
				if (!isBrandAssetsReady()) return false
				if (
					hasUserEditedBrand.current &&
					!hasResolvedSavePrompt.current &&
					records.length === 0 &&
					author.trim() &&
					brandPosition.trim()
				) {
					setShowSaveConfirm(true)
					return false
				}
				return true
			},
			isBrandAssetsReady,
		}),
		[records.length, author, brandPosition, isBrandAssetsReady],
	)

	const markBrandEdited = useCallback(() => {
		hasUserEditedBrand.current = true
		hasResolvedSavePrompt.current = false
	}, [])

	const handleBrandFieldChange = useCallback(
		(field: "author" | "brandPosition" | "targetAudience", value: string) => {
			markBrandEdited()
			onChange(field, value)
		},
		[markBrandEdited, onChange],
	)

	const handleBrandImagesChange = useCallback(
		(images: BrandImageItem[]) => {
			markBrandEdited()
			onBrandImagesChange(images)
		},
		[markBrandEdited, onBrandImagesChange],
	)

	const openEmptyBrandFormOnce = useCallback(() => {
		if (hasAutoOpenedEmptyBrand.current || hasBrandSummary) return
		hasAutoOpenedEmptyBrand.current = true
		setIsBrandFormOpen(true)
	}, [hasBrandSummary])

	useEffect(() => {
		if (brandService) return
		openEmptyBrandFormOnce()
	}, [brandService, openEmptyBrandFormOnce])

	useEffect(() => {
		if (initialized.current || !brandService) return
		initialized.current = true
		;(async () => {
			let list: StoredBrandRecord[] = []
			try {
				list = await brandService.listRecords()
			} catch (error) {
				console.error("Failed to load self-media brand records:", error)
				openEmptyBrandFormOnce()
				return
			}
			const mapped: BrandRecord[] = list.map((r: StoredBrandRecord) => ({
				id: r.id,
				author: r.author,
				brandPosition: r.brandPosition,
				targetAudience: r.targetAudience,
				createdAt: r.createdAt,
			}))
			setRecords(mapped)

			if (!hasAutoFilled.current && !author && !brandPosition && mapped.length > 0) {
				hasAutoFilled.current = true
				const latest = mapped[0]
				onChange("author", latest.author)
				onChange("brandPosition", latest.brandPosition)
				onChange("targetAudience", latest.targetAudience)
				setIsBrandFormOpen(false)
				return
			}

			if (mapped.length === 0) {
				openEmptyBrandFormOnce()
			}
		})()
	}, [brandService, author, brandPosition, onChange, openEmptyBrandFormOnce])

	const handleConfirmSave = useCallback(async () => {
		if (saveConfirmingRef.current) return

		if (!author.trim() || !brandPosition.trim() || !brandService) {
			hasResolvedSavePrompt.current = true
			hasUserEditedBrand.current = false
			setShowSaveConfirm(false)
			onConfirmNext?.()
			return
		}

		saveConfirmingRef.current = true
		setIsSaveConfirming(true)
		try {
			const saved = await brandService.saveRecord({
				author: author.trim(),
				brandPosition: brandPosition.trim(),
				targetAudience: targetAudience.trim(),
			})
			setRecords((prev) => [
				{
					id: saved.id,
					author: saved.author,
					brandPosition: saved.brandPosition,
					targetAudience: saved.targetAudience,
					createdAt: saved.createdAt,
				},
				...prev,
			])
			hasResolvedSavePrompt.current = true
			hasUserEditedBrand.current = false
			setShowSaveConfirm(false)
			onConfirmNext?.()
		} catch (error) {
			console.error("Failed to save self-media brand record:", error)
		} finally {
			saveConfirmingRef.current = false
			setIsSaveConfirming(false)
		}
	}, [author, brandPosition, targetAudience, brandService, onConfirmNext])

	const handleSkipSave = useCallback(() => {
		if (saveConfirmingRef.current) return
		hasResolvedSavePrompt.current = true
		hasUserEditedBrand.current = false
		setShowSaveConfirm(false)
		onConfirmNext?.()
	}, [onConfirmNext])

	const handleSaveRecord = useCallback(() => {
		if (!author.trim() || !brandPosition.trim() || !brandService) return
		hasResolvedSavePrompt.current = true
		hasUserEditedBrand.current = false
		;(async () => {
			const saved = await brandService.saveRecord({
				author: author.trim(),
				brandPosition: brandPosition.trim(),
				targetAudience: targetAudience.trim(),
			})
			const newRecord: BrandRecord = {
				id: saved.id,
				author: saved.author,
				brandPosition: saved.brandPosition,
				targetAudience: saved.targetAudience,
				createdAt: saved.createdAt,
			}
			setRecords((prev) => [newRecord, ...prev])
			message.success(t("detail.selfMedia.initPanel.stepBrand.saveSuccess", "保存成功"))
		})()
	}, [author, brandPosition, targetAudience, brandService, t])

	const handleSelectRecord = useCallback(
		(record: BrandRecord) => {
			hasResolvedSavePrompt.current = true
			hasUserEditedBrand.current = false
			onChange("author", record.author)
			onChange("brandPosition", record.brandPosition)
			onChange("targetAudience", record.targetAudience)
			setIsBrandFormOpen(true)
			setShowRecordPicker(false)
		},
		[onChange],
	)

	const handleDeleteRecord = useCallback(
		(id: string) => {
			setRecords((prev) => prev.filter((r) => r.id !== id))
			brandService?.deleteRecord(id)
		},
		[brandService],
	)

	return (
		<div className="mx-auto max-w-5xl space-y-4 py-4">
			<div className="space-y-3">
				<div
					className="flex w-full items-start gap-3 rounded-[24px] bg-white/90 p-4 text-[#18181b] shadow-[inset_0_1px_rgba(255,255,255,0.82)] lg:max-w-[calc(100%_-_20.5rem)]"
					data-testid="self-media-brand-collapsed-header"
				>
					<button
						type="button"
						className="min-w-0 flex-1 cursor-pointer rounded-[20px] px-1 py-1 text-left transition-colors hover:bg-[#f8f8f9] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15"
						onClick={() => setIsBrandFormOpen((open) => !open)}
						data-testid="set-is-brand-form-open"
					>
						<div className="space-y-1">
							<div className="space-y-1">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs font-medium text-[#71717a]">
										{brandHeaderStatus}
									</span>
									{brandAutoSaveMeta ? (
										<span
											className="inline-flex items-center gap-1.5 rounded-full bg-[#f8f8f9] px-2 py-0.5 text-[11px] font-semibold text-[#71717a] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]"
											aria-live="polite"
											data-testid="self-media-brand-auto-save-status"
										>
											<span
												className={cn(
													"h-1.5 w-1.5 rounded-full",
													brandAutoSaveMeta.dotClassName,
												)}
											/>
											<span>{brandAutoSaveMeta.label}</span>
										</span>
									) : null}
								</div>
								<h2 className="text-lg font-[780] tracking-tight text-[#18181b]">
									{t(
										"detail.selfMedia.initPanel.stepBrand.title",
										"账号与品牌定位",
									)}
								</h2>
							</div>
							<p className="text-xs text-[#71717a]">{brandHeaderDescription}</p>
						</div>
					</button>
					<button
						type="button"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#71717a] transition-colors hover:bg-[#f8f8f9] hover:text-[#18181b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15"
						aria-label={
							isBrandFormOpen
								? t("detail.selfMedia.initPanel.stepBrand.collapse", "收起品牌信息")
								: t("detail.selfMedia.initPanel.stepBrand.expand", "展开品牌信息")
						}
						onClick={() => setIsBrandFormOpen((open) => !open)}
						data-testid="set-is-brand-form-open-2"
					>
						<ChevronDown
							size={18}
							className={cn(
								"shrink-0 transition-transform",
								isBrandFormOpen && "rotate-180",
							)}
						/>
					</button>

					{records.length > 0 && (
						<Button
							type="button"
							className={cn(
								"gap-1.5 rounded-full border-0 bg-[#f8f8f9] text-xs text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] hover:bg-[#18181b] hover:text-[#ffd637]",
								showRecordPicker && "bg-[#18181b] text-[#ffd637]",
							)}
							variant="outline"
							size="sm"
							onClick={() => setShowRecordPicker(!showRecordPicker)}
						>
							<History size={12} />
							<span>
								{t(
									"detail.selfMedia.initPanel.stepBrand.historyRecords",
									"一键回填",
								)}
							</span>
							<Badge
								variant="secondary"
								className="h-5 rounded-full bg-white px-1.5 text-[9px] text-[#18181b]"
							>
								{records.length}
							</Badge>
						</Button>
					)}
				</div>

				{showRecordPicker && records.length > 0 && (
					<HistoryRecordPicker
						records={records}
						onSelect={handleSelectRecord}
						onDelete={handleDeleteRecord}
						onClose={() => setShowRecordPicker(false)}
					/>
				)}

				{isBrandFormOpen && (
					<div className="space-y-6 animate-in fade-in slide-in-from-top-2">
						<BrandInfoFields
							author={author}
							brandPosition={brandPosition}
							targetAudience={targetAudience}
							brandImages={brandImages}
							onChange={handleBrandFieldChange}
							onBrandImagesChange={handleBrandImagesChange}
							fileStorageService={fileStorageService}
							attachmentList={attachmentList}
							onBrandImagesUploadingChange={onBrandImagesUploadingChange}
							brandImageUploadTarget={brandImageUploadTarget}
						/>

						{author.trim() && brandPosition.trim() && brandService && (
							<div className="flex justify-end pt-1 animate-in fade-in">
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="gap-1.5 rounded-full border-0 bg-white px-3 text-xs text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)] hover:bg-[#18181b] hover:text-[#ffd637]"
									onClick={handleSaveRecord}
								>
									<Eye size={12} />
									<span>
										{t(
											"detail.selfMedia.initPanel.stepBrand.saveAsNew",
											"保存到我的品牌库",
										)}
									</span>
								</Button>
							</div>
						)}
					</div>
				)}
			</div>

			{showSaveConfirm && (
				<SaveConfirmDialog
					isConfirming={isSaveConfirming}
					onConfirm={handleConfirmSave}
					onCancel={handleSkipSave}
				/>
			)}
		</div>
	)
})

export default StepBrandInfo
export type { BrandImageItem }
