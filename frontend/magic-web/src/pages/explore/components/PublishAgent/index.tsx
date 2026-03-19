import { useTranslation } from "react-i18next"
import type { RadioChangeEvent } from "antd"
import { Form, Input, Flex, Radio, Alert, Modal } from "antd"
import MagicIcon from "@/components/base/MagicIcon"
import MagicButton from "@/components/base/MagicButton"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/components/base/MagicModal"
import { ScopeType, VisibleRangeType, type Bot } from "@/types/bot"
import type { MutableRefObject } from "react"
import { useState, useMemo, useEffect } from "react"
import { IconCheck, IconAlertCircleFilled } from "@tabler/icons-react"
import privateLogo from "@/assets/logos/privateLogo.svg"
import orgLogo from "@/assets/logos/orgLogo.svg"
import markLogo from "@/assets/logos/marketLogo.svg"
import IconWand from "@/enhance/tabler/icons-react/icons/IconWand"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import { shadowFlow } from "@/pages/flow/utils/helpers"
import { MessageReceiveType } from "@/types/chat"
import useNavigate from "@/routes/hooks/useNavigate"
import ConversationService from "@/services/chat/conversation/ConversationService"
import { BotApi } from "@/apis"
import ThirdPartyPlatform from "./components/ThirdPartyPlatform/ThirdPartyPlatform"
import useThirdPartyInit from "./hooks/useThirdPartyInit"
import { useStyles } from "./style"
import SuccessResult from "./components/SuccessResult"
import VisibleRange from "./components/VisibleRange"
import { useTheme } from "antd-style"
import { NodeType, TreeNode } from "@dtyq/user-selector"
import { RouteName } from "@/routes/constants"
import magicToast from "@/components/base/MagicToaster/utils"

export type PublishAgentType = Pick<
	Bot.BotVersion,
	| "version_number"
	| "version_description"
	| "release_scope"
	| "third_platform_list"
	| "visibility_config"
>

type PublishAgentProps = {
	open: boolean
	agentId?: string
	scope?: ScopeType // 机器人发布的范围
	flowInstance?: MutableRefObject<MagicFlowInstance | null>
	agent?: Bot.Detail
	updateAgent?: (botVersion: Bot.Detail["botVersionEntity"]) => void
	submit?: (this: any, agentId: any) => Promise<void>
	close?: () => void
}

type RadioRenderType = {
	scope: ScopeType
	title: string
	desc: string
	icon: string
	disable?: boolean
}

