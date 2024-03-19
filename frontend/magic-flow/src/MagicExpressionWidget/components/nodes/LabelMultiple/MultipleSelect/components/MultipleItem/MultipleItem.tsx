import { CheckOutlined } from "@ant-design/icons"
import React from "react"
import { Multiple, MultipleOption } from "../../../types"
import MultipleBlock from "./MultipleBlock"
import "./index.less"

type MultipleItemProps = {
	item: MultipleOption
	value: Multiple[]
	showCheck?: boolean
	onDelete?: () => void
	closeColor?: string
	[key: string]: any
}

export default function MultipleItem({
	item,
	showCheck = true,
	onDelete,
	value,
	itemClick,
	closeColor,
	...props
}: MultipleItemProps) {
	return (
		<div
			{...props}
			className={`magic-multiple-item ${props.className ?? ""}`}
			onClick={() => itemClick(item.id)}
			contentEditable={false}
		>
			<MultipleBlock item={item} onDelete={onDelete} />
			{showCheck && value.includes(item.id) && (
				<CheckOutlined className="icon" color={closeColor || "#1C1D2359"} />
			)}
		</div>
	)
}
