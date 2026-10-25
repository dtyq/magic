import { INSPECTABLE_TEXT_CONTENT_SCRIPT } from "@dtyq/html-sandbox"

/**
 * Minimal ElementInspectorHandler script for injection into CardFrame iframes.
 *
 * This script is injected dynamically when the inspector is started and removed
 * when stopped. It listens for MAGIC_INSPECTOR_START/STOP messages and reports
 * HOVER/SELECT/HOVER_END back to the parent window.
 *
 * The script is self-contained — helpers are inlined, not imported at runtime.
 */

export const INSPECTOR_HANDLER_SCRIPT = `
(function() {
  if (window.__MAGIC_INSPECTOR_HANDLER__) return;
  window.__MAGIC_INSPECTOR_HANDLER__ = true;

  var INSPECTOR_MSG = {
    START: "MAGIC_INSPECTOR_START",
    STOP: "MAGIC_INSPECTOR_STOP",
    HOVER: "MAGIC_INSPECTOR_HOVER",
    SELECT: "MAGIC_INSPECTOR_SELECT",
    HOVER_END: "MAGIC_INSPECTOR_HOVER_END"
  };

  var active = false;
  var hoveredElement = null;

  function parsePx(value) {
    var n = parseFloat(value);
    return isFinite(n) ? n : 0;
  }

  function getBoxSides(computed, prefix) {
    return {
      top: parsePx(computed.getPropertyValue(prefix + "-top")),
      right: parsePx(computed.getPropertyValue(prefix + "-right")),
      bottom: parsePx(computed.getPropertyValue(prefix + "-bottom")),
      left: parsePx(computed.getPropertyValue(prefix + "-left"))
    };
  }

  var STYLE_PROPS = [
    "display","position","width","height","color","backgroundColor",
    "fontSize","fontFamily","fontWeight","lineHeight","textAlign",
    "opacity","borderRadius","overflow","zIndex","flexDirection",
    "justifyContent","alignItems"
  ];
  var MAX_RESOURCE_LENGTH = 240;
  var MAX_HTML_LENGTH = 800;
  var RESOURCE_ATTRIBUTES = ["src", "href", "poster", "srcset", "data-src", "data-href", "data-url", "data-original"];
  var SENSITIVE_ATTRIBUTE_PATTERN = /(authorization|credential|api[-_]?key|token|secret|signature)/i;
  var VOID_TAGS = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"];
  ${INSPECTABLE_TEXT_CONTENT_SCRIPT}

  function normalizeResource(value) {
    if (!value) return "";
    var raw = String(value).trim();
    if (raw.indexOf("data:") === 0) return raw.slice(0, MAX_RESOURCE_LENGTH);
    var withoutQuery = raw.split(/[?#]/, 1)[0];
    if (!/^[a-z][a-z\\d+.-]*:/i.test(withoutQuery) && withoutQuery.indexOf("//") !== 0) {
      return withoutQuery.slice(0, MAX_RESOURCE_LENGTH);
    }
    try {
      var url = new URL(raw, window.location.href);
      url.search = "";
      url.hash = "";
      return url.href.slice(0, MAX_RESOURCE_LENGTH);
    } catch (ex) {
      return withoutQuery.slice(0, MAX_RESOURCE_LENGTH);
    }
  }

  function getElementResource(element) {
    if (!element) return "";
    if (element.tagName.toLowerCase() === "img") return normalizeResource(element.getAttribute("src") || element.currentSrc);
    return normalizeResource(element.getAttribute("src") || element.getAttribute("href") || element.getAttribute("poster"));
  }

  function isResourceAttribute(name) {
    return RESOURCE_ATTRIBUTES.indexOf(name) !== -1;
  }

  function normalizeAttributeValue(name, value) {
    if (name === "srcset") {
      return value.split(",").map(function(item) {
        var parts = item.trim().split(/\\s+/);
        return [normalizeResource(parts.shift()), parts.join(" ")].filter(Boolean).join(" ");
      }).join(", ");
    }
    return isResourceAttribute(name) ? normalizeResource(value) : value;
  }

  function isSensitiveAttribute(name) {
    return SENSITIVE_ATTRIBUTE_PATTERN.test(name);
  }

  function getElementLabel(element) {
    if (!element) return "";
    var tag = element.tagName.toLowerCase();
    var id = element.id ? "#" + element.id : "";
    var className = typeof element.className === "string"
      ? element.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).map(function(c) { return "." + c; }).join("")
      : "";
    var resource = getElementResource(element);
    var text = getInspectableTextContent(element).replace(/\\s+/g, " ").slice(0, 48);
    return tag + id + className + (resource ? " resource=" + resource : "") + (text ? " text=" + text : "");
  }

  function sanitizeOuterHTML(element) {
    var clone = element.cloneNode(false);
    clone.removeAttribute("style");
    Array.prototype.slice.call(clone.attributes).forEach(function(attribute) {
      if (isSensitiveAttribute(attribute.name)) {
        clone.removeAttribute(attribute.name);
        return;
      }
      if (isResourceAttribute(attribute.name)) {
        clone.setAttribute(attribute.name, normalizeAttributeValue(attribute.name, attribute.value));
      }
    });
    if (VOID_TAGS.indexOf(element.tagName.toLowerCase()) === -1) {
      clone.textContent = getInspectableTextContent(element).replace(/\\s+/g, " ").slice(0, 120);
    }
    return clone.outerHTML.slice(0, MAX_HTML_LENGTH);
  }

  function getDomContext(element) {
    var parent = element.parentElement;
    if (!parent) return { parentSelector: "", siblingIndex: 1, sameTagSiblingCount: 1, sameTagIndex: 1 };
    var children = Array.prototype.slice.call(parent.children);
    var sameTagSiblings = children.filter(function(child) {
      return child.tagName.toLowerCase() === element.tagName.toLowerCase();
    });
    return {
      parentSelector: getElementSelector(parent),
      siblingIndex: children.indexOf(element) + 1,
      sameTagSiblingCount: sameTagSiblings.length,
      sameTagIndex: sameTagSiblings.indexOf(element) + 1,
      previousSibling: element.previousElementSibling ? getElementLabel(element.previousElementSibling) : undefined,
      nextSibling: element.nextElementSibling ? getElementLabel(element.nextElementSibling) : undefined
    };
  }

  function getElementSelector(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element === document.documentElement) return "html";
    if (element === document.body) return "body";

    var path = [];
    var current = element;

    while (current && current.nodeType === 1 && current !== document.documentElement && current !== document.body) {
      var selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += "#" + current.id;
        path.unshift(selector);
        break;
      }

      var classes = [];
      if (current.className && typeof current.className === "string") {
        classes = current.className.trim().split(/\\s+/).filter(function(c) { return c; });
      }

      var baseSelector = selector;
      if (classes.length > 0) {
        baseSelector += classes.map(function(c) { return "." + c; }).join("");
      }

      var parent = current.parentElement;
      if (parent) {
        var tag = current.tagName.toLowerCase();
        var siblings = Array.from(parent.children).filter(function(ch) {
          return ch.tagName.toLowerCase() === tag;
        });
        if (siblings.length > 1) {
          var index = siblings.indexOf(current) + 1;
          selector = baseSelector + ":nth-of-type(" + index + ")";
        } else {
          selector = baseSelector;
        }
      } else {
        selector = baseSelector;
      }

      path.unshift(selector);
      current = parent;
    }

    var selectorPath = path.join(" > ");
    if (element.parentElement === document.body && selectorPath) return "body > " + selectorPath;
    return selectorPath;
  }

  function collectElementInfo(el) {
    var computed = window.getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var computedStyles = {};
    STYLE_PROPS.forEach(function(prop) { computedStyles[prop] = computed[prop] || ""; });

    var attributes = {};
    var skipAttrs = ["class","id","style"];
    var attrCount = 0;
    for (var i = 0; i < el.attributes.length && attrCount < 10; i++) {
      var attr = el.attributes[i];
      if (skipAttrs.indexOf(attr.name) === -1 && !isSensitiveAttribute(attr.name)) {
        var attrValue = normalizeAttributeValue(attr.name, attr.value);
        attributes[attr.name] = attrValue.length > 160 ? attrValue.slice(0,160) + "…" : attrValue;
        attrCount++;
      }
    }

    var rawText = getInspectableTextContent(el);
    var textContent = rawText.length > 120 ? rawText.slice(0,120) + "…" : rawText;

    var classList = [];
    if (el.className && typeof el.className === "string") {
      classList = el.className.trim().split(/\\s+/).filter(Boolean);
    }

    var selector = getElementSelector(el);
    var selectorMatchCount = 0;
    try { selectorMatchCount = document.querySelectorAll(selector).length; } catch (ex) {}
    return {
      selector: selector,
      tagName: el.tagName.toLowerCase(),
      id: el.id || "",
      classList: classList,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      margin: getBoxSides(computed, "margin"),
      padding: getBoxSides(computed, "padding"),
      border: {
        top: parsePx(computed.borderTopWidth),
        right: parsePx(computed.borderRightWidth),
        bottom: parsePx(computed.borderBottomWidth),
        left: parsePx(computed.borderLeftWidth)
      },
      computedStyles: computedStyles,
      attributes: attributes,
      textContent: textContent,
      resource: getElementResource(el),
      domContext: getDomContext(el),
      elementHtml: sanitizeOuterHTML(el),
      selectorMatchCount: selectorMatchCount,
      accessibleName: el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || undefined
    };
  }

  function onMouseMove(e) {
    if (!active) return;
    var target = e.target;
    if (!target || target === document.body || target === document.documentElement) return;
    if (target.getAttribute && target.getAttribute("data-injected") === "true") return;
    if (hoveredElement === target) return;
    hoveredElement = target;
    try {
      window.parent.postMessage({ type: INSPECTOR_MSG.HOVER, elementInfo: collectElementInfo(target), timestamp: Date.now() }, "*");
    } catch(ex) {}
  }

  function onMouseOut(e) {
    if (!active) return;
    var related = e.relatedTarget;
    if (!related || related === document.documentElement) {
      hoveredElement = null;
      try {
        window.parent.postMessage({ type: INSPECTOR_MSG.HOVER_END, timestamp: Date.now() }, "*");
      } catch(ex) {}
    }
  }

  function onClick(e) {
    if (!active) return;
    var target = e.target;
    if (!target) return;
    if (target.getAttribute && target.getAttribute("data-injected") === "true") return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    try {
      window.parent.postMessage({ type: INSPECTOR_MSG.SELECT, elementInfo: collectElementInfo(target), timestamp: Date.now() }, "*");
    } catch(ex) {}
    deactivate();
  }

  function activate() {
    if (active) return;
    active = true;
    hoveredElement = null;
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    document.documentElement.style.cursor = "crosshair";
  }

  function deactivate() {
    if (!active) return;
    active = false;
    hoveredElement = null;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("click", onClick, true);
    document.documentElement.style.cursor = "";
  }

  window.addEventListener("message", function(event) {
    if (event.data && event.data.type === INSPECTOR_MSG.START) { activate(); }
    if (event.data && event.data.type === INSPECTOR_MSG.STOP) { deactivate(); }
  });

  // If START was already sent before this script was injected, auto-activate
  activate();
})();
`

