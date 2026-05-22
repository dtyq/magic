import { cn } from "@/lib/utils"

import { MobileSettingsSheetContainer } from "./SheetContainer"
import type { MobileSettingsFeedbackCategoryOption } from "./feedbackShared"

const FEEDBACK_CATEGORY_ROW_DIVIDER_OFFSET_CLASSNAME = "ml-[calc(14px+0.75rem)]"

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
			contentClassName="gap-2 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-feedback-category-sheet"
		>
			<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
				{options.map((option, index) => {
					const showDivider = index < options.length - 1

					return (
						<div key={option.id}>
							<button
								type="button"
								onClick={() => handleSelectCategory(option.id)}
								aria-pressed={option.id === selectedCategoryId}
								className="flex h-14 w-full items-center gap-3 px-[14px] text-left transition-opacity active:opacity-60"
								data-testid={`mobile-settings-feedback-category-${option.id}`}
							>
								<MobileSettingsFeedbackCategoryIcon option={option} />
								<span className="flex-1 truncate text-[16px] leading-5 text-foreground">
									{option.label}
								</span>
							</button>
							{showDivider ? (
								<div
									className={cn(
										"h-px bg-border ml-4"
									)}
									aria-hidden
								/>
							) : null}
						</div>
					)
				})}
			</div>
		</MobileSettingsSheetContainer>
	)
}
