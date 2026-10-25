import { useCallback, useEffect, useMemo, useRef } from "react"
import {
	decodeHTMLEntities,
	getFullContent,
} from "@/pages/superMagic/components/Detail/contents/HTML/utils/full-content"
import { rewriteHtmlWithMagicCdn } from "@/pages/superMagic/components/Detail/contents/HTML/utils"
import { HTML_CODE_BLOCK_PREVIEW_CONTAIN_IFRAME_OVERSCROLL } from "../constants"
import type { HtmlPreviewRendererProps } from "./HtmlPreviewRenderer"

const STREAMING_HTML_PREVIEW_SCROLL_STYLE = `
<style data-streaming-preview-scroll-lock="true">
	html, body {
		overflow-y: auto !important;
		overscroll-behavior-y: auto !important;
	}

	body {
		min-height: 100%;
	}
</style>`

const STREAMING_HTML_PREVIEW_RUNTIME = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Streaming HTML Preview</title>
  <script>
    function setupMessageListener() {
      window.addEventListener("message", handleMessage);
    }

    function sendErrorToParent(payload) {
      try {
        window.parent.postMessage({
          type: "iframeError",
          payload: payload
        }, "*");
      } catch (error) {
        console.error("Failed to send iframe error to parent:", error);
      }
    }

    function setupErrorHandler() {
      window.onerror = function(message, source, lineno, colno, error) {
        sendErrorToParent({
          errorType: "error",
          message: message,
          source: source || "",
          lineno: lineno,
          colno: colno,
          stack: error && error.stack ? error.stack : ""
        });
        return false;
      };

      window.addEventListener("unhandledrejection", function(event) {
        var reason = event.reason;
        var message = typeof reason === "string"
          ? reason
          : (reason && reason.message) || "Unknown promise rejection";
        var stack = reason && reason.stack ? reason.stack : "";

        sendErrorToParent({
          errorType: "unhandledrejection",
          message: message,
          stack: stack
        });
      });
    }

    function getPreviewState() {
      if (!window.__MAGIC_STREAMING_HTML_PREVIEW_STATE__) {
        window.__MAGIC_STREAMING_HTML_PREVIEW_STATE__ = {
          hasWrittenContentOnce: false,
          lastHeadHTML: "",
          bodyScriptSignatures: {},
          contentVersion: 0,
          settledTimeoutId: null,
          resizeObserver: null,
          contentMetricsFrameId: null,
          contentMetricsNestedFrameId: null,
          scrollRestoreFrameId: null,
          scrollRestoreNestedFrameId: null,
          isActive: true
        };
      }

      return window.__MAGIC_STREAMING_HTML_PREVIEW_STATE__;
    }

    function normalizeDocumentMarkup(markup) {
      return typeof markup === "string" ? markup : "";
    }

    function parseIncomingDocument(htmlContent) {
      try {
        return new DOMParser().parseFromString(htmlContent, "text/html");
      } catch (error) {
        console.error("解析流式预览 HTML 时出错:", error);
        return null;
      }
    }

    function copyElementAttributes(target, source) {
      if (!target || !source) {
        return;
      }

      Array.prototype.slice.call(target.attributes || []).forEach(function(attribute) {
        if (!source.hasAttribute(attribute.name)) {
          target.removeAttribute(attribute.name);
        }
      });

      Array.prototype.slice.call(source.attributes || []).forEach(function(attribute) {
        if (target.getAttribute(attribute.name) !== attribute.value) {
          target.setAttribute(attribute.name, attribute.value);
        }
      });
    }

    function createExecutableScriptElement(sourceScript) {
      var executableScript = document.createElement("script");

      Array.prototype.slice.call(sourceScript.attributes || []).forEach(function(attribute) {
        executableScript.setAttribute(attribute.name, attribute.value);
      });

      if (
        sourceScript.src &&
        !sourceScript.hasAttribute("async") &&
        !sourceScript.hasAttribute("defer")
      ) {
        executableScript.async = false;
      }

      if (sourceScript.textContent) {
        executableScript.text = sourceScript.textContent;
      }

      return executableScript;
    }

    function getScriptSignature(scriptElement) {
      if (!scriptElement) {
        return "";
      }

      return [
        scriptElement.getAttribute("src") || "",
        scriptElement.getAttribute("type") || "",
        scriptElement.getAttribute("nonce") || "",
        scriptElement.textContent || ""
      ].join("::");
    }

    function markScriptSignatureAsExecuted(scriptSignature) {
      if (!scriptSignature) {
        return;
      }

      getPreviewState().bodyScriptSignatures[scriptSignature] = true;
    }

    function markExecutedBodyScripts(rootElement) {
      if (!rootElement) {
        return;
      }

      Array.prototype.slice
        .call(rootElement.querySelectorAll("script"))
        .forEach(function(scriptElement) {
          markScriptSignatureAsExecuted(getScriptSignature(scriptElement));
        });
    }

    function reactivateNewScripts(rootElement) {
      if (!rootElement) {
        return;
      }

      var previewState = getPreviewState();

      Array.prototype.slice
        .call(rootElement.querySelectorAll("script"))
        .forEach(function(scriptElement) {
          if (!scriptElement.parentNode) {
            return;
          }

          var scriptSignature = getScriptSignature(scriptElement);
          if (previewState.bodyScriptSignatures[scriptSignature]) {
            return;
          }

          scriptElement.parentNode.replaceChild(
            createExecutableScriptElement(scriptElement),
            scriptElement
          );
          markScriptSignatureAsExecuted(scriptSignature);
        });
    }

    function getScrollableElement() {
      return document.scrollingElement || document.documentElement || document.body || null;
    }

    function captureScrollPosition() {
      var scrollingElement = getScrollableElement();
      var scrollTop = scrollingElement ? Number(scrollingElement.scrollTop || 0) : 0;
      var scrollLeft = scrollingElement ? Number(scrollingElement.scrollLeft || 0) : 0;

      return {
        top: Math.max(scrollTop, Number(window.scrollY || 0)),
        left: Math.max(scrollLeft, Number(window.scrollX || 0))
      };
    }

    function applyScrollPosition(scrollPosition) {
      if (!scrollPosition) {
        return;
      }

      var top = Math.max(0, Number(scrollPosition.top) || 0);
      var left = Math.max(0, Number(scrollPosition.left) || 0);
      var scrollingElement = getScrollableElement();

      if (scrollingElement) {
        scrollingElement.scrollTop = top;
        scrollingElement.scrollLeft = left;
      }

      if (document.documentElement) {
        document.documentElement.scrollTop = top;
        document.documentElement.scrollLeft = left;
      }

      if (document.body) {
        document.body.scrollTop = top;
        document.body.scrollLeft = left;
      }

      if (typeof window.scrollTo === "function") {
        window.scrollTo(left, top);
      }
    }

    function cancelScheduledScrollRestore() {
      var previewState = getPreviewState();

      if (previewState.scrollRestoreFrameId) {
        cancelAnimationFrame(previewState.scrollRestoreFrameId);
        previewState.scrollRestoreFrameId = null;
      }

      if (previewState.scrollRestoreNestedFrameId) {
        cancelAnimationFrame(previewState.scrollRestoreNestedFrameId);
        previewState.scrollRestoreNestedFrameId = null;
      }
    }

    function scheduleScrollRestore(scrollPosition) {
      if (!scrollPosition) {
        return;
      }

      var previewState = getPreviewState();
      cancelScheduledScrollRestore();

      previewState.scrollRestoreFrameId = requestAnimationFrame(function() {
        previewState.scrollRestoreFrameId = null;

        previewState.scrollRestoreNestedFrameId = requestAnimationFrame(function() {
          previewState.scrollRestoreNestedFrameId = null;
          applyScrollPosition(scrollPosition);
        });
      });
    }

    function measureElementMetric(element, metric) {
      if (!element || typeof element.getBoundingClientRect !== "function") {
        return 0;
      }

      var rect = element.getBoundingClientRect();
      var rectValue = metric === "width" ? rect.width : rect.height;
      var scrollKey = metric === "width" ? "scrollWidth" : "scrollHeight";
      var scrollValue = Number(element[scrollKey] || 0);

      return Math.max(rectValue || 0, scrollValue || 0);
    }

    function measureBodyChildrenMetric(metric) {
      var body = document.body;
      if (!body) {
        return 0;
      }

      var bodyChildren = Array.prototype.slice.call(body.children || []);
      return bodyChildren.reduce(function(maxMetric, element) {
        return Math.max(maxMetric, measureElementMetric(element, metric));
      }, 0);
    }

    function measureVerticalScrollbarWidth(hasVerticalOverflow) {
      if (!hasVerticalOverflow) {
        return 0;
      }

      var docEl = document.documentElement;
      var body = document.body;
      var viewportWidth = window.innerWidth || 0;
      var docClientWidth = docEl ? docEl.clientWidth : viewportWidth;
      var bodyClientWidth = body ? body.clientWidth : docClientWidth;
      var bodyOffsetWidth = body ? body.offsetWidth : bodyClientWidth;

      return Math.max(
        0,
        Math.round(
          Math.max(
            viewportWidth - docClientWidth,
            bodyOffsetWidth - bodyClientWidth
          )
        )
      );
    }

    function measureContentMetrics() {
      var docEl = document.documentElement;
      var body = document.body;
      var viewportWidth = docEl ? docEl.clientWidth : (window.innerWidth || 0);
      var viewportHeight = docEl ? docEl.clientHeight : (window.innerHeight || 0);
      var overflowWidth = Math.max(docEl ? docEl.scrollWidth : 0, body ? body.scrollWidth : 0);
      var overflowHeight = Math.max(docEl ? docEl.scrollHeight : 0, body ? body.scrollHeight : 0);
      var bodyMetricWidth = measureElementMetric(body, "width");
      var bodyMetricHeight = measureElementMetric(body, "height");
      var childContentWidth = measureBodyChildrenMetric("width");
      var childContentHeight = measureBodyChildrenMetric("height");
      var intrinsicContentWidth = Math.max(childContentWidth, bodyMetricWidth);
      var intrinsicContentHeight = Math.max(childContentHeight, bodyMetricHeight);
      var contentWidth = overflowWidth > viewportWidth
        ? overflowWidth
        : (intrinsicContentWidth || viewportWidth);
      var contentHeight = overflowHeight > viewportHeight
        ? overflowHeight
        : (intrinsicContentHeight || viewportHeight);
      var hasVerticalOverflow = overflowHeight > viewportHeight;

      return {
        contentWidth: Math.max(1, Math.ceil(contentWidth)),
        contentHeight: Math.max(1, Math.ceil(contentHeight)),
        hasHorizontalOverflow: overflowWidth > viewportWidth,
        hasVerticalOverflow: hasVerticalOverflow,
        verticalScrollbarWidth: measureVerticalScrollbarWidth(hasVerticalOverflow)
      };
    }

    function postContentMetrics(phase, contentVersion) {
      if (!getPreviewState().isActive) {
        return;
      }
      try {
        var metrics = measureContentMetrics();
        window.parent.postMessage({
          type: "contentMetrics",
          contentVersion: typeof contentVersion === "number"
            ? contentVersion
            : getPreviewState().contentVersion,
          phase: phase,
          contentWidth: metrics.contentWidth,
          contentHeight: metrics.contentHeight,
          hasHorizontalOverflow: metrics.hasHorizontalOverflow,
          hasVerticalOverflow: metrics.hasVerticalOverflow,
          verticalScrollbarWidth: metrics.verticalScrollbarWidth
        }, "*");
      } catch (error) {
        console.error("发送流式预览 contentMetrics 时出错:", error);
      }
    }

    function cancelScheduledContentMetrics() {
      var previewState = getPreviewState();

      if (previewState.contentMetricsFrameId) {
        cancelAnimationFrame(previewState.contentMetricsFrameId);
        previewState.contentMetricsFrameId = null;
      }

      if (previewState.contentMetricsNestedFrameId) {
        cancelAnimationFrame(previewState.contentMetricsNestedFrameId);
        previewState.contentMetricsNestedFrameId = null;
      }
    }

    function scheduleContentMetrics(phase, contentVersion) {
      var previewState = getPreviewState();
      var metricsVersion = typeof contentVersion === "number"
        ? contentVersion
        : previewState.contentVersion;
      cancelScheduledContentMetrics();

      previewState.contentMetricsFrameId = requestAnimationFrame(function() {
        previewState.contentMetricsFrameId = null;

        previewState.contentMetricsNestedFrameId = requestAnimationFrame(function() {
          previewState.contentMetricsNestedFrameId = null;
          postContentMetrics(phase, metricsVersion);
        });
      });
    }

    function clearSettledTimeout() {
      var previewState = getPreviewState();
      if (previewState.settledTimeoutId) {
        window.clearTimeout(previewState.settledTimeoutId);
        previewState.settledTimeoutId = null;
      }
    }

    function disconnectSettledObserver() {
      var previewState = getPreviewState();
      if (previewState.resizeObserver) {
        previewState.resizeObserver.disconnect();
        previewState.resizeObserver = null;
      }
    }

    function scheduleSettledSignals(version) {
      var previewState = getPreviewState();
      if (!previewState.isActive) {
        return;
      }
      clearSettledTimeout();
      previewState.settledTimeoutId = window.setTimeout(function() {
        if (getPreviewState().contentVersion !== version) {
          return;
        }

        previewState.settledTimeoutId = null;

        try {
          window.parent.postMessage({
            type: "pageFullyLoaded",
            contentVersion: version
          }, "*");
        } catch (error) {
          console.error("发送流式预览 fully-loaded 消息时出错:", error);
        }

        scheduleContentMetrics("settled", version);
      }, 160);
    }

    function ensureSettledObserver(version) {
      var previewState = getPreviewState();

      if (!previewState.isActive) {
        disconnectSettledObserver();
        clearSettledTimeout();
        return;
      }

      if (typeof ResizeObserver !== "function" || !document.documentElement || !document.body) {
        scheduleSettledSignals(version);
        return;
      }

      if (!previewState.resizeObserver) {
        previewState.resizeObserver = new ResizeObserver(function() {
          scheduleSettledSignals(getPreviewState().contentVersion);
        });
      } else {
        previewState.resizeObserver.disconnect();
      }

      previewState.resizeObserver.observe(document.documentElement);
      previewState.resizeObserver.observe(document.body);
      scheduleSettledSignals(version);
    }

    function waitForRenderComplete(contentVersion) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          window.parent.postMessage({
            type: "renderComplete",
            contentVersion: contentVersion
          }, "*");
        });
      });
    }

    function notifyContentReady() {
      var previewState = getPreviewState();

      try {
        window.parent.postMessage({
          type: "contentLoaded",
          contentVersion: previewState.contentVersion
        }, "*");
        window.parent.postMessage({ type: "domReady" }, "*");
      } catch (error) {
        console.error("发送流式预览 ready 消息时出错:", error);
      }

      waitForRenderComplete(previewState.contentVersion);
      scheduleContentMetrics("initial", previewState.contentVersion);
      ensureSettledObserver(previewState.contentVersion);
    }

    function setupDOMLoadListeners() {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function() {
          try {
            window.parent.postMessage({ type: "domReady" }, "*");
          } catch (error) {
            console.error("发送 DOM ready 消息时出错:", error);
          }
          waitForRenderComplete(getPreviewState().contentVersion);
        });
      } else {
        try {
          window.parent.postMessage({ type: "domReady" }, "*");
        } catch (error) {
          console.error("发送 DOM ready 消息时出错:", error);
        }
        waitForRenderComplete(getPreviewState().contentVersion);
      }

      if (document.readyState === "complete") {
        ensureSettledObserver(getPreviewState().contentVersion);
      } else {
        window.addEventListener("load", function() {
          ensureSettledObserver(getPreviewState().contentVersion);
        }, { once: true });
      }
    }

    function patchBodyContent(parsedDocument, scrollPosition) {
      if (
        !parsedDocument ||
        !parsedDocument.documentElement ||
        !parsedDocument.body ||
        !document.documentElement ||
        !document.body
      ) {
        return false;
      }

      copyElementAttributes(document.documentElement, parsedDocument.documentElement);
      copyElementAttributes(document.body, parsedDocument.body);

      var nextBodyHTML = normalizeDocumentMarkup(parsedDocument.body.innerHTML);
      if (normalizeDocumentMarkup(document.body.innerHTML) !== nextBodyHTML) {
        document.body.innerHTML = nextBodyHTML;
        reactivateNewScripts(document.body);
      }

      notifyContentReady();
      scheduleScrollRestore(scrollPosition);
      return true;
    }

    function handleMessage(event) {
      try {
        if (event.source !== window.parent) {
          return;
        }

        if (
          !event.data ||
          (event.data.type !== "setContent" && event.data.type !== "setActive")
        ) {
          return;
        }

        var previewState = getPreviewState();
        if (event.data.type === "setActive") {
          previewState.isActive = event.data.isActive !== false;
          if (!previewState.isActive) {
            cancelScheduledContentMetrics();
            clearSettledTimeout();
            disconnectSettledObserver();
            return;
          }

          if (previewState.hasWrittenContentOnce) {
            scheduleContentMetrics("initial", previewState.contentVersion);
            ensureSettledObserver(previewState.contentVersion);
          }
          return;
        }

        if (typeof event.data.content !== "string") {
          return;
        }
        var scrollPosition = previewState.hasWrittenContentOnce
          ? captureScrollPosition()
          : null;
        var incomingContentVersion = Number(event.data.contentVersion);
        previewState.contentVersion = Number.isInteger(incomingContentVersion)
          ? incomingContentVersion
          : previewState.contentVersion + 1;
        var parsedDocument = parseIncomingDocument(event.data.content);
        var nextHeadHTML =
          parsedDocument && parsedDocument.head
            ? normalizeDocumentMarkup(parsedDocument.head.innerHTML)
            : "";

        if (
          previewState.hasWrittenContentOnce &&
          parsedDocument &&
          nextHeadHTML === previewState.lastHeadHTML &&
          patchBodyContent(parsedDocument, scrollPosition)
        ) {
          return;
        }

        previewState.hasWrittenContentOnce = true;
        previewState.lastHeadHTML = nextHeadHTML;
        previewState.bodyScriptSignatures = {};
        clearSettledTimeout();
        disconnectSettledObserver();
        cancelScheduledContentMetrics();

        document.open();
        document.write(event.data.content);
        document.close();
        setupMessageListener();
        setupErrorHandler();
        setupDOMLoadListeners();
        markExecutedBodyScripts(document.body);
        scheduleScrollRestore(scrollPosition);
        window.parent.postMessage({
          type: "contentLoaded",
          contentVersion: previewState.contentVersion
        }, "*");
        scheduleContentMetrics("initial", previewState.contentVersion);
      } catch (error) {
        console.error("处理流式预览消息时出错:", error);
        var errorMessage = error && error.message ? String(error.message) : "Unknown streaming preview error";
        try {
          window.parent.postMessage({
            type: "streamingPreviewError",
            contentVersion: getPreviewState().contentVersion,
            message: errorMessage
          }, "*");
        } catch (postError) {
          console.error("发送流式预览错误消息时出错:", postError);
        }
      }
    }

    setupMessageListener();
    setupErrorHandler();

    window.addEventListener("DOMContentLoaded", function() {
      try {
        window.parent.postMessage({ type: "iframeReady" }, "*");
      } catch (error) {
        console.error("发送 iframeReady 消息时出错:", error);
      }
    });
  </script>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
    }
  </style>
