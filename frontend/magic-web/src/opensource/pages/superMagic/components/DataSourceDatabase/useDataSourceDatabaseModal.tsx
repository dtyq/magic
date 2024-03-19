import { Modal } from "antd"
import { useState } from "react"
import DataSourceDatabase from "."
import { useModalStyles } from "./styles"

export default function useDataSourceDatabaseModal() {
	const [open, setOpen] = useState(false)

	const { styles } = useModalStyles()

	const show = () => {
		setOpen(true)
	}

	const close = () => {
		setOpen(false)
	}

	const content = (
		<Modal
			open={open}
			onCancel={close}
			destroyOnClose
			title="连接新数据库"
			width={460}
			className={styles.modal}
			footer={null}
			centered
		>
			<DataSourceDatabase />
		</Modal>
	)

	return {
		content,
		show,
		close,
	}
}
