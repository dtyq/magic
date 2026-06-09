/**
 * DragDropManager
 * Handles drag-over position detection and image insertion in the iframe.
 * Communicates with the parent via postMessage to show a drop position indicator
 * and insert images at the determined location.
 */

import type { CommandHistory } from "../core/CommandHistory"
import type { CommandRecord } from "../core/types"
import type { ElementSelector } from "../features/ElementSelector"
import { EditorLogger } from "../utils/EditorLogger"
import { getElementSelector } from "../utils/dom"

interface InsertedImageState {
    /** Selector of the parent element */
    parentSelector: string
    /** Selector of the inserted img element */
    imgSelector: string
    /** The outerHTML of the inserted img */
    html: string
    /** Index position among siblings */
    siblingIndex: number
}

const DRAG_DROP_COMMAND_TYPE = "DROP_INSERT_IMAGE"

export class DragDropManager {
    private commandHistory: CommandHistory
    private elementSelector: ElementSelector | null = null
    private indicatorElement: HTMLElement | null = null
    private currentInsertionPoint: {
        referenceElement: Element
        position: "before" | "after"
        axis: InsertionAxis
    } | null = null

    constructor(commandHistory: CommandHistory, elementSelector?: ElementSelector) {
        this.commandHistory = commandHistory
        this.elementSelector = elementSelector ?? null
    }

    /**
     * Handle drag-over event: determine the insertion point from coordinates
     * and show an indicator line in the iframe.
     */
    handleDragOver(
        x: number,
        y: number,
    ): { valid: boolean; indicatorRect?: { top: number; left: number; width: number } } {
        const element = document.elementFromPoint(x, y)
        if (!element || element === document.documentElement || element === document.body) {
            // If hovering over empty space, use body's last child as reference
            const lastChild = document.body.lastElementChild
            if (lastChild && lastChild !== this.indicatorElement) {
                this.currentInsertionPoint = {
                    referenceElement: lastChild,
                    position: "after",
                    axis: getInsertionAxis(lastChild),
                }
                return this.showIndicator()
            }
            this.hideIndicator()
            return { valid: false }
        }

        // Skip if hovering on the indicator itself
        if (element === this.indicatorElement) {
            return this.currentInsertionPoint
                ? { valid: true, indicatorRect: this.getIndicatorRect() }
                : { valid: false }
        }

        // Find the best block-level ancestor to insert beside
        const target = this.findInsertionTarget(element, y)
        if (!target) {
            this.hideIndicator()
            return { valid: false }
        }

        // Determine whether to insert before or after based on the layout axis.
        const rect = target.getBoundingClientRect()
        const axis = getInsertionAxis(target)
        const midpoint =
            axis === "horizontal" ? rect.left + rect.width / 2 : rect.top + rect.height / 2
        const pointerPosition = axis === "horizontal" ? x : y
        const position: "before" | "after" = pointerPosition < midpoint ? "before" : "after"

        this.currentInsertionPoint = { referenceElement: target, position, axis }
        return this.showIndicator()
    }

    /**
     * Hide the indicator and clear insertion point state.
     */
    handleDragLeave(): void {
        this.hideIndicator()
        this.currentInsertionPoint = null
    }

    /**
     * Insert an image at the current insertion point.
     */
    insertImage(relativePath: string, previewUrl?: string, x?: number, y?: number): boolean {
        // If coordinates are provided and no current insertion point, recalculate
        if (x !== undefined && y !== undefined && !this.currentInsertionPoint) {
            this.handleDragOver(x, y)
        }

        if (!this.currentInsertionPoint) {
            EditorLogger.warn("DragDropManager: No insertion point available")
            return false
        }

        const { referenceElement, position, axis } = this.currentInsertionPoint

        // Create the img element
        const img = document.createElement("img")
        img.setAttribute("src", previewUrl || relativePath)
        img.setAttribute("data-original-path", relativePath)
        img.setAttribute("alt", "")
        img.style.maxWidth = "100%"
        img.style.height = "auto"
        img.style.display = axis === "horizontal" ? "inline-block" : "block"

        // Insert at the determined position
        const parent = referenceElement.parentElement || document.body
        if (position === "before") {
            parent.insertBefore(img, referenceElement)
        } else {
            parent.insertBefore(img, referenceElement.nextSibling)
        }

        // Record for undo
        const imgSelector = getElementSelector(img)
        const parentSelector = getElementSelector(parent)
        const siblingIndex = Array.from(parent.children).indexOf(img)

        const commandState: InsertedImageState = {
            parentSelector,
            imgSelector,
            html: img.outerHTML,
            siblingIndex,
        }

        this.commandHistory.push({
            commandType: DRAG_DROP_COMMAND_TYPE,
            payload: commandState,
            previousState: null,
            timestamp: Date.now(),
            metadata: {
                canUndo: true,
                description: "Insert image via drag & drop",
            },
        })

        // Clean up
        this.hideIndicator()
        this.currentInsertionPoint = null

        EditorLogger.info("DragDropManager: Image inserted", { relativePath, imgSelector })
        return true
    }

