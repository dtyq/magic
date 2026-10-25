/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/naming-convention */

import { IconLogin2 } from "@tabler/icons-react"
import React from "react"
import Start from "./nodes/Start/Start"

export enum customNodeType {
	Start = 1,
}

export const nodeSchemaMap = {
	[customNodeType.Start]: {
		schema: {
			label: "开始节点",
			icon: <IconLogin2 color="#fff" stroke={2} size={18} />,
			color: "#315CEC",
			id: customNodeType.Start,
			desc: "当以下事件被触发时，流程将会从这个模块开始执行",
			handle: {
				withSourceHandle: false,
				withTargetHandle: false,
			},
			style: {
				width: "480px",
			},
		},
		component: () => <Start />,
	},
}

export default nodeSchemaMap
