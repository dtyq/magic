import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import PhoneShell from "../components/PhoneShell"

describe("PhoneShell", () => {
	it("renders the iPhone-style Wi-Fi icon", () => {
		render(
			<PhoneShell>
				<div>content</div>
			</PhoneShell>,
		)

		const wifiIcon = screen.getByTestId("self-media-phone-shell-wifi-icon")
		const paths = wifiIcon.querySelectorAll("path")

		expect(paths).toHaveLength(3)
		expect(paths[0]?.getAttribute("d")).toBe(
			"M8 11.25C8.69036 11.25 9.25 10.6904 9.25 10C9.25 9.30964 8.69036 8.75 8 8.75C7.30964 8.75 6.75 9.30964 6.75 10C6.75 10.6904 7.30964 11.25 8 11.25Z",
		)
		expect(paths[1]?.getAttribute("d")).toBe(
			"M11.0913 7.80176C9.3838 6.09428 6.6162 6.09428 4.90873 7.80176L3.84766 6.74069C6.1412 4.44715 9.8588 4.44715 12.1523 6.74069L11.0913 7.80176Z",
		)
		expect(paths[2]?.getAttribute("d")).toBe(
			"M13.9203 4.97227C10.6508 1.70281 5.34924 1.70281 2.07978 4.97227L1.01872 3.9112C4.87426 0.0556602 11.1257 0.0556602 14.9813 3.9112L13.9203 4.97227Z",
		)
	})
})
