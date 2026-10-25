import { useTranslation } from "react-i18next"
import { History, Trash2, X, User, Compass, Target } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface BrandRecord {
	id: string
	author: string
	brandPosition: string
	targetAudience: string
	createdAt: number
}

interface HistoryRecordPickerProps {
	records: BrandRecord[]
	onSelect: (record: BrandRecord) => void
	onDelete: (id: string) => void
	onClose: () => void
}

export function HistoryRecordPicker({
	records,
	onSelect,
	onDelete,
	onClose,
}: HistoryRecordPickerProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="overflow-hidden rounded-[24px] bg-white/95 shadow-[0_18px_44px_rgba(24,24,27,0.12),inset_0_1px_rgba(255,255,255,0.82)] duration-200 animate-in fade-in slide-in-from-top-3"
			data-testid="self-media-history-record-picker"
		>
			<div className="flex items-center justify-between border-b border-[#18181b]/[0.06] bg-[#f8f8f9] px-4 py-2.5">
				<div className="flex items-center gap-1.5 text-xs font-semibold text-[#71717a]">
					<History size={14} className="text-[#18181b]" />
					<span>
						{t(
							"detail.selfMedia.initPanel.stepBrand.reusableRecordsTitle",
							"可复用品牌信息",
						)}
					</span>
				</div>
				<button
					type="button"
					aria-label={t(
						"detail.selfMedia.initPanel.stepBrand.closeHistoryRecords",
						"关闭品牌记录",
					)}
					className="rounded-full p-1 text-[#71717a] transition-all hover:bg-[#18181b] hover:text-[#ffd637]"
					onClick={onClose}
					data-testid="on-close"
				>
					<X size={12} />
				</button>
			</div>

			{/* Record List */}
			{/* Let short lists shrink while capping the actual scrolling viewport. */}
			<ScrollArea viewportClassName="h-auto max-h-56 [&>div]:!block [&>div]:divide-y [&>div]:divide-[#18181b]/[0.06]">
				{records.map((record) => (
					<div
						key={record.id}
						className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#f8f8f9]"
					>
						<button
							type="button"
							aria-label={t("detail.selfMedia.initPanel.stepBrand.useRecord", {
								name: record.author,
								defaultValue: "回填 {{name}}",
							})}
							className="flex flex-1 flex-col items-start gap-1 text-left"
							onClick={() => onSelect(record)}
							data-testid="on-select"
						>
							{/* Account Name */}
							<div className="flex items-center gap-1.5 text-sm font-semibold text-[#18181b] transition-colors">
								<User
									size={12}
									className="text-[#71717a] group-hover:text-[#18181b]"
								/>
								<span>{record.author}</span>
							</div>

							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#71717a]">
								<span className="flex items-center gap-1">
									<Compass size={10} className="text-[#71717a]/70" />
									<span className="line-clamp-1 max-w-[200px]">
										{record.brandPosition}
									</span>
								</span>
								{record.targetAudience && (
									<>
										<span className="text-[#71717a]/40">•</span>
										<span className="flex items-center gap-1">
											<Target size={10} className="text-[#71717a]/70" />
											<span className="line-clamp-1 max-w-[150px]">
												{record.targetAudience}
											</span>
										</span>
									</>
								)}
							</div>
						</button>

						<div className="flex shrink-0 items-center gap-2">
							<span className="text-[10px] text-[#71717a]/70">
								{new Date(record.createdAt).toLocaleDateString()}
							</span>
							<button
								type="button"
								aria-label={t("detail.selfMedia.initPanel.stepBrand.deleteRecord", {
									name: record.author,
									defaultValue: "删除 {{name}}",
								})}
								className="rounded-full p-1.5 text-[#71717a]/50 opacity-0 transition-all hover:bg-[#ff776c]/10 hover:text-[#ff776c] group-hover:opacity-100"
								onClick={(e) => {
									e.stopPropagation()
									onDelete(record.id)
								}}
								data-testid="on-delete"
							>
								<Trash2 size={12} />
							</button>
						</div>
					</div>
				))}
			</ScrollArea>
		</div>
	)
}
