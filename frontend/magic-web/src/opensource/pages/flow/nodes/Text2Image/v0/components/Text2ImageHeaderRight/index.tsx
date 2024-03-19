import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function Text2ImageHeaderRightV0() {
	const rules = useMemo(() => {
		return [
			{
				type: "expression",
				path: ["params", "ratio", "structure"],
			},
			{
				type: "expression",
				path: ["params", "width", "structure"],
			},
			{
				type: "expression",
				path: ["params", "height", "structure"],
			},

			{
				type: "expression",
				path: ["params", "user_prompt", "structure"],
			},
			{
				type: "expression",
				path: ["params", "negative_prompt", "structure"],
			},
			{
				type: "expression",
				path: ["params", "negative_prompt", "structure"],
			},
			{
				type: "expression",
				path: ["params", "reference_images", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
