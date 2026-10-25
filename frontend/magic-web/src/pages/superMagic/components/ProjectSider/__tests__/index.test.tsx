import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import ProjectSider from "../index"

/**
 * The project files area is what the new-user guide's tour of a delivered file points its second
 * step at — see `HomeOnboardingAnchor.ProjectSider`.
 *
 * That step needs the panel itself rather than a tab or a row inside it, because it is saying where
 * the result was filed and the user may be looking at the sidebar in any state. What this file
 * holds is the one part of that promise the component owns: the anchor is published on **both**
 * shapes the component can take. A sidebar holding a single item renders no tab strip at all, and
 * that shape used to carry no anchor either — which from the tour's side is a page with no project
 * files area at all, and a step that would end the run rather than be framed.
 */
function items(count: number, visible?: (index: number) => boolean) {
	return Array.from({ length: count }, (_, index) => ({
		key: `item-${index}`,
		title: `tab ${index}`,
		content: <div>content {index}</div>,
		visible: visible?.(index),
	}))
}

/** The anchor as the tour looks for it. */
function findAnchor(container: HTMLElement) {
	return container.querySelector(`[data-guide-anchor="${HomeOnboardingAnchor.ProjectSider}"]`)
}

describe("ProjectSider publishes the guide's anchor", () => {
	it("marks the panel when there are tabs to switch between", () => {
		const { container } = render(<ProjectSider items={items(3)} />)

		expect(findAnchor(container)).not.toBeNull()
	})

	it("marks it just the same when a single item leaves no tab strip to render", () => {
		// The audio-recording sidebar is the shape: one item, and the component's other branch.
		const { container } = render(<ProjectSider items={items(1)} />)

		expect(findAnchor(container)).not.toBeNull()
	})

	it("counts only the items the caller shows when deciding on a tab strip", () => {
		// Three items declared, one visible: the same single-item shape by a different route.
		const { container } = render(<ProjectSider items={items(3, (index) => index === 0)} />)

		expect(findAnchor(container)).not.toBeNull()
	})
})
