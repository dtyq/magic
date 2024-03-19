import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function VectorSearchHeaderRightV1() {
	const rules = useMemo(() => {
		return [
			{
				type: "expression",
				path: ["params", "query", "structure"],
			},
			{
				type: "schema",
				path: ["params", "metadata_filter", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
