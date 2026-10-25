import { fireEvent, render, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ShareType } from "../../types"
import ShareTypeField from "../ShareTypeField"
import type { ShareTypeFieldProps } from "../types"

const mocks = vi.hoisted(() => ({
	isPaidPlan: true,
	isPersonalOrganization: false,
	openPaidPackageModal: vi.fn(),
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			get organizationSubscriptionInfo() {
				return { is_paid_plan: mocks.isPaidPlan }
			},
			get isPersonalOrganization() {
				return mocks.isPersonalOrganization
			},
		},
	},
}))

/**
 * `ShareTypeField` 在本仓库里是分层覆盖文件：企业版覆盖层带着付费弹窗接入，
 * `src` 版本没有。这份替身让两个版本都能被同一组断言覆盖。
 */
vi.mock("@enterprise/components/business/PaidPackage", () => ({
	PaidPackageModal: { Subscription: "subscription", Bonus: "bonus" },
	openPaidPackageModal: mocks.openPaidPackageModal,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/pages/superMagic/components/VipIcon", () => ({
	default: () => <span data-testid="mock-vip-icon" />,
}))

/**
 * 只替代勾选框这一片叶子：本例关心的是「付费计划禁用」与「管理员禁用」落在哪个分支，
 * 不是 Radix 内部实现。
 */
vi.mock("@/components/shadcn-ui/checkbox", () => ({
	Checkbox: ({
		checked,
		"data-testid": testId,
	}: {
		checked?: boolean
		"data-testid"?: string
	}) => <span data-testid={testId} data-checked={checked ? "true" : "false"} />,
}))

const ALL_TYPES = [ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]

function getRow(type: ShareType): HTMLElement {
	const row = document.querySelector(`[data-share-type="${type}"]`)
	if (!(row instanceof HTMLElement)) throw new Error(`share type row ${type} was not rendered`)
	return row
}

function renderField(props: Partial<ShareTypeFieldProps> = {}) {
	const onChange = props.onChange ?? vi.fn()
	const view = render(
		<ShareTypeField
			value={ShareType.Public}
			onChange={onChange}
			availableTypes={ALL_TYPES}
			{...props}
		/>,
	)
	return { ...view, onChange }
}

describe("ShareTypeField 付费计划门禁", () => {
	beforeEach(() => {
		mocks.isPaidPlan = true
		mocks.isPersonalOrganization = false
		mocks.openPaidPackageModal.mockClear()
	})

	it("付费计划下三种方式都可点击，管理员未返回权限时不误禁用", () => {
		renderField({ value: ShareType.PasswordProtected, permittedTypes: undefined })

		ALL_TYPES.forEach((type) => {
			expect(getRow(type)).toHaveAttribute("aria-disabled", "false")
		})
		expect(
			within(getRow(ShareType.PasswordProtected)).queryByTestId("mock-vip-icon"),
		).toBeNull()
		expect(
			within(getRow(ShareType.PasswordProtected)).getByTestId("share-type-field-checkbox"),
		).toHaveAttribute("data-checked", "true")
	})

	it("免费计划不渲染团队内分享整行", () => {
		mocks.isPaidPlan = false

		renderField({ permittedTypes: undefined })

		expect(document.querySelector(`[data-share-type="${ShareType.Organization}"]`)).toBeNull()
		expect(getRow(ShareType.Public)).toBeInTheDocument()
		expect(getRow(ShareType.PasswordProtected)).toBeInTheDocument()
	})

	it("免费计划的密码保护显示 VIP 标识，并且点击不会切换方式", () => {
		mocks.isPaidPlan = false
		const { onChange } = renderField({ value: ShareType.Public, permittedTypes: undefined })

		const passwordRow = getRow(ShareType.PasswordProtected)
		expect(passwordRow).toHaveAttribute("aria-disabled", "true")
		expect(within(passwordRow).getByTestId("mock-vip-icon")).toBeInTheDocument()
		expect(within(passwordRow).queryByTestId("share-type-field-checkbox")).toBeNull()

		fireEvent.click(passwordRow)

		// 对照组：同一份渲染里公开访问仍然点得动，证明上面的「没有回调」不是因为整体失活。
		fireEvent.click(getRow(ShareType.Public))

		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onChange).toHaveBeenCalledWith(ShareType.Public)
	})

	it("付费计划下密码保护可正常切换", () => {
		const { onChange } = renderField({ value: ShareType.Public, permittedTypes: undefined })

		fireEvent.click(getRow(ShareType.PasswordProtected))

		expect(onChange).toHaveBeenCalledWith(ShareType.PasswordProtected)
	})

	it("管理员关掉的方式显示勾选框而不是 VIP 标识", () => {
		renderField({
			value: ShareType.PasswordProtected,
			permittedTypes: [ShareType.Public],
			preserveCurrentType: true,
		})

		const passwordRow = getRow(ShareType.PasswordProtected)
		expect(passwordRow).toHaveAttribute("aria-disabled", "true")
		// 权限禁用不能复用 VIP 标识：升级套餐解不开管理员关掉的方式。
		expect(within(passwordRow).queryByTestId("mock-vip-icon")).toBeNull()
		expect(within(passwordRow).getByTestId("share-type-field-checkbox")).toBeInTheDocument()
	})

	it("同时被计划与权限禁用时点击同样不会切换方式", () => {
		mocks.isPaidPlan = false
		const { onChange } = renderField({
			value: ShareType.PasswordProtected,
			permittedTypes: [ShareType.Public],
			preserveCurrentType: true,
		})

		const passwordRow = getRow(ShareType.PasswordProtected)
		// 这一行两个门禁都命中，VIP 标识成立（计划确实禁用），但点击必须被拦住。
		expect(passwordRow).toHaveAttribute("aria-disabled", "true")
		expect(within(passwordRow).getByTestId("mock-vip-icon")).toBeInTheDocument()

		fireEvent.click(passwordRow)

		expect(onChange).not.toHaveBeenCalled()
	})
})
