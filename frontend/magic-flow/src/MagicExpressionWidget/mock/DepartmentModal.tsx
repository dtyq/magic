import { Input, Modal } from "antd"
import React from "react"
import { Department } from "../components/nodes/LabelDepartmentNames/LabelDepartmentNames"

const DepartmentModalFC = ({
	onChange,
	closeModal,
	isOpen,
}: {
	isOpen: boolean
	closeModal: () => void
	onChange: (departmentNames: Department[]) => void
}) => {
	return (
		<Modal
			open={isOpen}
			onCancel={closeModal}
			title="部门选择器"
			onOk={() => {
				onChange([
					{
						id: "Department",
						name: "技术中心",
					},
				])
			}}
		>
			<Input />
		</Modal>
	)
}
export default DepartmentModalFC
