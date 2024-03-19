import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"
import { useMemo } from "react"
import CurlImporter from "../CurlImporter/CurlImporter"
import useCurlImport from "./hooks/useCurlImport"

export default function HTTPHeaderRightV1() {
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

	const { visible, showImporter, onCancel, onImport } = useCurlImport()

	const { HeaderRight } = useHeaderRight({
		rules,
		extraComponent: (
			<CurlImporter
				visible={visible}
				onCancel={onCancel}
				onImport={onImport}
				onShow={showImporter}
			/>
		),
	})

	return HeaderRight
}
