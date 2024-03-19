import React, { ReactElement, useLayoutEffect, useMemo, useState } from "react"
import Schema from "../../../types/Schema"
import SvgLine from "../../svgLine"
import usePropertiesLength from "../hooks/usePropertiesLength"
import useSvgLine from "../hooks/useSvgLine"
import SchemaItem from "../schema-item"
import { SchemaObjectWrap } from "./index.style"

interface SchemaObjectProp {
	data: Schema
	prefix: string[]
	showEdit: (
		prefix: string[],
		editorName: string,
		propertyElement: string | { mock: string },
		type?: string,
	) => void
	showAdv: (prefix: string[], property?: Schema) => void
	// 是否显示线条（object到子field的线条）
	showExtraLine?: boolean
	setObjectLastItemOffsetTop?: React.Dispatch<React.SetStateAction<number>>
}

const SchemaObject = (props: SchemaObjectProp): ReactElement => {
	const {
		data,
		prefix,
		showEdit,
		showAdv,
		showExtraLine = true,
		setObjectLastItemOffsetTop,
	} = props

	const { propertiesLength } = usePropertiesLength({ prefix })

	// 子成员的长度
	const childLength = useMemo(() => {
		return Object.keys(data.properties || {}).length
	}, [data])

	const schemaRefs = new Array(childLength).fill(0).map(() => React.createRef<HTMLDivElement>())

	const [lastSchemaOffsetTop, setLastSchemaOffsetTop] = useState(0)

	// 竖线
	const { colSvgLineProps } = useSvgLine({ lastSchemaOffsetTop, propertiesLength, childLength })

	// 是否显示svg
	const showLine = useMemo(() => {
		return showExtraLine
	}, [showExtraLine])

	useLayoutEffect(() => {
		const lastSchemaRef = schemaRefs[childLength - 1]
		if (!lastSchemaRef || !lastSchemaRef.current) return

		// setLastSchemaOffsetTop(lastSchemaRef.current.offsetTop)
		setTimeout(() => {
			if (!lastSchemaRef || !lastSchemaRef.current) return
			//@ts-ignore
			setLastSchemaOffsetTop(lastSchemaRef.current?.offsetTop)
			setObjectLastItemOffsetTop?.(lastSchemaRef.current?.offsetTop)
		}, 10)
	}, [schemaRefs, data])

	return (
		<SchemaObjectWrap className="schema-object-wrap">
			{showLine && <SvgLine {...colSvgLineProps} className="col-line" />}
			{data.properties &&
				Object.keys(data.properties).map((name, index) => {
					return (
						<div ref={schemaRefs[index]}>
							<SchemaItem
								key={index}
								data={data}
								name={name}
								prefix={prefix}
								showEdit={showEdit}
								showAdv={showAdv}
								// 对象/数组专用属性
								childLength={Object.keys(data.properties || {}).length}
								isLastSchemaItem={index === childLength - 1}
							/>
						</div>
					)
				})}
		</SchemaObjectWrap>
	)
}

export default SchemaObject
