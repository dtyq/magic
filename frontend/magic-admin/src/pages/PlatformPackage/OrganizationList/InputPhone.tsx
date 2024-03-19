import { Input, Form, Flex } from "antd"
import { useTranslation } from "react-i18next"
import type { Rule } from "antd/es/form"
import PhoneStateCodeSelect from "./PhoneStateCodeSelect"

interface InputPhoneProps {
	placeholder?: string
	className?: string
	rules?: Rule[]
	filedName?: {
		stateCode?: string
		phone?: string
	}
	disabled?: boolean
}

const InputPhone = (props: InputPhoneProps) => {
	const {
		placeholder,
		rules,
		className,
		filedName = {
			stateCode: "state_code",
			phone: "phone",
		},
		disabled,
	} = props

	const { t } = useTranslation("admin/common")

	return (
		<Flex align="flex-start" gap={10} flex={1}>
			<Form.Item initialValue="+86" name={filedName.stateCode} style={{ marginBottom: 0 }}>
				<PhoneStateCodeSelect disabled={disabled} />
			</Form.Item>
			<Form.Item
				name={filedName.phone}
				rules={rules || []}
				dependencies={[filedName.stateCode]}
				validateFirst
				className={className}
				style={{ width: "100%", marginBottom: 0 }}
			>
				<Input
					placeholder={placeholder ?? t("pleaseInput")}
					style={{ width: "100%" }}
					disabled={disabled}
				/>
			</Form.Item>
		</Flex>
	)
}

export default InputPhone
