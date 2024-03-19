import { useMemo } from "react"
import { Flex, Form, Input } from "antd"
import type { FormInstance } from "antd/es/form/hooks/useForm"
import { resolveToString } from "@dtyq/es6-template-strings"
import { useTranslation } from "react-i18next"
import { UserApi } from "@/opensource/apis"
import { VerificationCode } from "@/opensource/constants/bussiness"
import VerificationCodeButton from "@/opensource/components/business/VerificationCodeButton"
import MagicSelect, { type OptionType } from "@/opensource/components/base/MagicSelect"
import { useAreaCodes } from "@/opensource/models/config/hooks"
import { useUserInfo } from "@/opensource/models/user/hooks"
import type { VerifyForm } from "./types"

interface PhoneVerifyProps {
	form: FormInstance<VerifyForm>
}

export function PhoneVerify({ form }: PhoneVerifyProps) {
	const { t } = useTranslation("interface")
	const { userInfo } = useUserInfo()
	const { areaCodes } = useAreaCodes()
	const phone = userInfo?.phone
	const phoneStateCode = userInfo?.country_code

	const phoneOptions = useMemo<OptionType[]>(() => {
		return areaCodes.map((item) => ({
			value: item.code,
			label: item.code,
		}))
	}, [areaCodes])

	return (
		<Form
			layout="vertical"
			form={form}
			autoComplete="off"
			validateMessages={{ required: t("form.required") }}
		>
			<Form.Item label={t("setting.phoneNumber")} className="mb-4" required>
				<Flex align="center" gap={8}>
					<MagicSelect
						value={phoneStateCode}
						options={phoneOptions}
						style={{ width: 100, height: "38px" }}
						disabled
					/>
					<Input disabled style={{ height: "38px" }} readOnly value={phone} />
				</Flex>
			</Form.Item>
			<Form.Item
				name="code"
				label={t("setting.VerificationCode")}
				className="mb-4"
				rules={[{ required: true }]}
			>
				<Input
					autoComplete="off"
					placeholder={t("form.stateCodeRequired", { ns: "message" })}
					suffix={
						<VerificationCodeButton
							phone={phone}
							size="small"
							type="link"
							codeType={VerificationCode.ChangePassword}
							trigger={UserApi.getUsersVerificationCode}
						/>
					}
				/>
			</Form.Item>
			<Form.Item
				name="password"
				label={t("setting.newPassword")}
				className="mb-4"
				rules={[{ required: true }]}
			>
				<Input.Password
					placeholder={resolveToString(t("form.required"), {
						label: t("setting.newPassword"),
					})}
				/>
			</Form.Item>
			<Form.Item name="repeat" noStyle />
		</Form>
	)
}
