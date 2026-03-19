import { validatePhone } from "@/utils/phone"
import type { FormItemProps } from "antd"
import { Form } from "antd"
import { useTranslation } from "react-i18next"
import PhoneStateCodeSelect from "@/components/other/PhoneStateCodeSelect"
import type { Rule } from "antd/es/form"
import { Input as ShadcnInput } from "@/components/shadcn-ui/input"
import { cn } from "@/lib/utils"

interface PhoneInputFormItemProps extends FormItemProps {
	hidden?: boolean
	name: string
	phoneStateCode: string
	onChangePhoneStateCode: (value: string) => void
}

const PhoneInputFormItem = ({
	hidden,
	phoneStateCode,
	onChangePhoneStateCode,
	name,
	className,
	...props
}: PhoneInputFormItemProps) => {
	const { t } = useTranslation("login")

	const rules: Rule[] = [
		{
			required: true,
			message: t("phone.placeholder"),
		},
		{
			validator: (_, value) => {
				if (!value || validatePhone(value, phoneStateCode)) {
					return Promise.resolve()
				}
				return Promise.reject(new Error(t("phone.invalid")))
			},
		},
	]

	return (
		<div className="flex w-full flex-col items-start gap-1">
			<Form.Item hidden={hidden} className={cn("mb-0 w-full", className)} {...props}>
				<div className="flex w-full items-center justify-between gap-2">
					<PhoneStateCodeSelect
						className={cn("!h-10", hidden && "hidden")}
						value={phoneStateCode}
						onChange={onChangePhoneStateCode}
						dataTestId="phone-state-code-select"
					/>
					<Form.Item noStyle name={name} rules={rules}>
						<ShadcnInput
							id={name}
							name={name}
							className="h-10 w-full rounded-md px-4 text-sm placeholder:text-muted-foreground"
							placeholder={t("phone.placeholder")}
							data-testid="phone-input"
						/>
					</Form.Item>
				</div>
			</Form.Item>
		</div>
	)
}

export default PhoneInputFormItem
