import { appendBodyScript } from "./appendBodyScript"

const HOLD_MESSAGE = "ppt-slide-animation-hold"
const RELEASE_MESSAGE = "ppt-slide-animation-release"
const HELD_MESSAGE = "ppt-slide-animation-held"
const HOLD_ACK_TIMEOUT_MS = 250

type PptAnimationPrepareStatus = "ready" | "unsupported"

interface PptAnimationHeldMessage {
	type: typeof HELD_MESSAGE
	requestId?: string
	status?: PptAnimationPrepareStatus
	documentKey?: string
	invalidated?: boolean
}

/**
 * Preview-only bridge that freezes a slide's running animations at their first frame.
 * A recreated slide starts animating while it is still covered by the previous page; freezing it
 * before the swap and releasing it afterwards makes the entrance play exactly once, in view.
 */
export function injectPPTAnimationHoldBridge(content: string, parentOrigin: string): string {
	const origin = JSON.stringify(parentOrigin).replace(/</g, "\\u003c")
	const script = `<script data-injected="true">
(function () {
	if (window.__magicPptHoldCleanup) window.__magicPptHoldCleanup();
	var held = [];
	var svgs = [];
	var safetyTimer = 0;
	var preparedDocumentKey = null;
	var preparedRequestId = null;
	var observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(invalidatePreparation);
	if (observer) observer.observe(document.documentElement, { attributes: true, childList: true, characterData: true, subtree: true });
	function invalidatePreparation() {
		if (preparedDocumentKey === null) return;
		var documentKey = preparedDocumentKey;
		var requestId = preparedRequestId;
		release();
		window.parent.postMessage({ type: '${HELD_MESSAGE}', status: 'unsupported', invalidated: true, documentKey: documentKey, requestId: requestId }, ${origin});
	}
	function release() {
		preparedDocumentKey = null;
		preparedRequestId = null;
		window.clearTimeout(safetyTimer);
		held.forEach(function (animation) { try { animation.play(); } catch (_) {} });
		svgs.forEach(function (svg) { try { svg.unpauseAnimations(); } catch (_) {} });
		held = [];
		svgs = [];
	}
	function animationNames(value) {
		// CSS 名称允许引号、逗号和转义；按 CSS 序列化结果分词，不能直接 split(',')。
		var tokens = [];
		var token = '';
		var quote = '';
		var escaped = false;
		for (var index = 0; index < value.length; index++) {
			var character = value[index];
			if (escaped) { token += character; escaped = false; continue; }
			if (character === '\\\\') { token += character; escaped = true; continue; }
			if (quote) {
				token += character;
				if (character === quote) quote = '';
			} else if (character === '"' || character === "'") {
				quote = character;
				token += character;
			} else if (character === ',') {
				tokens.push(token);
				token = '';
			} else token += character;
		}
		tokens.push(token);
		return tokens.map(function (token) {
			var name = token.trim();
			if (name === 'none') return null;
			if (name[0] === '"' || name[0] === "'") name = name.slice(1, -1);
			return name.replace(/\\\\([0-9a-f]{1,6}\\s?|.)/gi, function (_, escape) {
				return /^[0-9a-f]/i.test(escape) ? String.fromCodePoint(parseInt(escape, 16)) : escape;
			});
		});
	}
	function collectAnimationTargets() {
		var targets = new Map();
		[].slice.call(document.querySelectorAll('*')).forEach(function (element) {
			['', '::before', '::after'].forEach(function (pseudo) {
				var style = window.getComputedStyle(element, pseudo || null);
				if (pseudo && (style.content === 'none' || style.content === 'normal')) return;
				var names = animationNames(style.animationName);
				var states = style.animationPlayState.split(',');
				var expected = [];
				names.forEach(function (name, index) {
					if (name !== null) expected.push({ name: name, paused: states[index % states.length].trim() === 'paused', matched: false });
				});
				if (!expected.length) return;
				if (!targets.has(element)) targets.set(element, new Map());
				targets.get(element).set(pseudo, { element: element, pseudo: pseudo, names: style.animationName, expected: expected });
			});
		});
		return targets;
	}
	function prepare() {
		var pauseSheet = null;
		var wasDisabled = false;
		var resetStyle = null;
		try {
			if (!observer || !document.getAnimations || !document.timeline || typeof CSSAnimation === 'undefined' || typeof CSSTransition === 'undefined') return false;
			var pauseStyle = document.getElementById('magic-animation-pause');
			pauseSheet = pauseStyle && pauseStyle.sheet;
			if (pauseSheet) { wasDisabled = pauseSheet.disabled; pauseSheet.disabled = true; }
			// 包括已结束且无 fill 的动画；只读当前 DOM，不读取跨域 stylesheet.cssRules。
			var targets = collectAnimationTargets();
			resetStyle = document.createElement('style');
			resetStyle.textContent = '*,*::before,*::after{animation:none!important}';
			document.documentElement.appendChild(resetStyle);
			void document.documentElement.offsetWidth;
			targets.forEach(function (pseudos) {
				pseudos.forEach(function (target) {
					if (window.getComputedStyle(target.element, target.pseudo || null).animationName !== 'none') throw new Error('Animation reset blocked');
				});
			});
			resetStyle.remove();
			resetStyle = null;
			void document.documentElement.offsetWidth;
			targets.forEach(function (pseudos) {
				pseudos.forEach(function (target) {
					if (window.getComputedStyle(target.element, target.pseudo || null).animationName !== target.names) throw new Error('Animation targets changed');
				});
			});
			document.getAnimations().forEach(function (animation) {
				if (animation instanceof CSSTransition) return;
				if (!(animation instanceof CSSAnimation) || animation.timeline !== document.timeline) throw new Error('Unsupported animation timeline');
				var effect = animation.effect;
				if (!effect || !('pseudoElement' in effect)) throw new Error('Animation target unavailable');
				var pseudos = targets.get(effect.target);
				var target = pseudos && pseudos.get(effect.pseudoElement || '');
				var expected = target && target.expected.find(function (item) { return !item.matched && item.name === animation.animationName; });
				if (!expected) throw new Error('Unexpected animation target');
				expected.matched = true;
				// 作者暂停的动画也归零，但 release 不能将其强行播放。
				var authoredPaused = expected.paused || animation.playState === 'paused';
				if (!authoredPaused) held.push(animation);
				animation.pause();
				animation.currentTime = 0;
				if (animation.currentTime !== 0) throw new Error('Animation did not rewind');
			});
			targets.forEach(function (pseudos) {
				pseudos.forEach(function (target) {
					if (target.expected.some(function (item) { return !item.matched; })) throw new Error('Animation not restored');
				});
			});
			[].slice.call(document.querySelectorAll('svg')).forEach(function (svg) {
				if (typeof svg.pauseAnimations !== 'function' || typeof svg.setCurrentTime !== 'function' || typeof svg.getCurrentTime !== 'function' || typeof svg.animationsPaused !== 'function') throw new Error('SVG animation API unavailable');
				if (!svg.animationsPaused()) svgs.push(svg);
				svg.pauseAnimations();
				svg.setCurrentTime(0);
				if (!svg.animationsPaused() || svg.getCurrentTime() !== 0) throw new Error('SVG did not rewind');
			});
			return true;
		} catch (_) {
			release();
			return false;
		} finally {
			if (resetStyle) resetStyle.remove();
			if (pauseSheet) pauseSheet.disabled = wasDisabled;
			// 本次同步准备的 reset 插入／删除不代表作者内容变化。
			if (observer) observer.takeRecords();
		}
	}
	function hold(options) {
		if (options && options.refreshHold) {
			window.clearTimeout(safetyTimer);
			safetyTimer = window.setTimeout(release, 5000);
			return;
		}
		release();
		if (options && options.rewindCSS) {
			// The resident frame is covered. Restart CSS (including finished no-fill animations)
			// without recreating its document, then freeze the new timelines before the next paint.
			var ready = prepare();
			if (ready) {
				preparedDocumentKey = options.documentKey;
				preparedRequestId = options.requestId;
				safetyTimer = window.setTimeout(release, 5000);
			}
			window.parent.postMessage({ type: '${HELD_MESSAGE}', requestId: options.requestId, status: ready ? 'ready' : 'unsupported' }, ${origin});
			return;
		}
		var animations = document.getAnimations ? document.getAnimations() : [];
		animations.forEach(function (animation) {
			if (animation.timeline !== document.timeline) return;
			if (typeof CSSTransition !== 'undefined' && animation instanceof CSSTransition) return;
			if (animation.playState === 'paused') return;
			try {
				animation.pause();
				animation.currentTime = 0;
				held.push(animation);
			} catch (_) {}
		});
		[].slice.call(document.querySelectorAll('svg')).forEach(function (svg) {
			if (typeof svg.pauseAnimations !== 'function') return;
			try {
				svg.pauseAnimations();
				svg.setCurrentTime(0);
				svgs.push(svg);
			} catch (_) {}
		});
		// Never leave a slide frozen if the host disappears before releasing it.
		safetyTimer = window.setTimeout(release, 5000);
		var response = { type: '${HELD_MESSAGE}' };
		if (options && options.requestId) response.requestId = options.requestId;
		window.parent.postMessage(response, ${origin});
	}
	function onMessage(event) {
		if (event.source !== window.parent || !event.data) return;
		if (event.data.type === '${HOLD_MESSAGE}') hold(event.data);
		else if (event.data.type === '${RELEASE_MESSAGE}') release();
	}
	window.addEventListener('message', onMessage);
	// 外部样式晚到以及 Tailwind／DOM 样式更新，使这份文档的准备结果失效。
	document.addEventListener('load', invalidatePreparation, true);
	window.__magicPptHoldCleanup = function () {
		window.removeEventListener('message', onMessage);
		document.removeEventListener('load', invalidatePreparation, true);
		if (observer) observer.disconnect();
		release();
	};
})();
</script>`
	return appendBodyScript(content, script)
}

