import { Flex, Form, Input, InputNumber } from "antd"
import { memo } from "react"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import type { Lang } from "components"
import { LanguageType, MultiLangSetting } from "components"
import { AiModel } from "@/const/aiModel"
import type { AiManage } from "@/types/aiManage"
import ConfigForm from "../ConfigForm"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			padding-top: 20px;
			border-top: 1px solid ${token.colorBorder};
			display: flex;
			gap: 20px;
			flex-direction: column;
		`,
		label: css`
			flex-shrink: 0;
			width: 36%;
		`,
		labelText: css`
			font-size: 14px;
			font-weight: 400;
			color: ${token.magicColorUsages.text[1]};
		`,
		labelDesc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
		`,
		formItem: css`
			width: 60%;
			height: 32px;
			margin-bottom: 0;
		`,
		required: css`
			&::after {
				content: "*";
				margin-left: 4px;
				color: ${token.colorError};
			}
		`,
		testStatus: css`
			font-size: 14px;
			color: ${token.colorSuccess};
		`,
	}
})

interface ApiConfigProps {
	/* 服务商详情 */
	data?: AiManage.ServiceProviderDetail
	/* 是否是官方服务上 */
	isOfficial?: boolean
	/* 多语言配置 */
	lang?: Lang
	/* 多语言保存 */
	onLangSave?: (value: Lang) => void
}

const ApiConfig = memo(({ data, lang, isOfficial, onLangSave }: ApiConfigProps) => {
	const { name, provider_code: code, category } = data || {}
	const { styles } = useStyles()
	const { t } = useTranslation("admin/ai/model")

	if (!code) return null

	return (
		<>
			{/* 别名 */}
			{category === AiModel.ServiceProviderCategory.LLM && !isOfficial && (
				<Flex justify="space-between" gap={50} align="center">
					<Flex gap={4} vertical className={styles.label}>
						<div className={styles.labelText}>{t("form.alias")}</div>
						<div className={styles.labelDesc}>{t("form.aliasPlaceholder")}</div>
					</Flex>
					<Flex gap={10} align="center" className={styles.formItem}>
						<Form.Item name="alias" noStyle>
							<Input placeholder={`${t("form.alias")} 1`} />
						</Form.Item>
						<MultiLangSetting
							onSave={onLangSave}
							info={lang}
							supportLangs={[LanguageType.en_US]}
						/>
					</Flex>
				</Flex>
			)}
			{/* 服务商配置表单 */}
			<ConfigForm category={category} code={code} name={name} />
			{/* 展示优先级 */}
			<Flex justify="space-between" gap={50} align="center">
				<Flex gap={4} vertical className={styles.label}>
					<div className={styles.labelText}>{t("form.sort")}</div>
					<div className={styles.labelDesc}>{t("form.sortDesc")}</div>
				</Flex>
				<Form.Item name="sort" noStyle>
					<InputNumber
						placeholder={t("form.sortPlaceholder")}
						min={0}
						precision={0}
						step={1}
						style={{ width: "100%" }}
					/>
				</Form.Item>
			</Flex>
		</>
	)
})

export default memo(ApiConfig)
