/* eslint-disable react/no-array-index-key */
import { useMemoizedFn } from "ahooks"
import React, { useMemo, useRef } from "react"
import BaseItem from "./BaseItem"
import GroupItem from "./GroupItem"
import useExtraClassname from "./hooks/useExtraClassname"
import { useStyles } from "./style/style"
import Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"

type JSONSchemaRenderer = {
	form: Schema
}

export default function JSONSchemaRenderer({ form }: JSONSchemaRenderer) {
	const { styles, cx } = useStyles()
	const properties = useMemo(() => {
		if (form && form.properties) {
			// 将 properties 按 sort 字段进行排序，越小越排前
			return Object.entries(form.properties).sort(
				([, a], [, b]) => (a.sort || 0) - (b.sort || 0),
			)
		}
		return [] as Array<[string, Schema]>
	}, [form])

	const scrollRef = useRef<HTMLDivElement>(null)

	const { extraClassname, banScroll, makeCanScroll } = useExtraClassname()

	const onMouseEnter = useMemoizedFn(() => {
		const scrollHeight = scrollRef.current?.scrollHeight || 0
		const clientHeight = scrollRef.current?.clientHeight || 0

		const scrollable = scrollHeight > clientHeight
		if (scrollable) {
			makeCanScroll()
		}
	})

	return (
		<div
			className={cx(styles.jsonSchemaTree, extraClassname)}
			ref={scrollRef}
			onMouseEnter={onMouseEnter}
			onMouseLeave={banScroll}
		>
			{properties.map(([key, schema], index) => {
				if (schema.type === FormItemType.Array || schema.type === FormItemType.Object) {
					return (
						<GroupItem field={schema} key={index} fieldKey={key} type={schema.type} />
					)
				}
				return <BaseItem displayKey={key} key={index} field={schema} />
			})}
		</div>
	)
}