/** Freeze the slide at its first frame. Resolves once acknowledged, or after a short timeout. */
export function holdIframeAnimations(iframe: HTMLIFrameElement | null): Promise<void> {
	const target = iframe?.contentWindow
	if (!target) return Promise.resolve()

	return new Promise((resolve) => {
		const finish = () => {
			window.clearTimeout(timer)
			window.removeEventListener("message", onMessage)
			resolve()
		}
		const onMessage = (event: MessageEvent<PptAnimationHeldMessage>) => {
			if (event.source === target && event.data?.type === HELD_MESSAGE) finish()
		}
		const timer = window.setTimeout(finish, HOLD_ACK_TIMEOUT_MS)
		window.addEventListener("message", onMessage)
		target.postMessage({ type: HOLD_MESSAGE }, "*")
	})
}

export function releaseIframeAnimations(iframe: HTMLIFrameElement | null): void {
	iframe?.contentWindow?.postMessage({ type: RELEASE_MESSAGE }, "*")
}

/** Keep a prepared entrance frozen through the upcoming transition without resetting or repainting. */
export function renewIframeAnimationHold(iframe: HTMLIFrameElement | null): void {
	iframe?.contentWindow?.postMessage({ type: HOLD_MESSAGE, refreshHold: true }, "*")
}

