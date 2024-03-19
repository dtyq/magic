import { useTranslation } from "react-i18next"
import { Flex, Form, Image, Select, Tooltip } from "antd"
import { useAsyncEffect, useMemoizedFn, useUpdateEffect } from "ahooks"
import { useForm } from "antd/es/form/Form"
import { mutate } from "swr"

import type { PlatformItem } from "@/opensource/types/flow"
import { IconX } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicModal from "@/opensource/components/base/MagicModal"
import { useState } from "react"
import type { DefaultOptionType } from "antd/es/select"
import { createStyles } from "antd-style"

import MagicSpin from "@/opensource/components/base/MagicSpin"
import { FlowApi } from "@/opensource/apis"

type BindOpenApiAccountForm = {
	bindAccountIds: string[]
	bind: PlatformItem[]
}

type BindOpenApiAccountProps = {
	flowId: string
	open: boolean
	onClose: () => void
}

const useBindOpenApiAccountStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		select: css`
			.open-api-label {
				img {
					width: 20px;
					border-radius: 4px;
				}
			}
		`,
		iconX: css`
			border-radius: 4px;
			width: 40px;
			cursor: pointer;
			border: 1px solid transparent;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorScales.grey[4]};
			&:hover {
				background: ${isDarkMode
					? token.magicColorScales.grey[3]
					: token.magicColorScales.grey[0]};
			}
		`,
		avatar: css`
			border-radius: 4px;
			background: ${token.magicColorScales.grey[4]};
			width: 30px;
			height: 30px;
		`,
		form: css`
			.magic-form-item {
				margin-bottom: 12px;
			}
		`,
	}
})

function BindOpenApiAccount({ flowId, open, onClose }: BindOpenApiAccountProps) {
	const { t } = useTranslation()

	const { styles } = useBindOpenApiAccountStyles()

	// const [open, { setTrue, setFalse }] = useBoolean(false)

	const [options, setOptions] = useState([] as DefaultOptionType[])

	const [bindList, setBindList] = useState([] as PlatformItem[])

	const [isLoading, setIsLoading] = useState(false)

	const [form] = useForm<BindOpenApiAccountForm>()

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()
			try {
				const ids = res.bindAccountIds
				await FlowApi.bindOpenApiAccount(flowId, ids)
				// 更新流程列表
				mutate("/api/v1/flows/queries")
				mutate("/api/v1/flows/${flowId}/open-platform/apps/queries")
				onClose()
			} catch (err: any) {
				if (err.message) console.error(err.message)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		onClose()
	})

	const initBindList = useMemoizedFn(async () => {
		setIsLoading(true)
		try {
			const bindPlatformList = await FlowApi.getOpenApiAccountList(flowId)
			setBindList(bindPlatformList?.list || [])
		} catch (error) {
			// console.log(error)
		} finally {
			setIsLoading(false)
		}
	})

	const initOptionList = useMemoizedFn(async () => {
		const optionList = await FlowApi.getOpenPlatformOfMine()
		if (optionList) {
			setOptions(
				optionList.list.map((item) => {
					return {
						label: (
							<Flex className="open-api-label" align="center" gap={8}>
								<img src={item.avatar} width={20} alt="" />
								<span>{item.name}</span>
							</Flex>
						),
						value: item.id,
						realLabel: item.name,
					}
				}),
			)
		}
	})

	useAsyncEffect(async () => {
		if (open && flowId) {
			initBindList()
			initOptionList()
		}
	}, [open, flowId])

	const onSelectNewApp = useMemoizedFn(async (appId: string) => {
		await FlowApi.bindOpenApiAccount(flowId, [appId])
		initBindList()
	})

	const onRemoveApp = useMemoizedFn(async (appId: string) => {
		await FlowApi.removeOpenApiAccount(flowId, [appId])
		initBindList()
	})

	useUpdateEffect(() => {
		form.setFieldsValue({
			bind: bindList,
		})
	}, [bindList])

	const filterOption = useMemoizedFn((input, option) => {
		return option.realLabel.toLowerCase().includes(input.toLowerCase())
	})
	return (
		<MagicModal
			title="授权应用"
			open={open}
			onOk={handleOk}
			onCancel={handleCancel}
			closable
			okText={t("button.confirm", { ns: "interface" })}
			cancelText={t("button.cancel", { ns: "interface" })}
			centered
			footer={null}
		>
			<Form
				form={form}
				validateMessages={{ required: t("form.required", { ns: "interface" }) }}
				layout="vertical"
				className={styles.form}
			>
				<Form.Item
					label="新增应用"
					extra="选中即新增"
					required
					rules={[{ required: true }]}
				>
					<Flex align="center" gap={10}>
						<Select
							popupClassName={styles.select}
							options={options}
							value={null}
							onChange={onSelectNewApp}
							showSearch
							filterOption={filterOption}
						/>
					</Flex>
				</Form.Item>
				<MagicSpin section spinning={isLoading}>
					<Form.Item label="已添加应用">
						<Form.List name="bind">
							{(subFields) => (
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										rowGap: 16,
									}}
								>
									{subFields.map((subField) => {
										const fieldData = form.getFieldValue([
											"bind",
											subField.name,
										])
										return (
											<Flex
												key={subField.key}
												justify="space-between"
												gap={6}
												align="center"
											>
												<Flex
													className="open-api-label"
													align="center"
													gap={8}
												>
													{/* @ts-ignore */}
													{fieldData.avatar && (
														<Image
															src={fieldData.avatar}
															className={styles.avatar}
															width={30}
															height={30}
															alt=""
														/>
													)}
													{!fieldData.avatar && (
														<span className={styles.avatar} />
													)}
													<span>{fieldData.name}</span>
												</Flex>
												<Tooltip title={`移除${fieldData.name}`}>
													<MagicIcon
														component={IconX}
														className={styles.iconX}
														onClick={() => {
															onRemoveApp(fieldData.id)
															// subOpt.remove(subField.name)
														}}
														width={60}
													/>
												</Tooltip>
											</Flex>
										)
									})}
								</div>
							)}
						</Form.List>
					</Form.Item>
				</MagicSpin>
			</Form>
		</MagicModal>
	)
}

export default BindOpenApiAccount
