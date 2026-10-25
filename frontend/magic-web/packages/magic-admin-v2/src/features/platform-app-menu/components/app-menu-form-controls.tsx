import { useId } from "react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { cn } from "@magic-admin-v2/utils/cn"

interface NumberSelectProps {
	ariaLabel: string
	disabled: boolean
	id?: string
	onChange: (value: number) => void
	options: Array<[number, string]>
	value: number
}

/** 将应用菜单后端数字枚举适配到 Select 的字符串 value。 */
export function NumberSelect({
	ariaLabel,
	disabled,
	id,
	onChange,
	options,
	value,
}: NumberSelectProps) {
	return (
		<Select
			disabled={disabled}
			value={String(value)}
			onValueChange={(nextValue) => onChange(Number(nextValue))}
		>
			<SelectTrigger
				aria-label={ariaLabel}
				className="w-full"
				data-testid="platform-app-menu-select-trigger"
				id={id}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent data-testid="platform-app-menu-select-content">
				{options.map(([optionValue, label]) => (
					<SelectItem
						data-testid="platform-app-menu-option"
						key={optionValue}
						value={String(optionValue)}
					>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

interface RadioChoiceGroupProps {
	columns?: 2 | 3
	disabled: boolean
	id?: string
	onChange: (value: string) => void
	options: Array<{ value: string; label: string }>
	value: string
}

/** 应用菜单表单使用的卡片式单选组。 */
export function RadioChoiceGroup({
	columns = 2,
	disabled,
	id,
	onChange,
	options,
	value,
}: RadioChoiceGroupProps) {
	const groupName = useId()

	return (
		<div
			aria-labelledby={id ? `${id}-label` : undefined}
			className={cn("grid gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}
			role="radiogroup"
		>
			{options.map((option, index) => {
				const isSelected = value === option.value

				return (
					<label
						key={option.value}
						className={cn(
							"flex min-h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors",
							isSelected
								? "border-primary text-foreground shadow-sm"
								: "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
							disabled && "cursor-not-allowed opacity-50",
						)}
					>
						<input
							data-testid="platform-app-menu-input"
							checked={isSelected}
							className="sr-only"
							disabled={disabled}
							id={index === 0 ? id : undefined}
							name={groupName}
							onChange={() => onChange(option.value)}
							type="radio"
							value={option.value}
						/>
						<span
							className={cn(
								"flex size-4 shrink-0 items-center justify-center rounded-full border",
								isSelected ? "border-primary" : "border-muted-foreground/40",
							)}
							aria-hidden="true"
						>
							{isSelected ? (
								<span className="size-2 rounded-full bg-primary" />
							) : null}
						</span>
						<span className="truncate">{option.label}</span>
					</label>
				)
			})}
		</div>
	)
}
