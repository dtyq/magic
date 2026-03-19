/**
 * 人员检索条件相关状态和行为&组件
 */

import { Flex, Form } from "antd"
import MagicSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "../SearchUsers.module.less"

export enum FilterTypes {
	Any = "any",
	All = "all",
}

export default function useFilters() {
	const { t } = useTranslation()
	const FilterTypeSelector = useMemo(() => {
		return (
			<Flex className={styles.filterTypeWrap} align="center" gap={4}>
				<span className={styles.text}>{t("common.meet", { ns: "flow" })}</span>
				<Form.Item name="filter_type">
					<MagicSelect
						options={[
							{
								label: t("common.all", { ns: "flow" }),
								value: FilterTypes.All,
							},
							{
								label: t("common.any", { ns: "flow" }),
								value: FilterTypes.Any,
							},
						]}
					/>
				</Form.Item>
				<span className={styles.text}>{t("common.conditions", { ns: "flow" })}</span>
			</Flex>
		)
	}, [t])

	return {
		FilterTypeSelector,
	}
}
