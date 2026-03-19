import { memo } from "react"
import MagicFiles from "../../../../../MagicFiles"
import { isEqual } from "lodash-es"

interface Props {
	files?: any[]
	messageId: string
}

const Files = memo(({ files, messageId }: Props) => {
	return <MagicFiles data={files} messageId={messageId} />
}, isEqual)

export default Files
