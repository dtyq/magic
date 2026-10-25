import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { RouteName } from "@/routes/constants"
import {
	getMicroAppSharePageMocks,
	renderPage,
	resetMicroAppSharePageMocks,
} from "./MicroAppSharePage.testUtils"

const mocks = getMicroAppSharePageMocks()

describe("MicroAppSharePage 无权限返回", () => {
	beforeEach(resetMicroAppSharePageMocks)

	it("无查看权限时展示返回按钮，点击后回桌面首页 /super", async () => {
		mocks.resolvePublishedMicroApp.mockRejectedValue({ response: { status: 404 } })

		renderPage()

		expect(await screen.findByTestId("mock-error-display")).toBeInTheDocument()

		fireEvent.click(await screen.findByTestId("error-display-retry-button"))

		await waitFor(() => {
			// replace 而不是 push：错误页不该留在历史栈里，否则用户回退会再落回它上面。
			expect(mocks.historyReplace).toHaveBeenCalledWith({
				name: RouteName.Super,
				params: undefined,
				query: undefined,
				state: undefined,
			})
		})
	})

	it("移动端点击返回按钮回 /mobile-home", async () => {
		mocks.isMobile.current = true
		mocks.resolvePublishedMicroApp.mockRejectedValue({ response: { status: 404 } })

		renderPage()

		fireEvent.click(await screen.findByTestId("error-display-retry-button"))

		await waitFor(() => {
			expect(mocks.historyReplace).toHaveBeenCalledWith({
				name: RouteName.MobileHome,
				params: undefined,
				query: undefined,
				state: undefined,
			})
		})
	})

	it("链接带的密码错误时停留在密码校验，不会误进错误态", async () => {
		mocks.checkShareResourcePassword.mockResolvedValue({ has_password: true })
		mocks.getShareResource.mockRejectedValue({ code: 51306 })

		renderPage("/micro-app/app-1?password=wrong")

		expect(await screen.findByTestId("mock-password-verification")).toBeInTheDocument()
		expect(screen.queryByTestId("error-display-retry-button")).not.toBeInTheDocument()
	})
})
