/* eslint-disable react/no-array-index-key */
import { FormItemType } from "@/MagicExpressionWidget/types"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import _ from "lodash"
import React, { useMemo, useState } from "react"
import BaseItem from "../BaseItem"
import styles from "../style/index.module.less"

type GroupItemProps = {
	field: Schema
	fieldKey: string
	type: FormItemType.Array | FormItemType.Object
}

export default function GroupItem({ field, fieldKey, type }: GroupItemProps) {
	const [isDisplay, setIsDisplay] = useState(true)
	const sortedProperties = useMemo(() => {
		let _properties = field.properties

		if (field?.type === FormItemType.Array) {
			const itemsType = field?.items?.type
			if (itemsType === FormItemType.Object) {
				_properties = field?.items?.properties
			}
		}
		// 如果折叠，则置空
		if (!isDisplay) {
			_properties = {}
		}

		return _.sortBy(
			Object.entries(
				_properties ||
					({} as {
						[key: string]: Schema
					}),
			),
			["sort"],
		)
	}, [field, isDisplay])

	return (
		<div className={styles.objectKeyItem}>
			<div className={styles.objectRow}>
				<BaseItem
					field={field}
					displayKey={fieldKey}
					onExpand={() => setIsDisplay(!isDisplay)}
					isDisplay={isDisplay}
				/>

				{(type === FormItemType.Object || type === FormItemType.Array) && (
					<ul className={styles.keyList} style={{ paddingLeft: `40px` }}>
						{sortedProperties.map(([key, item], index) => {
							if (
								item.type === FormItemType.Array ||
								item.type === FormItemType.Object
							) {
								return (
									<GroupItem
										field={item}
										key={index}
										fieldKey={key}
										type={type}
									/>
								)
							}
							return <BaseItem displayKey={key} key={index} field={item} />
						})}
					</ul>
				)}
			</div>
		</div>
	)
}
