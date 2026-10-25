import { memo, useState, useEffect } from "react"
import { Input, Empty } from "antd"
import { IconSearch } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

// Keep dropdown styling consistent with the existing theme tokens.
const useStyles = createStyles(({ token, css }) => ({
	dropdown: css`
		padding: 8px;
		background: ${token.colorBgContainer};
		border-radius: ${token.borderRadius}px;
	`,

	searchBox: css`
		margin-bottom: 8px;

		.ant-input {
			border-color: ${token.colorBorder};

			&:focus,
			&:hover {
				border-color: ${token.colorPrimary};
			}
		}
	`,

	optionsList: css`
		height: auto;
		max-height: 200px;
		> div {
			display: block !important;
		}
	`,

	option: css`
		height: 30px;
		cursor: pointer;
		border-radius: ${token.borderRadiusSM}px;
		transition: background-color 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;

		&:hover {
			background-color: ${token.colorBgTextHover};
		}

		&.selected {
			background-color: ${token.colorPrimaryBg};
			color: ${token.colorPrimary};
		}
	`,

	optionLabel: css`
		flex: 1;
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	`,

	empty: css`
		padding: 20px;
		text-align: center;
		color: ${token.colorTextSecondary};
	`,
}))

interface BaseDropdownRendererProps {
	options?: any[]
	placeholder?: string
	value?: any
	onChange?: (value: any) => void
	showSearch?: boolean
	multiple?: boolean
	OptionWrapper?: React.FC<any>
	[key: string]: any
}

const BaseDropdownRenderer = memo<BaseDropdownRendererProps>(
	({
		options = [],
		placeholder,
		value,
		onChange,
		showSearch = true,
		multiple = false,
		OptionWrapper,
		...restProps
	}) => {
		const { t } = useTranslation()
		const { styles } = useStyles()
		const searchPlaceholder = placeholder ?? t("common.searchPlaceholder", { ns: "flow" })
		const [searchValue, setSearchValue] = useState("")

		// Filter by the searchable text while retaining the original option labels.
		const filteredOptions = options.filter((option) => {
			if (!searchValue) return true
			const label = option.realLabel
			return label.toLowerCase().includes(searchValue.toLowerCase())
		})

		const handleOptionClick = useMemoizedFn((option: any) => {
			onChange?.(option.value)
		})

		const handleSearchChange = useMemoizedFn((e: React.ChangeEvent<HTMLInputElement>) => {
			setSearchValue(e.target.value)
		})

		// Reset search when the selected value changes.
		useEffect(() => {
			setSearchValue("")
		}, [value])

		const renderOption = (option: any, index: number) => {
			const isSelected = multiple
				? Array.isArray(value) && value.includes(option.value)
				: value === option.value

			const optionContent = (
				<div
					key={option.value || index}
					className={`${styles.option} ${isSelected ? "selected" : ""}`}
					onClick={() => handleOptionClick(option)}
				>
					<span className={styles.optionLabel}>
						{option.label || option.title || option.name}
					</span>
				</div>
			)

			// Preserve callers' custom option wrappers.
			if (OptionWrapper) {
				return (
					<OptionWrapper key={option.value || index} option={option}>
						{optionContent}
					</OptionWrapper>
				)
			}

			return optionContent
		}

		return (
			<div className={styles.dropdown} {...restProps}>
				{showSearch && (
					<div className={styles.searchBox}>
						<Input
							placeholder={searchPlaceholder}
							value={searchValue}
							onChange={handleSearchChange}
							prefix={<MagicIcon component={IconSearch} size={16} />}
							autoFocus
							onClick={(e) => {
								e.stopPropagation()
								e.preventDefault()
							}}
						/>
					</div>
				)}

				<ScrollArea viewportClassName={styles.optionsList}>
					{filteredOptions.length > 0 ? (
						filteredOptions.map(renderOption)
					) : (
						<div className={styles.empty}>
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description={t("common.noData", { ns: "flow" })}
							/>
						</div>
					)}
				</ScrollArea>
			</div>
		)
	},
)

BaseDropdownRenderer.displayName = "BaseDropdownRenderer"

export default BaseDropdownRenderer
