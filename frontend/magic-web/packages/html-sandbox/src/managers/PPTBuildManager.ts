import type { CommandHistory } from "../core/CommandHistory"
import type { CommandRecord } from "../core/types"
import { getEditorNodeSelector } from "../features/domTree"
import {
	collectPPTBuilds,
	isPPTBuildElement,
	normalizePPTBuild,
	readPPTBuild,
	writePPTBuild,
	type PPTBuild,
} from "../utils/pptBuild"
import { getInspectableTextContent } from "../utils/inspectableTextContent"
import { getElementSelector } from "../utils/dom"

export interface PPTBuildEntry {
	selector: string
	label: string
	build: PPTBuild
	/** Latest step among configured ancestors. Past this step the element cannot show earlier. */
	ancestorStep?: number
}

export interface PPTBuildUpdate {
	selector: string
	build: PPTBuild | null
}

interface BuildState {
	selector: string
	value: PPTBuild | null
}

function sameBuild(a: PPTBuild | null, b: PPTBuild | null): boolean {
	return (
		a === b ||
		(a !== null &&
			b !== null &&
			a.step === b.step &&
			a.effect === b.effect &&
			a.after === b.after)
	)
}

/** Authored build metadata shares the editor's undo stack, but no unrelated attributes. */
export class PPTBuildManager {
	constructor(
		private history: CommandHistory,
		private isEditMode: () => boolean,
	) {}

	getBuilds(): PPTBuildEntry[] {
		const collected = collectPPTBuilds(document)
		const byElement = new Map(collected.map(({ element, build }) => [element, build]))
		return collected
			.map(({ element, build }) => {
				let ancestorStep: number | undefined
				for (let node = element.parentElement; node; node = node.parentElement) {
					const parent = byElement.get(node)
					if (parent && (ancestorStep === undefined || parent.step > ancestorStep))
						ancestorStep = parent.step
				}
				return {
					// Match canvas selection payloads; history separately uses stable session IDs.
					selector: getElementSelector(element),
					label:
						element.getAttribute("aria-label")?.trim() ||
						element.getAttribute("alt")?.trim() ||
						getInspectableTextContent(element).slice(0, 80) ||
						element.id ||
						element.tagName.toLowerCase(),
					build,
					...(ancestorStep !== undefined ? { ancestorStep } : {}),
				}
			})
			.sort((a, b) => a.build.step - b.build.step)
	}

	updateBuilds(updates: PPTBuildUpdate[]): void {
		if (!this.isEditMode()) throw new Error("PPT_BUILD_EDIT_MODE_REQUIRED")
		if (!Array.isArray(updates)) throw new Error("PPT_BUILD_INVALID")
		const changes = new Map<HTMLElement, BuildState>()
		for (const update of updates) {
			if (!update || typeof update.selector !== "string") throw new Error("PPT_BUILD_INVALID")
			const element = this.resolve(update.selector)
			if (changes.has(element)) throw new Error("PPT_BUILD_DUPLICATE")
			const build = update.build === null ? null : normalizePPTBuild(update.build)
			if (update.build !== null && !build) throw new Error("PPT_BUILD_INVALID")
			changes.set(element, { selector: update.selector, value: build })
		}

		const previous: BuildState[] = []
		const next: BuildState[] = []
		for (const [element, change] of changes) {
			const value = readPPTBuild(element)
			if (sameBuild(value, change.value)) continue
			change.selector = getEditorNodeSelector(element)
			previous.push({ selector: change.selector, value })
			next.push(change)
		}
		if (!next.length) return
		this.apply(next)
		this.history.push({
			commandType: "UPDATE_PPT_BUILDS",
			payload: next,
			previousState: previous,
			timestamp: Date.now(),
			metadata: { canUndo: true, description: "Update presentation builds" },
		})
	}

	canHandleCommand(commandType: string): boolean {
		return commandType === "UPDATE_PPT_BUILDS"
	}

	restoreCommand(command: CommandRecord): boolean {
		if (!this.canHandleCommand(command.commandType)) return false
		this.apply(command.previousState as BuildState[])
		return true
	}

	applyCommand(command: CommandRecord): boolean {
		if (!this.canHandleCommand(command.commandType)) return false
		this.apply(command.payload as BuildState[])
		return true
	}

	private resolve(selector: string): HTMLElement {
		const elements = document.querySelectorAll(selector)
		if (elements.length !== 1 || !isPPTBuildElement(elements[0]))
			throw new Error("PPT_BUILD_INVALID")
		return elements[0] as HTMLElement
	}

	private apply(states: BuildState[]): void {
		// Resolve every target before writing; a missing target must not partially replay.
		const elements = states.map((state) => this.resolve(state.selector))
		states.forEach((state, index) => writePPTBuild(elements[index], state.value))
	}
}
