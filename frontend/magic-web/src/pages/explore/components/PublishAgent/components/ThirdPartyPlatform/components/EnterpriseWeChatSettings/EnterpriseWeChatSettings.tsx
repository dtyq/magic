import MagicModal from "@/components/base/MagicModal"
import type { FormListOperation } from "antd"
import { Flex, Form, Input, Steps } from "antd"
import { useMemo } from "react"
import { useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { IconCircleCheckFilled, IconCopy } from "@tabler/icons-react"
import { cx } from "antd-style"
import { copyToClipboard } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import MagicButton from "@/components/base/MagicButton"
import { useTranslation } from "react-i18next"
import { ThirdPartyPlatformType } from "@/types/bot"
import { env } from "@/utils/env"
import { useStyles } from "./style"
import { usePlatformData } from "../../context/PlatformDataContext"
import magicToast from "@/components/base/MagicToaster/utils"

type EnterpriseWeChatSettingsProps = {
	open: boolean
	onClose: () => void
	subOpt: FormListOperation
}

export default function EnterpriseWeChatSettings({
	open,
	onClose,
	subOpt,
}: EnterpriseWeChatSettingsProps) {
	const { styles } = useStyles()

	const { t } = useTranslation()

	const [form] = Form.useForm()

	const { platformData, setPlatformData, resetPlatformData, mode, updateRow, editIndex } =
		usePlatformData()

	const [step, setStep, resetStep] = useResetState(0)

	const isSaved = useMemo(() => {
		return !!platformData?.id
	}, [platformData?.id])

	const extraProps = useMemo(() => {
		if (step === 2)
			return {
				footer: null,
			}
		return {}
	}, [step])

	const onNext = useMemoizedFn(async () => {
		form.validateFields().then((values) => {
			setPlatformData({
				...platformData,
				...values,
			})
			if (step === 1) {
				if (mode === "create") {
					subOpt.add({
						...platformData,
						...values,
					})
				} else {
					updateRow(editIndex, {
						...platformData,
						...values,
					})
				}
				resetPlatformData()
			}
			setStep(step + 1)
		})
	})

	const onCopy = useMemoizedFn((content: string) => {
		copyToClipboard(content)
		magicToast.success(t("common.copySuccess", { ns: "flow" }))
	})

	const onStepChange = useMemoizedFn(async (value: number) => {
		if (value > step) {
			await form.validateFields()
			setStep(value)
		} else {
			setStep(value)
		}
	})

	const wechatAddr = useMemo(() => {
		if (!platformData.key) return ""
		return `${env("MAGIC_GATEWAY_ADDRESS")}/magic-service/bot/third-platform/chat?key=${platformData.key
			}&platform=${ThirdPartyPlatformType.EnterpriseWeChat}`
	}, [platformData])

	useUpdateEffect(() => {
		if (!open) {
			resetStep()
		}
	}, [open])

	useUpdateEffect(() => {
		if (mode === "create") {
			form.resetFields()
		}
	}, [mode])

	useUpdateEffect(() => {
		if (open && mode === "create") {
			form.resetFields()
		}
		if (open && mode === "edit") {
			form.setFieldsValue({
				options: platformData.options,
			})
		}
	}, [open])

	const goToWeChatPlatform = useMemoizedFn((e) => {
		e.stopPropagation()
		window.open("https://work.weixin.qq.com", "_blank")
	})

	return (
		<MagicModal
			width={700}
			title={t("common.enterpriseWeChatSettings", { ns: "flow" })}
			open={open}
			onCancel={onClose}
			onClose={onClose}
			onOk={onNext}
			className={styles.modal}
			okText={t("common.nextStep", { ns: "flow" })}
			{...extraProps}
		>
			{step !== 2 && (
				<Steps
					size="small"
					current={step}
					className={styles.steps}
					onChange={onStepChange}
					items={[
						{
							title: (
								<div
									className={cx(styles.title, {
										[styles.activeTitle]: step === 0,
									})}
								>
									{t("common.setEnterpriseWeChatInfo", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc} gap={4} align="center">
									<span>{t("common.goTo", { ns: "flow" })}</span>
									<span
										className={styles.activeText}
										onClick={goToWeChatPlatform}
									>
										{t("common.enterpriseWeChatPlatform", { ns: "flow" })}
									</span>
									<span>{t("common.get", { ns: "flow" })}</span>
								</Flex>
							),
						},
						{
							title: (
								<div
									className={cx(styles.title, {
										[styles.activeTitle]: step === 1,
									})}
								>
									{t("common.enterpriseWeChatRightTitle", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc}>
									<span>
										{t("common.enterpriseWeChatRightDesc", { ns: "flow" })}
									</span>
								</Flex>
							),
						},
						{
							title: (
								<div
									className={cx(styles.title, {
										[styles.activeTitle]: step === 2,
									})}
								>
									{t("common.publishSuccess", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc}>
									<span>{t("common.tryToChatWithAI", { ns: "flow" })}</span>
								</Flex>
							),
						},
					]}
				/>
			)}
			<Form layout="vertical" className={styles.form} form={form}>
				{step === 0 && (
					<>
						<Form.Item
							name={["options", "corp_id"]}
							label={t("common.corpId", { ns: "flow" })}
							required
							rules={[{ required: true }]}
							help={t("common.corpIdDesc", { ns: "flow" })}
						>
							<Input
								placeholder={t("common.inputEnterpriseWeChatCorpIdPlaceholder", {
									ns: "flow",
								})}
								disabled={isSaved}
							/>
						</Form.Item>
						<Form.Item
							name={["options", "secret"]}
							label={t("common.corpSecret", { ns: "flow" })}
							required
							rules={[{ required: true }]}
							help={t("common.corpSecretDesc", { ns: "flow" })}
						>
							<Input
								placeholder={t(
									"common.inputEnterpriseWeChatCorpSecretPlaceholder",
									{
										ns: "flow",
									},
								)}
								disabled={isSaved}
							/>
						</Form.Item>
						<Form.Item
							name={["options", "token"]}
							label={t("common.token", { ns: "flow" })}
							required
							rules={[{ required: true }]}
							help={t("common.tokenDesc", { ns: "flow" })}
						>
							<Input
								placeholder={t("common.inputEnterpriseWeChatTokenPlaceholder", {
									ns: "flow",
								})}
								disabled={isSaved}
							/>
						</Form.Item>
						<Form.Item
							name={["options", "aes_key"]}
							label={t("common.aesKey", { ns: "flow" })}
							required
							rules={[{ required: true }]}
							help={t("common.aesKeyDesc", { ns: "flow" })}
						>
							<Input
								placeholder={t("common.inputEnterpriseWeChatAesKeyPlaceholder", {
									ns: "flow",
								})}
								disabled={isSaved}
							/>
						</Form.Item>
					</>
				)}
				{step === 1 && (
					<>
						<div className={styles.infoCard}>
							<Flex vertical gap={8} className={styles.infoCardContent}>
								<MagicEllipseWithTooltip
									text={t("common.intoEnterpriseWeChatInfo", { ns: "flow" })}
									maxWidth="580px"
								/>
								<MagicEllipseWithTooltip
									text={t("common.addEnterpriseWeChatAgentInfo", { ns: "flow" })}
									maxWidth="580px"
								/>
							</Flex>

							<div className={styles.noticeBlock}>
								<div className={styles.noticeTitle}>
									{t("common.notices", { ns: "flow" })}
								</div>
								<Flex vertical gap={4}>
									<Flex align="flex-start" gap={8}>
										<span>
											{t("common.enterpriseWeChatLimitTips", { ns: "flow" })}
										</span>
									</Flex>
									<Flex align="flex-start" gap={8}>
										<span>
											{t("common.enterpriseWeChatChatTips", { ns: "flow" })}
										</span>
									</Flex>
									<Flex align="flex-start" gap={8}>
										<span>
											{t("common.enterpriseWeChatRichTextTips", {
												ns: "flow",
											})}
										</span>
									</Flex>
									<Flex align="flex-start" gap={8}>
										<span>
											{t("common.enterpriseWeChatLengthTips", { ns: "flow" })}
										</span>
									</Flex>
								</Flex>
							</div>
						</div>

						<Flex className={styles.formItem} align="center" gap={12}>
							<span className={styles.formTitle}>
								{t("common.messageReceiveAddr", { ns: "flow" })}
							</span>
							<Flex className={styles.formInput}>
								<MagicEllipseWithTooltip
									text={wechatAddr}
									maxWidth=""
									className={styles.url}
								/>
								<Flex
									align="center"
									className={styles.copyBlock}
									justify="center"
									gap={4}
									onClick={() => onCopy(wechatAddr)}
								>
									<IconCopy className={styles.iconCopyLink} size={20} />
									{t("common.copy", {
										ns: "flow",
									})}
								</Flex>
							</Flex>
						</Flex>
					</>
				)}

				{step === 2 && (
					<Flex
						className={styles.finishBlock}
						vertical
						gap={10}
						align="center"
						justify="center"
					>
						<IconCircleCheckFilled className={styles.iconCheck} size={60} />
						<span className={styles.successText}>
							{t("common.enterpriseWeChatSettingsSuccess", {
								ns: "flow",
							})}
						</span>
						<MagicButton
							onClick={onClose}
							className={styles.backBtn}
							color="default"
							variant="filled"
						>
							{t("common.backToPublishPage", {
								ns: "flow",
							})}
						</MagicButton>
					</Flex>
				)}
			</Form>
		</MagicModal>
	)
}
