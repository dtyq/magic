import React from "react"
import SubFlowV0 from "./v0"
import SubFlowV1 from "./v1"

export const SubComponentVersionMap = {
	v0: () => <SubFlowV0 />,
	v1: () => <SubFlowV1 />,
}
