import React, { memo, useMemo } from "react"
import { ModelItem } from "../types"
import FlexBox from "@/opensource/components/base/FlexBox"

interface TagItem {
	key: string
	component: React.ReactElement
}

function ModelTags({ model }: { model?: ModelItem | null }) {
	// Collect all tags in a unified way
	const tags = useMemo<TagItem[]>(() => {
		if (!model) return []

		return []
	}, [model])

	if (!tags.length) return null

	return (
		<FlexBox gap={4} align="center" wrap flex={1}>
			{tags.map((tag) =>
				React.isValidElement(tag.component)
					? React.cloneElement(tag.component, { key: tag.key })
					: null,
			)}
		</FlexBox>
	)
}

export default memo(ModelTags)
