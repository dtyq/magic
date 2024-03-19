import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function HTTPHeaderRightV0() {
	const rules = useMemo(() => {
		return [
			{
				type: "schema",
				path: ["params", "api", "structure", "request", "body", "structure"],
			},
			{
				type: "schema",
				path: ["params", "api", "structure", "request", "headers", "structure"],
			},

			{
				type: "schema",
				path: ["params", "api", "structure", "request", "params_path", "structure"],
			},
			{
				type: "schema",
				path: ["params", "api", "structure", "request", "params_query", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
