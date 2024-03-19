import { memo, useMemo, useState } from "react"
import { Badge, Button, Drawer, Flex } from "antd"
import { IconFilter } from "@tabler/icons-react"
import MagicButton from "../MagicButton"
import { useSearchComponents } from "../TableWithFilters"
import type { SearchItem, TableButton } from "../TableWithFilters"
import { useStyles } from "./style"
import { useAdminComponents } from "../AdminComponentsProvider"
import MagicDropdown from "../MagicDropdown"
import { ButtonType } from "../TableWithFilters/types"

export interface MobileFilterProps {
	search: SearchItem[]
	buttons?: TableButton[]
	filterCount?: number
	handleReset?: () => void
}

function MobileFilter({ search, buttons, filterCount = 0 }: MobileFilterProps) {
	const { styles } = useStyles()
	const { getLocale } = useAdminComponents()
	const locale = getLocale("MobileFilter")

	const [open, setOpen] = useState(false)

	const { getComponent } = useSearchComponents()

	const formItems = useMemo(() => {
		return search.map((item) => {
			// 获取搜索组件
			const SearchComponent = getComponent(item.type)

			if (!SearchComponent) {
				console.warn(`未找到类型为 ${item.type} 的搜索组件`)
				return null
			}

			return <SearchComponent {...item} key={item.field} />
		})
	}, [search, getComponent])

	const buttonItems = useMemo(() => {
		return (
			<Flex align="center">
				{buttons?.map((button) => {
					switch (button.buttonType) {
						case ButtonType.DROPDOWN:
							return (
								<MagicDropdown.Button key={button.text} {...button}>
									{button.text}
								</MagicDropdown.Button>
							)
						case ButtonType.NORMAL:
						default:
							return (
								<MagicButton block key={button.text} {...button}>
									{button.text}
								</MagicButton>
							)
					}
				})}
			</Flex>
		)
	}, [buttons])

	// 应用筛选
	const handleApply = () => {
		setOpen(false)
	}

	return (
		<>
			<Badge count={filterCount}>
				<MagicButton
					type="primary"
					icon={<IconFilter size={18} />}
					className={styles.filterButton}
					onClick={() => setOpen(true)}
				>
					{locale.filter}
				</MagicButton>
			</Badge>

			<Drawer
				title={locale.filter}
				placement="right"
				onClose={() => setOpen(false)}
				open={open}
				width="85%"
				className={styles.drawer}
				footer={
					<Flex gap={12}>
						{/* <Button block onClick={handleReset}>
							{tCommon("button.reset")}
						</Button> */}
						<Button block type="primary" onClick={handleApply}>
							{locale.confirm}
						</Button>
					</Flex>
				}
			>
				<Flex vertical gap={10} className={styles.filterContent}>
					{formItems}
					{buttonItems}
				</Flex>
			</Drawer>
		</>
	)
}

export default memo(MobileFilter)
