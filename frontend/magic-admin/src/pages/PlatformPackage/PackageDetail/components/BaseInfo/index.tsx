import { memo } from "react"
import { useTranslation } from "react-i18next"
import { LanguageType, MagicInput, MagicSwitch, MultiLangSetting } from "components"
import { Flex, Form, Radio } from "antd"
import { useMemoizedFn } from "ahooks"
import { PlatformPackage } from "@/types/platformPackage"
import InputNumber from "../InputNumber"
import type { LangConfig } from "../../const"
import { useGetStyles } from "../../index.page"

interface BaseInfoProps {
	productId?: string
	langConfig: LangConfig
	setLangConfig: React.Dispatch<React.SetStateAction<LangConfig>>
	errors: Record<string, boolean>
	planTypeOptions?: PlatformPackage.OptionsType[]
}

const BaseInfo = memo(
	({ productId, langConfig, setLangConfig, errors, planTypeOptions }: BaseInfoProps) => {
		const { t } = useTranslation("admin/platform/manage")
		const { t: tCommon } = useTranslation("admin/common")
		const styles = useGetStyles()

		const updateLangConfig = useMemoizedFn(
			(key: "name_i18n" | "description_i18n" | "subtitle_i18n", value: any) => {
				setLangConfig((prev) => ({
					...prev,
					[key]: { ...prev[key], ...value },
				}))
			},
		)

		return (
			<Flex vertical className={styles.packageInfo} gap={20}>
				{productId && (
					<Form.Item label="Product ID" className={styles.formItem}>
						<MagicInput readOnly placeholder="Product ID" value={productId} />
					</Form.Item>
				)}
				<Form.Item label={t("packageName")} required className={styles.formItem}>
					<Flex gap={10}>
						<Form.Item
							name={["product", "name_i18n", "zh_CN"]}
							style={{ width: "100%" }}
							rules={[{ required: true, message: "" }]}
							noStyle
						>
							<MagicInput
								placeholder={tCommon("pleaseInputPlaceholder", {
									name: t("packageName"),
								})}
								onChange={(e) => {
									updateLangConfig("name_i18n", {
										zh_CN: e.target.value,
									})
								}}
							/>
						</Form.Item>
						<MultiLangSetting
							required
							supportLangs={[LanguageType.en_US]}
							danger={errors?.name_i18n}
							info={langConfig.name_i18n}
							onSave={(value) => {
								updateLangConfig("name_i18n", value)
							}}
						/>
					</Flex>
				</Form.Item>
				<Form.Item label={t("packageDescription")} className={styles.formItem}>
					<Flex gap={10}>
						<Form.Item
							name={["product", "description_i18n", "zh_CN"]}
							style={{ width: "100%" }}
							noStyle
						>
							<MagicInput
								placeholder={tCommon("pleaseInputPlaceholder", {
									name: t("packageDescription"),
								})}
								onChange={(e) => {
									updateLangConfig("description_i18n", {
										zh_CN: e.target.value,
									})
								}}
							/>
						</Form.Item>
						<MultiLangSetting
							supportLangs={[LanguageType.en_US]}
							danger={errors?.description_i18n}
							info={langConfig.description_i18n}
							onSave={(value) => {
								updateLangConfig("description_i18n", value)
							}}
						/>
					</Flex>
				</Form.Item>
				<Form.Item label={t("subtitle")} className={styles.formItem}>
					<Flex gap={10}>
						<Form.Item
							name={["product", "subtitle_i18n", "zh_CN"]}
							style={{ width: "100%" }}
							noStyle
						>
							<MagicInput
								placeholder={t("subtitlePlaceholder")}
								onChange={(e) => {
									updateLangConfig("subtitle_i18n", {
										zh_CN: e.target.value,
									})
								}}
							/>
						</Form.Item>
						<MultiLangSetting
							supportLangs={[LanguageType.en_US]}
							info={langConfig.subtitle_i18n}
							onSave={(value) => {
								updateLangConfig("subtitle_i18n", value)
							}}
						/>
					</Flex>
				</Form.Item>
				<InputNumber
					name={["product", "extra", "level"]}
					label={t("packageLevel")}
					placeholder={t("packageLevelPlaceholder")}
				/>
				<InputNumber
					name={["product", "sort"]}
					label={t("sort")}
					placeholder={t("sortPlaceholder")}
				/>
				<Form.Item
					name={["product", "enable"]}
					label={t("status")}
					required
					className={styles.formItem}
					valuePropName="checked"
					initialValue
				>
					<MagicSwitch />
				</Form.Item>
				<Form.Item
					label={t("packageType")}
					required
					className={styles.formItem}
					name={["skus", "attributes", "plan_type"]}
					initialValue={PlatformPackage.PackageType.Personal}
					rules={[{ required: true, message: "" }]}
				>
					<Radio.Group
						options={planTypeOptions}
						defaultValue={PlatformPackage.PackageType.Personal}
					/>
				</Form.Item>
			</Flex>
		)
	},
)

export default BaseInfo
