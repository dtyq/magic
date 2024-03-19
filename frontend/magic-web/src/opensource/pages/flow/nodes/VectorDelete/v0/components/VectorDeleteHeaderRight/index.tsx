import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function VectorDeleteHeaderRightV0() {
	const rules = useMemo(() => {
		return [
			{
				type: "expression",
				path: ["params", "business_id", "structure"],
			},
			{
				type: "schema",
				path: ["params", "metadata", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
