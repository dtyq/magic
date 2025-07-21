import { Card, Flex, type CardProps } from "antd"
import type { ReactNode } from "react"
import { forwardRef, memo, useMemo } from "react"
import { IconX } from "@tabler/icons-react"
import MagicButton from "../MagicButton"
import MagicIcon from "../MagicIcon"
import { useStyles } from "./style"

export interface MagicPageContainerProps extends CardProps {
	className?: string
	icon?: ReactNode
	closeable?: boolean
	onClose?: () => void
}

const PageContainer = memo(
	forwardRef<HTMLDivElement, MagicPageContainerProps>(
		(
			{
				children,
				className,
				classNames,
				icon,
				title: _title,
				closeable = false,
				onClose,
				...props
			},
			ref,
		) => {
			const { styles, cx } = useStyles()

			const title = useMemo(() => {
				return (
					<Flex align="center" justify="space-between">
						<Flex align="center" gap={8}>
							{icon}
							{_title}
						</Flex>
						<MagicButton
							type="text"
							hidden={!closeable}
							className={styles.closeButton}
							icon={<MagicIcon component={IconX} />}
							onClick={onClose}
						/>
					</Flex>
				)
			}, [_title, closeable, icon, onClose, styles.closeButton])

			return (
				<Card
					ref={ref}
					className={cx(styles.card, className)}
					variant="borderless"
					classNames={{
						header: cx(styles.cardHeader, classNames?.header),
						body: cx(styles.cardBody, classNames?.body),
					}}
					title={title}
					{...props}
				>
					{children}
				</Card>
			)
		},
	),
)

export default PageContainer
