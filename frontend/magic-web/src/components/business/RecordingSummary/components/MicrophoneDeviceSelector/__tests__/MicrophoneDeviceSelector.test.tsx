/**
 * UI tests for MicrophoneDeviceSelector component.
 *
 * We test the public behaviour that is observable through the DOM:
 *  - shows the "system default" label when value is ""
 *  - shows a custom device label when a deviceId is selected
 *  - disables the trigger button when disabled=true
 *  - calls onChange with "" when the user picks "System Default"
 *  - calls onChange with a deviceId string when the user picks a device
 *
 * We keep tests fast and isolated by mocking:
 *  - react-i18next (returns the key as label)
 *  - navigator.mediaDevices.enumerateDevices (returns controlled device list)
 *  - MagicDropdown (renders children directly so we can test dropdown content)
 *  - shadcn-ui dropdown primitives (thin wrappers)
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import MicrophoneDeviceSelector from "../index"

// ── i18n mock ─────────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (opts?.label) return `Microphone switched to ${opts.label}`
			// Return last segment as readable label
			return key.split(".").at(-1) ?? key
		},
	}),
}))

// ── MagicDropdown mock ────────────────────────────────────────────────────────
// Render popupRender content always visible so we can test dropdown items.
vi.mock("@/components/base/MagicDropdown", () => ({
	default: ({
		children,
		popupRender,
		onOpenChange,
		disabled,
	}: {
		children: React.ReactNode
		popupRender?: () => React.ReactNode
		onOpenChange?: (open: boolean) => void
		disabled?: boolean
	}) => (
		<div>
			<div onClick={() => !disabled && onOpenChange?.(true)}>{children}</div>
			{popupRender?.()}
		</div>
	),
}))

// ── shadcn-ui dropdown mocks ──────────────────────────────────────────────────
vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="label">{children}</div>
	),
	DropdownMenuSeparator: () => <hr />,
	DropdownMenuRadioGroup: ({
		children,
		onValueChange,
	}: {
		children: React.ReactNode
		onValueChange?: (v: string) => void
		value?: string
	}) => (
		<div
			onClick={(e) =>
				(e.target as HTMLElement).dataset.value &&
				onValueChange?.((e.target as HTMLElement).dataset.value!)
			}
		>
			{children}
		</div>
	),
	DropdownMenuRadioItem: ({
		children,
		value,
		disabled,
		className,
	}: {
		children: React.ReactNode
		value?: string
		disabled?: boolean
		className?: string
	}) => (
		<button role="option" data-value={value} disabled={disabled} className={className}>
			{children}
		</button>
	),
}))

// ── Devices used in tests ──────────────────────────────────────────────────────
const FAKE_DEVICES: MediaDeviceInfo[] = [
	{ deviceId: "default", groupId: "g1", kind: "audioinput", label: "Default", toJSON: vi.fn() },
	{
		deviceId: "built-in",
		groupId: "g2",
		kind: "audioinput",
		label: "MacBook Pro Microphone",
		toJSON: vi.fn(),
	},
	{
		deviceId: "headset",
		groupId: "g3",
		kind: "audioinput",
		label: "AirPods Pro",
		toJSON: vi.fn(),
	},
]

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
	vi.clearAllMocks()
	Object.defineProperty(navigator, "mediaDevices", {
		value: {
			enumerateDevices: vi.fn().mockResolvedValue(FAKE_DEVICES),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		},
		configurable: true,
	})
})

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("MicrophoneDeviceSelector", () => {
	it("shows the system-default label when value is empty string", async () => {
		render(<MicrophoneDeviceSelector value="" onChange={vi.fn()} data-testid="mic-selector" />)
		// The trigger button should show the default label
		await waitFor(() => {
			expect(screen.getByRole("button")).toBeInTheDocument()
		})
		// 'deviceDefault' key → last segment is 'deviceDefault'
		expect(screen.getByRole("button").textContent).toContain("deviceDefault")
	})

	it("shows the label of the selected device", async () => {
		render(<MicrophoneDeviceSelector value="headset" onChange={vi.fn()} />)
		await waitFor(() => {
			expect(screen.getByRole("button").textContent).toContain("AirPods Pro")
		})
	})

	it("trigger button is disabled when disabled=true", () => {
		render(<MicrophoneDeviceSelector value="" onChange={vi.fn()} disabled />)
		expect(screen.getByRole("button")).toBeDisabled()
	})

	it("renders device entries in the dropdown list after load", async () => {
		render(<MicrophoneDeviceSelector value="" onChange={vi.fn()} />)
		// Wait for async enumerateDevices
		await waitFor(() => {
			expect(screen.getByText("MacBook Pro Microphone")).toBeInTheDocument()
			expect(screen.getByText("AirPods Pro")).toBeInTheDocument()
		})
	})

	it("calls onChange with '' when System Default entry is clicked", async () => {
		const onChange = vi.fn()
		render(<MicrophoneDeviceSelector value="headset" onChange={onChange} />)
		await waitFor(() => screen.getByText("deviceDefault"))

		const defaultOption = screen
			.getAllByRole("option")
			.find((el) => el.getAttribute("data-value") === "__default")
		expect(defaultOption).toBeDefined()
		fireEvent.click(defaultOption!)
		expect(onChange).toHaveBeenCalledWith("", expect.any(String))
	})

	it("calls onChange with deviceId when a specific device is clicked", async () => {
		const onChange = vi.fn()
		render(<MicrophoneDeviceSelector value="" onChange={onChange} />)
		await waitFor(() => screen.getByText("AirPods Pro"))

		const headsetOption = screen
			.getAllByRole("option")
			.find((el) => el.getAttribute("data-value") === "headset")
		expect(headsetOption).toBeDefined()
		fireEvent.click(headsetOption!)
		expect(onChange).toHaveBeenCalledWith("headset", "AirPods Pro")
	})

	it("shows permission error when enumerateDevices returns empty list", async () => {
		;(navigator.mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([])
		render(<MicrophoneDeviceSelector value="" onChange={vi.fn()} />)
		await waitFor(() => {
			expect(screen.getByText(/devicePermissionDenied/)).toBeInTheDocument()
		})
	})

	it("shows permission error when enumerateDevices rejects", async () => {
		;(navigator.mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("NotAllowedError"),
		)
		render(<MicrophoneDeviceSelector value="" onChange={vi.fn()} />)
		await waitFor(() => {
			expect(screen.getByText(/devicePermissionDenied/)).toBeInTheDocument()
		})
	})

	it("applies data-testid to the trigger button", () => {
		render(
			<MicrophoneDeviceSelector value="" onChange={vi.fn()} data-testid="custom-test-id" />,
		)
		expect(screen.getByTestId("custom-test-id")).toBeInTheDocument()
	})
})
