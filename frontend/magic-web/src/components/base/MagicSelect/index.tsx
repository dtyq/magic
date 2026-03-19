import { ChevronDown, CheckIcon } from "lucide-react"
import type { SelectProps as AntdSelectProps } from "antd"
import { memo, useMemo, useState, useCallback, type CSSProperties, type ReactNode } from "react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"

// Type for option item in antd style
interface OptionType {
	label: React.ReactNode
	value: string | number
	disabled?: boolean
	className?: string
	desc?: string
	danger?: boolean
	dataTestId?: string
}

// Custom styles prop (antd v5 API)
interface StylesType {
	popup?: {
		root?: CSSProperties
	}
}

// Custom classNames prop (antd v5 API)
interface ClassNamesType {
	popup?: {
		root?: string
	}
}

// Extended props to support both antd and shadcn APIs
interface MagicSelectProps extends Omit<
	AntdSelectProps,
	| "mode"
	| "suffixIcon"
	| "size"
	| "dropdownRender"
	| "labelRender"
	| "optionRender"
	| "placement"
	| "onSelect"
	| "filterOption"
	| "variant"
	| "popupRender"
> {
	// Override antd props with simplified versions
	options?: OptionType[]
	// Additional shadcn props
	size?: "sm" | "default"
	triggerClassName?: string
	style?: CSSProperties
	// Antd v5 styling props
	styles?: StylesType
	classNames?: ClassNamesType
	// Custom rendering props
	labelRender?: (option: OptionType) => ReactNode
	optionRender?: (option: OptionType) => ReactNode
	prefix?: ReactNode
	// Dropdown control props
	popupClassName?: string
	placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight"
	variant?: "outlined" | "borderless" | "filled" | "underlined"
	// Event props
	onClick?: (e: React.MouseEvent) => void
	onSelect?: (value: string | number, option: OptionType) => void
	// Custom render props
	popupRender?: () => ReactNode
	dropdownRender?: (menu: ReactNode) => ReactNode
	// Search props (placeholder for future implementation)
	showSearch?: boolean
	onSearch?: (value: string) => void
	filterOption?: boolean | ((input: string, option?: OptionType) => boolean)
	defaultActiveFirstOption?: boolean
	notFoundContent?: ReactNode
	dataTestId?: string
}

