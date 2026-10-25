import { createPortal } from "react-dom"
import { render, renderHook, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	DEFAULT_FILE_ACCESS,
	DEFAULT_FILE_ACTION_OPTIONS,
	useFileAccess,
	FileAccessProvider,
	type FileAccessState,
} from ".."

function Actions({ name }: { name: string }) {
	const { permissions: access } = useFileAccess()
	return (
		<div data-testid={name}>
			{Object.entries(access).map(([action, allowed]) =>
				allowed ? <button key={action}>{`${name}:${action}`}</button> : null,
			)}
		</div>
	)
}

describe("FileAccessProvider", () => {
	it("preserves standard actions without a scope", () => {
		render(<Actions name="standard" />)
		expect(screen.getAllByRole("button")).toHaveLength(5)
	})

	it.each(Object.keys(DEFAULT_FILE_ACCESS) as (keyof FileAccessState)[])(
		"restricts %s independently without disabling the other operations",
		(action) => {
			render(
				<FileAccessProvider permissions={{ [action]: false }}>
					<Actions name="file" />
				</FileAccessProvider>,
			)
			expect(screen.queryByRole("button", { name: `file:${action}` })).toBeNull()
			expect(screen.getAllByRole("button")).toHaveLength(4)
		},
	)

	it("updates every entry including portals when the owning scope changes", () => {
		const tree = (download: boolean) => (
			<FileAccessProvider permissions={{ download }}>
				<Actions name="list" />
				{createPortal(<Actions name="preview" />, document.body)}
			</FileAccessProvider>
		)
		const { rerender } = render(tree(false))
		expect(screen.queryByRole("button", { name: "list:download" })).toBeNull()
		expect(screen.queryByRole("button", { name: "preview:download" })).toBeNull()
		rerender(tree(true))
		expect(screen.getByRole("button", { name: "list:download" })).toBeTruthy()
		expect(screen.getByRole("button", { name: "preview:download" })).toBeTruthy()
	})

	it("inherits restrictions, prevents reopening them, and isolates sibling scopes", () => {
		render(
			<>
				<FileAccessProvider permissions={{ download: false }}>
					<FileAccessProvider permissions={{ download: true, share: false }}>
						<Actions name="restricted" />
					</FileAccessProvider>
					<FileAccessProvider>
						<Actions name="inherited" />
					</FileAccessProvider>
				</FileAccessProvider>
				<FileAccessProvider>
					<Actions name="other-project" />
				</FileAccessProvider>
			</>,
		)
		expect(screen.queryByRole("button", { name: "restricted:download" })).toBeNull()
		expect(screen.queryByRole("button", { name: "restricted:share" })).toBeNull()
		expect(screen.queryByRole("button", { name: "inherited:download" })).toBeNull()
		expect(screen.getByRole("button", { name: "inherited:share" })).toBeTruthy()
		expect(screen.getByRole("button", { name: "other-project:download" })).toBeTruthy()
	})
})

function Decisions() {
	const { permissions: access, options } = useFileAccess()
	return <output data-testid="decisions">{JSON.stringify({ options, access })}</output>
}
function readDecisions() {
	return JSON.parse(screen.getByTestId("decisions").textContent || "{}")
}
it("does not reopen sharing through nested permissions or read-only presentation", () => {
	render(
		<FileAccessProvider permissions={{ share: false }} options={{ fullscreen: false }}>
			<FileAccessProvider permissions={{ share: true }} options={{ shareInReadOnly: true }}>
				<Decisions />
			</FileAccessProvider>
		</FileAccessProvider>,
	)
	expect(readDecisions().access.share).toBe(false)
	expect(readDecisions().options).toMatchObject({ fullscreen: false, shareInReadOnly: true })
})
it("inherits presentation options but permits explicit local overrides", () => {
	render(
		<FileAccessProvider options={{ fullscreen: false, shareTopic: false }}>
			<FileAccessProvider options={{ fullscreen: true }}>
				<Decisions />
			</FileAccessProvider>
		</FileAccessProvider>,
	)
	expect(readDecisions().options).toMatchObject({ fullscreen: true, shareTopic: false })
})
it("provides complete defaults to page hooks without a provider", () => {
	render(<Decisions />)
	expect(readDecisions().access).toEqual(DEFAULT_FILE_ACCESS)
	expect(readDecisions().options).toEqual(DEFAULT_FILE_ACTION_OPTIONS)
})
vi.mock("@/pages/superMagic/providers/FileAccessProvider/hooks/useResolveFileAccess", () => ({
	useResolveFileAccess: () => ({}),
}))

it("exposes permissions and options through one stable public result without scope metadata", () => {
	const { result, rerender } = renderHook(useFileAccess)
	expect(result.current).toEqual({
		permissions: DEFAULT_FILE_ACCESS,
		options: DEFAULT_FILE_ACTION_OPTIONS,
	})
	expect(result.current).not.toHaveProperty("isScoped")
	const previous = result.current
	rerender()
	expect(result.current).toBe(previous)
})
