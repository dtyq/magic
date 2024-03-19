import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function SubFlowHeaderRightV0() {
	const rules = useMemo(() => {
		return [
			{
				type: "schema",
				path: ["input", "form", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