/** Reuse only a positively acknowledged frame; unsupported bridges fall back to document replay. */
export function prepareIframeAnimations(
	iframe: HTMLIFrameElement | null,
	documentKey: string,
	requestId: string,
): Promise<boolean> {
	const target = iframe?.contentWindow
	if (!target) return Promise.resolve(false)
	return new Promise((resolve) => {
		const finish = (ready: boolean) => {
			window.clearTimeout(timer)
			window.removeEventListener("message", onMessage)
			resolve(ready)
		}
		const onMessage = (event: MessageEvent<PptAnimationHeldMessage>) => {
			if (
				event.source === target &&
				event.data?.type === HELD_MESSAGE &&
				event.data.requestId === requestId
			)
				finish(event.data.status === "ready")
		}
		const timer = window.setTimeout(() => finish(false), HOLD_ACK_TIMEOUT_MS)
		window.addEventListener("message", onMessage)
		try {
			target.postMessage({ type: HOLD_MESSAGE, rewindCSS: true, requestId, documentKey }, "*")
		} catch {
			finish(false)
		}
	})
}

/** 后台文档内容／样式变化时撤销准备状态；源 iframe 与文档版本都必须一致。 */
export function observeIframeAnimationPreparation(
	iframe: HTMLIFrameElement | null,
	documentKey: string,
	onInvalidated: (requestId: string) => void,
): () => void {
	const target = iframe?.contentWindow
	const onMessage = (event: MessageEvent<PptAnimationHeldMessage>) => {
		if (
			target &&
			event.source === target &&
			event.data?.type === HELD_MESSAGE &&
			event.data.invalidated &&
			event.data.documentKey === documentKey &&
			event.data.requestId
		)
			onInvalidated(event.data.requestId)
	}
	window.addEventListener("message", onMessage)
	return () => window.removeEventListener("message", onMessage)
}
