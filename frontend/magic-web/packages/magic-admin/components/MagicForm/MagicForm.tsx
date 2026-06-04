import { Flex, Form, type FormProps } from "antd"
import type { ReactNode } from "react"
import { useStyles } from "./style"

export interface MagicFormProps extends FormProps {
	children?: ReactNode
	/* 必填标志是否置后 */
	afterRequiredMask?: boolean
}

// 定义组件类型，包含所有附加属性
interface MagicFormType extends React.FC<MagicFormProps> {
	Item: typeof Form.Item
	List: typeof Form.List
	useForm: typeof Form.useForm
	useWatch: typeof Form.useWatch
	useFormInstance: typeof Form.useFormInstance
}

const MagicForm: MagicFormType = ({
	className,
	children,
	afterRequiredMask = false,
	requiredMark,
	...props
}: MagicFormProps) => {
	const { styles, cx } = useStyles()
	const customRequiredMark = (label: React.ReactNode, { required }: { required: boolean }) => (
		<Flex gap={4} align="center">
			{label}
			{required && <span className={styles.required}>*</span>}
		</Flex>
	)

	return (
		<Form
			className={cx(styles.form, className)}
			{...props}
			requiredMark={afterRequiredMask ? customRequiredMark : requiredMark}
		>
			{children}
		</Form>
	)
}

MagicForm.Item = Form.Item
MagicForm.List = Form.List
MagicForm.useForm = Form.useForm
MagicForm.useWatch = Form.useWatch
MagicForm.useFormInstance = Form.useFormInstance

export default MagicForm
