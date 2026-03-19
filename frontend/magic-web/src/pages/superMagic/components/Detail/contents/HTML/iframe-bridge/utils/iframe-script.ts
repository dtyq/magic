/**
 * Import the built iframe runtime script
 * This file imports the compiled IIFE bundle from iframe-runtime
 */
// eslint-disable-next-line import/extensions
import iframeRuntimeScript from "../../iframe-runtime/dist/iframe-runtime.js?raw"

/**
 * Get the iframe runtime script
 * @returns IIFE format script string
 */
export function getIframeRuntimeScript(): string {
	return iframeRuntimeScript
}