const MagicSelect = memo(
	({
		value,
		defaultValue,
		onChange,
		options = [],
		placeholder,
		disabled,
		className,
		triggerClassName,
		size = "default",
		style,
		styles,
		classNames,
		labelRender,
		optionRender,
		prefix,
		popupClassName,
		placement,
		variant,
		onClick,
		onSelect,
		popupRender,
		dropdownRender,
		showSearch,
		onSearch,
		filterOption,
		defaultActiveFirstOption,
		notFoundContent,
		dataTestId,
		...restProps
	}: MagicSelectProps) => {
		const isMobile = useIsMobile()
		const [open, setOpen] = useState(false)

		// Log warnings for unsupported props in development
		if (process.env.NODE_ENV === "development") {
			if (showSearch) console.warn("[MagicSelect] showSearch is not supported yet")
			if (onSearch) console.warn("[MagicSelect] onSearch is not supported yet")
			if (filterOption !== undefined)
				console.warn("[MagicSelect] filterOption is not supported yet")
			if (defaultActiveFirstOption)
				console.warn("[MagicSelect] defaultActiveFirstOption is not supported yet")
			if (notFoundContent) console.warn("[MagicSelect] notFoundContent is not supported yet")
			if (placement) console.warn("[MagicSelect] placement is not fully supported yet")
			if (variant) console.warn("[MagicSelect] variant is not supported yet")
		}

		// Convert value to string for radix-ui
		const stringValue = value?.toString() ?? ""
		const stringDefaultValue = defaultValue?.toString() ?? ""

		// Handle value change
		const handleValueChange = useCallback(
			(newValue: string) => {
				const selectedOption = options.find((opt) => opt.value.toString() === newValue)
				if (selectedOption) {
					// Call onSelect if provided
					onSelect?.(selectedOption.value, selectedOption)
					// Call onChange
					if (onChange) {
						onChange(
							selectedOption.value as string | number,
							selectedOption as unknown as AntdSelectProps["options"],
						)
					}
				}
			},
			[onChange, onSelect, options],
		)

		// Render options with optional custom renderer
		const renderOptions = useMemo(
			() =>
				options.map((option) => (
					<SelectItem
						key={option.value}
						value={option.value.toString()}
						disabled={option.disabled}
						className={cn(option.className, option.danger && "text-destructive")}
						data-testid={option.dataTestId}
					>
						{optionRender ? optionRender(option) : option.label}
					</SelectItem>
				)),
			[options, optionRender],
		)

		// Get selected option for label rendering
		const selectedOption = options.find((opt) => opt.value.toString() === stringValue)

		// Render label with custom renderer or default
		const renderLabel = useCallback(
			(option: OptionType | undefined) => {
				if (!option) return placeholder
				if (labelRender) return labelRender(option)
				return option.label
			},
			[labelRender, placeholder],
		)

		// Mobile drawer content
		const mobileContent = (
			<div className="flex flex-col gap-1 p-4">
				{options.map((option) => {
					const isSelected = stringValue === option.value.toString()
					const content = optionRender ? optionRender(option) : option.label
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => {
								if (!option.disabled) {
									handleValueChange(option.value.toString())
									setOpen(false)
								}
							}}
							disabled={option.disabled}
							data-testid={option.dataTestId}
							className={cn(
								"relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-3 pl-2 pr-8 text-sm outline-none",
								"hover:bg-accent hover:text-accent-foreground",
								"disabled:pointer-events-none disabled:opacity-50",
								isSelected && "bg-accent text-accent-foreground",
								option.className,
							)}
						>
							{isSelected && (
								<span className="absolute right-2 flex size-3.5 items-center justify-center">
									<CheckIcon className="size-4" />
								</span>
							)}
							{content}
						</button>
					)
				})}
			</div>
		)

		// Desktop version
		if (!isMobile) {
			// If custom popupRender is provided, wrap it
			const content = popupRender
				? popupRender()
				: dropdownRender
					? dropdownRender(
						<div
							className={cn("p-1", classNames?.popup?.root)}
							style={styles?.popup?.root}
						>
							{renderOptions}
						</div>,
					)
					: renderOptions

			return (
				<Select
					value={stringValue}
					defaultValue={stringDefaultValue}
					onValueChange={handleValueChange}
					disabled={disabled}
					open={open}
					onOpenChange={setOpen}
					{...restProps}
				>
					<SelectTrigger
						className={cn("w-fit", className, triggerClassName)}
						size={size}
						onClick={onClick}
						data-testid={dataTestId}
					>
						{prefix && <span className="mr-1.5 flex items-center">{prefix}</span>}
						<SelectValue placeholder={placeholder}>
							{selectedOption ? renderLabel(selectedOption) : placeholder}
						</SelectValue>
					</SelectTrigger>
					<SelectContent
						className={cn("z-popup", popupClassName, classNames?.popup?.root)}
						style={styles?.popup?.root}
					>
						{content}
					</SelectContent>
				</Select>
			)
		}

		// Mobile version with MagicPopup
		const handleTriggerClick = (e: React.MouseEvent) => {
			if (!disabled) {
				setOpen(true)
				onClick?.(e)
			}
		}

		return (
			<>
				<button
					type="button"
					onClick={handleTriggerClick}
					disabled={disabled}
					style={style}
					data-size={size}
					className={cn(
						"shadow-xs flex w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:ring-ring/50",
						"focus-visible:border-ring focus-visible:ring-[3px]",
						"disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
						"data-[placeholder]:text-muted-foreground",
						// Size-specific styles
						"data-[size=default]:h-9 data-[size=default]:px-3 data-[size=default]:py-2 data-[size=default]:text-sm",
						"data-[size=sm]:h-7 data-[size=sm]:px-1.5 data-[size=sm]:py-1.5 data-[size=sm]:text-xs",
						className,
						triggerClassName,
					)}
					data-testid={dataTestId}
					data-placeholder={!selectedOption}
				>
					{prefix && <span className="mr-1.5 flex items-center">{prefix}</span>}
					<span className="line-clamp-1 flex items-center gap-2">
						{renderLabel(selectedOption)}
					</span>
					<ChevronDown
						className={cn("opacity-50", size === "sm" ? "size-3.5" : "size-4")}
					/>
				</button>

				<MagicPopup
					visible={open}
					onClose={() => setOpen(false)}
					position="bottom"
					title={placeholder?.toString() || "Select"}
					className={classNames?.popup?.root}
					bodyStyle={styles?.popup?.root}
				>
					{popupRender ? popupRender() : mobileContent}
				</MagicPopup>
			</>
		)
	},
)

export default MagicSelect
export type { MagicSelectProps, OptionType }
