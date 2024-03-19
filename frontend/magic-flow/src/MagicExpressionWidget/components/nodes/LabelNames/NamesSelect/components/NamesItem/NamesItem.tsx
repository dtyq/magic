import { CheckOutlined } from "@ant-design/icons"
import React, { useMemo } from "react"
import { Names, NamesOption } from "../../../types"
import NamesBlock from "./NamesBlock"
import "./index.less"

type NamesItemProps = {
	item: NamesOption
	value: Names[]
	showCheck?: boolean
	onDelete?: () => void
	closeColor?: string
	[key: string]: any
}

export default function NamesItem({
	item,
	showCheck = true,
	onDelete,
	value,
	itemClick,
	closeColor,
	...props
}: NamesItemProps) {
	const suffix = useMemo(() => {
		return props?.suffix?.(item) || null
	}, [props])

	return (
		<div
			{...props}
			className={`magic-names-item ${props.className ?? ""}`}
			onClick={() =>
				itemClick({
					id: item.id,
					name: item.label,
				})
			}
			contentEditable={false}
		>
			<NamesBlock item={item} onDelete={onDelete} suffix={suffix} />
			{showCheck && value?.find?.((v) => v.id === item.id) && (
				<CheckOutlined className="icon" color={closeColor || "#1C1D2359"} />
			)}
		</div>
	)
}
