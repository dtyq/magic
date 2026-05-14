import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"

import MagicPopup from "../index"
import { resetOverlayStackForTest } from "@/utils/overlayZIndex/overlayStackManager"

describe("MagicPopup z-index", () => {
	beforeEach(() => {
		resetOverlayStackForTest()
	})

	test("两个 MagicPopup 依次打开时，后打开的 content 层级更高", async () => {
		render(
			<>
				<MagicPopup visible title="first">
					<div data-testid="first-popup">first</div>
				</MagicPopup>
				<MagicPopup visible title="second">
					<div data-testid="second-popup">second</div>
				</MagicPopup>
			</>,
		)

		await waitFor(() => {
			expect(getDrawerContentByText("first-popup").style.zIndex).toBe("1011")
			expect(getDrawerContentByText("second-popup").style.zIndex).toBe("1021")
		})
	})

	test("显式 zIndex 会抬高后续 MagicPopup", async () => {
		render(
			<>
				<MagicPopup visible title="elevated" zIndex={1300}>
					<div data-testid="elevated-popup">elevated</div>
				</MagicPopup>
				<MagicPopup visible title="after elevated">
					<div data-testid="after-elevated-popup">after</div>
				</MagicPopup>
			</>,
		)

		await waitFor(() => {
			expect(getDrawerContentByText("elevated-popup").style.zIndex).toBe("1301")
			expect(getDrawerContentByText("after-elevated-popup").style.zIndex).toBe("1311")
		})
	})

	test("zIndexManaged=false 不影响后续 MagicPopup 分配", async () => {
		render(
			<>
				<MagicPopup visible title="manual" zIndex={1300} zIndexManaged={false}>
					<div data-testid="manual-popup">manual</div>
				</MagicPopup>
				<MagicPopup visible title="managed">
					<div data-testid="managed-popup">managed</div>
				</MagicPopup>
			</>,
		)

		await waitFor(() => {
			expect(getDrawerContentByText("manual-popup").style.zIndex).toBe("1301")
			expect(getDrawerContentByText("managed-popup").style.zIndex).toBe("1011")
		})
	})

	test("overlay 和 content 均使用分配结果，且 content 高于 overlay", async () => {
		render(
			<MagicPopup visible title="single">
				<div data-testid="single-popup">single</div>
			</MagicPopup>,
		)

		await waitFor(() => {
			const overlay = document.querySelector('[data-slot="drawer-overlay"]') as HTMLElement
			const content = getDrawerContentByText("single-popup")

			expect(overlay.style.zIndex).toBe("1010")
			expect(content.style.zIndex).toBe("1011")
		})
	})

	test("关闭未完成退场动画时，新打开的 MagicPopup 继续占用更高层级", async () => {
		const { rerender } = render(
			<MagicPopup visible destroyOnClose={false} title="first">
				<div data-testid="first-popup">first</div>
			</MagicPopup>,
		)

		await waitFor(() => {
			expect(getDrawerContentByText("first-popup").style.zIndex).toBe("1011")
		})

		rerender(
			<>
				<MagicPopup visible={false} destroyOnClose={false} title="first">
					<div data-testid="first-popup">first</div>
				</MagicPopup>
				<MagicPopup visible destroyOnClose={false} title="second">
					<div data-testid="second-popup">second</div>
				</MagicPopup>
			</>,
		)

		await waitFor(() => {
			expect(getDrawerContentByText("second-popup").style.zIndex).toBe("1021")
		})

		fireEvent.animationEnd(getDrawerContentByText("first-popup"))

		rerender(
			<>
				<MagicPopup visible={false} destroyOnClose={false} title="first">
					<div data-testid="first-popup">first</div>
				</MagicPopup>
				<MagicPopup visible={false} destroyOnClose={false} title="second">
					<div data-testid="second-popup">second</div>
				</MagicPopup>
			</>,
		)

		fireEvent.animationEnd(getDrawerContentByText("second-popup"))

		rerender(
			<MagicPopup visible title="third">
				<div data-testid="third-popup">third</div>
			</MagicPopup>,
		)

		await waitFor(() => {
			expect(getDrawerContentByText("third-popup").style.zIndex).toBe("1011")
		})
	})
})

/** 通过子内容反查所属 DrawerContent，避免测试依赖 Portal 的渲染顺序。 */
function getDrawerContentByText(testId: string) {
	const inner = screen.getByTestId(testId)
	const content = inner.closest('[data-slot="drawer-content"]')
	if (!(content instanceof HTMLElement)) throw new Error(`Missing drawer content for ${testId}`)

	return content
}
