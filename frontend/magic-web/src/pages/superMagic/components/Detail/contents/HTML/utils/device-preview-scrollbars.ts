const DEVICE_PREVIEW_SCROLLBARS_MESSAGE = "MAGIC_DEVICE_PREVIEW_SCROLLBARS"

interface DevicePreviewScrollbarsMessage {
	type: typeof DEVICE_PREVIEW_SCROLLBARS_MESSAGE
	enabled: boolean
}

export function syncDevicePreviewScrollbars(
	iframe: HTMLIFrameElement | null,
	targetOrigin: string,
	enabled: boolean,
): void {
	iframe?.contentWindow?.postMessage(
		{
			type: DEVICE_PREVIEW_SCROLLBARS_MESSAGE,
			enabled,
		} satisfies DevicePreviewScrollbarsMessage,
		targetOrigin,
	)
}

/** 只隐藏条身，不修改 overflow 或作者布局；切换模式不重写文档，保留表单和媒体状态。 */
export function getDevicePreviewScrollbarsScript(parentOrigin: string, enabled = false): string {
	return `
		(function() {
			var parentOrigin = ${JSON.stringify(parentOrigin)};
			var listenerKey = "__MAGIC_DEVICE_PREVIEW_SCROLLBARS_LISTENER__";
			var styleId = "magic-device-preview-scrollbars";
			var previousListener = window[listenerKey];
			if (typeof previousListener === "function") {
				window.removeEventListener("message", previousListener);
			}
			function apply(enabled) {
				var style = document.querySelector('style[data-injected="' + styleId + '"]');
				if (!enabled) {
					if (style) style.remove();
					return;
				}
				if (style) return;
				style = document.createElement("style");
				style.setAttribute("data-injected", styleId);
				style.textContent = ":root, :root * { scrollbar-width: none !important; }" +
					":root::-webkit-scrollbar, :root *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }";
				document.head.appendChild(style);
			}
			function handleMessage(event) {
				if (event.source !== window.parent || event.origin !== parentOrigin) return;
				if (!event.data || event.data.type !== ${JSON.stringify(DEVICE_PREVIEW_SCROLLBARS_MESSAGE)}) return;
				if (typeof event.data.enabled !== "boolean") return;
				apply(event.data.enabled);
			}
			window[listenerKey] = handleMessage;
			window.addEventListener("message", handleMessage);
			apply(${JSON.stringify(enabled)});
		})();
	`
}
