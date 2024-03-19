import { memo, useEffect, useMemo, useState } from "react"
import type { FormInstance } from "antd"
import { Divider, Empty, Flex, Form, message } from "antd"
import { useTranslation } from "react-i18next"
import { useDebounceFn, useMount, useRequest } from "ahooks"
import { MagicSelect, MagicButton, WarningModal } from "components"
import { IconCheck, IconCopy, IconPlus, IconTrash } from "@tabler/icons-react"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useApis } from "@/apis"
import { useOpenModal } from "@/hooks/useOpenModal"
import { useAdminStore } from "@/stores/admin"
import { useStyles } from "./styles"

export const ModelSelect = memo(({ form }: { form: FormInstance }) => {
	const { t } = useTranslation("admin/ai/model")
	const { t: tCommon } = useTranslation("admin/common")
	const { styles } = useStyles()
	const openModal = useOpenModal()

	const { AIManageApi } = useApis()
	const { isOfficialOrg } = useAdminStore()
	const [list, setList] = useState<AiManage.ModelIdList[]>([])
	const [keyword, setKeyword] = useState<string>("")

	// 监听form值变化
	const selectedModelId = Form.useWatch(["model_id"], form)

	const { data: rawList, run } = useRequest(
		() =>
			isOfficialOrg
				? AIManageApi.getOriginalModelList()
				: AIManageApi.getOriginalModelListNonOfficial(),
		{
			manual: true,
			onSuccess: (res) => {
				setList(res)
			},
		},
	)

	const { runAsync: addModelId } = useRequest(
		(model_id: string) =>
			isOfficialOrg
				? AIManageApi.addModalId(model_id)
				: AIManageApi.addModalIdNonOfficial(model_id),
		{
			manual: true,
			debounceWait: 300,
			onSuccess: (_, requestParams) => {
				message.success(tCommon("message.addSuccess"))
				run()
				form.setFieldsValue({
					model_id: requestParams[0],
				})
			},
		},
	)

	useMount(() => {
		run()
	})

	useEffect(() => {
		setList(rawList?.filter((item) => item.model_id.includes(keyword)) || [])
	}, [keyword, rawList])

	const { run: debounceSearch } = useDebounceFn(
		(value: string) => {
			if (value) {
				setKeyword(value)
				setList(rawList?.filter((item) => item.model_id.includes(value)) || [])
			} else {
				setKeyword("")
				setList(rawList || [])
			}
		},
		{
			wait: 300,
		},
	)

	const removeModelId = async (modelId?: string) => {
		if (!modelId) return

		openModal(WarningModal, {
			open: true,
			content: modelId,
			zIndex: 9999,
			onOk: async () => {
				const id = list.find((item) => item.model_id === modelId)?.id
				if (!id) return
				await (isOfficialOrg
					? AIManageApi.deleteModalId(id)
					: AIManageApi.deleteModalIdNonOfficial(id))
				message.success(tCommon("message.deleteSuccess"))
				run()
				form.setFieldsValue({
					model_id: undefined,
				})
			},
		})
	}

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && keyword && !e.nativeEvent.isComposing) {
			if (list.find((item) => item.model_id === keyword)) {
				form.setFieldsValue({
					model_id: keyword,
				})
			} else {
				addModelId(keyword)
			}
		}
	}

	const options = useMemo(() => {
		return list?.map((option) => ({
			label: option.model_id,
			value: option.model_id,
			type: option.type,
		}))
	}, [list])

	const hasSearchResult = useMemo(() => {
		return list?.find((item) => item.model_id === keyword)
	}, [keyword, list])

	const onCopy = () => {
		navigator.clipboard.writeText(selectedModelId)
		message.success(t("modelIdSelect"))
	}

	return (
		<Flex gap={6} vertical>
			<Flex gap={4} align="center">
				<Form.Item name="model_id" noStyle rules={[{ required: true, message: "" }]}>
					<MagicSelect
						showSearch
						className={styles.search}
						placeholder={t("form.modelIdPlaceholder")}
						defaultActiveFirstOption={false}
						filterOption={false}
						onSearch={debounceSearch}
						notFoundContent={<Empty />}
						options={options}
						onKeyDown={onKeyDown}
						popupRender={(menu) => (
							<div>
								{menu}
								{keyword && !hasSearchResult && (
									<>
										<Divider className={styles.divider} />
										<MagicButton
											type="text"
											className={styles.button}
											onClick={() => addModelId(keyword)}
										>
											<Flex gap={4} align="center" justify="flex-start">
												<IconPlus
													size={18}
													stroke={2}
													style={{ flexShrink: 0 }}
												/>
												{t("form.addModelTip")}
												<span className={styles.link}>{keyword}</span>
											</Flex>
										</MagicButton>
									</>
								)}
							</div>
						)}
						optionRender={(option) => (
							<Flex justify="space-between">
								<Flex align="center" gap={4} className={styles.optionItem}>
									<span className={styles.ellipsis}>{option.data.label}</span>
									{option.data.type === AiModel.ModelIdType.NonOfficial && (
										<MagicButton
											type="text"
											danger
											ghost
											className={styles.deleteButton}
											onClick={(e) => {
												e.stopPropagation()
												removeModelId(option.value as string)
											}}
											icon={<IconTrash size={16} />}
										/>
									)}
								</Flex>
								{option.value === selectedModelId && (
									<IconCheck size={18} className={styles.link} />
								)}
							</Flex>
						)}
					/>
				</Form.Item>
				<MagicButton type="text" icon={<IconCopy size={18} />} onClick={onCopy} />
			</Flex>
			<div className={styles.desc}>{t("form.languageModelDesc")}</div>
		</Flex>
	)
})
