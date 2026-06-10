import type { CommandHistory } from "../core/CommandHistory"
import type { CommandRecord } from "../core/types"
import type { ElementSelector } from "../features/ElementSelector"
import {
	type ImageActionPayload,
	type ImageUploadRequestPayload,
	type ImageUploadResultPayload,
} from "../../../iframe-bridge/types/messages"
import { replaceBackgroundImageInStyleAttribute } from "../../../utils/background-style"
import { EditorLogger } from "../utils/EditorLogger"
import { findElement } from "../utils/ElementSelector"
import { getElementSelector } from "../utils/dom"
import { getParentOrigin } from "../utils/parentOrigin"

interface ReplaceElementImageState {
	selector: string
	src: string
	originalPath: string | null
	dataSrc: string | null
}

interface BackgroundImageState {
	selector: string
	styleAttribute: string
}

interface InsertFloatingImagePendingState {
	parentSelector: string
	nextSiblingSelector: string | null
	siblingIndex: number
}

interface InsertFloatingImageState extends InsertFloatingImagePendingState {
	selector: string
	html: string
}

const IMAGE_COMMAND_TYPES = new Set([
	"REPLACE_ELEMENT_IMAGE",
	"SET_ELEMENT_BACKGROUND_IMAGE",
	"REMOVE_ELEMENT_BACKGROUND_IMAGE",
	"INSERT_FLOATING_IMAGE",
])

type ImageCommandRecord = CommandRecord & {
	commandType:
		| "REPLACE_ELEMENT_IMAGE"
		| "SET_ELEMENT_BACKGROUND_IMAGE"
		| "REMOVE_ELEMENT_BACKGROUND_IMAGE"
		| "INSERT_FLOATING_IMAGE"
	payload?: ReplaceElementImageState | BackgroundImageState | InsertFloatingImageState
	previousState?:
		| ReplaceElementImageState
		| BackgroundImageState
		| InsertFloatingImagePendingState
}

interface PendingImageUploadContext {
	request: ImageUploadRequestPayload
	previousState: ReplaceElementImageState | BackgroundImageState | InsertFloatingImagePendingState
	resolve: () => void
	reject: (error: Error) => void
}

const DEFAULT_INSERTED_IMAGE_WIDTH = 240
const DEFAULT_INSERTED_IMAGE_OFFSET = 24

export class ImageManager {
	private commandHistory: CommandHistory
	private elementSelector: ElementSelector
	private pendingUploadRequests = new Map<string, PendingImageUploadContext>()

	constructor(commandHistory: CommandHistory, elementSelector: ElementSelector) {
		this.commandHistory = commandHistory
		this.elementSelector = elementSelector
	}

	async runImageAction(payload: ImageActionPayload): Promise<void> {
		if (payload.action === "replace-element-image") {
			await this.requestReplaceElementImage()
			return
		}

		if (payload.action === "set-element-background-image") {
			await this.requestSetElementBackgroundImage()
			return
		}

		if (payload.action === "remove-element-background-image") {
			this.removeElementBackgroundImage()
			return
		}

		if (payload.action === "insert-floating-image") {
			await this.requestInsertFloatingImage()
			return
		}

		throw new Error(`Unsupported image action: ${payload.action}`)
	}

	destroy(): void {
		for (const [, pendingRequest] of this.pendingUploadRequests) {
			pendingRequest.reject(new Error("Image upload request cancelled"))
		}

		this.pendingUploadRequests.clear()
	}

	handleUploadResult(payload: ImageUploadResultPayload): void {
		const pendingRequest = this.pendingUploadRequests.get(payload.requestId)
		if (!pendingRequest) {
			EditorLogger.warn("No pending image upload request found", payload)
			return
		}

		this.pendingUploadRequests.delete(payload.requestId)

		if (
			payload.action !== pendingRequest.request.action ||
			payload.selector !== pendingRequest.request.selector
		) {
			pendingRequest.reject(new Error("Image upload result does not match pending request"))
			return
		}

		if (payload.cancelled) {
			pendingRequest.resolve()
			return
		}

		if (!payload.success) {
			pendingRequest.reject(new Error(payload.error || "Image upload failed"))
			return
		}

		if (!payload.previewUrl || !payload.relativeFilePath) {
			pendingRequest.reject(new Error("Image upload result is missing preview data"))
			return
		}

		try {
			if (payload.action === "replace-element-image") {
				this.applyReplaceElementImageResult(pendingRequest, payload)
				pendingRequest.resolve()
				return
			}

			if (payload.action === "set-element-background-image") {
				this.applySetBackgroundImageResult(pendingRequest, payload)
				pendingRequest.resolve()
				return
			}

			if (payload.action === "insert-floating-image") {
				this.applyInsertFloatingImageResult(pendingRequest, payload)
				pendingRequest.resolve()
				return
			}

			pendingRequest.reject(new Error(`Unsupported upload result action: ${payload.action}`))
		} catch (error) {
			pendingRequest.reject(
				error instanceof Error ? error : new Error("Failed to apply image upload result"),
			)
		}
	}

