import { appendBodyScript } from "./appendBodyScript"

/** Preview-only bridge: iframe touch events cannot bubble across origins. */
export function injectPPTSwipeBridge(content: string, parentOrigin: string): string {
	const origin = JSON.stringify(parentOrigin).replace(/</g, "\\u003c")
	const script = `<script data-injected="true">
(function () {
	// Same-origin previews already use direct document listeners.
	try { if (window.parent.document) return; } catch (_) {}
	if (window.__magicPptSwipeCleanup) window.__magicPptSwipeCleanup();
	var start = null;
	function onStart(event) {
		start = event.touches.length === 1
			? { x: event.touches[0].clientX, y: event.touches[0].clientY }
			: null;
	}
	function onCancel() { start = null; }
	function onEnd(event) {
		var first = start;
		start = null;
		var last = event.changedTouches[0];
		if (!first || !last) return;
		var dx = last.clientX - first.x;
		var dy = last.clientY - first.y;
		if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
		window.parent.postMessage({ type: 'ppt-slide-swipe', direction: dx < 0 ? 'next' : 'prev' }, ${origin});
	}
	document.addEventListener('touchstart', onStart, { passive: true, capture: true });
	document.addEventListener('touchend', onEnd, { passive: true, capture: true });
	document.addEventListener('touchcancel', onCancel, { passive: true, capture: true });
	window.__magicPptSwipeCleanup = function () {
		document.removeEventListener('touchstart', onStart, true);
		document.removeEventListener('touchend', onEnd, true);
		document.removeEventListener('touchcancel', onCancel, true);
	};
})();
</script>`
	return appendBodyScript(content, script)
}
