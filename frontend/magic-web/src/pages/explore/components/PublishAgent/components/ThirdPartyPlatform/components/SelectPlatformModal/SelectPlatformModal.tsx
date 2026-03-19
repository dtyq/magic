import { Flex, Form, Input } from "antd"
import MagicButton from "@/components/base/MagicButton"
import { cx } from "antd-style"
import { IconCheck } from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import MagicModal from "@/components/base/MagicModal"
import { useTranslation } from "react-i18next"
import { ThirdPartyPlatformType } from "@/types/bot"
import { useStyles } from "./style"
import { usePlatformData } from "../../context/PlatformDataContext"
import usePlatforms from "../PlatformInfo/usePlatforms"

type SelectPlatformButtonProps = {
	openDingTalk: () => void
	openFeiShu: () => void
	openEnterpriseWeChat: () => void
	open: boolean
	onOpen: () => void
	onClose: () => void
}

export default function SelectPlatformButton({
	openDingTalk,
	openFeiShu,
	openEnterpriseWeChat,
	open,
	onOpen,
	onClose,
}: SelectPlatformButtonProps) {
	const { styles } = useStyles()

	const { t } = useTranslation()

	const [form] = Form.useForm()

	const { platformData, setPlatformData, mode } = usePlatformData()

	const { thirdPartyPlatformList } = usePlatforms()

	const switchActivePlatform = useMemoizedFn((platform) => {
		if (platform.disabled) return

		setPlatformData({
			...platformData,
			type: platform.type,
		})
	})

	const onOk = useMemoizedFn(() => {
		form.validateFields().then((values) => {
			setPlatformData({
				...platformData,
				identification: values.identification,
			})
			onClose()
			if (platformData.type === ThirdPartyPlatformType.DingTalk) {
				openDingTalk()
			}
			if (platformData.type === ThirdPartyPlatformType.FeiShu) {
				openFeiShu()
			}
			if (platformData.type === ThirdPartyPlatformType.EnterpriseWeChat) {
				openEnterpriseWeChat()
			}
		})
	})

	useUpdateEffect(() => {
		if (open && mode === "create") {
			form.resetFields()
		}
		if (open && mode === "edit") {
			form.setFieldValue("identification", platformData.identification)
		}
	}, [open])

	return (
		<>
			<MagicButton type="primary" ghost onClick={onOpen}>
				{t("common.addPlatform", {
					ns: "flow",
				})}
			</MagicButton>
			<MagicModal
				width={700}
				title={t("common.selectPlatform", {
					ns: "flow",
				})}
				open={open}
				onCancel={onClose}
				onClose={onClose}
				okText={t("common.nextStep", {
					ns: "flow",
				})}
				onOk={onOk}
			>
				<Flex gap={10} className={styles.thirdPartyAppList}>
					{thirdPartyPlatformList.map((platform) => {
						const isActive = platformData.type === platform.type
						const ImageComp = platform.image
						return (
							<Flex
								key={platform.type}
								className={cx(styles.platformBlock, {
									[styles.active]: isActive,
									[styles.disabled]: platform.disabled,
								})}
								align="center"
								justify="center"
								vertical
								onClick={() => switchActivePlatform(platform)}
								gap={4}
							>
								<div className={styles.platformImage}>
									<ImageComp size={28} />
								</div>
								{platform.disabled && (
									<Flex
										align="center"
										justify="center"
										className={styles.willSupportBlock}
									>
										{t("common.willOnline", {
											ns: "flow",
										})}
									</Flex>
								)}
								{isActive && (
									<Flex
										align="center"
										justify="center"
										className={styles.checkIcon}
									>
										<IconCheck size={24} color="#fff" />
									</Flex>
								)}
								<MagicEllipseWithTooltip
									text={platform.title}
									maxWidth="180px"
									className="platform-title"
								/>
								<MagicEllipseWithTooltip
									text={t("common.enterpriseApp", {
										ns: "flow",
									})}
									className="platform-title"
									maxWidth="200px"
								/>
							</Flex>
						)
					})}
				</Flex>
				<Form form={form} layout="vertical" className={styles.form}>
					<Form.Item
						name="identification"
						label={t("common.identification", {
							ns: "flow",
						})}
						required
						rules={[{ required: true }]}
					>
						<Input
							placeholder={t("common.identificationPlaceholder", {
								ns: "flow",
							})}
						/>
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}