    /**
     * Check if this manager can handle the given command type (for undo/redo).
     */
    canHandleCommand(commandType: string): boolean {
        return commandType === DRAG_DROP_COMMAND_TYPE
    }

    /**
     * Undo: remove the inserted image.
     */
    restoreCommand(command: CommandRecord): boolean {
        const state = command.payload as InsertedImageState
        try {
            const img = document.querySelector(state.imgSelector)
            if (img) {
                img.remove()
                this.elementSelector?.clearSelection()
                return true
            }
            return false
        } catch (error) {
            EditorLogger.warn("DragDropManager: Failed to undo image insertion", error)
            return false
        }
    }

    /**
     * Redo: re-insert the image.
     */
    applyCommand(command: CommandRecord): boolean {
        const state = command.payload as InsertedImageState
        try {
            const parent = document.querySelector(state.parentSelector)
            if (!parent) return false

            const template = document.createElement("template")
            template.innerHTML = state.html
            const img = template.content.firstElementChild
            if (!img) return false

            const children = Array.from(parent.children)
            if (state.siblingIndex >= children.length) {
                parent.appendChild(img)
            } else {
                parent.insertBefore(img, children[state.siblingIndex])
            }
            return true
        } catch (error) {
            EditorLogger.warn("DragDropManager: Failed to redo image insertion", error)
            return false
        }
    }

