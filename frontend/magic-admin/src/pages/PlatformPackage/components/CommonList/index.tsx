import { Flex, Row, Col } from "antd"
import { MagicAvatar, MagicCard } from "components"
import { useStyles } from "./styles"
import ServiceIcon from "../ServiceIcon"

interface CommonItem {
	id: string
	name: string
	alias?: string
	icon?: string
	description?: string
	provider_code?: string
	provider_type?: number
}

interface CommonListProps<T = CommonItem> {
	content: Array<{
		id: any
		title: string
		data: T[]
	}>
	className?: string
	style?: React.CSSProperties
	rightAction?: (item: T) => React.ReactNode
	leftAction?: (item: T) => React.ReactNode
	emptyComponent?: (id: any) => React.ReactNode
}

const CommonList = <T extends CommonItem>({
	content,
	className,
	style,
	rightAction,
	leftAction,
	emptyComponent,
}: CommonListProps<T>) => {
	const { styles, cx } = useStyles()

	return (
		<Flex gap={10} vertical className={cx(styles.container, className)} style={style}>
			{content.map(({ id, title, data }) => {
				return (
					<Flex gap={10} vertical key={id}>
						<div className={styles.title}>
							{title} ({data?.length})
						</div>
						<Row gutter={[10, 10]} wrap>
							{data?.map((item) => (
								<Col xs={24} sm={24} md={12} lg={8} xl={6} key={item.id}>
									<MagicCard
										key={item.id}
										title={`${item.name || item?.provider_code || ""}${
											item.alias ? `(${item.alias})` : ""
										}`}
										avatar={
											item?.provider_code ? (
												<ServiceIcon
													size={42}
													code={item.provider_code || ""}
													type={item.provider_type}
													border
													radius={8}
												/>
											) : (
												<MagicAvatar src={item.icon} size={42} radius={8}>
													{item.name}
												</MagicAvatar>
											)
										}
										className={styles.card}
										description={item.description}
										rightAction={rightAction?.(item)}
										leftAction={leftAction?.(item)}
									/>
								</Col>
							))}
							{emptyComponent?.(id)}
						</Row>
					</Flex>
				)
			})}
		</Flex>
	)
}

export default CommonList
