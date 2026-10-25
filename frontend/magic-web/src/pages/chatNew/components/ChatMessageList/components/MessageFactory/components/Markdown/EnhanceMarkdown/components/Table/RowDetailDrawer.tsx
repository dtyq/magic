import type React from "react"
import { Drawer, Form } from "antd"
import { useTranslation } from "react-i18next"
import { useTableStyles } from "./styles"

interface RowData {
	[key: string]: React.ReactNode
}

interface RowDetailDrawerProps {
	visible: boolean
	onClose: () => void
	rowData: RowData
	headers: string[]
	title?: string
}

const RowDetailDrawer: React.FC<RowDetailDrawerProps> = ({
	visible,
	onClose,
	rowData,
	headers,
	title,
}) => {
	const { t } = useTranslation("chat")
	const { styles } = useTableStyles()
	return (
		<Drawer
			title={title ?? t("detail.details")}
			placement="right"
			onClose={onClose}
			open={visible}
			width={400}
			destroyOnClose
		>
			<Form className={styles.detailForm} layout="vertical">
				{headers.map((header, index) => {
					const value = rowData[index] || rowData[header] || ""
					return (
						<Form.Item key={header} label={header} style={{ marginBottom: 16 }}>
							<div className={styles.formValueContent}>{value}</div>
						</Form.Item>
					)
				})}
			</Form>
		</Drawer>
	)
}

export default RowDetailDrawer
