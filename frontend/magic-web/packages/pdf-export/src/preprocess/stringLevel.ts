const INTERSECTION_OBSERVER_PATCH = `
<script data-pdf-export-intersection-observer-patch>
(function () {
	if (typeof window === "undefined") return;
	var OriginalIntersectionObserver = window.IntersectionObserver;
	if (!OriginalIntersectionObserver) return;
	window.IntersectionObserver = function (callback, options) {
		var targets = [];
		return {
			observe: function (target) {
				targets.push(target);
				setTimeout(function () {
					callback([{ target: target, isIntersecting: true, intersectionRatio: 1 }], this);
				}.bind(this), 0);
			},
			unobserve: function (target) {
				targets = targets.filter(function (item) { return item !== target; });
			},
			disconnect: function () {
				targets = [];
			},
			takeRecords: function () {
				return [];
			}
		};
	};
	window.IntersectionObserver.prototype = OriginalIntersectionObserver.prototype;
})();
</script>`

export function preprocessString(html: string): string {
	const eagerHtml = html.replace(/\sloading=(["'])lazy\1/gi, " loading=\"eager\"")
	const resolvedLazySrcHtml = eagerHtml.replace(
		/<img\b[^>]*\sdata-src=(["'])([^"']+)\1[^>]*>/gi,
		(full, quote: string, value: string) => {
			if (/\ssrc\s*=/i.test(full)) return full
			return full.replace(/^<img\b/i, `<img src=${quote}${value}${quote}`)
		},
	)

	return injectObserverPatch(resolvedLazySrcHtml)
}

function injectObserverPatch(html: string): string {
	if (html.includes("data-pdf-export-intersection-observer-patch")) return html
	if (/<head\b[^>]*>/i.test(html)) {
		return html.replace(/<head\b([^>]*)>/i, `<head$1>${INTERSECTION_OBSERVER_PATCH}`)
	}
	return `${INTERSECTION_OBSERVER_PATCH}${html}`
}