</head>
<body></body>
</html>`

function injectStreamingPreviewScrollStyle(html: string): string {
	if (html.includes('data-streaming-preview-scroll-lock="true"')) {
		return html
	}

	// Inject after the real head opening tag. Replacing the first `</head>` is unsafe:
	// getFullContent also embeds user/runtime scripts that may contain the literal
	// `</head>` in a JavaScript string, and inserting CSS there breaks that script.
	if (/<head\b[^>]*>/i.test(html)) {
		return html.replace(/<head\b[^>]*>/i, (headTag) => {
			return `${headTag}${STREAMING_HTML_PREVIEW_SCROLL_STYLE}`
		})
	}

	return `${html}${STREAMING_HTML_PREVIEW_SCROLL_STYLE}`
}

export function StreamingHtmlPreviewRenderer(props: HtmlPreviewRendererProps) {
	const {
		content,
		onReady,
		onMetrics,
		containIframeOverscroll = false,
		hideVerticalScroll = false,
		onContentCommitted,
		isPreviewActive = true,
	} = props
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const isIframeReadyRef = useRef(false)
	const contentVersionRef = useRef(0)
	const latestSentVersionRef = useRef(0)
	const lastAcknowledgedFullContentRef = useRef("")
	const lastPostedActivityRef = useRef<boolean | null>(null)
	const acknowledgeTimeoutRef = useRef<number | null>(null)
	const latestPayloadRef = useRef<{ fullContent: string; committedContent: string }>({
		fullContent: "",
		committedContent: "",
	})
	const mailboxRef = useRef<{
		inFlight: { version: number; fullContent: string; committedContent: string } | null
		pending: { fullContent: string; committedContent: string } | null
	}>({ inFlight: null, pending: null })
	useEffect(() => {
		const iframe = iframeRef.current
		if (!iframe) return
		// Legacy fullscreen attributes for old WebKit/Firefox engines.
		iframe.setAttribute("allowfullscreen", "true")
		iframe.setAttribute("webkitallowfullscreen", "true")
		iframe.setAttribute("mozallowfullscreen", "true")
	}, [])
	const previewContent = useMemo(() => rewriteHtmlWithMagicCdn(content), [content])
	const fullContent = useMemo(() => {
		const decodedContent = decodeHTMLEntities(previewContent)
		const previewDocument = getFullContent(decodedContent, undefined, {
			containOverscroll:
				containIframeOverscroll && HTML_CODE_BLOCK_PREVIEW_CONTAIN_IFRAME_OVERSCROLL,
			hideVerticalScroll,
			disableParentClickBridge: true,
		})

		return injectStreamingPreviewScrollStyle(previewDocument)
	}, [containIframeOverscroll, hideVerticalScroll, previewContent])
	// Keep the high-frequency payload in a ref so ACK/timeout handlers always flush
	// the newest version instead of the render that originally created the timer.
	latestPayloadRef.current = { fullContent, committedContent: content }

	const clearAcknowledgeTimeout = useCallback(() => {
		if (acknowledgeTimeoutRef.current !== null) {
			window.clearTimeout(acknowledgeTimeoutRef.current)
			acknowledgeTimeoutRef.current = null
		}
	}, [])

	const postActivityState = useCallback(() => {
		if (!isIframeReadyRef.current || !iframeRef.current?.contentWindow) return
		if (isPreviewActive && lastPostedActivityRef.current === null) return
		if (lastPostedActivityRef.current === isPreviewActive) return
		iframeRef.current.contentWindow.postMessage(
			{ type: "setActive", isActive: isPreviewActive },
			"*",
		)
		lastPostedActivityRef.current = isPreviewActive
	}, [isPreviewActive])

	const postLatestContent = useCallback(() => {
		const latestPayload = latestPayloadRef.current
		const mailbox = mailboxRef.current

		if (!isIframeReadyRef.current || !iframeRef.current?.contentWindow) {
			mailbox.pending = latestPayload
			return
		}

		if (!isPreviewActive) {
			mailbox.pending = latestPayload
			return
		}

		if (mailbox.inFlight) {
			if (mailbox.inFlight.fullContent !== latestPayload.fullContent) {
				mailbox.pending = latestPayload
			}
			return
		}

		if (latestPayload.fullContent === mailbox.pending?.fullContent) {
			mailbox.pending = null
		}
		if (!latestPayload.fullContent) return
		if (latestPayload.fullContent === lastAcknowledgedFullContentRef.current) return

		const contentVersion = contentVersionRef.current + 1
		contentVersionRef.current = contentVersion
		latestSentVersionRef.current = contentVersion
		mailbox.inFlight = { version: contentVersion, ...latestPayload }
		mailbox.pending = null

		iframeRef.current.contentWindow.postMessage(
			{ type: "setContent", content: latestPayload.fullContent, contentVersion },
			"*",
		)

		clearAcknowledgeTimeout()
		acknowledgeTimeoutRef.current = window.setTimeout(() => {
			const currentFlight = mailboxRef.current.inFlight
			if (!currentFlight || currentFlight.version !== contentVersion) return
			const hasPendingContent = mailboxRef.current.pending !== null
			mailboxRef.current.inFlight = null
			acknowledgeTimeoutRef.current = null
			if (hasPendingContent) postLatestContent()
		}, 800)
	}, [clearAcknowledgeTimeout, isPreviewActive])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (
				!iframeRef.current?.contentWindow ||
				event.source !== iframeRef.current.contentWindow
			) {
				return
			}

			if (event.data?.type === "iframeReady") {
				isIframeReadyRef.current = true
				postActivityState()
				postLatestContent()
				return
			}

			if (event.data?.type === "renderComplete" || event.data?.type === "pageFullyLoaded") {
				const contentVersion = Number(event.data?.contentVersion)
				const currentFlight = mailboxRef.current.inFlight
				if (!Number.isInteger(contentVersion) || !currentFlight) return
				if (contentVersion !== currentFlight.version) return

				// 只有当前 in-flight 版本得到 iframe ACK，才解除 loading 并冻结可恢复内容。
				clearAcknowledgeTimeout()
				mailboxRef.current.inFlight = null
				lastAcknowledgedFullContentRef.current = currentFlight.fullContent
				onContentCommitted?.(currentFlight.committedContent)
				onReady()
				postLatestContent()
				return
			}

			if (event.data?.type === "streamingPreviewError") {
				const contentVersion = Number(event.data?.contentVersion)
				const currentFlight = mailboxRef.current.inFlight
				if (Number.isInteger(contentVersion) && currentFlight?.version === contentVersion) {
					const hasPendingContent = mailboxRef.current.pending !== null
					clearAcknowledgeTimeout()
					mailboxRef.current.inFlight = null
					if (hasPendingContent) postLatestContent()
				}
				return
			}

			if (event.data?.type !== "contentMetrics") return
			const metricsContentVersion = Number(event.data?.contentVersion)
			if (
				!Number.isInteger(metricsContentVersion) ||
				metricsContentVersion !== latestSentVersionRef.current ||
				!isPreviewActive
			) {
				return
			}

			const contentWidth = Number(event.data?.contentWidth)
			const contentHeight = Number(event.data?.contentHeight)
			if (!Number.isFinite(contentWidth) || contentWidth <= 0) return
			if (!Number.isFinite(contentHeight) || contentHeight <= 0) return

			onMetrics({
				contentWidth,
				contentHeight,
				phase: event.data?.phase === "settled" ? "settled" : "initial",
				hasHorizontalOverflow: event.data?.hasHorizontalOverflow === true,
				hasVerticalOverflow: event.data?.hasVerticalOverflow === true,
				verticalScrollbarWidth: Math.max(
					0,
					Number(event.data?.verticalScrollbarWidth) || 0,
				),
			})
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [
		clearAcknowledgeTimeout,
		isPreviewActive,
		onContentCommitted,
		onMetrics,
		onReady,
		postActivityState,
		postLatestContent,
	])

	useEffect(() => {
		postActivityState()
		postLatestContent()
	}, [content, fullContent, postActivityState, postLatestContent])

	useEffect(() => {
		return () => {
			clearAcknowledgeTimeout()
		}
	}, [clearAcknowledgeTimeout])

	return (
		<iframe
			ref={iframeRef}
			className="h-full w-full border-none bg-transparent"
			title="Streaming HTML Preview"
			sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups allow-downloads allow-pointer-lock"
			allow="fullscreen; pointer-lock"
			allowFullScreen
			srcDoc={STREAMING_HTML_PREVIEW_RUNTIME}
			scrolling="yes"
			translate="no"
			data-testid="streaming-html-preview-renderer"
		/>
	)
}
