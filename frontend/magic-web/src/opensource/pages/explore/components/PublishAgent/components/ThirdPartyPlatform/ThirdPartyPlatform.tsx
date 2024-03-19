import { Flex, Form } from "antd"
import { cx } from "antd-style"
import type { FormInstance } from "antd/lib"
import CryptoJS from "@/opensource/utils/crypto"
import { useBoolean, useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import type { Bot } from "@/opensource/types/bot"
import { ThirdPartyPlatformType } from "@/opensource/types/bot"
import { generateSnowFlake } from "@/opensource/pages/flow/utils/helpers"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"
import PlatformInfo from "./components/PlatformInfo/PlatformInfo"
import type { PublishAgentType } from "../.."
import { PlatformDataProvider } from "./context/PlatformDataContext"
import SelectPlatformButton from "./components/SelectPlatformModal/SelectPlatformModal"
import DingTalkSettings from "./components/DingTalkSettings/DingTalkSettings"
import FeiShuSettings from "./components/FeiShuSettings/FeiShuSettings"
import EnterpriseWeChatSettings from "./components/EnterpriseWeChatSettings/EnterpriseWeChatSettings"

type ThirdPartyPlatformProps = {
	form: FormInstance<PublishAgentType>
	agent?: Bot.Detail
}

export default function ThirdPartyPlatform({ form, agent }: ThirdPartyPlatformProps) {
	const { styles } = useStyles()

	const { t } = useTranslation()

	const [platformData, setPlatformData, resetPlatformData] = useResetState({
		bot_id: agent?.botEntity?.id,
		identification: "",
		key: CryptoJS.MD5encryption(generateSnowFlake()),
		type: ThirdPartyPlatformType.DingTalk,
		enabled: true,
		options: {
			app_key: "",
			app_secret: "",
		},
	} as Bot.ThirdPartyPlatform)

	const [mode, setMode] = useState("create")

	const [dingTalkOpen, { setFalse: closeDingTalk, setTrue: openDingTalk }] = useBoolean()
	const [feiShuOpen, { setFalse: closeFeiShu, setTrue: openFeiShu }] = useBoolean()
	const [
		enterpriseWeChatOpen,
		{ setFalse: closeEnterpriseWeChat, setTrue: openEnterpriseWeChat },
	] = useBoolean()

	const [
		thirdPartyPlatformOpen,
		{ setFalse: closeThirdPartyPlatform, setTrue: openThirdPartyPlatform },
	] = useBoolean()

	const [editIndex, setEditIndex] = useState(0)

	const editPlatform = useMemoizedFn((platform: Bot.ThirdPartyPlatform, index: number) => {
		setMode("edit")
		setEditIndex(index)
		setPlatformData({ ...platform })
		openThirdPartyPlatform()
	})

	const openPlatformSelect = useMemoizedFn(() => {
		setMode("create")
		openThirdPartyPlatform()
	})

	const updateRow = useMemoizedFn((index: number, newData: Bot.ThirdPartyPlatform) => {
		const currentValues = form.getFieldsValue()
		const updatedValues = {
			...currentValues,
			third_platform_list: currentValues?.third_platform_list?.map?.((item, i) =>
				i === index ? { ...item, ...newData } : item,
			),
		}
		form.setFieldsValue(updatedValues)
	})

	useUpdateEffect(() => {
		if (!dingTalkOpen) {
			resetPlatformData()
		}
	}, [dingTalkOpen])

	useUpdateEffect(() => {
		if (!feiShuOpen) {
			resetPlatformData()
		}
	}, [feiShuOpen])

	useUpdateEffect(() => {
		if (!enterpriseWeChatOpen) {
			resetPlatformData()
		}
	}, [enterpriseWeChatOpen])

	return (
		<PlatformDataProvider
			platformData={platformData}
			setPlatformData={setPlatformData}
			resetPlatformData={resetPlatformData}
			updateRow={updateRow}
			editIndex={editIndex}
			mode={mode}
		>
			<Form.Item>
				<Form.List name="third_platform_list">
					{(subFields, subOpt) => {
						return (
							<div className={styles.thirdPartyBlock}>
								<Flex vertical>
									<Flex
										align="center"
										justify="space-between"
										className={styles.thirdPartyHeader}
									>
										<Flex vertical>
											<span className={styles.title}>
												{t("common.thirdPartyPlatform", { ns: "flow" })}
											</span>
											<span className={styles.desc}>
												{t("common.thirdPartyPlatformDesc", { ns: "flow" })}
											</span>
										</Flex>
										<Flex>
											<SelectPlatformButton
												openDingTalk={openDingTalk}
												openFeiShu={openFeiShu}
												openEnterpriseWeChat={openEnterpriseWeChat}
												open={thirdPartyPlatformOpen}
												onClose={closeThirdPartyPlatform}
												onOpen={openPlatformSelect}
											/>
											<DingTalkSettings
												open={dingTalkOpen}
												onClose={closeDingTalk}
												subOpt={subOpt}
											/>
											<FeiShuSettings
												open={feiShuOpen}
												onClose={closeFeiShu}
												subOpt={subOpt}
											/>
											<EnterpriseWeChatSettings
												open={enterpriseWeChatOpen}
												onClose={closeEnterpriseWeChat}
												subOpt={subOpt}
											/>
										</Flex>
									</Flex>
									<Flex vertical gap={0} className={styles.thirdPartyList}>
										{subFields.map((subField) => {
											// @ts-ignore
											const fieldData = form.getFieldValue([
												"third_platform_list",
												subField.name,
											])

											return (
												<Flex
													key={subField.key}
													className={styles.thirdPartyApp}
													gap={10}
													align="center"
												>
													<div className={styles.left}>
														<PlatformInfo
															data={fieldData}
															name={subField.name}
														/>
													</div>
													<Flex
														className={styles.right}
														align="center"
														justify="space-between"
														gap={10}
													>
														<span
															className={cx(
																styles.settings,
																styles.text,
															)}
															onClick={() =>
																editPlatform(
																	fieldData,
																	subField.name,
																)
															}
														>
															{t("common.settings", { ns: "flow" })}
														</span>
														<span
															className={cx(
																styles.delete,
																styles.text,
															)}
															onClick={() => {
																subOpt.remove(subField.name)
															}}
														>
															{t("common.delete", { ns: "flow" })}
														</span>
													</Flex>
												</Flex>
											)
										})}
									</Flex>
								</Flex>
							</div>
						)
					}}
				</Form.List>
			</Form.Item>
		</PlatformDataProvider>
	)
}
