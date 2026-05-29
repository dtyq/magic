import type { PropsWithChildren } from "react"
import { memo, useMemo } from "react"
import { Flex } from "antd"
import { useStyles } from "./style"

export interface ConfigCardProps extends PropsWithChildren {
	/** 标题 */
	title: string
	/** 描述 */
	description?: string
	/** 标题额外内容 */
	titleExtra?: React.ReactNode
	/** 额外内容 */
	extra?: React.ReactNode
}

const ConfigCard = memo(({ title, description, titleExtra, extra, children }: ConfigCardProps) => {
	const { styles } = useStyles()

	const Title = useMemo(
		() => (
			<Flex gap={10} vertical style={extra ? { flex: 1 } : {}}>
				{titleExtra ? (
					<Flex gap={10} align="center">
						<div className={styles.title}>{title}</div>
						{titleExtra}
					</Flex>
				) : (
					<div className={styles.title}>{title}</div>
				)}
				{description && <div className={styles.description}>{description}</div>}
			</Flex>
		),
		[extra, titleExtra, styles.title, styles.description, title, description],
	)

	return (
		<Flex gap={20} vertical className={styles.container}>
			{extra ? (
				<Flex gap={20} align="center">
					{Title}
					{extra}
				</Flex>
			) : (
				Title
			)}
			{children}
		</Flex>
	)
})

export default ConfigCard
