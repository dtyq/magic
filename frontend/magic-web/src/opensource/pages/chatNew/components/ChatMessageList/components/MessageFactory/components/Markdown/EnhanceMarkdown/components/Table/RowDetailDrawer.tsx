import type React from "react"
import { Drawer, Form } from "antd"
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
	title = "Details",
}) => {
	const { styles } = useTableStyles()
	return (
		<Drawer
			title={title}
			placement="right"
			onClose={onClose}
			open={visible}
			width={400}
			destroyOnClose
		>
			<div className={styles.detailForm}>
				{headers.map((header, index) => {
					const value = rowData[index] || rowData[header] || ""
					return (
						<Form.Item key={header} label={header} style={{ marginBottom: 16 }}>
							<div className={styles.formValueContent}>{value}</div>
						</Form.Item>
					)
				})}
			</div>
		</Drawer>
	)
}

export default RowDetailDrawer