type InspectorContentWindow = Window & {
	__MAGIC_INSPECTOR_HANDLER__?: boolean
}

/**
 * Injects the inspector handler script into an iframe's document.
 * The iframe must have same-origin access (sandbox="allow-same-origin allow-scripts").
 *
 * Returns a cleanup function that removes the script and deactivates the handler.
 */
export function injectInspectorHandler(iframe: HTMLIFrameElement): (() => void) | null {
	const doc = iframe.contentDocument
	if (!doc) return null

	// Avoid double-injection
	if ((iframe.contentWindow as InspectorContentWindow | null)?.__MAGIC_INSPECTOR_HANDLER__) {
		return () => {
			iframe.contentWindow?.postMessage(
				{ type: "MAGIC_INSPECTOR_STOP", timestamp: Date.now() },
				"*",
			)
		}
	}

	const script = doc.createElement("script")
	script.setAttribute("data-injected", "true")
	script.textContent = INSPECTOR_HANDLER_SCRIPT
	doc.body.appendChild(script)

	return () => {
		iframe.contentWindow?.postMessage(
			{ type: "MAGIC_INSPECTOR_STOP", timestamp: Date.now() },
			"*",
		)
		try {
			script.remove()
		} catch {
			// iframe may already be detached
		}
		try {
			const contentWindow = iframe.contentWindow as InspectorContentWindow | null
			if (contentWindow) contentWindow.__MAGIC_INSPECTOR_HANDLER__ = false
		} catch {
			// cross-origin or detached
		}
	}
}
