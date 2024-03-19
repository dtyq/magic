import { CheckOutlined } from "@ant-design/icons"
import { Tooltip } from "antd"
import React from "react"
import { Member } from "../../../types"
import MemberBlock from "./MemberBlock"
import "./index.less"

type MemberItemProps = {
	item: Member
	value: Member[]
	showCheck?: boolean
	onDelete?: () => void
	[key: string]: any
}

export default function MemberItem({
	item,
	showCheck = true,
	size = 20,
	onDelete,
	value,
	itemClick,
	...props
}: MemberItemProps) {
	const { tooltip } = item
	return (
		<Tooltip title={tooltip}>
			<div
				{...props}
				className={`magic-member-item ${props.className ?? ""}`}
				onClick={() => itemClick(item)}
				contentEditable={false}
			>
				<MemberBlock item={item} size={size} onDelete={onDelete} />
				{showCheck && !!value?.find?.((v) => v.id === item.id) && (
					<CheckOutlined style={{ color: "#3B81F7" }} className="icon" />
				)}
			</div>
		</Tooltip>
	)
}