	canHandleCommand(commandType: string): boolean {
		return IMAGE_COMMAND_TYPES.has(commandType)
	}

	restoreCommand(command: CommandRecord): boolean {
		const imageCommand = command as ImageCommandRecord
		if (!this.canHandleCommand(imageCommand.commandType)) {
			return false
		}

		if (imageCommand.commandType === "REPLACE_ELEMENT_IMAGE") {
			if (!imageCommand.previousState) return false
			const previousState = imageCommand.previousState as ReplaceElementImageState
			const element = findElement(previousState.selector)
			if (!(element instanceof HTMLImageElement)) {
				throw new Error("Target element is not an image")
			}

			this.applyImageState(element, previousState)
			this.refreshSelectionWhenImageSettled(element)
			return true
		}

		if (
			imageCommand.commandType === "SET_ELEMENT_BACKGROUND_IMAGE" ||
			imageCommand.commandType === "REMOVE_ELEMENT_BACKGROUND_IMAGE"
		) {
			if (!imageCommand.previousState) return false
			const previousState = imageCommand.previousState as BackgroundImageState
			const element = findElement(previousState.selector)
			this.applyStyleAttribute(element, previousState.styleAttribute)
			return true
		}

		if (imageCommand.commandType === "INSERT_FLOATING_IMAGE") {
			const payload = imageCommand.payload as InsertFloatingImageState | undefined
			if (!payload) return false

			const element = findElement(payload.selector)
			element.remove()
			this.elementSelector.clearSelection()
			return true
		}

		return false
	}

	async applyCommand(command: CommandRecord): Promise<boolean> {
		const imageCommand = command as ImageCommandRecord
		if (!this.canHandleCommand(imageCommand.commandType) || !imageCommand.payload) {
			return false
		}

		if (imageCommand.commandType === "REPLACE_ELEMENT_IMAGE") {
			const payload = imageCommand.payload as ReplaceElementImageState
			const element = findElement(payload.selector)
			if (!(element instanceof HTMLImageElement)) {
				throw new Error("Target element is not an image")
			}

			this.applyImageState(element, payload)
			this.refreshSelectionWhenImageSettled(element)
			return true
		}

		if (
			imageCommand.commandType === "SET_ELEMENT_BACKGROUND_IMAGE" ||
			imageCommand.commandType === "REMOVE_ELEMENT_BACKGROUND_IMAGE"
		) {
			const payload = imageCommand.payload as BackgroundImageState
			const element = findElement(payload.selector)
			this.applyStyleAttribute(element, payload.styleAttribute)
			return true
		}

		if (imageCommand.commandType === "INSERT_FLOATING_IMAGE") {
			const payload = imageCommand.payload as InsertFloatingImageState
			const restoredElement = this.restoreInsertedFloatingImage(payload)
			payload.selector = getElementSelector(restoredElement)
			payload.html = restoredElement.outerHTML
			this.elementSelector.selectElement(restoredElement)
			this.refreshSelectionWhenImageSettled(restoredElement)
			return true
		}

		return false
	}

	private async requestReplaceElementImage(): Promise<void> {
		const { selector, element } = this.getSingleSelectedElement("img")
		if (!(element instanceof HTMLImageElement))
			throw new Error("Selected element is not an image")

		const previousState = this.captureImageState(element, selector)
		const request: ImageUploadRequestPayload = {
			requestId: this.generateRequestId(),
			action: "replace-element-image",
			selector,
			suggestedPath: this.buildSuggestedPath(),
		}

		await this.requestImageUpload(request, previousState)
	}

	private async requestSetElementBackgroundImage(): Promise<void> {
		const { selector, element } = this.getSingleSelectedElement("non-img")
		const previousState: BackgroundImageState = {
			selector,
			styleAttribute: element.getAttribute("style") || "",
		}
		const request: ImageUploadRequestPayload = {
			requestId: this.generateRequestId(),
			action: "set-element-background-image",
			selector,
			suggestedPath: this.buildSuggestedPath(),
		}

		await this.requestImageUpload(request, previousState)
	}

	private async requestInsertFloatingImage(): Promise<void> {
		const previousState: InsertFloatingImagePendingState = {
			parentSelector: "body",
			nextSiblingSelector: null,
			siblingIndex: document.body.children.length,
		}
		const request: ImageUploadRequestPayload = {
			requestId: this.generateRequestId(),
			action: "insert-floating-image",
			selector: previousState.parentSelector,
			suggestedPath: this.buildSuggestedPath(),
		}

		await this.requestImageUpload(request, previousState)
	}

