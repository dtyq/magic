import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"

export default function ExcelHeaderRightV0() {
	const rules = useMemo(() => {
		return [
			{
				type: "schema",
				path: ["params", "files", "structure"],
			},
		]
	}, [])

	const { HeaderRight } = useHeaderRight({ rules })

	return HeaderRight
}
