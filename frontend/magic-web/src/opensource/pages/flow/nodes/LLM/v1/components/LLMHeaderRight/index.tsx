import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function LLMHeaderRightV1() {
	const rules = useMemo(() => {
		return [
			{
				type: "expression",
				path: ["params", "system_prompt", "structure"],
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
