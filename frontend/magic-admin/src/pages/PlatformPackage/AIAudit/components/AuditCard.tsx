import { memo } from "react"
import { Card, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import type { UsageData } from "@/types/aiAudit"

export const useStyles = createStyles(({ token, prefixCls, css }) => ({
	card: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[1]};
		.${prefixCls}-card-body {
			padding: 14px;
		}
		.${prefixCls}-card-header {
			padding: 0 14px;
		}
	`,
	desc: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 12px;
	`,
}))

interface AuditCardProps {
	data?: UsageData
	onClick?: (data: UsageData) => void
	getButtons: (data: UsageData) => React.ReactNode
}

function AuditCard({ data, onClick, getButtons }: AuditCardProps) {
	const { t } = useTranslation("admin/platform/audit")
	const { styles } = useStyles()

	if (!data) return null

	return (
		<Card
			className={styles.card}
			title={`${data.topic_name} (${data.topic_id})`}
			onClick={() => onClick?.(data)}
		>
			<Flex vertical gap={6}>
				<Flex vertical gap={4}>
					<span>
						{t("userName")}: {data.user_name}
					</span>
					<span className={styles.desc}>ID:{data.user_id || "-"}</span>
				</Flex>
				<Flex vertical gap={4}>
					<span>
						{t("organization")}: {data.organization_name}
					</span>
					<span className={styles.desc}>ID:{data.organization_code || "-"}</span>
				</Flex>
				<span>
					{t("taskRounds")}: {data.task_rounds}
				</span>
				<span>
					{t("cost")}: {!data.cost ? "0.00" : data.cost.toFixed(2)}
				</span>
			</Flex>
			<Flex justify="end">{getButtons(data)}</Flex>
		</Card>
	)
}

export default memo(AuditCard)
