import MagicCode from "@/opensource/components/base/MagicCode"
import { CodeRenderProps } from "../types"

const Fallback = (props: CodeRenderProps) => {
	return <MagicCode language={props.language} data={props.data} />
}

export default Fallback
