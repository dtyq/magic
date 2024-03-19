/**
 * 人员检索条件相关状态和行为&组件
 */

import MagicSelect from "@/common/BaseUI/Select"
import { Flex, Form } from "antd"
import React, { useMemo } from "react"
import styles from "../SearchUsers.module.less"

export enum FilterTypes {
	Any = "any",
	All = "all",
}

export default function useFilters() {
	const FilterTypeSelector = useMemo(() => {
		return (
			<Flex className={styles.filterTypeWrap} align="center" gap={4}>
				<span className={styles.text}>符合</span>
				<Form.Item name="filter_type">
					<MagicSelect
						options={[
							{
								label: "所有",
								value: FilterTypes.All,
							},
							{
								label: "任一",
								value: FilterTypes.Any,
							},
						]}
					/>
				</Form.Item>
				<span className={styles.text}>条件</span>
			</Flex>
		)
	}, [])

	return {
		FilterTypeSelector,
	}
}
