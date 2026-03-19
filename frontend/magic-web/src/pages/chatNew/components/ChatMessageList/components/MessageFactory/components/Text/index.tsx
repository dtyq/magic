import React from "react"

const Text = React.memo(({ content }: { content: string }) => {
	return <div>{content}</div>
})

export default Text
