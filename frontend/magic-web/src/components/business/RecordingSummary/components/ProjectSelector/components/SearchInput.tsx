import { ChangeEvent, CompositionEvent, useEffect, useRef, useState } from "react"
import { Input } from "antd"
import { createStyles } from "antd-style"
import { IconSearch } from "@tabler/icons-react"
import { SearchInputProps } from "../types"

const useStyles = createStyles(({ css, token, prefixCls }) => ({
	searchInput: css`
		flex: 1;

		.${prefixCls}-input-affix-wrapper {
			height: 32px;
			border-radius: 8px;
			border-color: ${token.colorBorder};

			&:hover {
				border-color: ${token.colorPrimaryHover};
			}

			&:focus,
			&.${prefixCls}-input-affix-wrapper-focused {
				border-color: ${token.colorPrimary};
				box-shadow: 0 0 0 2px ${token.colorPrimary}10;
			}

			.${prefixCls}-input {
				font-size: 14px;
				line-height: 20px;
			}

			.${prefixCls}-input::placeholder {
				color: ${token.colorTextPlaceholder};
			}

			.${prefixCls}-input-prefix {
				margin-right: 8px;

				.anticon {
					color: ${token.colorTextTertiary};
					font-size: 16px;
				}
			}
		}
	`,
}))

function SearchInput({
	placeholder,
	value,
	onChange,
	onSearch,
	inputClassName,
	className,
}: SearchInputProps) {
	const { styles, cx } = useStyles()
	const [inputValue, setInputValue] = useState(value || "")
	const isComposingRef = useRef(false)

	// Sync external value changes when not composing
	useEffect(() => {
		if (value !== undefined && value !== inputValue && !isComposingRef.current) {
			setInputValue(value)
		}
	}, [value])

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value
		setInputValue(newValue)
		// Only trigger onChange when not composing (not typing Chinese)
		if (!isComposingRef.current) {
			onChange?.(newValue)
		}
	}

	const handleCompositionStart = () => {
		isComposingRef.current = true
	}

	const handleCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
		isComposingRef.current = false
		// Trigger onChange after composition ends
		const newValue = e.currentTarget.value
		setInputValue(newValue)
		onChange?.(newValue)
	}

	return (
		<div className={cx(styles.searchInput, className)}>
			<Input
				className={inputClassName}
				prefix={<IconSearch size={16} />}
				placeholder={placeholder}
				value={inputValue}
				onChange={handleChange}
				onCompositionStart={handleCompositionStart}
				onCompositionEnd={handleCompositionEnd}
				onPressEnter={() => onSearch?.(inputValue || "")}
				allowClear
				size="middle"
			/>
		</div>
	)
}

export default SearchInput
