import MagicModal from "@/opensource/components/base/MagicModal"
import type { FormListOperation } from "antd"
import { Flex, Form, Input, Steps } from "antd"
import { useMemo } from "react"
import { useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import { IconCircleCheckFilled, IconCopy, IconPointFilled } from "@tabler/icons-react"
import { cx } from "antd-style"
import { env } from "@/opensource/utils/env"
import { copyToClipboard } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useTranslation } from "react-i18next"
import { ThirdPartyPlatformType } from "@/opensource/types/bot"
import { useStyles } from "./style"
import { usePlatformData } from "../../context/PlatformDataContext"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

type FeiShuSettingsProps = {
	open: boolean
	onClose: () => void
	subOpt: FormListOperation
}

export default function FeiShuSettings({ open, onClose, subOpt }: FeiShuSettingsProps) {
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
			// 保证 http 结构的正确性
			if (step === 0) {
				const options = {
					...values.options,
				}
				setPlatformData({
					...platformData,
					options,
				})
			} else {
				setPlatformData({
					...platformData,
					...values,
				})
			}

			if (step === 1) {
				if (mode === "create") {
					subOpt.add({
						...platformData,
						...values,
						options: {
							...platformData.options,
							...values.options,
						},
					})
				} else {
					updateRow(editIndex, {
						...platformData,
						...values,
						options: {
							...platformData.options,
							...values.options,
						},
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

	const feiShuAddr = useMemo(() => {
		return `${env("MAGIC_GATEWAY_ADDRESS")}/magic-service/bot/third-platform/chat?key=${
			platformData.key
		}&platform=${ThirdPartyPlatformType.FeiShu}`
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

	const goToFeiShuPlatform = useMemoizedFn((e) => {
		e.stopPropagation()
		window.open("https://open.feishu.cn/app", "_blank")
	})

	return (
		<MagicModal
			width={700}
			title={t("common.feiShuSettings", { ns: "flow" })}
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
									{t("common.setFeiShuInfo", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc} gap={4} align="center">
									<span>{t("common.goTo", { ns: "flow" })}</span>
									<span
										className={styles.activeText}
										onClick={goToFeiShuPlatform}
									>
										{t("common.feiShuPlatform", { ns: "flow" })}
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
									{t("common.feiShuRightTitle", { ns: "flow" })}
								</div>
							),
							description: (
								<Flex className={styles.desc}>
									<span>{t("common.feiShuRightDesc", { ns: "flow" })}</span>
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
							name={["options", "app_id"]}
							label="App ID"
							required
							rules={[{ required: true }]}
						>
							<Input
								placeholder={t("common.inputFeiShuAppIdPlaceholder", {
									ns: "flow",
								})}
								disabled={isSaved}
							/>
						</Form.Item>
						<Form.Item
							name={["options", "app_secret"]}
							label="App Secret"
							required
							rules={[{ required: true }]}
						>
							<Input
								placeholder={t("common.inputFeiShuAppSecretPlaceholder", {
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
							<Flex vertical gap={8}>
								<div>{t("common.feiShuSteps1", { ns: "flow" })}</div>
								<div>{t("common.feiShuSteps2", { ns: "flow" })}</div>
								<Flex align="center" gap={2}>
									<span>{t("common.feiShuSteps3", { ns: "flow" })}</span>
									<span className={styles.infoActiveText}>
										im:message.receive_v1
									</span>
									<IconCopy
										className={styles.copy}
										size={14}
										onClick={() => onCopy("im:message.receive_v1")}
									/>
								</Flex>
								<div>{t("common.feiShuSteps4", { ns: "flow" })}</div>
								{[
									{
										label: t("common.readUserMessage", { ns: "flow" }),
										permission: "im:message.p2p_msg:readonly",
									},
									{
										label: t("common.receiveGroupMessage", { ns: "flow" }),
										permission: "im:message.group_at_msg:readonly",
									},
									{
										label: t("common.sendMessage", { ns: "flow" }),
										permission: "im:message",
									},
									{
										label: t("common.getContactInfo", { ns: "flow" }),
										permission: "contact:contact.base:readonly",
									},
									{
										label: t("common.getUserInfo", { ns: "flow" }),
										permission: "contact:user.base:readonly",
									},
									{
										label: t("common.getResources", { ns: "flow" }),
										permission: "im:resource",
									},
								].map(({ label, permission }) => (
									<Flex
										key={permission}
										align="center"
										gap={2}
										className={styles.infoItem}
									>
										<Flex align="center">
											<IconPointFilled size={10} style={{ marginRight: 4 }} />
											{label}{" "}
										</Flex>
										<span className={styles.infoActiveText}>{permission}</span>
										<IconCopy
											className={styles.copy}
											size={14}
											onClick={() => onCopy(permission)}
										/>
									</Flex>
								))}
							</Flex>
						</div>
						<Flex className={styles.formItem} align="center" gap={12}>
							<span className={styles.formTitle}>
								{t("common.requestAddr", {
									ns: "flow",
								})}
							</span>
							<Flex className={styles.formInput}>
								<MagicEllipseWithTooltip
									text={feiShuAddr}
									maxWidth=""
									className={styles.url}
								/>
								<Flex
									align="center"
									className={styles.copyBlock}
									justify="center"
									gap={4}
									onClick={() => onCopy(feiShuAddr)}
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
							{t("common.feiShuSettingsSuccess", {
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
