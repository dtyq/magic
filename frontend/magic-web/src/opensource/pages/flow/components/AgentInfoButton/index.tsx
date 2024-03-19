import { Flex, Tag, Switch, Button } from "antd"
import { IconCircleCheckFilled, IconInfoCircle } from "@tabler/icons-react"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import MagicModal from "@/opensource/components/base/MagicModal"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { colorScales } from "@/opensource/providers/ThemeProvider/colors"
import type { Bot } from "@/opensource/types/bot"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useState, useEffect } from "react"
import { Status } from "@/opensource/pages/flow/agent/constants"
import MagicButton from "@/opensource/components/base/MagicButton"
import { openModal } from "@/opensource/utils/react"
import DeleteDangerModal from "@/opensource/components/business/DeleteDangerModal"
import { BotApi } from "@/opensource/apis"
import { useStyles } from "./styles"
import { RouteName } from "@/opensource/routes/constants"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

type AgentInfoButtonProps = {
	agent: Bot.Detail
	isAdminRight: boolean
}

export default function AgentInfoButton({ agent, isAdminRight }: AgentInfoButtonProps) {
	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()
	const { styles, cx } = useStyles()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const navigate = useNavigate()

	const [enable, setEnable] = useState(false)

	const [orgEnable, setOrgEnable] = useState(false)

	useEffect(() => {
		if (agent) {
			setEnable(agent.botEntity?.status === Status.enable)
		}
	}, [agent])

	const handleDelete = useMemoizedFn(() => {
		openModal(DeleteDangerModal, {
			content: agent.botEntity.robot_name,
			needConfirm: true,
			onSubmit: async () => {
				await BotApi.deleteBot(agent.botEntity?.id)
				magicToast.success(globalT("common.deleteSuccess", { ns: "flow" }))
				navigate({ name: RouteName.AgentList })
			},
		})
	})

	const updateAgentEnable = useMemoizedFn(async (value) => {
		setEnable(value)
		await BotApi.updateBotStatus(agent.botEntity?.id, value ? Status.enable : Status.disable)
		const text = value
			? globalT("common.enabled", { ns: "flow" })
			: globalT("common.baned", { ns: "flow" })
		magicToast.success(`${agent.botEntity?.robot_name} ${text}`)
		agent.botEntity.status = value ? Status.enable : Status.disable
	})

	const updateOrgEnable = useMemoizedFn(async (value) => {
		setOrgEnable(value)
	})

	return (
		<>
			<MagicButton
				tip={t("agent.agentInfo")}
				className={styles.iconButton}
				onClick={setTrue}
				icon={<IconInfoCircle size={16} color="#000000" />}
			/>
			<MagicModal
				title={
					<Flex gap={4} align="center">
						<Button
							type="primary"
							style={{ width: 20, height: 20 }}
							// className={styles.iconButton}
							onClick={setTrue}
							icon={<IconInfoCircle size={14} color="white" />}
						/>
						{t("agent.agentInfo")}
					</Flex>
				}
				open={open}
				onCancel={setFalse}
				footer={null}
				width={600}
			>
				<Flex vertical gap={10} style={{ paddingTop: 12 }}>
					<Flex vertical gap={8} className={styles.agentInfo}>
						<Flex justify="space-between">
							<div className={styles.text2}>{t("agent.creator")}</div>
							<Flex gap={5}>
								<MagicAvatar src={agent.magicUserEntity?.avatar_url} size={22}>
									{agent.magicUserEntity?.nickname}
								</MagicAvatar>
								<div>{agent.magicUserEntity?.nickname}</div>
							</Flex>
						</Flex>
						<Flex justify="space-between">
							<div className={styles.text2}>{t("agent.quote")}</div>
							<Tag
								icon={
									<IconCircleCheckFilled size={12} color={colorScales.green[5]} />
								}
								className={styles.tag}
							>
								{t("agent.quoteAgent", { num: 0 })}
							</Tag>
						</Flex>
						<Flex justify="space-between">
							<div className={styles.text2}>{t("agent.createTime")}</div>
							<div>
								{agent.botEntity?.created_at &&
									agent.botEntity?.created_at.replace(/-/g, "/")}
							</div>
						</Flex>
						<Flex justify="space-between">
							<div className={styles.text2}>{t("agent.updateTime")}</div>
							<div>
								{agent.botEntity?.updated_at &&
									agent.botEntity?.updated_at.replace(/-/g, "/")}
							</div>
						</Flex>
						{agent.botVersionEntity && (
							<Flex justify="space-between">
								<div className={styles.text2}>{t("agent.currentVersion")}</div>
								<div>{agent.botVersionEntity.version_number}</div>
							</Flex>
						)}
						<Flex justify="space-between">
							<div className={styles.text2}>{t("agent.status")}</div>
							<Switch
								checked={enable}
								onChange={updateAgentEnable}
								className={cx(styles.switch, { [styles.switchChecked]: enable })}
							/>
						</Flex>
						{/* <Flex justify="space-between">
							<div className={styles.text2}>{t("explore.assistantMarket")}</div>
							<Switch />
						</Flex> */}
						<Flex justify="space-between">
							<div className={styles.text2}>{t("agent.organization")}</div>
							<Flex gap={4} align="center">
								<div className={styles.text3}>{t("agent.switchOrgTip")}</div>
								<Switch
									checked={orgEnable}
									onChange={updateOrgEnable}
									className={cx(styles.switch, {
										[styles.switchChecked]: orgEnable,
									})}
								/>
							</Flex>
						</Flex>
					</Flex>
					{isAdminRight && (
						<Flex align="center" gap={8} justify="center">
							{/* <MagicButton className={cx(styles.button, styles.transfer)}>
							{t("agent.transferCreator")}
						</MagicButton> */}
							<MagicButton
								className={cx(styles.button, styles.delete)}
								onClick={handleDelete}
							>
								{t("agent.deleteAgent")}
							</MagicButton>
						</Flex>
					)}
				</Flex>
			</MagicModal>
		</>
	)
}
