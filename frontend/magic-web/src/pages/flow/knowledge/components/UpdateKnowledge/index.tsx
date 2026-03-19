import { useTranslation } from "react-i18next"
import { Form, Input } from "antd"
import MagicButton from "@/components/base/MagicButton"
import { useBoolean, useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import { mutate } from "swr"

import MagicModal from "@/components/base/MagicModal"
import type { Knowledge } from "@/types/knowledge"
import { useEffect, useMemo } from "react"
import { IconEdit } from "@tabler/icons-react"
import { createStyles } from "antd-style"
import { KnowledgeApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

type UpdateKnowledgeForm = Pick<Knowledge.Detail, "name" | "description">

type UpdateKnowledgeProps = {
	knowledge?: Knowledge.Detail
	updateKnowledge?: (data: Knowledge.Detail) => void
	initKnowledgeList?: () => void
}

const useUpdateKnowledgeStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		iconEdit: css`
			padding: 4px;
			cursor: pointer;
			border-radius: 4px;
			&:hover {
				background: ${isDarkMode
				? token.magicColorScales.grey[8]
				: token.magicColorScales.grey[0]};
			}
		`,
	}
})

function UpdateKnowledge({ knowledge, updateKnowledge, initKnowledgeList }: UpdateKnowledgeProps) {
	const { t } = useTranslation()

	const { styles } = useUpdateKnowledgeStyles()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const [form] = useForm<UpdateKnowledgeForm>()

	const title = useMemo(() => {
		return knowledge?.id
			? t("knowledgeDatabase.update", { ns: "flow" })
			: t("knowledgeDatabase.add", { ns: "flow" })
	}, [knowledge?.id, t])

	const handleOk = useMemoizedFn(async () => {
		try {
			const res = await form.validateFields()
			try {
				const data = await KnowledgeApi.updateKnowledge({
					code: knowledge?.code || "",
					name: res.name,
					description: res.description,
					icon: knowledge?.icon || "",
					enabled: knowledge?.enabled || false,
				})
				magicToast.success(`${title} ${t("common.success", { ns: "flow" })}`)
				// 更新流程列表
				mutate("/api/v1/knowledge-bases/queries")
				form.resetFields()
				setFalse()
				if (knowledge) {
					updateKnowledge?.(data)
				} else {
					initKnowledgeList?.()
				}
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
			name: knowledge?.name,
			description: knowledge?.description,
		}
	}, [knowledge?.name, knowledge?.description])

	useEffect(() => {
		form.setFieldsValue({
			name: knowledge?.name,
			description: knowledge?.description,
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [knowledge])

	return (
		<>
			{knowledge?.id ? (
				<IconEdit className={styles.iconEdit} onClick={setTrue} />
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
			>
				<Form
					form={form}
					validateMessages={{ required: t("form.required", { ns: "interface" }) }}
					initialValues={initialValues}
				>
					<Form.Item
						name="name"
						label={t("common.name", { ns: "flow" })}
						required
						rules={[{ required: true }]}
					>
						<Input
							placeholder={t("knowledgeDatabase.namePlaceholder", { ns: "flow" })}
						/>
					</Form.Item>
					<Form.Item
						name="description"
						label={t("common.desc", { ns: "flow" })}
						required
						rules={[{ required: true }]}
					>
						<Input.TextArea
							placeholder={t("knowledgeDatabase.descPlaceholder", { ns: "flow" })}
						/>
					</Form.Item>
				</Form>
			</MagicModal>
		</>
	)
}

export default UpdateKnowledge
