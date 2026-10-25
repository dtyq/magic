import { Fragment, useMemo, useCallback } from "react"
import styles from "./ElementToolTopSurface.module.css"
import TopToolRenderer from "../renderers/TopToolRenderer"
import TopCustomToolRenderer from "../renderers/TopCustomToolRenderer"
import type { ElementToolResolution } from "../../../runtime/element-tools"
import useElementPositionEffect from "../../../app/hooks/layout/useElementPositionEffect"
import { useFloatingComponent } from "../../../app/hooks/layout/useFloatingComponent"
import {
	PRESERVE_TEXT_EDITOR_FOCUS_ATTR,
	PreserveTextEditorFocusProvider,
} from "../../../runtime/shared/dom/preserveTextEditorFocus"
import { FloatingSurfaceScope } from "../../primitives/shadcn/popover"

interface ElementToolsRenderProps {
	tools: readonly ElementToolResolution[]
}

export default function ElementToolsRender(props: ElementToolsRenderProps) {
	const options = props.tools

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
		const result: ElementToolResolution[][] = []
		let currentGroup: ElementToolResolution[] = []
		options.forEach((item) => {
			if (item.presentation.group !== currentGroup[0]?.presentation.group) {
				if (currentGroup.length > 0) result.push(currentGroup)
				currentGroup = []
			}
			currentGroup.push(item)
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
		<FloatingSurfaceScope id="element-tools">
			<PreserveTextEditorFocusProvider value>
				<div
					ref={setRefs}
					className={styles.elementTools}
					data-canvas-ui-component
					{...{ [PRESERVE_TEXT_EDITOR_FOCUS_ATTR]: "" }}
				>
					{groups.map((group, groupIndex) => (
						<Fragment key={groupIndex}>
							<div className={styles.group}>
								{group.map((item) =>
									item.presentation.renderKind === "top-custom" ? (
										<TopCustomToolRenderer key={item.id} tool={item} />
									) : (
										<TopToolRenderer key={item.id} tool={item} />
									),
								)}
							</div>
							{groupIndex < groups.length - 1 && (
								<div key={`divider-${groupIndex}`} className={styles.divider} />
							)}
						</Fragment>
					))}
				</div>
			</PreserveTextEditorFocusProvider>
		</FloatingSurfaceScope>
	)
}