	private removeElementBackgroundImage(): void {
		const { selector, element } = this.getSingleSelectedElement("non-img")
		const previousState: BackgroundImageState = {
			selector,
			styleAttribute: element.getAttribute("style") || "",
		}
		const nextStyleAttribute = replaceBackgroundImageInStyleAttribute({
			styleAttribute: previousState.styleAttribute,
			nextBackgroundImage: "none",
		})
		const payload: BackgroundImageState = {
			selector,
			styleAttribute: nextStyleAttribute,
		}

		this.applyStyleAttribute(element, nextStyleAttribute)
		this.commandHistory.push({
			commandType: "REMOVE_ELEMENT_BACKGROUND_IMAGE",
			payload,
			previousState,
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: "Remove background image",
			},
		})
		this.elementSelector.refreshSelection()
	}

	private getSingleSelectedElement(mode: "img" | "non-img"): {
		selector: string
		element: HTMLElement
	} {
		const selectors = this.elementSelector.getSelectedSelectors()
		if (selectors.length !== 1) {
			throw new Error("Image action requires exactly one selected element")
		}

		const selector = selectors[0]
		const element = findElement(selector)
		const isImageElement = element.tagName.toLowerCase() === "img"

		if (mode === "img" && !isImageElement) {
			throw new Error("Selected element is not an image")
		}

		if (mode === "non-img" && isImageElement) {
			throw new Error("Background image actions do not support <img> elements")
		}

		return { selector, element }
	}

	private captureImageState(
		element: HTMLImageElement,
		selector: string,
	): ReplaceElementImageState {
		return {
			selector,
			src: element.getAttribute("src") || "",
			originalPath: element.getAttribute("data-original-path"),
			dataSrc: element.getAttribute("data-src"),
		}
	}

	private applyImageState(element: HTMLImageElement, state: ReplaceElementImageState): void {
		if (state.src) {
			element.setAttribute("src", state.src)
		} else {
			element.removeAttribute("src")
		}

		if (state.originalPath) {
			element.setAttribute("data-original-path", state.originalPath)
		} else {
			element.removeAttribute("data-original-path")
		}

		if (state.dataSrc) {
			element.setAttribute("data-src", state.dataSrc)
		} else {
			element.removeAttribute("data-src")
		}
	}

	private applyStyleAttribute(element: HTMLElement, styleAttribute: string): void {
		if (!styleAttribute.trim()) {
			element.removeAttribute("style")
			return
		}

		element.setAttribute("style", styleAttribute)
	}

	private createBackgroundImageValue(relativePath: string, previewUrl: string): string {
		return `/*__ORIGINAL_URL__:${relativePath}__*/url('${previewUrl}')`
	}

	private createFloatingImageElement(uploadResult: ImageUploadResultPayload): HTMLImageElement {
		const element = document.createElement("img")
		element.setAttribute("src", uploadResult.previewUrl || "")
		element.setAttribute("data-original-path", uploadResult.relativeFilePath || "")
		element.setAttribute("alt", "")
		element.style.position = "absolute"
		element.style.top = `${DEFAULT_INSERTED_IMAGE_OFFSET}px`
		element.style.left = `${DEFAULT_INSERTED_IMAGE_OFFSET}px`
		element.style.width = `${DEFAULT_INSERTED_IMAGE_WIDTH}px`
		element.style.height = "auto"
		element.style.maxWidth = `calc(100% - ${DEFAULT_INSERTED_IMAGE_OFFSET * 2}px)`
		element.style.display = "block"
		element.style.zIndex = "1"
		return element
	}

	private buildSuggestedPath(): string {
		return "./images"
	}

	private generateRequestId(): string {
		return `image_upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
	}

	private async requestImageUpload(
		request: ImageUploadRequestPayload,
		previousState:
			| ReplaceElementImageState
			| BackgroundImageState
			| InsertFloatingImagePendingState,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.pendingUploadRequests.set(request.requestId, {
				request,
				previousState,
				resolve,
				reject,
			})

			try {
				window.parent.postMessage(
					{
						type: "REQUEST_IMAGE_UPLOAD",
						data: request,
					},
					getParentOrigin(),
				)
			} catch (error) {
				this.pendingUploadRequests.delete(request.requestId)
				reject(error instanceof Error ? error : new Error("Failed to request image upload"))
			}
		})
	}

	private applyReplaceElementImageResult(
		pendingRequest: PendingImageUploadContext,
		uploadResult: ImageUploadResultPayload,
	): void {
		const previousState = pendingRequest.previousState as ReplaceElementImageState
		const element = findElement(previousState.selector)
		if (!(element instanceof HTMLImageElement))
			throw new Error("Target element is not an image")

		const payload: ReplaceElementImageState = {
			selector: previousState.selector,
			src: uploadResult.previewUrl || "",
			originalPath: uploadResult.relativeFilePath || null,
			dataSrc: null,
		}

		this.applyImageState(element, payload)
		this.commandHistory.push({
			commandType: "REPLACE_ELEMENT_IMAGE",
			payload,
			previousState,
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: "Replace image",
			},
		})
		this.elementSelector.refreshSelection()
		this.refreshSelectionWhenImageSettled(element)
	}

	private refreshSelectionWhenImageSettled(element: HTMLImageElement): void {
		if (!this.elementSelector.isSelected(element)) return

		let isHandled = false

		const cleanup = () => {
			element.removeEventListener("load", handleSettled)
			element.removeEventListener("error", handleSettled)
		}

		const handleSettled = () => {
			if (isHandled) return
			isHandled = true
			cleanup()

			window.requestAnimationFrame(() => {
				if (!this.elementSelector.isSelected(element)) return
				this.elementSelector.refreshSelection()
			})
		}

		element.addEventListener("load", handleSettled)
		element.addEventListener("error", handleSettled)

		if (!element.complete) return

		if (typeof element.decode === "function") {
			element
				.decode()
				.catch(() => undefined)
				.finally(handleSettled)
			return
		}

		handleSettled()
	}

	private restoreInsertedFloatingImage(payload: InsertFloatingImageState): HTMLImageElement {
		const parent = findElement(payload.parentSelector)
		const tempDiv = document.createElement("div")
		tempDiv.innerHTML = payload.html
		const restoredElement = tempDiv.firstElementChild

		if (!(restoredElement instanceof HTMLImageElement))
			throw new Error("Failed to restore floating image element")

		let isInserted = false
		if (payload.siblingIndex >= 0) {
			const currentChildren = Array.from(parent.children)
			if (payload.siblingIndex < currentChildren.length) {
				parent.insertBefore(restoredElement, currentChildren[payload.siblingIndex])
				isInserted = true
			} else if (payload.siblingIndex === currentChildren.length) {
				parent.appendChild(restoredElement)
				isInserted = true
			}
		}

		if (!isInserted && payload.nextSiblingSelector) {
			try {
				const nextSibling = findElement(payload.nextSiblingSelector)
				parent.insertBefore(restoredElement, nextSibling)
				isInserted = true
			} catch (error) {
				EditorLogger.warn("Failed to restore floating image before next sibling", error)
			}
		}

		if (!isInserted) parent.appendChild(restoredElement)

		return restoredElement
	}

	private applyInsertFloatingImageResult(
		pendingRequest: PendingImageUploadContext,
		uploadResult: ImageUploadResultPayload,
	): void {
		const previousState = pendingRequest.previousState as InsertFloatingImagePendingState
		const element = this.createFloatingImageElement(uploadResult)
		const parent = findElement(previousState.parentSelector)

		parent.appendChild(element)
		const siblingIndex = Array.from(parent.children).indexOf(element)
		const nextSibling = element.nextElementSibling

		const payload: InsertFloatingImageState = {
			selector: getElementSelector(element),
			parentSelector: previousState.parentSelector,
			nextSiblingSelector:
				nextSibling instanceof HTMLElement ? getElementSelector(nextSibling) : null,
			siblingIndex,
			html: element.outerHTML,
		}

		this.commandHistory.push({
			commandType: "INSERT_FLOATING_IMAGE",
			payload,
			previousState,
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: "Insert floating image",
			},
		})
		this.elementSelector.selectElement(element)
		this.refreshSelectionWhenImageSettled(element)
	}

	private applySetBackgroundImageResult(
		pendingRequest: PendingImageUploadContext,
		uploadResult: ImageUploadResultPayload,
	): void {
		const previousState = pendingRequest.previousState as BackgroundImageState
		const element = findElement(previousState.selector)
		const nextStyleAttribute = replaceBackgroundImageInStyleAttribute({
			styleAttribute: previousState.styleAttribute,
			nextBackgroundImage: this.createBackgroundImageValue(
				uploadResult.relativeFilePath || "",
				uploadResult.previewUrl || "",
			),
		})
		const payload: BackgroundImageState = {
			selector: previousState.selector,
			styleAttribute: nextStyleAttribute,
		}

		this.applyStyleAttribute(element, nextStyleAttribute)
		this.commandHistory.push({
			commandType: "SET_ELEMENT_BACKGROUND_IMAGE",
			payload,
			previousState,
			timestamp: Date.now(),
			metadata: {
				canUndo: true,
				description: "Set background image",
			},
		})
		this.elementSelector.refreshSelection()
	}
}
