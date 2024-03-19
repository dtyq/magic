import { memo, useState, useEffect } from "react"
import { Input, Empty } from "antd"
import { IconSearch } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"

// 样式定义
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
		max-height: 200px;
		overflow-y: auto;

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-thumb {
			background-color: ${token.colorBorderSecondary};
			border-radius: 3px;

			&:hover {
				background-color: ${token.colorBorder};
			}
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
		placeholder = "搜索...",
		value,
		onChange,
		showSearch = true,
		multiple = false,
		OptionWrapper,
		...restProps
	}) => {
		const { styles } = useStyles()
		const [searchValue, setSearchValue] = useState("")

		// 过滤选项
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

		// 重置搜索值
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

			// 如果有包装组件，使用包装组件
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
							placeholder={placeholder}
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

				<div className={styles.optionsList}>
					{filteredOptions.length > 0 ? (
						filteredOptions.map(renderOption)
					) : (
						<div className={styles.empty}>
							<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
						</div>
					)}
				</div>
			</div>
		)
	},
)

BaseDropdownRenderer.displayName = "BaseDropdownRenderer"

export default BaseDropdownRenderer
