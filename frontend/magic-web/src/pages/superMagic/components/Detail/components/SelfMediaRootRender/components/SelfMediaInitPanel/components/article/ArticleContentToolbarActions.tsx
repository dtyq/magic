import type { Dispatch, RefObject, SetStateAction } from "react"
import { FileText, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import AiActionButton from "../ai/AiActionButton"
import { selfMediaOverlayStyles } from "../../../selfMediaOverlayStyles"

interface ArticleContentToolbarActionsProps {
	showWechatViewToggle: boolean
	wechatContentView: "editor" | "phone"
	isCardPlatform: boolean
	hasOutline: boolean
	generatingOutline: boolean
	isOutlineActionBlocked: boolean
	outlineActionDisabledReason?: string
	outlineModel: string
	optimizePopoverOpen: boolean
	optimizeInstruction: string
	outlineActionRef: RefObject<HTMLDivElement | null>
	onWechatContentViewChange: (view: "editor" | "phone") => void
	onOutlineButtonClick: () => void
	onOptimizeInstructionChange: Dispatch<SetStateAction<string>>
	onOutlineModelChange: Dispatch<SetStateAction<string>>
	onAiOptimize: (instruction: string) => void
}

export default function ArticleContentToolbarActions({
	showWechatViewToggle,
	wechatContentView,
	isCardPlatform,
	hasOutline,
	generatingOutline,
	isOutlineActionBlocked,
	outlineActionDisabledReason,
	outlineModel,
	optimizePopoverOpen,
	optimizeInstruction,
	outlineActionRef,
	onWechatContentViewChange,
	onOutlineButtonClick,
	onOptimizeInstructionChange,
	onOutlineModelChange,
	onAiOptimize,
}: ArticleContentToolbarActionsProps) {
	const { t } = useTranslation("super")

	return (
		<div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
			{showWechatViewToggle ? (
				<div
					className="inline-flex rounded-full bg-[#f4f4f5] p-0.5"
					aria-label={t(
						"detail.selfMedia.initPanel.stepDetail.wechatContentViewToggle",
						"全文内容视图切换",
					)}
				>
					<button
						type="button"
						aria-pressed={wechatContentView === "editor"}
						className={cn(
							"inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
							wechatContentView === "editor"
								? "bg-white text-[#18181b] shadow-sm"
								: "text-[#71717a] hover:text-[#18181b]",
						)}
						onClick={() => onWechatContentViewChange("editor")}
						data-testid="on-wechat-content-view-change"
					>
						<FileText size={12} />
						{t("detail.selfMedia.initPanel.stepDetail.wechatContentEditorView", "编辑")}
					</button>
					<button
						type="button"
						aria-pressed={wechatContentView === "phone"}
						className={cn(
							"inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
							wechatContentView === "phone"
								? "bg-white text-[#18181b] shadow-sm"
								: "text-[#71717a] hover:text-[#18181b]",
						)}
						onClick={() => onWechatContentViewChange("phone")}
						data-testid="on-wechat-content-view-change-2"
					>
						<Smartphone size={12} />
						{t(
							"detail.selfMedia.initPanel.stepDetail.wechatContentPhoneView",
							"手机预览",
						)}
					</button>
				</div>
			) : null}

			<div ref={outlineActionRef} className="relative">
				<AiActionButton
					modelValue={outlineModel}
					onModelChange={onOutlineModelChange}
					loading={generatingOutline}
					disabled={isOutlineActionBlocked}
					disabledReason={outlineActionDisabledReason}
					onClick={onOutlineButtonClick}
					variant="primary"
					size="sm"
					label={t(
						hasOutline
							? isCardPlatform
								? "detail.selfMedia.initPanel.stepDetail.cardContentOptimizeBtn"
								: "detail.selfMedia.initPanel.stepDetail.outlineOptimizeBtn"
							: isCardPlatform
								? "detail.selfMedia.initPanel.stepDetail.cardContentGenerateBtn"
								: "detail.selfMedia.initPanel.stepDetail.outlineGenerateBtn",
					)}
					loadingLabel={
						<div className="flex items-center gap-1.5">
							<svg
								className="animate-spin"
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
							>
								<path d="M21 12a9 9 0 1 1-6.219-8.56" />
							</svg>
							<span>
								{t(
									hasOutline
										? "detail.selfMedia.initPanel.stepDetail.outlineOptimizing"
										: "detail.selfMedia.initPanel.stepDetail.outlineGenerating",
								)}
							</span>
						</div>
					}
				/>

				{optimizePopoverOpen && hasOutline && !generatingOutline && (
					<div
						className={`absolute right-0 top-full z-[1000] mt-1.5 w-72 p-3 animate-in fade-in-0 zoom-in-95 ${selfMediaOverlayStyles.floatingPanel}`}
					>
						<textarea
							className="min-h-[80px] w-full resize-none rounded-[16px] border-0 bg-[#f8f8f9] px-3 py-2 text-xs shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#18181b]/15"
							placeholder={t(
								isCardPlatform
									? "detail.selfMedia.initPanel.stepDetail.cardContentOptimizePlaceholder"
									: "detail.selfMedia.initPanel.stepDetail.outlineOptimizePlaceholder",
							)}
							rows={3}
							value={optimizeInstruction}
							onChange={(e) => onOptimizeInstructionChange(e.target.value)}
							autoFocus
							data-testid="on-optimize-instruction-change"
						/>
						<div className="mt-2 flex justify-end">
							<button
								type="button"
								className={cn(
									`inline-flex cursor-pointer items-center gap-1 py-1 text-[11px] transition-all active:scale-[0.97] ${selfMediaOverlayStyles.primaryButtonCompact}`,
									!optimizeInstruction.trim() && "cursor-not-allowed opacity-50",
								)}
								disabled={!optimizeInstruction.trim()}
								onClick={() => onAiOptimize(optimizeInstruction)}
								data-testid="on-ai-optimize"
							>
								{t("detail.selfMedia.initPanel.stepDetail.outlineOptimizeSubmit")}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
