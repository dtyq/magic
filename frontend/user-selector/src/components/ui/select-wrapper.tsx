import { forwardRef } from "react"
import type { ReactNode, CSSProperties } from "react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption {
	label: ReactNode
	value: string | number
	disabled?: boolean
}

export interface SelectWrapperProps {
	value?: string | number
	onChange?: (value: string | number) => void
	options?: SelectOption[]
	disabled?: boolean
	className?: string
	style?: CSSProperties
	popupClassName?: string
	dropdownRender?: (menu: ReactNode) => ReactNode
	placeholder?: string
}

const SelectWrapper = forwardRef<HTMLButtonElement, SelectWrapperProps>(
	(
		{
			value,
			onChange,
			options = [],
			disabled,
			className,
			style,
			popupClassName,
			dropdownRender,
			placeholder,
		},
		ref,
	) => {
		const content = (
			<SelectContent className={popupClassName}>
				{options.map((option) => (
					<SelectItem
						key={String(option.value)}
						value={String(option.value)}
						disabled={option.disabled}
					>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		)

		return (
			<Select
				value={value !== undefined ? String(value) : undefined}
				onValueChange={(val) => {
					const option = options.find((opt) => String(opt.value) === val)
					if (option) {
						onChange?.(option.value)
					}
				}}
				disabled={disabled}
			>
				<SelectTrigger
					ref={ref}
					className={cn("h-9 rounded-lg w-full focus:ring-offset-0", className)}
					style={style}
				>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				{dropdownRender ? dropdownRender(content) : content}
			</Select>
		)
	},
)
SelectWrapper.displayName = "SelectWrapper"

export { SelectWrapper }
