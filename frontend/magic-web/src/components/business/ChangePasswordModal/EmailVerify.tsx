import { Flex, Form, Input } from "antd"
import type { FormInstance } from "antd/es/form/hooks/useForm"
import { resolveToString } from "@dtyq/es6-template-strings"
import { useTranslation } from "react-i18next"
import { UserApi } from "@/apis"
import { VerificationCode } from "@/constants/bussiness"
import VerificationCodeButton from "@/components/business/VerificationCodeButton"
import { useUserInfo } from "@/models/user/hooks"
import type { VerifyForm } from "./types"

interface EmailVerifyProps {
	form: FormInstance<VerifyForm>
}

export function EmailVerify({ form }: EmailVerifyProps) {
	const { t } = useTranslation("interface")
	const { userInfo } = useUserInfo()
	const email = userInfo?.email

	return (
		<Form
			layout="vertical"
			form={form}
			autoComplete="off"
			validateMessages={{ required: t("form.required") }}
		>
			<Form.Item label={t("setting.email")} className="mb-4" required>
				<Flex align="center" gap={8}>
					<Input disabled style={{ height: "38px" }} readOnly value={email} />
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
							phone={email}
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
