import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AddModelConnectivityTest from "../AddModelConnectivityTest"

const { testAiModelConnectivityMock, addModelStoreMock } = vi.hoisted(() => ({
	testAiModelConnectivityMock: vi.fn(),
	addModelStoreMock: {
		selectedProviderId: "provider-1",
		providerModelId: "vision-model",
		isSubmitting: false,
		modelForm: {
			modelConfig: {
				support_multi_modal: true,
			},
		},
	},
}))

vi.mock("@/apis", () => ({
	OrgAiModelProviderApi: {
		testAiModelConnectivity: testAiModelConnectivityMock,
	},
}))

vi.mock("../context", () => ({
	useAddModelStore: () => addModelStoreMock,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("AddModelConnectivityTest", () => {
	beforeEach(() => {
		testAiModelConnectivityMock.mockReset()
		testAiModelConnectivityMock.mockResolvedValue({ status: true, message: null })
	})

	it("should pass the current multimodal capability to the connectivity API", async () => {
		render(<AddModelConnectivityTest />)
		fireEvent.click(screen.getByTestId("add-model-connectivity-test-button"))

		await waitFor(() => {
			expect(testAiModelConnectivityMock).toHaveBeenCalledWith({
				service_provider_config_id: "provider-1",
				model_version: "vision-model",
				support_multi_modal: true,
			})
		})
	})
})
