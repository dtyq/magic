import { Input, Flex, type SelectProps, Space, Tag, Checkbox } from "antd"
import { memo, useMemo, useState } from "react"
import { IconX } from "@tabler/icons-react"
import { useAdminComponents } from "../AdminComponentsProvider"
import MagicSelect from "../MagicSelect"
import { useStyles } from "./style"
import MagicAvatar from "../MagicAvatar"
import { CheckboxChangeEvent } from "antd/lib"

export type SearchSelectProps = SelectProps & {
	/** 是否显示头像 */
	showAvatar?: boolean
	/** 是否显示搜索框 */
	showInput?: boolean
	/** 标签是否显示边框 */
	bordered?: boolean
	/** 是否显示全选 */
	showAllCheck?: boolean
	/** tag 类名 */
	tagClassName?: string
}
type TagRender = SelectProps["tagRender"]
type OptionRender = SelectProps["optionRender"]

const SearchSelect = memo(
	({
		options,
		className,
		showInput = true,
		showAvatar = true,
		bordered = false,
		showAllCheck = false,
		tagClassName,
		maxTagPlaceholder,
		mode,
		...props
	}: SearchSelectProps) => {
		const { styles, cx } = useStyles()
		const [searchValue, setSearchValue] = useState("")

		const { getLocale } = useAdminComponents()
		const locale = getLocale("SearchSelect")
		const allOptions = useMemo(() => options || [], [options])

		const filteredOptions = useMemo(() => {
			if (searchValue && showInput) {
				return allOptions.filter((option) =>
					option?.label?.toString().toLowerCase().includes(searchValue.toLowerCase()),
				)
			}
			return allOptions
		}, [allOptions, searchValue, showInput])

		const handleSearch = (value: string) => {
			setSearchValue(value)
			props.onSearch?.(value)
		}

		const tagRender: TagRender = (option) => {
			const { label, value, closable, onClose, isMaxTag } = option
			const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
				event.preventDefault()
				event.stopPropagation()
			}

			const avatar = allOptions.find((o) => o.value === value)?.avatar || ""
			const newLabel =
				showAvatar && !isMaxTag ? (
					<Flex gap={4} align="center">
						<MagicAvatar size={18} shape="square" src={avatar}>
							{label}
						</MagicAvatar>
						<span className={styles.label}>{label}</span>
					</Flex>
				) : (
					<span className={styles.label}>{label}</span>
				)

			return (
				<Tag
					color={value}
					onMouseDown={onPreventMouseDown}
					closable={closable}
					onClose={onClose}
					className={cx(styles.tag, tagClassName)}
					closeIcon={<IconX color="currentColor" size={12} />}
					bordered={bordered}
				>
					{newLabel}
				</Tag>
			)
		}

		const innerMaxTagPlaceholder = useMemo(() => {
			if (maxTagPlaceholder) return maxTagPlaceholder

			return (omittedValues: Array<{ value?: string | number; label?: React.ReactNode }>) => {
				if (!showAvatar) {
					return `+${omittedValues.length}`
				}

				const avatarOptions = omittedValues
					.map((item) => {
						return allOptions.find((candidate) => candidate.value === item.value)
					})
					.filter(Boolean)
					.slice(0, 3)

				return (
					<Flex className={styles.maxTag} align="center">
						<div className={styles.maxTagAvatars}>
							{avatarOptions.map((item, index) => (
								<MagicAvatar
									key={`${item?.value ?? index}`}
									size={18}
									shape="square"
									src={item?.avatar}
									className={styles.maxTagAvatar}
								>
									{item?.label}
								</MagicAvatar>
							))}
						</div>
						<span className={styles.maxTagCount}>+{omittedValues.length}</span>
					</Flex>
				)
			}
		}, [allOptions, maxTagPlaceholder, showAvatar, styles])

		const optionRender: OptionRender = (option) => (
			<Space>
				{option?.data?.avatar && showAvatar && (
					<MagicAvatar size={18} shape="square" src={option.data.avatar}>
						{option.data.label}
					</MagicAvatar>
				)}
				{option.data.label}
			</Space>
		)

		const handleAllCheckChange = (e: CheckboxChangeEvent) => {
			const { checked } = e.target
			if (checked) {
				props.onChange?.(filteredOptions.map((option) => option.value))
			} else {
				props.onChange?.([])
			}
		}

		const isAllChecked = useMemo(() => {
			return props.value?.length === filteredOptions.length
		}, [props.value, filteredOptions])

		const isShowAllCheck = useMemo(() => {
			return (
				showAllCheck &&
				filteredOptions.length > 0 &&
				mode &&
				["tags", "multiple"].includes(mode)
			)
		}, [showAllCheck, filteredOptions.length, mode])

		return (
			<MagicSelect
				allowClear
				className={cx(styles.select, className)}
				options={filteredOptions}
				optionRender={optionRender}
				tagRender={tagRender}
				maxTagPlaceholder={innerMaxTagPlaceholder}
				mode={mode}
				onOpenChange={(open) => {
					if (!open) {
						setSearchValue("")
					}
				}}
				dropdownRender={(menu) => {
					return (
						<Flex vertical gap={4}>
							{showInput && (
								<Input
									placeholder={locale.search}
									value={searchValue}
									allowClear
									onChange={(e) => handleSearch(e.target.value)}
									onKeyDown={(e) => {
										e.stopPropagation()
									}}
								/>
							)}
							{menu}
							{isShowAllCheck && (
								<Flex justify="end" className={styles.allCheck}>
									<Checkbox
										checked={isAllChecked}
										onChange={handleAllCheckChange}
									>
										{locale.all}
									</Checkbox>
								</Flex>
							)}
						</Flex>
					)
				}}
				{...props}
			/>
		)
	},
)

export default SearchSelect