    /**
     * Destroy: clean up indicator element.
     */
    destroy(): void {
        this.hideIndicator()
        this.currentInsertionPoint = null
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    /**
     * Find the block-level element to use as insertion reference.
     * Walk up from the target until we find a direct child of body or a block element.
     */
    private findInsertionTarget(element: Element, y: number): Element | null {
        let current: Element | null = element

        // Walk up until we find a meaningful block-level element
        while (current && current !== document.body && current !== document.documentElement) {
            // If this element's parent is body, this is a good insertion target
            if (current.parentElement === document.body) {
                if (this.isOversizedBodyContainer(current)) {
                    return this.findChildTargetByY(current, y) ?? current
                }
                return current
            }

            // If this is a block-level element with a reasonable parent
            const display = window.getComputedStyle(current).display
            if (
                display === "block" ||
                display === "flex" ||
                display === "grid" ||
                display === "list-item"
            ) {
                // Check if parent is also a reasonable container
                const parentDisplay = current.parentElement
                    ? window.getComputedStyle(current.parentElement).display
                    : ""
                if (
                    parentDisplay === "block" ||
                    parentDisplay === "flex" ||
                    parentDisplay === "grid" ||
                    current.parentElement === document.body
                ) {
                    return current
                }
            }

            current = current.parentElement
        }

        // Fallback: use body's last child
        return this.findChildTargetByY(document.body, y) ?? document.body.lastElementChild
    }

    private isOversizedBodyContainer(element: Element): boolean {
        if (element.children.length === 0) return false
        const rect = element.getBoundingClientRect()
        return rect.height > window.innerHeight * 1.2
    }

    private findChildTargetByY(container: Element, y: number): Element | null {
        const children = Array.from(container.children).filter((child) => {
            if (child === this.indicatorElement) return false
            const rect = child.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
        })
        if (children.length === 0) return null

        const containingChild = children.find((child) => {
            const rect = child.getBoundingClientRect()
            return y >= rect.top && y <= rect.bottom
        })
        if (containingChild) {
            if (this.isOversizedBodyContainer(containingChild)) {
                return this.findChildTargetByY(containingChild, y) ?? containingChild
            }
            return containingChild
        }

        return children.reduce<Element | null>((closest, child) => {
            if (!closest) return child
            const childDistance = getVerticalDistanceToElement(child, y)
            const closestDistance = getVerticalDistanceToElement(closest, y)
            return childDistance < closestDistance ? child : closest
        }, null)
    }

    /**
     * Show the insertion indicator at the current insertion point.
     */
    private showIndicator(): {
        valid: boolean
        indicatorRect?: { top: number; left: number; width: number }
    } {
        if (!this.currentInsertionPoint) {
            return { valid: false }
        }

        const { referenceElement, position, axis } = this.currentInsertionPoint
        const rect = referenceElement.getBoundingClientRect()

        // Calculate indicator position
        const indicatorRect =
            axis === "horizontal"
                ? {
                    top: rect.top,
                    left: position === "before" ? rect.left : rect.right,
                    width: 2,
                    height: rect.height,
                }
                : {
                    top: position === "before" ? rect.top : rect.bottom,
                    left: rect.left,
                    width: rect.width,
                    height: 2,
                }

        // Create or update indicator element
        if (!this.indicatorElement) {
            this.indicatorElement = document.createElement("div")
            this.indicatorElement.setAttribute("data-drag-indicator", "true")
            this.indicatorElement.style.cssText = `
				position: fixed;
				background-color: #1677ff;
				pointer-events: none;
				z-index: 999999;
				transition: background-color 0.1s ease, box-shadow 0.1s ease;
				box-shadow: 0 0 4px rgba(22, 119, 255, 0.4);
			`
            document.body.appendChild(this.indicatorElement)
        }

        this.indicatorElement.style.top = `${indicatorRect.top}px`
        this.indicatorElement.style.left = `${indicatorRect.left}px`
        this.indicatorElement.style.width = `${indicatorRect.width}px`
        this.indicatorElement.style.height = `${indicatorRect.height}px`
        this.indicatorElement.style.display = "block"

        return {
            valid: true,
            indicatorRect: {
                top: indicatorRect.top + window.scrollY,
                left: indicatorRect.left + window.scrollX,
                width: indicatorRect.width,
            },
        }
    }

    /**
     * Get the current indicator rect (if visible).
     */
    private getIndicatorRect(): { top: number; left: number; width: number } | undefined {
        if (!this.indicatorElement || this.indicatorElement.style.display === "none") {
            return undefined
        }
        return {
            top: parseFloat(this.indicatorElement.style.top) + window.scrollY,
            left: parseFloat(this.indicatorElement.style.left) + window.scrollX,
            width: parseFloat(this.indicatorElement.style.width),
        }
    }

    /**
     * Hide the indicator element.
     */
    private hideIndicator(): void {
        if (this.indicatorElement) {
            this.indicatorElement.style.display = "none"
        }
    }
}

function getVerticalDistanceToElement(element: Element, y: number): number {
    const rect = element.getBoundingClientRect()
    if (y < rect.top) return rect.top - y
    if (y > rect.bottom) return y - rect.bottom
    return 0
}

type InsertionAxis = "vertical" | "horizontal"

function getInsertionAxis(element: Element): InsertionAxis {
    const parent = element.parentElement
    if (!parent) return "vertical"

    const parentStyle = window.getComputedStyle(parent)
    const display = parentStyle.display
    if (display === "flex" || display === "inline-flex") {
        return parentStyle.flexDirection.startsWith("column") ? "vertical" : "horizontal"
    }

    if (display === "grid" || display === "inline-grid") {
        return hasSameRowSibling(element) ? "horizontal" : "vertical"
    }

    return hasSameRowSibling(element) ? "horizontal" : "vertical"
}

function hasSameRowSibling(element: Element): boolean {
    const parent = element.parentElement
    if (!parent) return false

    const targetRect = element.getBoundingClientRect()
    return Array.from(parent.children).some((sibling) => {
        if (sibling === element) return false
        const rect = sibling.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return false
        return rangesOverlap(targetRect.top, targetRect.bottom, rect.top, rect.bottom)
    })
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return Math.max(startA, startB) < Math.min(endA, endB)
}
