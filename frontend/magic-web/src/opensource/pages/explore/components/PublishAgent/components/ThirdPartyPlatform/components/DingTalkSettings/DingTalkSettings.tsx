import MagicModal from "@/opensource/components/base/MagicModal"
import type { FormListOperation } from "antd"
import { Flex, Form, Input, Steps } from "antd"
import { useMemo } from "react"
import { useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { IconCircleCheckFilled, IconCopy } from "@tabler/icons-react"
import { cx } from "antd-style"
import { env } from "@/opensource/utils/env"
import { copyToClipboard } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useTranslation } from "react-i18next"
import { ThirdPartyPlatformType } from "@/opensource/types/bot"
import { useStyles } from "./style"
import { usePlatformData } from "../../context/PlatformDataContext"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

type DingTalkSettingsProps = {
	open: boolean
	onClose: () => void
	subOpt: FormListOperation
}

export default function DingTalkSettings({ open, onClose, subOpt }: DingTalkSettingsProps) {
	const { styles } = useStyles()
	const [form] = Form.useForm()

	const { t } = useTranslation()

	const { platformData, setPlatformData, resetPlatformData, mode, updateRow, editIndex } =
		usePlatformData()
	const [step, setStep, resetStep] = useResetState(0)

	const isSaved = useMemo(() => {
		return !!platformData?.id
	}, [platformData?.id])

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

	const onStepChange = useMemoizedFn(async (value: number) => {
		if (value > step) {
			await form.validateFields()
			setStep(value)
		} else {
			setStep(value)
		}
	})

	const dingTalkAddr = useMemo(() => {
		return `${env("MAGIC_GATEWAY_ADDRESS")}/magic-service/bot/third-platform/chat?key=${
			platformData.key
		}&platform=${ThirdPartyPlatformType.DingTalk}`
	}, [platformData])

	const onCopy = useMemoizedFn((str: string) => {
		copyToClipboard(str)
		magicToast.success(t("common.copySuccess", { ns: "flow" }))
	})

	const extraProps = useMemo(() => {
		if (step === 2)
			return {
				footer: null,
			}
		return {}
	}, [step])

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

	const goToDingTalkPlatform = useMemoizedFn((e) => {
		e.stopPropagation()
		window.open("https://open-dev.dingtalk.com/", "_blank")
	})

	return (
		<MagicModal
			width={700}
			title={t("common.dingTalkSettings", { ns: "flow" })}
			open={open}
			onCancel={onClose}
			onClose={onClose}
			onOk={onNext}
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
									{t("common.setDingTalkInfo", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc} gap={4} align="center">
									<span>{t("common.goTo", { ns: "flow" })}</span>
									<span
										className={styles.activeText}
										onClick={goToDingTalkPlatform}
									>
										{t("common.dingTalkPlatform", { ns: "flow" })}
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
									{t("common.dingTalkRightTitle", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc}>
									<span>{t("common.dingTalkRightDesc", { ns: "flow" })}</span>
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
							name={["options", "app_key"]}
							label="Client ID"
							required
							rules={[{ required: true }]}
						>
							<Input
								placeholder={t("common.inputClientIdPlaceholder", { ns: "flow" })}
								disabled={isSaved}
							/>
						</Form.Item>
						<Form.Item
							name={["options", "app_secret"]}
							label="Client Secret"
							required
							rules={[{ required: true }]}
						>
							<Input
								placeholder={t("common.inputClientSecretPlaceholder", {
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
							<MagicEllipseWithTooltip
								text={t("common.intoDingTalkInfo", {
									ns: "flow",
								})}
								maxWidth="580px"
							/>
							<MagicEllipseWithTooltip
								text={t("common.addAgentInfo", {
									ns: "flow",
								})}
								maxWidth="580px"
							/>
							<Flex align="center">
								<span>
									{t("common.dingTalkPowerInfo", {
										ns: "flow",
									})}
								</span>
								<span className={styles.infoActiveText}>
									qyapi_get_department_list
								</span>
								<IconCopy
									className={styles.copy}
									size={14}
									onClick={() => onCopy("qyapi_get_department_list")}
								/>
								<span>
									”
									{t("common.dingTalkAndInfo", {
										ns: "flow",
									})}
									“
								</span>
								<span className={styles.infoActiveText}>qyapi_get_member</span>
								<IconCopy
									className={styles.copy}
									size={14}
									onClick={() => onCopy("qyapi_get_member")}
								/>
								<span>”</span>
							</Flex>
						</div>
						<Flex className={styles.formItem} align="center" gap={12}>
							<span className={styles.formTitle}>
								{t("common.messageReceiveMode", {
									ns: "flow",
								})}
							</span>
							<span className={styles.formDesc}>
								{t("common.httpMode", {
									ns: "flow",
								})}
							</span>
						</Flex>
						<Flex className={styles.formItem} align="center" gap={12}>
							<span className={styles.formTitle}>
								{t("common.messageReceiveAddr", {
									ns: "flow",
								})}
							</span>
							<Flex className={styles.formInput}>
								<MagicEllipseWithTooltip
									text={dingTalkAddr}
									maxWidth=""
									className={styles.url}
								/>
								<Flex
									align="center"
									className={styles.copyBlock}
									justify="center"
									gap={4}
									onClick={() => onCopy(dingTalkAddr)}
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
							{t("common.dingTalkSettingsSuccess", {
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
