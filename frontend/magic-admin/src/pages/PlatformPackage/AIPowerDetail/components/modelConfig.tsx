import { MagicInput, SearchSelect, SubHeader } from "components"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"
import { Flex, Form } from "antd"
import { useMount, useRequest } from "ahooks"
import { useParams } from "react-router-dom"
import type { AiManage } from "@/types/aiManage"
import { AiModel } from "@/const/aiModel"
import { useApis } from "@/apis"
import { useIsMobile } from "@/hooks/useIsMobile"
import { PlatformPackage } from "@/types/platformPackage"
import BaseModelItem from "../../components/ModalList/components/BaseModelItem"
import { useStyles } from "../styles"

const ModelConfig = () => {
	const { t } = useTranslation("admin/ai/power")
	const isMobile = useIsMobile()
	const { cx, styles } = useStyles({ isMobile })

	const { code } = useParams()

	const { PlatformPackageApi } = useApis()

	const { run, data: modelList } = useRequest(
		() =>
			PlatformPackageApi.getAllModelList({
				category:
					code === PlatformPackage.PowerCode.IMAGE_CONVERT_HIGH
						? AiModel.ServiceProviderCategory.VLM
						: AiModel.ServiceProviderCategory.LLM,
				is_model_id_filter: true,
				status: 1,
			}),
		{
			manual: true,
		},
	)

	const options = useMemo(() => {
		return (
			modelList?.map((model) => ({
				data: model,
				label: model.name || model.model_id,
				value: model.model_id,
			})) || []
		)
	}, [modelList])

	useMount(() => {
		run()
	})

	return (
		<Flex vertical gap={14}>
			<SubHeader title={t("powerModel")} className={styles.subHeader} />
			<Flex
				vertical={isMobile}
				gap={10}
				justify={isMobile ? "flex-start" : "space-between"}
				align={isMobile ? "flex-start" : "center"}
			>
				<Flex gap={4} vertical className={styles.label}>
					<div className={cx(styles.labelText)}>{t("aiModel")}</div>
					<div className={styles.labelDesc}>{t("aiModelDesc")}</div>
				</Flex>
				<Form.Item name={["config", "model_id"]} className={styles.formItem}>
					<SearchSelect
						placeholder={t("aiModelPlaceholder")}
						options={options}
						maxTagCount={4}
						classNames={{ popup: { root: styles.searchSelect } }}
						showSearch
						filterOption={(input, option) =>
							(option?.label ?? "")
								.toString()
								.toLowerCase()
								.includes(input.toLowerCase())
						}
						optionRender={(option) => {
							const model = option.data.data as AiManage.ModelInfo
							return (
								<BaseModelItem
									item={model}
									isLLM={model.category === AiModel.ServiceProviderCategory.LLM}
									className={styles.modelItem}
									showDescription={false}
									avatarConfig={{
										shape: "square",
										size: 18,
									}}
								/>
							)
						}}
					/>
				</Form.Item>
			</Flex>
			{code === PlatformPackage.PowerCode.IMAGE_CONVERT_HIGH && (
				<Flex
					vertical={isMobile}
					gap={10}
					justify={isMobile ? "flex-start" : "space-between"}
					align="flex-start"
				>
					<Flex gap={4} vertical className={styles.label}>
						<div className={cx(styles.labelText)}>{t("prompt")}</div>
						<div className={styles.labelDesc}>{t("promptDesc")}</div>
					</Flex>
					<Form.Item name={["config", "prompt"]} className={styles.formItem}>
						<MagicInput.TextArea
							placeholder={t("promptPlaceholder")}
							allowClear
							rows={4}
						/>
					</Form.Item>
				</Flex>
			)}
		</Flex>
	)
}

export default ModelConfig
