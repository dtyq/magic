import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function ToolsHeaderRightV0() {
	const rules = useMemo(() => {
		return [
			{
				type: "schema",
				path: ["input", "form", "structure"],
			},
			{
				type: "schema",
				path: ["params", "custom_system_input", "form", "structure"],
			},
			{
				type: "expression",
				path: ["params", "user_prompt", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
