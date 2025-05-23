import type { AggregateAISearchCardEvent } from "@/types/chat/conversation_message"
import { Table } from "antd"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import MagicMarkdown from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown"

const useStyles = createStyles(({ css, token }) => ({
	eventTable: css`
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		overflow: hidden;

		th[class*="magic-table-cell"] {
			background: ${token.magicColorScales.grey[0]} !important;
		}

		td[class*="magic-table-cell"]:not(:last-child),
		th[class*="magic-table-cell"]:not(:last-child) {
			border-right: 1px solid ${token.colorBorder};
		}

		th[class*="magic-table-cell"] {
			color: ${token.colorTextSecondary};
			font-size: 12px;
			font-weight: 600;
			line-height: 16px;
		}

		td[class*="magic-table-cell"] {
			color: ${token.colorTextSecondary};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		}

		tr:last-child {
			td[class*="magic-table-cell"] {
				border-bottom: none;
			}
		}
	`,
}))

const EventTable = memo(({ events }: { events: AggregateAISearchCardEvent[] }) => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	/** 事件表格列 */
	const eventTableColumns = useMemo(() => {
		return [
			{
				title: t("chat.aggregate_ai_search_card.eventName"),
				dataIndex: "name",
				minWidth: 100,
				render: (_: any, record: AggregateAISearchCardEvent) => {
					return <MagicMarkdown content={record.name} />
				},
			},
			{
				title: t("chat.aggregate_ai_search_card.eventTime"),
				dataIndex: "time",
				minWidth: 100,
			},
			{
				title: t("chat.aggregate_ai_search_card.eventDescription"),
				dataIndex: "description",
			},
		]
	}, [t])

	return (
		<Table
			dataSource={events}
			columns={eventTableColumns}
			pagination={false}
			className={styles.eventTable}
			scroll={{ x: 600 }}
		/>
	)
})

export default EventTable
