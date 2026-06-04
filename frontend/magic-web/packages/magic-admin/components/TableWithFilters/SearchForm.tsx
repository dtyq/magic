import type { RowProps } from "antd"
import { Row, Col, Flex } from "antd"
import { useMemo } from "react"
import MagicDropdown from "../MagicDropdown"
import MagicButton from "../MagicButton"
import { ButtonType, type SearchItem, type TableButton } from "./types"
import { useSearchComponents } from "./SearchComponentRegistry"
import { useStyles } from "./style"
/**
 * 搜索表单
 */
export interface SearchFormProps {
	/** 搜索项 */
	items?: SearchItem[]
	/** 搜索项变化回调 */
	onChange?: (values: Record<string, any>) => void
	/** 按钮 */
	buttons?: TableButton[]
	/** 搜索布局 */
	justify?: RowProps["justify"]
	/** 搜索表单高度 */
	height?: number
}

export const SearchForm = ({ items, buttons, justify, height }: SearchFormProps) => {
	const { styles } = useStyles({ height: height ?? 0 })

	const { getComponent } = useSearchComponents()

	const formItems = useMemo(() => {
		if (!items || items.length === 0) return null
		return items.map((item) => {
			// 获取搜索组件
			const SearchComponent = getComponent(item.type)

			if (!SearchComponent) {
				console.warn(`未找到类型为 ${item.type} 的搜索组件`)
				return null
			}

			return (
				<Col
					xs={24}
					sm={12}
					md={8}
					lg={8}
					xl={8}
					key={item.field}
					style={{ alignSelf: "center" }}
				>
					<SearchComponent {...item} />
				</Col>
			)
		})
	}, [items, getComponent])

	const buttonItems = useMemo(() => {
		return (
			<Flex align="center">
				{buttons?.map((button) => {
					switch (button.buttonType) {
						case ButtonType.DROPDOWN:
							return (
								<Col key={button.text}>
									<MagicDropdown.Button {...button}>
										{button.text}
									</MagicDropdown.Button>
								</Col>
							)
						case ButtonType.NORMAL:
						default:
							return (
								<Col key={button.text} className={styles.button}>
									{button.description && (
										<span className={styles.description}>
											{button.description}
										</span>
									)}
									<MagicButton {...button}>{button.text}</MagicButton>
								</Col>
							)
					}
				})}
			</Flex>
		)
	}, [buttons, styles.button, styles.description])

	return (
		<Row gutter={[10, 10]} justify={justify}>
			{formItems}
			{buttonItems}
		</Row>
	)
}
