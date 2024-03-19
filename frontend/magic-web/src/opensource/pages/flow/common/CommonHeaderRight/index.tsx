/**
 * 适用于没有单步调试但是有其他公共头部的节点
 */

import useHeaderRight from "@/opensource/pages/flow/common/hooks/useHeaderRight"

export default function CommonHeaderRight() {
	const { HeaderRight } = useHeaderRight({})

	return HeaderRight
}
