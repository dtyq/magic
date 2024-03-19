/* eslint-disable react/no-array-index-key */
import { FormItemType } from "@/MagicExpressionWidget/types"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import { useMemoizedFn } from "ahooks"
import clsx from "clsx"
import React, { useMemo, useRef } from "react"
import BaseItem from "./BaseItem"
import GroupItem from "./GroupItem"
import useExtraClassname from "./hooks/useExtraClassname"
import styles from "./style/index.module.less"

type JSONSchemaRenderer = {
	form: Schema
}

export default function JSONSchemaRenderer({ form }: JSONSchemaRenderer) {
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
			className={clsx(styles.jsonSchemaTree, extraClassname)}
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
