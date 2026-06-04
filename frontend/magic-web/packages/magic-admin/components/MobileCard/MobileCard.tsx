import type { CardProps } from "antd"
import { Card } from "antd"
import { useStyles } from "./style"

export type MobileCardProps = CardProps

function MobileCard({ className, children, ...props }: MobileCardProps) {
	const { styles, cx } = useStyles()

	return (
		<Card className={cx(styles.card, className)} {...props}>
			{children}
		</Card>
	)
}

export default MobileCard
