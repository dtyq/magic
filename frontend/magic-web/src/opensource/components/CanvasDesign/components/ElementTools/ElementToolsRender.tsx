import { Divider } from "../../types"
import type { ElementToolType } from "../../types"
import { Fragment, useMemo, useCallback } from "react"
import styles from "./index.module.css"
import ElementToolItem from "./ElementToolItem"
import type { ElementToolOptionType } from "./types"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"

interface ElementToolsRenderProps {
	options?: ElementToolOptionType[]
}

export default function ElementToolsRender(props: ElementToolsRenderProps) {
	const { options } = props

	const { containerRef: positionRef } = useElementPositionEffect({
		position: "top",
		offset: 24,
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "element-tools",
		enableWheelForwarding: true,
	})

	// 合并 refs
	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	// 根据 Divider 分组
	const groups = useMemo(() => {
		const result: Array<Array<{ type: ElementToolType }>> = []
		let currentGroup: Array<{ type: ElementToolType }> = []
		options?.forEach((item) => {
			if (item === Divider) {
				if (currentGroup.length > 0) {
					result.push(currentGroup)
					currentGroup = []
				}
			} else {
				currentGroup.push(item)
			}
		})
		if (currentGroup.length > 0) {
			result.push(currentGroup)
		}
		return result
	}, [options])

	// 如果没有 groups，不渲染
	if (groups.length === 0) {
		return null
	}

	return (
		<div ref={setRefs} className={styles.elementTools} data-canvas-ui-component>
			{groups.map((group, groupIndex) => (
				<Fragment key={groupIndex}>
					<div className={styles.group}>
						{group.map((item) => (
							<ElementToolItem key={item.type} type={item.type} />
						))}
					</div>
					{groupIndex < groups.length - 1 && (
						<div key={`divider-${groupIndex}`} className={styles.divider} />
					)}
				</Fragment>
			))}
		</div>
	)
}