function PublishAgent({
	agentId,
	scope,
	open,
	submit,
	close,
	flowInstance,
	agent,
	updateAgent,
}: PublishAgentProps) {
	const { t } = useTranslation("interface")
	const { magicColorScales } = useTheme()

	const navigate = useNavigate()

	const [success, { setTrue: SuccessTrue, setFalse: SuccessFalse }] = useBoolean(false)

	const { styles, cx } = useStyles({ success })

	const [form] = useForm<PublishAgentType>()

	const [userId, setUserId] = useState("")

	const [selectScope, setSelectScope] = useState(ScopeType.private)

	const [selectedMember, setSelectedMember] = useState<TreeNode[]>([])

	const [version, setVersion] = useState("")

	const title = useMemo(() => {
		return success ? t("explore.form.publishSuccess") : t("explore.buttonText.publishAssistant")
	}, [success, t])

	const handleCancel = useMemoizedFn(() => {
		// 回显版本发布范围/版本号
		const newBotVersion = agent?.botVersionEntity || { release_scope: "", version_number: "" }
		newBotVersion.release_scope = selectScope
		newBotVersion.version_number = form.getFieldValue("version_number")
		updateAgent?.(newBotVersion as Bot.Detail["botVersionEntity"])
		close?.()
		form.resetFields()
		SuccessFalse()
	})

	// 获取下一个版本号
	const getNextVersion = useMemoizedFn(async () => {
		const data = await BotApi.getMaxVersion(agentId!)
		setVersion(data)
	})

	const currentVersionIsOld = useMemo(() => {
		if (!agent) return false
		const currentVersion = Number(
			agent?.botVersionEntity?.version_number?.split?.(".")?.join?.(""),
		)
		const nextVersion = Number(version.split(".").join(""))
		return nextVersion > currentVersion + 1
	}, [agent, version])

	const publishAction = useMemoizedFn(async () => {
		const latestFlow = flowInstance?.current?.getFlow()
		if (!latestFlow) return
		const shadowedFlow = shadowFlow(latestFlow)
		const res = await form.validateFields()

		const visibilityConfig = res?.visibility_config || {
			visibility_type: VisibleRangeType.AllMember,
		}

		const users = selectedMember.filter((item) => item.dataType === NodeType.User)
		const departments = selectedMember.filter((item) => item.dataType === NodeType.Department)
		const versionNumber = selectScope === ScopeType.private ? version : res.version_number

		if (
			visibilityConfig &&
			visibilityConfig.visibility_type === VisibleRangeType.SpecifiedMemberOrDepartment
		) {
			visibilityConfig.users = users.map((item) => ({ id: item.id }))
			visibilityConfig.departments = departments.map((item) => ({ id: item.id }))
		}

		const data = await BotApi.publishBot({
			...res,
			bot_id: agentId,
			magic_flow: shadowedFlow!,
			version_description: res.version_description || "",
			version_number: versionNumber,
			third_platform_list: res.third_platform_list || [],
			visibility_config: visibilityConfig,
		})
		magicToast.success(`${title}成功`)
		// 更新机器人版本
		const newBotVersion = agent?.botVersionEntity || {
			release_scope: "",
			version_number: "",
			visibility_config: {},
		}
		newBotVersion.release_scope = selectScope
		newBotVersion.version_number = versionNumber
		newBotVersion.visibility_config = {
			visibility_type: visibilityConfig.visibility_type,
			users,
			departments,
		}

		updateAgent?.(newBotVersion as Bot.Detail["botVersionEntity"])

		SuccessTrue()
		setUserId(data.user.user_id)
		submit?.(agentId)
		setSelectedMember([])
	})

	const handleOk = useMemoizedFn(async () => {
		try {
			if (currentVersionIsOld) {
				Modal.confirm({
					centered: true,
					title: "提示",
					content:
						"当前云端存在更新的流程版本，使用本地流程覆盖可能导致他人的最新修改丢失，建议保存为草稿后刷新检查。是否确认覆盖？",
					okText: t("button.confirm", { ns: "interface" }),
					cancelText: t("button.cancel", { ns: "interface" }),
					okButtonProps: {
						type: "primary",
						danger: true,
					},
					okType: "danger",
					onOk: async () => {
						publishAction()
					},
				})
			} else {
				publishAction()
			}
		} catch (err: any) {
			if (err.message) console.error(err.message)
		}
	})

	const handleChange = useMemoizedFn((e: RadioChangeEvent) => {
		setSelectScope(e.target.value)
		form.setFieldsValue({ release_scope: e.target.value })
	})

	const selectIcon = useMemo(() => {
		switch (selectScope) {
			case ScopeType.private:
				return privateLogo
			case ScopeType.organization:
				return orgLogo
			case ScopeType.public:
				return markLogo
			default:
				return privateLogo
		}
	}, [selectScope])

	const radioRender: RadioRenderType[] = useMemo(
		() => [
			{
				scope: ScopeType.private,
				title: t("explore.form.private"),
				desc: t("explore.form.privatePlaceholder"),
				icon: privateLogo,
				disable: false,
			},
			{
				scope: ScopeType.organization,
				title: t("explore.form.publishOrg"),
				desc: t("explore.form.publishOrgPlaceholder"),
				icon: orgLogo,
				disable: false,
			},
			{
				scope: ScopeType.public,
				title: t("explore.form.publishPublic"),
				desc: t("explore.form.publishPublicPlaceholder"),
				icon: markLogo,
				disable: true,
			},
		],
		[t],
	)

	const footerRender = useMemo(() => {
		return (
			<Flex justify="flex-end" align="center">
				{/* <MagicButton
					type="default"
					className={styles.button}
					onClick={()=>{}}
				>{t("explore.buttonText.autoGenerate")}
				</MagicButton> */}
				<Flex gap={10} align="center">
					<MagicButton type="default" onClick={handleCancel}>
						{t("button.cancel", { ns: "interface" })}
					</MagicButton>
					<MagicButton type="primary" onClick={handleOk}>
						{t("button.publish", { ns: "interface" })}
					</MagicButton>
				</Flex>
			</Flex>
		)
	}, [handleOk, handleCancel, t])

	// 会话
	const navaigateCoversation = useMemoizedFn(async () => {
		const conversation = await ConversationService.createConversation(
			MessageReceiveType.Ai,
			`${userId}`,
		)
		if (conversation) {
			ConversationService.switchConversation(conversation)
			navigate({ name: RouteName.SuperAssistant })
		}
	})

	const handleConversation = useMemoizedFn(() => {
		navaigateCoversation()
		handleCancel()
	})

	useThirdPartyInit({ agent, form, open })

	useEffect(() => {
		if (open && agentId) {
			// 获取下个版本号
			getNextVersion()
			form.setFieldValue("version_number", version)
			if (scope) {
				setSelectScope(scope)
				form.setFieldsValue({ release_scope: scope })
			} else {
				form.setFieldsValue({ release_scope: selectScope })
			}
			form.setFieldValue("visibility_config", {
				visibility_type: agent?.botVersionEntity?.visibility_config?.visibility_type,
			})

			setSelectedMember([
				...(agent?.botVersionEntity?.visibility_config?.users || []).map((item) => ({
					...item,
					avatar_url: item.avatar_url || item.avatar || "",
					real_name: item.nickname || "",
					name: item.nickname || "",
					dataType: NodeType.User,
				})),
				...(agent?.botVersionEntity?.visibility_config?.departments || []).map((item) => ({
					...item,
					dataType: NodeType.Department,
				})),
			] as TreeNode[])
		}
	}, [agent, agentId, form, getNextVersion, open, scope, selectScope, version])

	const handleKeyDown = useMemoizedFn(() => {
		if (!form.getFieldValue("version_number")) form.setFieldsValue({ version_number: version })
	})

	return (
		<MagicModal
			className={styles.modal}
			width={600}
			title={title}
			open={open}
			footer={!success && footerRender}
			onCancel={handleCancel}
			closable
			centered
			destroyOnClose
		>
			{!success && (
				<Form
					form={form}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					layout="vertical"
					className={styles.form}
				>
					<div className={styles.title}>{t("explore.form.officialChannel")}</div>
					<Form.Item
						name="release_scope"
						initialValue={ScopeType.private}
						noStyle={selectScope === ScopeType.private}
					>
						<Radio.Group className={styles.radioBox} onChange={handleChange}>
							{radioRender.map((radio) => {
								if (scope && radio.scope < scope) return null
								return (
									<Radio
										disabled={radio.disable}
										value={radio.scope}
										key={radio.scope}
									>
										<Flex
											className={cx(styles.customRadio, {
												[styles.checked]: selectScope === radio.scope,
												[styles.disabled]: radio.disable,
											})}
											vertical
											align="center"
											justify="center"
											gap={10}
										>
											<img alt="" src={radio.icon} />
											<Flex vertical gap={4} align="center">
												<div
													className={cx(styles.customRadioTitle, {
														[styles.disabled]: radio.disable,
													})}
												>
													{radio.title}
												</div>
												<div>{radio.desc}</div>
											</Flex>
											{selectScope === radio.scope && (
												<div className={styles.checkedIcon}>
													<MagicIcon
														component={IconCheck}
														color="white"
													/>
												</div>
											)}
											{radio.disable && (
												<div className={styles.disabledText}>
													{t("explore.form.comingSoon")}
												</div>
											)}
										</Flex>
									</Radio>
								)
							})}
						</Radio.Group>
					</Form.Item>

					{selectScope === ScopeType.organization && (
						<>
							<Form.Item>
								<Alert
									className={styles.alert}
									message={t("explore.form.alert")}
									type="warning"
									showIcon
									icon={
										<MagicIcon
											component={IconAlertCircleFilled}
											size={16}
											color={magicColorScales.orange[5]}
										/>
									}
								/>
							</Form.Item>
							<Form.Item
								name="version_number"
								label={t("explore.form.version")}
								required
								rules={[
									{
										required: true,
										message: t("explore.form.versionPlaceholder"),
									},
									{
										pattern: /^\d+\.\d+\.\d+$/,
										message: t("explore.form.versionValidateTip"),
									},
								]}
							>
								<Input
									placeholder={`${t(
										"explore.form.versionPlaceholder",
									)} [${version}] `}
									onFocus={handleKeyDown}
								/>
							</Form.Item>
							<Form.Item>
								<Flex
									style={{ width: "100%" }}
									justify="space-between"
									align="center"
								>
									<div>{t("explore.form.publishRecord")}</div>
									<MagicButton
										className={styles.aiButton}
										type="text"
										icon={<IconWand size={18} />}
									/>
								</Flex>
								<Form.Item name="version_description" noStyle>
									<Input.TextArea
										style={{
											minHeight: "90px",
										}}
										placeholder={t("explore.form.publishRecordPlaceholder", {
											ns: "interface",
										})}
									/>
								</Form.Item>
							</Form.Item>
							<VisibleRange
								selected={selectedMember}
								setSelected={setSelectedMember}
								type={agent?.botVersionEntity?.visibility_config?.visibility_type}
							/>
							<ThirdPartyPlatform form={form} agent={agent} />
						</>
					)}
				</Form>
			)}
			{success && (
				<SuccessResult
					selectIcon={selectIcon}
					handleConversation={handleConversation}
					handleCancel={handleCancel}
				/>
			)}
		</MagicModal>
	)
}

export default PublishAgent
