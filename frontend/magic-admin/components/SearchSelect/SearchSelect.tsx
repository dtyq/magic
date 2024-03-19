import { Input, Flex, type SelectProps, Space, Tag } from "antd"
import { memo, useMemo, useState } from "react"
import { IconX } from "@tabler/icons-react"
import { useAdminComponents } from "../AdminComponentsProvider"
import MagicSelect from "../MagicSelect"
import { useStyles } from "./style"
import MagicAvatar from "../MagicAvatar"

export type SearchSelectProps = SelectProps & {
	/* 是否显示头像 */
	showAvatar?: boolean
	/* 是否显示搜索框 */
	showInput?: boolean
	/* 标签是否显示边框 */
	bordered?: boolean
	/* tag 类名 */
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
		tagClassName,
		...props
	}: SearchSelectProps) => {
		const { styles, cx } = useStyles()
		const [searchValue, setSearchValue] = useState("")

		const { getLocale } = useAdminComponents()
		const locale = getLocale("SearchSelect")

		const filteredOptions = useMemo(() => {
			if (searchValue && showInput) {
				return options?.filter((option) =>
					option?.label?.toString().toLowerCase().includes(searchValue.toLowerCase()),
				)
			}
			return options || []
		}, [options, searchValue, showInput])

		const handleSearch = (value: string) => {
			setSearchValue(value)
			props.onSearch?.(value)
		}

		const tagRender: TagRender = (option) => {
			const { label, value, closable, onClose } = option
			const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
				event.preventDefault()
				event.stopPropagation()
			}

			const avatar = options?.find((o) => o.value === value)?.avatar || ""

			const newLabel = showAvatar ? (
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

		return (
			<MagicSelect
				allowClear
				className={cx(styles.select, className)}
				options={filteredOptions}
				optionRender={optionRender}
				tagRender={tagRender}
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
								/>
							)}
							{menu}
						</Flex>
					)
				}}
				{...props}
			/>
		)
	},
)

export default SearchSelect
