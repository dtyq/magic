import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { MobileSettingsSheetContainer } from "./SheetContainer"
import type { MobileSettingsFeedbackCategoryOption } from "./feedbackShared"

/** Category icon in the picker list — compact size-9 cell aligned with the prototype. */
function MobileSettingsFeedbackCategoryIcon(props: {
	option: MobileSettingsFeedbackCategoryOption
}) {
	const { option } = props
	const Icon = option.Icon

	return (
		<div
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-[10px]",
				option.iconBoxClassName,
			)}
			aria-hidden
		>
			<Icon className={cn("h-5 w-5", option.iconClassName)} strokeWidth={1.75} />
		</div>
	)
}

/** 分类选择子 Sheet 只负责枚举展示与选择回传，避免把创建表单状态拆散到多处。 */
export function MobileSettingsFeedbackCategorySheet(props: {
	open: boolean
	title: string
	options: MobileSettingsFeedbackCategoryOption[]
	selectedCategoryId?: string
	onClose: () => void
	onSelect: (categoryId: string) => void
}) {
	const { open, title, options, selectedCategoryId, onClose, onSelect } = props

	/** 选中分类后立即回传并关闭子 Sheet，保持和原型一致的单击即返回交互。 */
	function handleSelectCategory(categoryId: string) {
		onSelect(categoryId)
		onClose()
	}

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={title}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			contentClassName="gap-2.5 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-feedback-category-sheet"
		>
			<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
				{options.map((option, index) => {
					const isSelected = option.id === selectedCategoryId

					return (
						<div key={option.id}>
							<button
								type="button"
								onClick={() => handleSelectCategory(option.id)}
								className="flex h-14 w-full items-center gap-3 px-[14px] text-left transition-opacity active:opacity-60"
								data-testid={`mobile-settings-feedback-category-${option.id}`}
							>
								<MobileSettingsFeedbackCategoryIcon option={option} />
								<span className="flex-1 truncate text-[16px] leading-5 text-foreground">
									{option.label}
								</span>
								<ChevronRight
									className={cn(
										"h-4 w-4 shrink-0",
										isSelected ? "text-foreground" : "text-muted-foreground",
									)}
								/>
							</button>
							{index < options.length - 1 ? (
								<div className="pl-[50px]">
									<div className="h-px w-full bg-border" />
								</div>
							) : null}
						</div>
					)
				})}
			</div>
		</MobileSettingsSheetContainer>
	)
}
