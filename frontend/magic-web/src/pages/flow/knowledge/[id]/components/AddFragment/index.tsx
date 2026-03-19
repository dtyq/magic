import { useTranslation } from "react-i18next"
import { Button, Flex, Form, Input, Tooltip } from "antd"
import MagicButton from "@/components/base/MagicButton"
import { useBoolean, useMemoizedFn, useUpdateEffect } from "ahooks"
import { useForm } from "antd/es/form/Form"
import MagicModal from "@/components/base/MagicModal"
import type { Knowledge } from "@/types/knowledge"
import type { RefObject } from "react"
import { forwardRef, useImperativeHandle, useMemo } from "react"
import { IconEdit, IconWand, IconX } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { createStyles } from "antd-style"
import { generateSnowFlake } from "@/pages/flow/utils/helpers"
import { KnowledgeApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

type AddFragmentForm = Pick<Knowledge.FragmentItem, "content" | "business_id"> & {
	metadata: { key: string; value: string | number }[]
}

type AddFragmentProps = {
	knowledgeId: string
	fragment?: Knowledge.FragmentItem
	editRefs?: Record<string, RefObject<unknown>>
	initFragmentList: () => void
}

export type AddFragmentRef = {
	showModal: () => void
}

const useAddFragmentStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		iconX: css`
			border-radius: 4px;
			cursor: pointer;
			border: 1px solid transparent;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorScales.grey[4]};
			background: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.white};
			box-shadow:${isDarkMode
				? "none"
				: "0px 4px 14px 0px rgba(0, 0, 0, 0.1), 0px 0px 1px 0px rgba(0, 0, 0, 0.3);"
			}
			&:hover {
				background: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorScales.grey[0]};
			}
		`,

		modal: css`
			.magic-modal-body {
				max-height: 60vh;
				overflow: auto;
			}
		`,
		businessInput: css`

			.iconWand {
				transition: opacity 0.3s ease-in;
				opacity: 0;
				border-radius: 4px;
				padding: 2px;
				cursor: pointer;
				border: 1px solid transparent;
				color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorScales.grey[4]};
				background: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.white};
				box-shadow:${isDarkMode
				? "none"
				: "0px 4px 14px 0px rgba(0, 0, 0, 0.1), 0px 0px 1px 0px rgba(0, 0, 0, 0.3);"
			}
				&:hover {
					background: ${isDarkMode ? token.magicColorScales.grey[3] : token.magicColorScales.grey[0]};
				}
			}

			&:hover {
				.iconWand {
					opacity: 1;
				}
			
			}
		
		`,
	}
})

const AddFragment = forwardRef<AddFragmentRef, AddFragmentProps>((props, ref) => {
	const { knowledgeId, fragment, editRefs, initFragmentList } = props

	const { styles } = useAddFragmentStyles()

	const { t } = useTranslation()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const title = useMemo(() => {
		return fragment?.id
			? t("knowledgeDatabase.updateFragment", { ns: "flow" })
			: t("knowledgeDatabase.addFragment", { ns: "flow" })
	}, [fragment?.id, t])

	const [form] = useForm<AddFragmentForm>()

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()

			try {
				const { metadata } = res
				const handledMetadata = metadata.reduce(
					(acc, { key, value }) => {
						acc[key] = value
						return acc
					},
					{} as Knowledge.FragmentItem["metadata"],
				)
				await KnowledgeApi.saveFragment({
					content: res.content,
					business_id: res.business_id,
					knowledge_code: knowledgeId,
					id: fragment?.id,
					metadata: handledMetadata,
				})

				initFragmentList?.()
				magicToast.success(`${title} ${t("common.success", { ns: "flow" })}`)
				setFalse()
			} catch (err: any) {
				if (err.message) console.error(err.message)
			}
		} catch (err_1) {
			console.error("form validate error: ", err_1)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		form.resetFields()
		setFalse()
	})

	const initialValues = useMemo(() => {
		return {
			content: fragment?.content,
			metadata: Object.entries(fragment?.metadata || {}).map(([key, value]) => ({
				key,
				value,
			})),
			business_id: fragment?.business_id,
		}
	}, [fragment])

	useUpdateEffect(() => {
		if (!form) return
		form.setFieldsValue(initialValues)
	}, [fragment])

	useImperativeHandle(ref, () => {
		return {
			showModal: () => {
				setTrue()
			},
		}
	})

	useUpdateEffect(() => {
		if (!open) {
			form.resetFields()
		}
	}, [open])

	const generateBusinessId = useMemoizedFn(() => {
		const id = generateSnowFlake()
		form.setFieldsValue({
			business_id: id,
		})
	})

	return (
		<>
			{fragment?.id ? (
				<IconEdit
					className="iconEdit"
					onClick={setTrue}
					ref={editRefs?.[fragment?.id] as any}
				/>
			) : (
				<MagicButton type="dashed" onClick={setTrue}>
					{title}
				</MagicButton>
			)}
			<MagicModal
				title={title}
				open={open}
				onOk={handleOk}
				onCancel={handleCancel}
				closable
				okText={t("button.confirm", { ns: "interface" })}
				cancelText={t("button.cancel", { ns: "interface" })}
				centered
				className={styles.modal}
			>
				<Form
					form={form}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					initialValues={initialValues}
					layout="vertical"
				>
					<Form.Item
						name="content"
						label={t("knowledgeDatabase.fragmentContent", { ns: "flow" })}
						required
						rules={[{ required: true }]}
					>
						<Input.TextArea
							style={{ minHeight: "200px" }}
							placeholder={t("knowledgeDatabase.fragmentContentPlaceholder", {
								ns: "flow",
							})}
						/>
					</Form.Item>
					<Form.Item
						name="business_id"
						label={t("common.businessId", { ns: "flow" })}
						extra={t("knowledgeDatabase.businessIdDesc", { ns: "flow" })}
					>
						<Input
							placeholder={t("common.businessIdPlaceholder", { ns: "flow" })}
							className={styles.businessInput}
							suffix={
								<Tooltip title={t("common.autoBusinessId", { ns: "flow" })}>
									<IconWand className="iconWand" onClick={generateBusinessId} />
								</Tooltip>
							}
						/>
					</Form.Item>
					<Form.Item label={t("common.metadata", { ns: "flow" })}>
						<Form.List name="metadata">
							{(subFields, subOpt) => (
								<div
									style={{ display: "flex", flexDirection: "column", rowGap: 16 }}
								>
									{subFields.map((subField) => (
										<Flex
											key={subField.key}
											justify="space-between"
											gap={6}
											align="center"
										>
											<Form.Item
												noStyle
												name={[subField.name, "key"]}
												rules={[{ required: true, message: "" }]}
											>
												<Input
													placeholder={t("common.key", { ns: "flow" })}
												/>
											</Form.Item>
											<Form.Item
												noStyle
												name={[subField.name, "value"]}
												rules={[{ required: true, message: "" }]}
											>
												<Input
													placeholder={t("common.value", { ns: "flow" })}
												/>
											</Form.Item>
											<MagicIcon
												component={IconX}
												className={styles.iconX}
												onClick={() => {
													subOpt.remove(subField.name)
												}}
												width={60}
											/>
										</Flex>
									))}
									<Button type="dashed" onClick={() => subOpt.add()} block>
										+ {t("common.addMetadata", { ns: "flow" })}
									</Button>
								</div>
							)}
						</Form.List>
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
})

export default AddFragment
