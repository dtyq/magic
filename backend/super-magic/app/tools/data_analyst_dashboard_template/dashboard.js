var _window$StyleUtils, _window$StyleUtils2;
var _excluded = ["i"];
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(t, e) { if (e && ("object" == _typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return _assertThisInitialized(t); }
function _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }
function _inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && _setPrototypeOf(t, e); }
function _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Dashboard Bundle
 */

// Language Configuration for Internationalization
var LANGUAGE_CONFIG = {
  "en-US": {
    // Common texts used across components
    common: {
      loading: "Loading",
      error: "Unknown error",
      noData: "No data",
      to: "to",
      apply: "Apply",
      clear: "Clear",
      expandInModal: "Expand in modal",
      deleteCard: "Delete card",
      closeModal: "Close modal",
      addTitle: "Add title",
      editTitle: "Edit title"
    },
    // Filter related texts
    filter: {
      dateFilter: {
        title: "Date Range Filter",
        startPlaceholder: "Start date",
        endPlaceholder: "End date"
      },
      timeFilter: {
        title: "Time Range Filter",
        startPlaceholder: "Start time",
        endPlaceholder: "End time"
      },
      numberFilter: {
        title: "Number Range Filter",
        minPlaceholder: "Min",
        maxPlaceholder: "Max"
      },
      stringFilter: {
        title: "Text Filter",
        placeholder: "Enter keywords"
      }
    },
    // Error boundary texts
    error: {
      title: "Card Error",
      renderFailed: "Render failed",
      imageLoadFailed: "Image loading failed",
      invalidEChartsConfig: "Invalid ECharts configuration data",
      chartRenderError: "Error occurred during chart rendering",
      markedLibraryNotLoaded: "marked library not loaded",
      renderError: "Render error"
    },
    // Chart validation warnings
    warning: {
      legendPositionRequired: "legend must explicitly declare position (left/right/top/bottom)",
      legendScrollRecommended: "legend should enable type: 'scroll' to avoid taking up too much space",
      gridContainLabelDeprecated: "grid.containLabel is deprecated in ECharts v6.0.0, recommend using { left: 0, right: 0, top: 0, bottom: 0, containLabel: false } configuration",
      gridPositionMustBeNumber: "must be a number, strings or percentages are not allowed",
      gridOuterBoundsUnnecessary: "grid.outerBounds should only be used when legend or visualMap components are configured, otherwise remove this configuration",
      gridOuterBoundsMustBeNumber: "must be a number, strings or percentages are not allowed",
      gridOuterBoundsRequired: "grid.outerBounds must be configured to reserve space when legend or visualMap components are present",
      gridNonZeroPosition: "has non-zero position values ({positions}). Consider using grid.outerBounds instead for better layout control when legend or visualMap components are present.",
      kpiDuplicateIcon: "KPI card has duplicate icon '{icon}' used {count} times at positions: {positions}. Consider using different icons for better visual distinction.",
      cardsWithoutLayout: "Found {count} card(s) without layout configuration out of {total} total cards: {cardIds}"
    }
  },
  "zh-CN": {
    // Common texts used across components
    common: {
      loading: "加载中",
      error: "未知错误",
      noData: "暂无数据",
      to: "到",
      apply: "应用",
      clear: "清除",
      expandInModal: "在弹窗中展开",
      deleteCard: "删除卡片",
      closeModal: "关闭弹窗",
      addTitle: "添加标题",
      editTitle: "编辑标题"
    },
    // Filter related texts
    filter: {
      dateFilter: {
        title: "日期范围筛选",
        startPlaceholder: "开始日期",
        endPlaceholder: "结束日期"
      },
      timeFilter: {
        title: "时间范围筛选",
        startPlaceholder: "开始时间",
        endPlaceholder: "结束时间"
      },
      numberFilter: {
        title: "数值范围筛选",
        minPlaceholder: "最小值",
        maxPlaceholder: "最大值"
      },
      stringFilter: {
        title: "文本筛选",
        placeholder: "输入关键词"
      }
    },
    // Error boundary texts
    error: {
      title: "卡片错误",
      renderFailed: "渲染失败",
      imageLoadFailed: "图片加载失败",
      invalidEChartsConfig: "无效的ECharts配置数据",
      chartRenderError: "图表渲染时发生错误",
      markedLibraryNotLoaded: "marked库未加载",
      renderError: "渲染错误"
    },
    // Chart validation warnings
    warning: {
      legendPositionRequired: "图例必须明确声明位置属性 (left/right/top/bottom)",
      legendScrollRecommended: "建议图例启用 type: 'scroll' 以避免占用过多空间",
      gridContainLabelDeprecated: "grid.containLabel 在 ECharts v6.0.0 中已弃用，建议使用 { left: 0, right: 0, top: 0, bottom: 0, containLabel: false } 配置",
      gridPositionMustBeNumber: "必须为数字，不允许使用字符串或百分比",
      gridOuterBoundsUnnecessary: "grid.outerBounds 仅在配置了图例或视觉映射组件时使用，否则请移除此配置",
      gridOuterBoundsMustBeNumber: "必须为数字，不允许使用字符串或百分比",
      gridOuterBoundsRequired: "存在图例或视觉映射组件时，必须配置 grid.outerBounds 来预留空间",
      gridNonZeroPosition: "存在非零位置值 ({positions})。建议使用 grid.outerBounds 来获得更好的布局控制，特别是当存在图例或视觉映射组件时。",
      kpiDuplicateIcon: "KPI 卡片存在重复图标 '{icon}'，在第 {positions} 个位置使用了 {count} 次。建议使用不同的图标以获得更好的视觉区分度。",
      cardsWithoutLayout: "发现 {count} 个卡片缺少布局配置，总共 {total} 个卡片：{cardIds}"
    }
  }
};
// Language class for internationalization
var Language = /*#__PURE__*/function () {
  function Language() {
    _classCallCheck(this, Language);
    this.config = LANGUAGE_CONFIG;
    this.updateFromConfig();
  }
  // Set current language
  return _createClass(Language, [{
    key: "setLanguage",
    value: function setLanguage(lang) {
      if (this.config[lang]) {
        this.currentLanguage = lang;
      } else {
        console.warn("Language '".concat(lang, "' not found, using default 'zh-CN'"));
      }
    }
    // Get current language
  }, {
    key: "getLanguage",
    value: function getLanguage() {
      return this.currentLanguage;
    }
    // Translation function (t) with interpolation support
  }, {
    key: "t",
    value: function t(keyPath) {
      var fallback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
      var params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var keys = keyPath.split(".");
      var current = this.config[this.currentLanguage];
      var _iterator = _createForOfIteratorHelper(keys),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var key = _step.value;
          if (current && _typeof(current) === "object" && key in current) {
            current = current[key];
          } else {
            console.warn("Translation key not found: ".concat(keyPath, " for language: ").concat(this.currentLanguage));
            current = fallback || keyPath;
            break;
          }
        }
        // Handle interpolation if params provided
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      if (typeof current === "string" && params && _typeof(params) === "object") {
        return current.replace(/\{(\w+)\}/g, function (match, key) {
          return params.hasOwnProperty(key) ? params[key] : match;
        });
      }
      return current;
    }
    // Add new language
  }, {
    key: "addLanguage",
    value: function addLanguage(lang, translations) {
      this.config[lang] = translations;
    }
    // Get available languages
  }, {
    key: "getAvailableLanguages",
    value: function getAvailableLanguages() {
      return Object.keys(this.config);
    }
    // Update language from magicDashboard configuration
  }, {
    key: "updateFromConfig",
    value: function updateFromConfig() {
      var configLang = "zh-CN";
      if (window.magicDashboard && window.magicDashboard.language) {
        configLang = window.magicDashboard.language;
      }
      // Use the language directly if it exists in our config and is different from current
      if (this.config[configLang] && configLang !== this.currentLanguage) {
        this.setLanguage(configLang);
      }
    }
  }]);
}(); // Export to global scope
window.language = new Language();

// React error boundary component - Used to catch and handle JavaScript errors in child components
var ErrorBoundary = /*#__PURE__*/function (_React$Component) {
  function ErrorBoundary(props) {
    var _this;
    _classCallCheck(this, ErrorBoundary);
    _this = _callSuper(this, ErrorBoundary, [props]);
    _this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
    return _this;
  }
  _inherits(ErrorBoundary, _React$Component);
  return _createClass(ErrorBoundary, [{
    key: "getErrorThemeConfig",
    value: function getErrorThemeConfig() {
      var config = this.props.dashboardConfig;
      var fontSize = config.BASE_FONT_SIZE;
      return {
        FONT_SIZE: fontSize,
        MESSAGE_FONT_SIZE: fontSize,
        MESSAGE_MARGIN_BOTTOM: config.CARD_GAP,
        ERROR: config.COLORS_ERROR,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY
      };
    }
  }, {
    key: "componentDidCatch",
    value: function componentDidCatch(error, errorInfo) {
      console.error("ErrorBoundary caught an error:", error);
      this.setState({
        error: error,
        errorInfo: errorInfo
      });
      var errorEvent = new CustomEvent("ComponentError", {
        detail: {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: Date.now(),
          cardType: this.props.cardType || "unknown",
          cardId: this.props.cardId || "unknown"
        }
      });
      document.dispatchEvent(errorEvent);
    }
    // Get error message
  }, {
    key: "errorMessage",
    get: function get() {
      var error = this.state.error;
      if (typeof error === "string") return error;
      if (error !== null && error !== void 0 && error.message) return error.message;
      return language.t("error.renderFailed", "Render failed");
    }
    // Render error icon
  }, {
    key: "renderErrorIcon",
    value: function renderErrorIcon() {
      return React.createElement("div", {
        key: "error-icon",
        style: {
          fontSize: "24px",
          marginBottom: "8px",
          opacity: 0.8
        }
      }, React.createElement("i", {
        className: "ti ti-alert-triangle",
        style: {
          fontSize: "24px",
          color: "#ff6b6b"
        }
      }));
    }
    // Render error message
  }, {
    key: "renderErrorMessage",
    value: function renderErrorMessage() {
      var themeConfig = this.getErrorThemeConfig();
      return React.createElement("div", {
        key: "error-message",
        style: {
          color: themeConfig.ERROR,
          fontSize: themeConfig.MESSAGE_FONT_SIZE,
          fontWeight: "500",
          marginBottom: themeConfig.MESSAGE_MARGIN_BOTTOM,
          textAlign: "center"
        }
      }, this.errorMessage);
    }
    // Render error card content
  }, {
    key: "renderErrorContent",
    value: function renderErrorContent() {
      return React.createElement("div", {
        key: "error-content",
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          textAlign: "center"
        }
      }, [this.renderErrorIcon(), this.renderErrorMessage()]);
    }
    // Render error card
  }, {
    key: "renderErrorCard",
    value: function renderErrorCard() {
      var _this$props$cardType = this.props.cardType,
        cardType = _this$props$cardType === void 0 ? "unknown" : _this$props$cardType;
      var containerStyle = {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        position: "relative"
      };
      return React.createElement("div", {
        className: "error-card",
        style: containerStyle,
        "data-card-type": "error",
        title: "".concat(cardType, " card render error")
      }, this.renderErrorContent());
    }
  }, {
    key: "render",
    value: function render() {
      var _this2 = this;
      if (this.state.hasError) {
        // Custom fallback UI
        var fallback = this.props.fallback;
        // If custom fallback component is provided
        if (fallback) {
          return React.createElement(fallback, {
            error: this.state.error,
            errorInfo: this.state.errorInfo,
            reset: function reset() {
              return _this2.setState({
                hasError: false,
                error: null,
                errorInfo: null
              });
            }
          });
        }
        // Directly render error card
        return this.renderErrorCard();
      }
      return this.props.children;
    }
    // Provide method to reset error state
  }, {
    key: "reset",
    value: function reset() {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }
  }], [{
    key: "getDerivedStateFromError",
    value: function getDerivedStateFromError(error) {
      return {
        hasError: true
      };
    }
  }]);
}(React.Component);
window.ErrorBoundary = ErrorBoundary;

/**
 * Card Modal Component - A modal dialog for enlarging cards
 * Provides a full-screen modal interface for displaying enlarged card content
 */
var CardModal = /*#__PURE__*/function (_React$Component2) {
  function CardModal(props) {
    var _this3;
    _classCallCheck(this, CardModal);
    _this3 = _callSuper(this, CardModal, [props]);
    _this3.state = {
      isVisible: false,
      title: "",
      content: null,
      shouldRenderContent: false
    };
    // Bind methods
    _this3.handleClose = _this3.handleClose.bind(_this3);
    _this3.handleKeyDown = _this3.handleKeyDown.bind(_this3);
    _this3.handleBackdropClick = _this3.handleBackdropClick.bind(_this3);
    _this3.handleResize = _this3.handleResize.bind(_this3);
    _this3.calculateModalSize = _this3.calculateModalSize.bind(_this3);
    return _this3;
  }
  _inherits(CardModal, _React$Component2);
  return _createClass(CardModal, [{
    key: "componentDidMount",
    value: function componentDidMount() {
      // Add event listener for ESC key
      document.addEventListener("keydown", this.handleKeyDown);
      // Add event listener for window resize
      window.addEventListener("resize", this.handleResize);
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      // Remove event listeners
      document.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("resize", this.handleResize);
    }
    /**
     * Show modal with content
     * @param {string} title - The title to display in modal header
     * @param {React.ReactNode} content - The content to display in modal body
     */
  }, {
    key: "show",
    value: function show(title, content) {
      var _this4 = this;
      this.setState({
        isVisible: true,
        title: title,
        content: content,
        shouldRenderContent: false
      });
      // Prevent body scrolling when modal is open
      document.body.style.overflow = "hidden";
      // Apply calculated size after a short delay to ensure DOM is ready
      setTimeout(function () {
        _this4.updateModalSize();
        _this4.applyModalBackground();
        setTimeout(function () {
          _this4.setState({
            shouldRenderContent: true
          });
        }, 300);
      }, 10);
    }
    /**
     * Hide modal
     */
  }, {
    key: "hide",
    value: function hide() {
      this.setState({
        isVisible: false,
        title: "",
        content: null,
        shouldRenderContent: false
      });
      // Remove body overflow style to restore original scrolling behavior
      document.body.style.removeProperty("overflow");
    }
    /**
     * Handle close button click
     */
  }, {
    key: "handleClose",
    value: function handleClose() {
      this.hide();
      // Call onClose callback if provided
      if (this.props.onClose) {
        this.props.onClose();
      }
    }
    /**
     * Handle ESC key press
     */
  }, {
    key: "handleKeyDown",
    value: function handleKeyDown(event) {
      if (event.key === "Escape" && this.state.isVisible) {
        this.handleClose();
      }
    }
    /**
     * Handle backdrop click (click outside modal content)
     */
  }, {
    key: "handleBackdropClick",
    value: function handleBackdropClick(event) {
      if (event.target === event.currentTarget) {
        this.handleClose();
      }
    }
    /**
     * Handle window resize
     */
  }, {
    key: "handleResize",
    value: function handleResize() {
      if (this.state.isVisible) {
        this.updateModalSize();
      }
    }
    /**
     * Calculate modal size based on screen dimensions
     * @returns {Object} Object containing width and height
     */
  }, {
    key: "calculateModalSize",
    value: function calculateModalSize() {
      var screenWidth = window.innerWidth;
      var screenHeight = window.innerHeight;
      // Define aspect ratio (width:height = 4:3 for better content display)
      var aspectRatio = 4 / 3;
      // Calculate width based on screen size with responsive breakpoints
      var modalWidth;
      if (screenWidth <= 480) {
        // Mobile: 95% of screen width
        modalWidth = screenWidth * 0.95;
      } else if (screenWidth <= 768) {
        // Tablet: 85% of screen width
        modalWidth = screenWidth * 0.85;
      } else if (screenWidth <= 1200) {
        // Desktop small: 75% of screen width
        modalWidth = screenWidth * 0.75;
      } else {
        // Desktop large: max 1000px or 70% of screen width
        modalWidth = Math.min(screenWidth * 0.7, 1000);
      }
      // Calculate height based on aspect ratio
      var modalHeight = modalWidth / aspectRatio;
      // Ensure height doesn't exceed 90% of screen height
      var maxHeight = screenHeight * 0.9;
      if (modalHeight > maxHeight) {
        modalHeight = maxHeight;
        modalWidth = modalHeight * aspectRatio;
      }
      // Ensure minimum dimensions for usability
      modalWidth = Math.max(modalWidth, 320);
      modalHeight = Math.max(modalHeight, 240);
      return {
        width: Math.round(modalWidth),
        height: Math.round(modalHeight)
      };
    }
    /**
     * Update modal size by applying calculated dimensions
     */
  }, {
    key: "updateModalSize",
    value: function updateModalSize() {
      var modalContainer = document.querySelector(".card-modal-container");
      if (modalContainer) {
        var _this$calculateModalS = this.calculateModalSize(),
          width = _this$calculateModalS.width,
          height = _this$calculateModalS.height;
        modalContainer.style.width = "".concat(width, "px");
        modalContainer.style.height = "".concat(height, "px");
      }
    }
    /**
     * Apply opaque background color to modal container
     */
  }, {
    key: "applyModalBackground",
    value: function applyModalBackground() {
      var modalContainer = document.querySelector(".card-modal-container");
      if (modalContainer) {
        modalContainer.style.backgroundColor = UTILS.getOpaqueBackgroundColor();
      }
    }
    /**
     * Render modal content
     */
  }, {
    key: "renderModalContent",
    value: function renderModalContent() {
      var _this$state = this.state,
        title = _this$state.title,
        content = _this$state.content,
        shouldRenderContent = _this$state.shouldRenderContent;
      if (!content) return null;
      return [React.createElement("div", {
        key: "modal-header",
        className: "modal-header"
      }, React.createElement("div", {
        className: "modal-title"
      }, title), React.createElement("div", {
        className: "action-button modal-close-btn",
        onClick: this.handleClose,
        "aria-label": "Close modal",
        title: language.t("common.closeModal")
      }, React.createElement("i", {
        className: "ti ti-x"
      }))), React.createElement("div", {
        key: "modal-body",
        className: "modal-body"
      }, shouldRenderContent ? content : null)];
    }
  }, {
    key: "render",
    value: function render() {
      var isVisible = this.state.isVisible;
      if (!isVisible) return null;
      return React.createElement("div", {
        className: "card-modal-overlay",
        onClick: this.handleBackdropClick
      }, React.createElement("div", {
        className: "card-modal-container"
      }, this.renderModalContent()));
    }
    /**
     * Static method to open modal using Portal
     * @param {string} title - Modal title
     * @param {React.ReactNode} content - Modal content
     * @param {Object} options - Additional options
     * @returns {Function} Close function to manually close the modal
     */
  }], [{
    key: "open",
    value: function open(title, content) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      // Create container element
      var container = document.createElement("div");
      container.className = "card-modal-portal-container";
      document.body.appendChild(container);
      // Create a wrapper component that auto-shows the modal
      var PortalModalWrapper = /*#__PURE__*/function (_React$Component3) {
        function PortalModalWrapper(props) {
          var _this5;
          _classCallCheck(this, PortalModalWrapper);
          _this5 = _callSuper(this, PortalModalWrapper, [props]);
          _defineProperty(_this5, "handleClose", function () {
            // Clean up when modal closes
            CardModal.cleanup(container);
            if (options.onClose) {
              options.onClose();
            }
          });
          _this5.modalRef = React.createRef();
          return _this5;
        }
        _inherits(PortalModalWrapper, _React$Component3);
        return _createClass(PortalModalWrapper, [{
          key: "componentDidMount",
          value: function componentDidMount() {
            // Auto-show modal after mount
            if (this.modalRef.current) {
              this.modalRef.current.show(title, content);
            }
          }
        }, {
          key: "render",
          value: function render() {
            return React.createElement(CardModal, {
              ref: this.modalRef,
              onClose: this.handleClose
            });
          }
        }]);
      }(React.Component); // Render wrapper to container
      ReactDOM.render(React.createElement(PortalModalWrapper), container);
      // Return close function
      return function () {
        CardModal.cleanup(container);
      };
    }
    /**
     * Cleanup modal container
     * @param {HTMLElement} container - Container element to cleanup
     */
  }, {
    key: "cleanup",
    value: function cleanup(container) {
      if (container && container.parentNode) {
        ReactDOM.unmountComponentAtNode(container);
        container.parentNode.removeChild(container);
      }
    }
  }]);
}(React.Component);
window.CardModal = CardModal;

// Universal Input class component
var Input = /*#__PURE__*/function (_React$Component4) {
  function Input(props) {
    var _this6;
    _classCallCheck(this, Input);
    _this6 = _callSuper(this, Input, [props]);
    _defineProperty(_this6, "handleChange", function (event) {
      var onChange = _this6.props.onChange;
      var newValue = event.target.value;
      _this6.setState({
        value: newValue
      });
      if (onChange) {
        onChange(newValue);
      }
    });
    _defineProperty(_this6, "handleFocus", function (event) {
      var onFocus = _this6.props.onFocus;
      if (onFocus) {
        onFocus(event);
      }
    });
    _defineProperty(_this6, "handleBlur", function (event) {
      var onBlur = _this6.props.onBlur;
      if (onBlur) {
        onBlur(event);
      }
    });
    _defineProperty(_this6, "handleKeyDown", function (event) {
      var _this6$props = _this6.props,
        onKeyDown = _this6$props.onKeyDown,
        onEnter = _this6$props.onEnter;
      if (event.key === "Enter" && onEnter) {
        onEnter(_this6.state.value, event);
      }
      if (onKeyDown) {
        onKeyDown(event);
      }
    });
    _defineProperty(_this6, "focus", function () {
      if (_this6.inputRef.current) {
        _this6.inputRef.current.focus();
      }
    });
    _defineProperty(_this6, "blur", function () {
      if (_this6.inputRef.current) {
        _this6.inputRef.current.blur();
      }
    });
    _defineProperty(_this6, "getValue", function () {
      return _this6.state.value;
    });
    _defineProperty(_this6, "setValue", function (value) {
      var onChange = _this6.props.onChange;
      _this6.setState({
        value: value
      });
      if (onChange) {
        onChange(value);
      }
    });
    _this6.state = {
      value: props.value || props.defaultValue || ""
    };
    _this6.inputRef = React.createRef();
    return _this6;
  }
  _inherits(Input, _React$Component4);
  return _createClass(Input, [{
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      if (prevProps.value !== this.props.value && this.props.value !== undefined) {
        this.setState({
          value: this.props.value
        });
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this$props = this.props,
        _this$props$type = _this$props.type,
        type = _this$props$type === void 0 ? "text" : _this$props$type,
        placeholder = _this$props.placeholder,
        _this$props$className = _this$props.className,
        className = _this$props$className === void 0 ? "" : _this$props$className,
        _this$props$style = _this$props.style,
        style = _this$props$style === void 0 ? {} : _this$props$style,
        _this$props$inputClas = _this$props.inputClassName,
        inputClassName = _this$props$inputClas === void 0 ? "" : _this$props$inputClas,
        _this$props$inputStyl = _this$props.inputStyle,
        inputStyle = _this$props$inputStyl === void 0 ? {} : _this$props$inputStyl,
        maxLength = _this$props.maxLength,
        minLength = _this$props.minLength,
        pattern = _this$props.pattern,
        _this$props$required = _this$props.required,
        required = _this$props$required === void 0 ? false : _this$props$required,
        autoComplete = _this$props.autoComplete,
        _this$props$autoFocus = _this$props.autoFocus,
        autoFocus = _this$props$autoFocus === void 0 ? false : _this$props$autoFocus,
        tabIndex = _this$props.tabIndex,
        name = _this$props.name,
        id = _this$props.id,
        testId = _this$props["data-testid"];
      var value = this.state.value;
      return React.createElement("div", {
        className: ["magic-input-container", className].filter(Boolean).join(" "),
        style: style
      }, [React.createElement("input", {
        key: "input",
        ref: this.inputRef,
        type: type,
        value: value,
        placeholder: placeholder,
        className: ["magic-input", inputClassName].filter(Boolean).join(" "),
        style: inputStyle,
        maxLength: maxLength,
        minLength: minLength,
        pattern: pattern,
        required: required,
        autoComplete: autoComplete,
        autoFocus: autoFocus,
        tabIndex: tabIndex,
        name: name,
        id: id,
        "data-testid": testId,
        onChange: this.handleChange,
        onFocus: this.handleFocus,
        onBlur: this.handleBlur,
        onKeyDown: this.handleKeyDown
      })]);
    }
  }]);
}(React.Component); // Export to global scope
window.Input = Input;

// String Filter Component - String filtering component
var StringFilter = /*#__PURE__*/function (_React$Component5) {
  function StringFilter() {
    _classCallCheck(this, StringFilter);
    return _callSuper(this, StringFilter, arguments);
  }
  _inherits(StringFilter, _React$Component5);
  return _createClass(StringFilter, [{
    key: "render",
    value: function render() {
      var _this$props2 = this.props,
        value = _this$props2.value,
        _onChange = _this$props2.onChange,
        placeholder = _this$props2.placeholder;
      return React.createElement("div", {
        style: {
          padding: "8px"
        }
      }, React.createElement("div", {
        style: {
          marginBottom: "8px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          color: this.props.dashboardConfig.COLORS_TEXT_PRIMARY,
          fontWeight: "500"
        }
      }, language.t("filter.stringFilter.title")), React.createElement("input", {
        type: "text",
        placeholder: placeholder || language.t("filter.stringFilter.placeholder"),
        value: value,
        onChange: function onChange(e) {
          return _onChange(e.target.value);
        },
        style: {
          width: "100%",
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      }));
    }
  }]);
}(React.Component);
window.StringFilter = StringFilter;

// Number Filter Component - Number range filtering component
var NumberFilter = /*#__PURE__*/function (_React$Component6) {
  function NumberFilter(props) {
    var _this7;
    _classCallCheck(this, NumberFilter);
    _this7 = _callSuper(this, NumberFilter, [props]);
    // Parse existing value, supports range format "min-max" or single number
    _defineProperty(_this7, "handleChange", function (type, value) {
      var newState = _objectSpread(_objectSpread({}, _this7.state), {}, _defineProperty({}, type, value));
      _this7.setState(newState);
      // Build filter value
      var min = newState.min,
        max = newState.max;
      var filterValue = "";
      if (min && max) {
        filterValue = "".concat(min, "-").concat(max);
      } else if (min) {
        filterValue = min;
      } else if (max) {
        filterValue = "-".concat(max);
      }
      _this7.props.onChange(filterValue);
    });
    var parseValue = function parseValue(val) {
      if (!val) return {
        min: "",
        max: ""
      };
      if (typeof val === "string" && val.includes("-")) {
        var _val$split = val.split("-"),
          _val$split2 = _slicedToArray(_val$split, 2),
          min = _val$split2[0],
          max = _val$split2[1];
        return {
          min: min || "",
          max: max || ""
        };
      }
      return {
        min: val || "",
        max: ""
      };
    };
    _this7.state = parseValue(props.value);
    return _this7;
  }
  _inherits(NumberFilter, _React$Component6);
  return _createClass(NumberFilter, [{
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      if (prevProps.value !== this.props.value) {
        var parseValue = function parseValue(val) {
          if (!val) return {
            min: "",
            max: ""
          };
          if (typeof val === "string" && val.includes("-")) {
            var _val$split3 = val.split("-"),
              _val$split4 = _slicedToArray(_val$split3, 2),
              min = _val$split4[0],
              max = _val$split4[1];
            return {
              min: min || "",
              max: max || ""
            };
          }
          return {
            min: val || "",
            max: ""
          };
        };
        this.setState(parseValue(this.props.value));
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this8 = this;
      var placeholder = this.props.placeholder;
      var _this$state2 = this.state,
        min = _this$state2.min,
        max = _this$state2.max;
      return React.createElement("div", {
        style: {
          padding: "8px"
        }
      }, React.createElement("div", {
        style: {
          marginBottom: "8px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          color: this.props.dashboardConfig.COLORS_TEXT_PRIMARY,
          fontWeight: "500"
        }
      }, language.t("filter.numberFilter.title")), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }
      }, React.createElement("input", {
        type: "number",
        placeholder: language.t("filter.numberFilter.minPlaceholder"),
        value: min,
        onChange: function onChange(e) {
          return _this8.handleChange("min", e.target.value);
        },
        style: {
          flex: 1,
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      }), React.createElement("span", {
        style: {
          color: this.props.dashboardConfig.COLORS_TEXT_SECONDARY,
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE
        }
      }, language.t("common.to")), React.createElement("input", {
        type: "number",
        placeholder: language.t("filter.numberFilter.maxPlaceholder"),
        value: max,
        onChange: function onChange(e) {
          return _this8.handleChange("max", e.target.value);
        },
        style: {
          flex: 1,
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      })));
    }
  }]);
}(React.Component);
window.NumberFilter = NumberFilter;

// Date Filter Component - Date range filtering component
var DateFilter = /*#__PURE__*/function (_React$Component7) {
  function DateFilter(props) {
    var _this9;
    _classCallCheck(this, DateFilter);
    _this9 = _callSuper(this, DateFilter, [props]);
    // Parse existing value, supports timestamp format "startTimestamp,endTimestamp" or traditional date format
    _defineProperty(_this9, "handleChange", function (type, value) {
      var newState = _objectSpread(_objectSpread({}, _this9.state), {}, _defineProperty({}, type, value));
      _this9.setState(newState);
      // Build filter value - use timestamp as internal format
      var startDate = newState.startDate,
        endDate = newState.endDate;
      var filterValue = "";
      if (startDate && endDate) {
        var startTimestamp = new Date(startDate).getTime();
        var endTimestamp = new Date(endDate + "T23:59:59").getTime(); // End date includes whole day
        filterValue = "".concat(startTimestamp, ",").concat(endTimestamp);
      } else if (startDate) {
        var _startTimestamp = new Date(startDate).getTime();
        filterValue = "".concat(_startTimestamp, ","); // Only start date, no end limit
      } else if (endDate) {
        var _endTimestamp = new Date(endDate + "T23:59:59").getTime();
        filterValue = ",".concat(_endTimestamp); // Only end date, no start limit
      }
      _this9.props.onChange(filterValue);
    });
    var parseValue = function parseValue(val) {
      if (!val) return {
        startDate: "",
        endDate: ""
      };
      // Check if it's timestamp format
      if (typeof val === "string" && val.includes(",")) {
        var _val$split5 = val.split(","),
          _val$split6 = _slicedToArray(_val$split5, 2),
          startTs = _val$split6[0],
          endTs = _val$split6[1];
        var startDate = "";
        var endDate = "";
        if (startTs) {
          var startTimestamp = parseInt(startTs);
          if (!isNaN(startTimestamp)) {
            startDate = new Date(startTimestamp).toISOString().split("T")[0];
          }
        }
        if (endTs) {
          var endTimestamp = parseInt(endTs);
          if (!isNaN(endTimestamp)) {
            endDate = new Date(endTimestamp).toISOString().split("T")[0];
          }
        }
        return {
          startDate: startDate,
          endDate: endDate
        };
      }
      // Compatible with traditional format "startDate~endDate"
      if (typeof val === "string" && val.includes("~")) {
        var _val$split7 = val.split("~"),
          _val$split8 = _slicedToArray(_val$split7, 2),
          start = _val$split8[0],
          end = _val$split8[1];
        return {
          startDate: start || "",
          endDate: end || ""
        };
      }
      // Single date value
      return {
        startDate: val || "",
        endDate: ""
      };
    };
    _this9.state = parseValue(props.value);
    return _this9;
  }
  _inherits(DateFilter, _React$Component7);
  return _createClass(DateFilter, [{
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      if (prevProps.value !== this.props.value) {
        var parseValue = function parseValue(val) {
          if (!val) return {
            startDate: "",
            endDate: ""
          };
          // Check if it's timestamp format
          if (typeof val === "string" && val.includes(",")) {
            var _val$split9 = val.split(","),
              _val$split0 = _slicedToArray(_val$split9, 2),
              startTs = _val$split0[0],
              endTs = _val$split0[1];
            var startDate = "";
            var endDate = "";
            if (startTs) {
              var startTimestamp = parseInt(startTs);
              if (!isNaN(startTimestamp)) {
                startDate = new Date(startTimestamp).toISOString().split("T")[0];
              }
            }
            if (endTs) {
              var endTimestamp = parseInt(endTs);
              if (!isNaN(endTimestamp)) {
                endDate = new Date(endTimestamp).toISOString().split("T")[0];
              }
            }
            return {
              startDate: startDate,
              endDate: endDate
            };
          }
          // Compatible with traditional format "startDate~endDate"
          if (typeof val === "string" && val.includes("~")) {
            var _val$split1 = val.split("~"),
              _val$split10 = _slicedToArray(_val$split1, 2),
              start = _val$split10[0],
              end = _val$split10[1];
            return {
              startDate: start || "",
              endDate: end || ""
            };
          }
          // Single date value
          return {
            startDate: val || "",
            endDate: ""
          };
        };
        this.setState(parseValue(this.props.value));
      }
    }
  }, {
    key: "formatDateValue",
    value:
    // Validate and format date value - strict YYYY-MM-DD parsing
    function formatDateValue(dateValue) {
      if (!dateValue) return "";
      // Strict validation: only accept YYYY-MM-DD format
      var dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
      var match = dateValue.match(dateRegex);
      if (!match) {
        return ""; // Invalid format returns empty string
      }
      var _match = _slicedToArray(match, 4),
        year = _match[1],
        month = _match[2],
        day = _match[3];
      // Validate date ranges
      var yearNum = parseInt(year);
      var monthNum = parseInt(month);
      var dayNum = parseInt(day);
      if (yearNum < 1900 || yearNum > 2100) return "";
      if (monthNum < 1 || monthNum > 12) return "";
      if (dayNum < 1 || dayNum > 31) return "";
      // Additional validation using Date object
      var date = new Date(yearNum, monthNum - 1, dayNum);
      if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) {
        return ""; // Invalid date (e.g., Feb 30th)
      }
      return dateValue; // Return original YYYY-MM-DD format
    }
  }, {
    key: "render",
    value: function render() {
      var _this0 = this;
      var _this$state3 = this.state,
        startDate = _this$state3.startDate,
        endDate = _this$state3.endDate;
      return React.createElement("div", {
        style: {
          padding: "8px"
        }
      }, React.createElement("div", {
        style: {
          marginBottom: "8px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          color: this.props.dashboardConfig.COLORS_TEXT_PRIMARY,
          fontWeight: "500"
        }
      }, language.t("filter.dateFilter.title")), React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }
      }, React.createElement("input", {
        type: "date",
        placeholder: language.t("filter.dateFilter.startPlaceholder"),
        value: this.formatDateValue(startDate),
        onChange: function onChange(e) {
          return _this0.handleChange("startDate", e.target.value);
        },
        style: {
          width: "100%",
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      }), React.createElement("div", {
        style: {
          textAlign: "center",
          color: this.props.dashboardConfig.COLORS_TEXT_SECONDARY,
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE
        }
      }, language.t("common.to")), React.createElement("input", {
        type: "date",
        placeholder: language.t("filter.dateFilter.endPlaceholder"),
        value: this.formatDateValue(endDate),
        onChange: function onChange(e) {
          return _this0.handleChange("endDate", e.target.value);
        },
        style: {
          width: "100%",
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      })));
    }
  }]);
}(React.Component);
window.DateFilter = DateFilter;

// Time Filter Component - Time range filtering component
var TimeFilter = /*#__PURE__*/function (_React$Component8) {
  function TimeFilter(props) {
    var _this1;
    _classCallCheck(this, TimeFilter);
    _this1 = _callSuper(this, TimeFilter, [props]);
    // Parse existing value, supports timestamp format "startTimestamp,endTimestamp" or traditional time format
    _defineProperty(_this1, "handleChange", function (type, value) {
      var newState = _objectSpread(_objectSpread({}, _this1.state), {}, _defineProperty({}, type, value));
      _this1.setState(newState);
      // Build filter value - use timestamp as internal format
      var startTime = newState.startTime,
        endTime = newState.endTime;
      var filterValue = "";
      // Convert time to today's timestamp for comparison
      var today = new Date().toISOString().split("T")[0]; // Get today's date
      if (startTime && endTime) {
        var startTimestamp = new Date("".concat(today, "T").concat(startTime, ":00")).getTime();
        var endTimestamp = new Date("".concat(today, "T").concat(endTime, ":59")).getTime(); // Include whole minute
        filterValue = "".concat(startTimestamp, ",").concat(endTimestamp);
      } else if (startTime) {
        var _startTimestamp2 = new Date("".concat(today, "T").concat(startTime, ":00")).getTime();
        filterValue = "".concat(_startTimestamp2, ","); // Only start time, no end limit
      } else if (endTime) {
        var _endTimestamp2 = new Date("".concat(today, "T").concat(endTime, ":59")).getTime();
        filterValue = ",".concat(_endTimestamp2); // Only end time, no start limit
      }
      _this1.props.onChange(filterValue);
    });
    var parseValue = function parseValue(val) {
      if (!val) return {
        startTime: "",
        endTime: ""
      };
      // Check if it's timestamp format
      if (typeof val === "string" && val.includes(",")) {
        var _val$split11 = val.split(","),
          _val$split12 = _slicedToArray(_val$split11, 2),
          startTs = _val$split12[0],
          endTs = _val$split12[1];
        var startTime = "";
        var endTime = "";
        if (startTs) {
          var startTimestamp = parseInt(startTs);
          if (!isNaN(startTimestamp)) {
            startTime = new Date(startTimestamp).toTimeString().substr(0, 5);
          }
        }
        if (endTs) {
          var endTimestamp = parseInt(endTs);
          if (!isNaN(endTimestamp)) {
            endTime = new Date(endTimestamp).toTimeString().substr(0, 5);
          }
        }
        return {
          startTime: startTime,
          endTime: endTime
        };
      }
      // Compatible with traditional format "startTime~endTime"
      if (typeof val === "string" && val.includes("~")) {
        var _val$split13 = val.split("~"),
          _val$split14 = _slicedToArray(_val$split13, 2),
          start = _val$split14[0],
          end = _val$split14[1];
        return {
          startTime: start || "",
          endTime: end || ""
        };
      }
      // Single time value
      return {
        startTime: val || "",
        endTime: ""
      };
    };
    _this1.state = parseValue(props.value);
    return _this1;
  }
  _inherits(TimeFilter, _React$Component8);
  return _createClass(TimeFilter, [{
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      if (prevProps.value !== this.props.value) {
        var parseValue = function parseValue(val) {
          if (!val) return {
            startTime: "",
            endTime: ""
          };
          // Check if it's timestamp format
          if (typeof val === "string" && val.includes(",")) {
            var _val$split15 = val.split(","),
              _val$split16 = _slicedToArray(_val$split15, 2),
              startTs = _val$split16[0],
              endTs = _val$split16[1];
            var startTime = "";
            var endTime = "";
            if (startTs) {
              var startTimestamp = parseInt(startTs);
              if (!isNaN(startTimestamp)) {
                startTime = new Date(startTimestamp).toTimeString().substr(0, 5);
              }
            }
            if (endTs) {
              var endTimestamp = parseInt(endTs);
              if (!isNaN(endTimestamp)) {
                endTime = new Date(endTimestamp).toTimeString().substr(0, 5);
              }
            }
            return {
              startTime: startTime,
              endTime: endTime
            };
          }
          // Compatible with traditional format "startTime~endTime"
          if (typeof val === "string" && val.includes("~")) {
            var _val$split17 = val.split("~"),
              _val$split18 = _slicedToArray(_val$split17, 2),
              start = _val$split18[0],
              end = _val$split18[1];
            return {
              startTime: start || "",
              endTime: end || ""
            };
          }
          // Single time value
          return {
            startTime: val || "",
            endTime: ""
          };
        };
        this.setState(parseValue(this.props.value));
      }
    }
  }, {
    key: "formatTimeValue",
    value:
    // Validate and format time value - strict HH:mm parsing
    function formatTimeValue(timeValue) {
      if (!timeValue) return "";
      // Strict validation: only accept HH:mm format
      var timeRegex = /^(\d{2}):(\d{2})$/;
      var match = timeValue.match(timeRegex);
      if (!match) {
        return ""; // Invalid format returns empty string
      }
      var _match2 = _slicedToArray(match, 3),
        hours = _match2[1],
        minutes = _match2[2];
      // Validate time ranges
      var hoursNum = parseInt(hours);
      var minutesNum = parseInt(minutes);
      if (hoursNum < 0 || hoursNum > 23) return "";
      if (minutesNum < 0 || minutesNum > 59) return "";
      return timeValue; // Return original HH:mm format
    }
  }, {
    key: "render",
    value: function render() {
      var _this10 = this;
      var _this$state4 = this.state,
        startTime = _this$state4.startTime,
        endTime = _this$state4.endTime;
      return React.createElement("div", {
        style: {
          padding: "8px"
        }
      }, React.createElement("div", {
        style: {
          marginBottom: "8px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          color: this.props.dashboardConfig.COLORS_TEXT_PRIMARY,
          fontWeight: "500"
        }
      }, language.t("filter.timeFilter.title")), React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }
      }, React.createElement("input", {
        type: "time",
        placeholder: language.t("filter.timeFilter.startPlaceholder"),
        value: this.formatTimeValue(startTime),
        onChange: function onChange(e) {
          return _this10.handleChange("startTime", e.target.value);
        },
        style: {
          width: "100%",
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      }), React.createElement("div", {
        style: {
          textAlign: "center",
          color: this.props.dashboardConfig.COLORS_TEXT_SECONDARY,
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE
        }
      }, language.t("common.to")), React.createElement("input", {
        type: "time",
        placeholder: language.t("filter.timeFilter.endPlaceholder"),
        value: this.formatTimeValue(endTime),
        onChange: function onChange(e) {
          return _this10.handleChange("endTime", e.target.value);
        },
        style: {
          width: "100%",
          padding: "4px 8px",
          border: "1px solid ".concat(this.props.dashboardConfig.COLORS_BORDER),
          borderRadius: "4px",
          fontSize: this.props.dashboardConfig.BASE_FONT_SIZE,
          height: "calc(".concat(this.props.dashboardConfig.TABLE_CELL_HEIGHT, " - 2px)"),
          boxSizing: "border-box"
        }
      })));
    }
  }]);
}(React.Component);
window.TimeFilter = TimeFilter;

// Filter Popup Component - Filter popup component
var FilterPopup = /*#__PURE__*/function (_React$Component9) {
  function FilterPopup(props) {
    var _this11;
    _classCallCheck(this, FilterPopup);
    _this11 = _callSuper(this, FilterPopup, [props]);
    _defineProperty(_this11, "handleApply", function () {
      _this11.props.onChange(_this11.state.tempValue);
      _this11.closeWithAnimation();
    });
    _defineProperty(_this11, "handleClear", function () {
      _this11.setState({
        tempValue: ""
      });
      _this11.props.onChange("");
      _this11.closeWithAnimation();
    });
    _defineProperty(_this11, "closeWithAnimation", function () {
      // Set closing flag to prevent re-rendering during close process
      _this11.isClosing = true;
      if (!_this11.popupRef.current) {
        _this11.props.onClose();
        return;
      }
      var popupElement = _this11.popupRef.current;
      // Trigger close animation
      popupElement.style.opacity = "0";
      popupElement.style.transform = "scale(0.95)"; // Only keep scale, no position offset
      // Also trigger overlay fade out
      if (_this11.overlay) {
        _this11.overlay.style.backgroundColor = "rgba(0, 0, 0, 0)";
      }
      // Close popup after animation completes
      setTimeout(function () {
        _this11.props.onClose();
      }, 200); // Consistent with transition time
    });
    _this11.state = {
      tempValue: props.value || ""
    };
    _this11.popupRef = React.createRef();
    _this11.isClosing = false; // Flag to indicate if closing
    return _this11;
  }
  _inherits(FilterPopup, _React$Component9);
  return _createClass(FilterPopup, [{
    key: "componentDidMount",
    value: function componentDidMount() {
      // Detect if we're inside a modal by checking for modal container in DOM hierarchy
      var isInsideModal = this.isInsideModal();
      var baseZIndex = isInsideModal ? 10000 : 999; // Use higher z-index when inside modal
      // Create overlay and add to body
      this.overlay = document.createElement("div");
      this.overlay.style.cssText = "\n      position: fixed;\n      top: 0;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      z-index: ".concat(baseZIndex, ";\n      background-color: rgba(0, 0, 0, 0);\n      transition: background-color 0.2s ease;\n    ");
      this.overlay.addEventListener("click", this.closeWithAnimation);
      document.body.appendChild(this.overlay);
      // Create popup container and add to body
      this.popupContainer = document.createElement("div");
      this.popupContainer.style.cssText = "\n      position: fixed;\n      top: 0;\n      left: 0;\n      z-index: ".concat(baseZIndex + 1, ";\n      pointer-events: none;\n    ");
      document.body.appendChild(this.popupContainer);
      // Initial render of popup content
      this.renderPopupToBody();
    }
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      // If closing, don't re-render
      if (this.isClosing) return;
      // Only re-render and recalculate position when position-related props change
      if (prevProps.position !== this.props.position || prevProps.buttonRect !== this.props.buttonRect || prevProps.column !== this.props.column) {
        this.renderPopupToBody();
      } else {
        // If only content changes (like value), only update content, don't recalculate position
        this.updatePopupContent();
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      // Clean up overlay and popup container
      if (this.overlay) {
        this.overlay.removeEventListener("click", this.closeWithAnimation);
        document.body.removeChild(this.overlay);
      }
      if (this.popupContainer) {
        document.body.removeChild(this.popupContainer);
      }
    }
    // Check if FilterPopup is rendered inside a modal
  }, {
    key: "isInsideModal",
    value: function isInsideModal() {
      // Check if there's a modal overlay in the DOM (indicating a modal is open)
      var modalOverlay = document.querySelector(".card-modal-overlay");
      return modalOverlay !== null;
    }
  }, {
    key: "updatePopupContent",
    value: function updatePopupContent() {
      var _this$props$dashboard, _this$props$dashboard2;
      if (!this.popupContainer || !this.popupRef.current) return;
      // Only update popup content, maintain current position and styles
      var popupElement = this.popupRef.current;
      var currentStyles = {
        position: popupElement.style.position,
        top: popupElement.style.top,
        left: popupElement.style.left,
        opacity: popupElement.style.opacity,
        transform: popupElement.style.transform,
        transition: popupElement.style.transition
      };
      var popupContent = React.createElement("div", {
        ref: this.popupRef,
        style: {
          position: currentStyles.position || "fixed",
          top: currentStyles.top,
          left: currentStyles.left,
          backgroundColor: UTILS.getOpaqueBackgroundColor(),
          color: "var(--color-text-primary, #1f2937)",
          border: "1px solid ".concat(((_this$props$dashboard = this.props.dashboardConfig) === null || _this$props$dashboard === void 0 ? void 0 : _this$props$dashboard.COLORS_BORDER) || "#ddd"),
          borderRadius: "6px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          minWidth: "200px",
          pointerEvents: "auto",
          opacity: currentStyles.opacity || "1",
          transform: currentStyles.transform || "scale(1)",
          transition: currentStyles.transition || "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
        }
      }, this.renderFilterContent(), React.createElement("div", {
        style: {
          padding: "8px",
          borderTop: "1px solid ".concat(((_this$props$dashboard2 = this.props.dashboardConfig) === null || _this$props$dashboard2 === void 0 ? void 0 : _this$props$dashboard2.COLORS_BORDER) || "#eee"),
          display: "flex",
          justifyContent: "space-between",
          gap: "8px"
        }
      }, React.createElement("button", {
        onClick: this.handleClear,
        className: "filter-popup-button filter-popup-button-clear"
      }, language.t("common.clear")), React.createElement("button", {
        onClick: this.handleApply,
        className: "filter-popup-button filter-popup-button-apply"
      }, language.t("common.apply"))));
      ReactDOM.render(popupContent, this.popupContainer);
    }
  }, {
    key: "renderPopupToBody",
    value: function renderPopupToBody() {
      var _this$props$dashboard3,
        _this$props$dashboard4,
        _this12 = this;
      if (!this.popupContainer) return;
      var position = this.props.position;
      // Use ReactDOM.render to render popup content to body container
      var popupContent = React.createElement("div", {
        ref: this.popupRef,
        style: {
          position: "fixed",
          top: position.top + "px",
          left: position.left + "px",
          backgroundColor: UTILS.getOpaqueBackgroundColor(),
          color: "var(--color-text-primary, #1f2937)",
          border: "1px solid ".concat(((_this$props$dashboard3 = this.props.dashboardConfig) === null || _this$props$dashboard3 === void 0 ? void 0 : _this$props$dashboard3.COLORS_BORDER) || "#ddd"),
          borderRadius: "6px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          minWidth: "200px",
          pointerEvents: "auto",
          opacity: 0,
          // Initially transparent
          transform: "scale(0.95)",
          // Initial scale, no position offset
          transition: "none" // No transition effect initially
        }
      }, this.renderFilterContent(), React.createElement("div", {
        style: {
          padding: "8px",
          borderTop: "1px solid ".concat(((_this$props$dashboard4 = this.props.dashboardConfig) === null || _this$props$dashboard4 === void 0 ? void 0 : _this$props$dashboard4.COLORS_BORDER) || "#eee"),
          display: "flex",
          justifyContent: "space-between",
          gap: "8px"
        }
      }, React.createElement("button", {
        onClick: this.handleClear,
        className: "filter-popup-button filter-popup-button-clear"
      }, language.t("common.clear")), React.createElement("button", {
        onClick: this.handleApply,
        className: "filter-popup-button filter-popup-button-apply"
      }, language.t("common.apply"))));
      ReactDOM.render(popupContent, this.popupContainer);
      // Use setTimeout to ensure DOM rendering is complete before getting dimensions
      setTimeout(function () {
        _this12.adjustPopupPosition();
      }, 0);
    }
  }, {
    key: "adjustPopupPosition",
    value: function adjustPopupPosition() {
      var _this13 = this;
      if (!this.popupRef.current) return;
      var popupElement = this.popupRef.current;
      var _this$props3 = this.props,
        position = _this$props3.position,
        buttonRect = _this$props3.buttonRect,
        dashboardConfig = _this$props3.dashboardConfig;
      // Get actual popup dimensions
      var popupRect = popupElement.getBoundingClientRect();
      var popupWidth = popupRect.width;
      var popupHeight = popupRect.height;
      // Get container padding configuration
      var containerPadding = dashboardConfig.GRID_CONTAINER_PADDING[0];
      // Viewport dimensions
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      // Recalculate position
      var buttonCenterX = buttonRect.left + buttonRect.width / 2;
      var finalLeft = buttonCenterX - popupWidth / 2;
      var finalTop = buttonRect.bottom + 12;
      // Horizontal position adjustment
      finalLeft = Math.max(containerPadding, Math.min(finalLeft, viewportWidth - popupWidth - containerPadding));
      // Vertical position adjustment - if not enough space below, show above button
      if (finalTop + popupHeight > viewportHeight - containerPadding) {
        finalTop = buttonRect.top - popupHeight - 12;
        // If not enough space above either, force display below but adjust within bounds
        if (finalTop < containerPadding) {
          finalTop = Math.max(containerPadding, viewportHeight - popupHeight - containerPadding);
        }
      }
      // Apply final position
      popupElement.style.left = finalLeft + "px";
      popupElement.style.top = finalTop + "px";
      // Use requestAnimationFrame to ensure position is set before enabling transition and triggering animation
      requestAnimationFrame(function () {
        // Enable transition effect
        popupElement.style.transition = "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
        // Trigger show animation
        popupElement.style.opacity = "1";
        popupElement.style.transform = "scale(1)"; // Only keep scale, no position offset
        // Also trigger overlay fade-in effect (optional light background)
        if (_this13.overlay) {
          _this13.overlay.style.backgroundColor = "rgba(0, 0, 0, 0.02)";
        }
      });
    }
  }, {
    key: "renderFilterContent",
    value: function renderFilterContent() {
      var _this14 = this;
      var column = this.props.column;
      var tempValue = this.state.tempValue;
      var handleChange = function handleChange(value) {
        _this14.setState({
          tempValue: value
        });
      };
      switch (column.dataType) {
        case "number":
          return React.createElement(NumberFilter, {
            value: tempValue,
            onChange: handleChange,
            placeholder: "".concat(language.t("filter.numberFilter.title"), " ").concat(column.title),
            dashboardConfig: this.props.dashboardConfig
          });
        case "date":
          return React.createElement(DateFilter, {
            value: tempValue,
            onChange: handleChange,
            dashboardConfig: this.props.dashboardConfig
          });
        case "time":
          return React.createElement(TimeFilter, {
            value: tempValue,
            onChange: handleChange,
            dashboardConfig: this.props.dashboardConfig
          });
        case "string":
        default:
          return React.createElement(StringFilter, {
            value: tempValue,
            onChange: handleChange,
            placeholder: "".concat(language.t("filter.stringFilter.placeholder"), " ").concat(column.title),
            dashboardConfig: this.props.dashboardConfig
          });
      }
    }
  }, {
    key: "render",
    value: function render() {
      // Popup content is rendered to body via DOM manipulation, return null here
      return null;
    }
  }]);
}(React.Component);
window.FilterPopup = FilterPopup;

// Metric card - Suitable for displaying single key business metrics and change trends
var MetricCard = /*#__PURE__*/function (_React$Component0) {
  function MetricCard(props) {
    _classCallCheck(this, MetricCard);
    return _callSuper(this, MetricCard, [props]);
  }
  _inherits(MetricCard, _React$Component0);
  return _createClass(MetricCard, [{
    key: "getMetricThemeConfig",
    value: function getMetricThemeConfig() {
      var config = this.props.dashboardConfig;
      var baseFontSize = parseFloat(config.BASE_FONT_SIZE);
      var numberCardGap = parseFloat(config.CARD_GAP);
      return {
        BASE_NUMBER_FONT_SIZE: baseFontSize,
        NUMBER_CARD_GAP: numberCardGap,
        ICON_TYPE: config.METRIC_CARD_ICON_TYPE || "circle",
        FONT_SIZE: "".concat(baseFontSize, "px"),
        ICON_FONT_SIZE: "".concat(baseFontSize * 1.5, "px"),
        VALUE_FONT_SIZE: "".concat(baseFontSize * 2, "px"),
        UNIT_FONT_SIZE: "".concat(baseFontSize * 1, "px"),
        CHANGE_FONT_SIZE: "".concat(baseFontSize * 1, "px"),
        ELEMENT_GAP: "".concat(numberCardGap * 0.25, "px"),
        TEXT_PRIMARY: config.COLORS_TEXT_PRIMARY,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY,
        PRIMARY: config.COLORS_PRIMARY,
        SUCCESS: config.COLORS_SUCCESS,
        ERROR: config.COLORS_ERROR,
        WARNING: config.COLORS_WARNING
      };
    }
  }, {
    key: "parseUnifiedData",
    value: function parseUnifiedData(data) {
      if (data && data.label && data.value !== undefined) {
        return data;
      }
      return {
        label: null,
        value: 0,
        change: "",
        unit: "",
        icon: ""
      };
    }
  }, {
    key: "getChangeType",
    value: function getChangeType(change) {
      if (!change) return "neutral";
      if (typeof change === "string") {
        return change.startsWith("+") ? "positive" : change.startsWith("-") ? "negative" : "neutral";
      }
      if (typeof change === "number") {
        return change > 0 ? "positive" : change < 0 ? "negative" : "neutral";
      }
      return "neutral";
    }
    // Render icon - Support tabler-icons and emoji
  }, {
    key: "renderIcon",
    value: function renderIcon(icon, iconColor, themeConfig) {
      if (!icon) return null;
      var isCircleMode = themeConfig.ICON_TYPE === "circle";
      if (isCircleMode) {
        return this.renderCircleIcon(icon, iconColor, themeConfig);
      } else {
        return this.renderNormalIcon(icon, iconColor, themeConfig);
      }
    }
    // Render circle mode icon with background and shadow
  }, {
    key: "renderCircleIcon",
    value: function renderCircleIcon(icon, iconColor, themeConfig) {
      var iconSize = "".concat(themeConfig.BASE_NUMBER_FONT_SIZE * 1.75, "px");
      var numberIconSize = parseFloat(iconSize);
      var circleSize = numberIconSize * 2;
      var containerStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "".concat(circleSize, "px"),
        height: "".concat(circleSize, "px"),
        borderRadius: "50%",
        background: window.UTILS.getCircleGradientBackground(iconColor, themeConfig.PRIMARY),
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)"
      };
      return React.createElement("div", {
        style: containerStyle
      }, this.createIconElement(icon, iconSize, "white"));
    }
    // Render normal mode icon without background
  }, {
    key: "renderNormalIcon",
    value: function renderNormalIcon(icon, iconColor, themeConfig) {
      var iconSize = themeConfig.ICON_FONT_SIZE;
      var numberIconSize = parseFloat(iconSize);
      var iconColorStyle = iconColor || themeConfig.TEXT_PRIMARY;
      var containerStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "".concat(numberIconSize, "px"),
        height: "".concat(numberIconSize, "px")
      };
      return React.createElement("div", {
        style: containerStyle
      }, this.createIconElement(icon, iconSize, iconColorStyle));
    }
    // Create icon element (tabler-icons or emoji/text)
  }, {
    key: "createIconElement",
    value: function createIconElement(icon, iconSize, iconColor) {
      var isTablerIcon = typeof icon === "string" && icon.startsWith("ti-");
      if (isTablerIcon) {
        return React.createElement("i", {
          className: "ti ".concat(icon),
          style: {
            fontSize: iconSize,
            color: iconColor
          }
        });
      }
      // Render emoji or other characters
      return React.createElement("div", {
        style: {
          fontSize: iconSize,
          color: iconColor
        }
      }, icon);
    }
    // Render empty state when no data is provided
  }, {
    key: "renderEmptyState",
    value: function renderEmptyState(themeConfig) {
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.FONT_SIZE
        }
      }, null);
    }
    // Build array of elements to render
  }, {
    key: "buildRenderElements",
    value: function buildRenderElements(parsedData, themeConfig) {
      var icon = parsedData.icon,
        iconColor = parsedData.iconColor;
      var elements = [];
      var isCircleMode = themeConfig.ICON_TYPE === "circle";
      // Add icon container if icon exists
      if (icon) {
        elements.push({
          key: "metric-icon-container",
          element: this.renderIconContainer(icon, iconColor, themeConfig)
        });
      }
      // Add spacer div for circle mode
      if (isCircleMode && icon) {
        elements.push({
          key: "metric-spacer",
          element: this.renderSpacer(themeConfig)
        });
      }
      // Add content container
      elements.push({
        key: "metric-content-container",
        element: this.renderContentContainer(parsedData, themeConfig)
      });
      return elements.filter(Boolean);
    }
    // Render icon container
  }, {
    key: "renderIconContainer",
    value: function renderIconContainer(icon, iconColor, themeConfig) {
      return React.createElement("div", {
        style: {
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }
      }, this.renderIcon(icon, iconColor, themeConfig));
    }
    // Render spacer div for circle mode
  }, {
    key: "renderSpacer",
    value: function renderSpacer(themeConfig) {
      return React.createElement("div", {
        className: "metric-spacer",
        style: {
          width: "20%",
          maxWidth: themeConfig.NUMBER_CARD_GAP * 2,
          minWidth: themeConfig.NUMBER_CARD_GAP / 2
        }
      });
    }
    // Render content container with value, label, and change
  }, {
    key: "renderContentContainer",
    value: function renderContentContainer(parsedData, themeConfig) {
      var change = parsedData.change,
        value = parsedData.value,
        unit = parsedData.unit,
        label = parsedData.label;
      var isCircleMode = themeConfig.ICON_TYPE === "circle";
      return React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: isCircleMode ? "flex-start" : "center",
          gap: themeConfig.ELEMENT_GAP,
          maxWidth: "100%",
          overflow: isCircleMode ? "hidden" : undefined
        }
      }, [this.renderValueLabelContainer(value, unit, label, themeConfig), change && this.renderChangeIndicator(change, themeConfig)].filter(Boolean));
    }
    // Render value and label container
  }, {
    key: "renderValueLabelContainer",
    value: function renderValueLabelContainer(value, unit, label, themeConfig) {
      var isCircleMode = themeConfig.ICON_TYPE === "circle";
      var isNormalMode = themeConfig.ICON_TYPE === "normal";
      return React.createElement("div", {
        key: "metric-value-label-container",
        style: {
          display: "flex",
          flexDirection: isNormalMode ? "column" : "column-reverse",
          alignItems: "center",
          gap: themeConfig.ELEMENT_GAP,
          width: "100%",
          textAlign: isCircleMode ? "left" : "center"
        }
      }, [this.renderValueWithUnit(value, unit, themeConfig), this.renderLabel(label, themeConfig)]);
    }
    // Render value with unit
  }, {
    key: "renderValueWithUnit",
    value: function renderValueWithUnit(value, unit, themeConfig) {
      var isCircleMode = themeConfig.ICON_TYPE === "circle";
      return React.createElement("div", {
        key: "metric-value",
        style: {
          fontSize: themeConfig.VALUE_FONT_SIZE,
          fontWeight: "bold",
          display: "flex",
          alignItems: "baseline",
          justifyContent: isCircleMode ? "flex-start" : "center",
          gap: "2px",
          width: "100%"
        }
      }, [
      // Value
      React.createElement("span", {
        key: "value",
        style: {
          color: themeConfig.PRIMARY,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%"
        },
        title: value
      }, value),
      // Unit
      unit && React.createElement("span", {
        key: "unit",
        style: {
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.UNIT_FONT_SIZE,
          fontWeight: "normal",
          whiteSpace: "nowrap"
        }
      }, unit)].filter(Boolean));
    }
    // Render label
  }, {
    key: "renderLabel",
    value: function renderLabel(label, themeConfig) {
      return React.createElement("div", {
        key: "metric-label",
        style: {
          color: themeConfig.TEXT_PRIMARY,
          fontSize: themeConfig.FONT_SIZE,
          fontWeight: "bold",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          width: "100%"
        },
        title: label
      }, label);
    }
    // Render change indicator
  }, {
    key: "renderChangeIndicator",
    value: function renderChangeIndicator(change, themeConfig) {
      var type = this.getChangeType(change);
      var changeColor = type === "positive" ? themeConfig.SUCCESS : type === "negative" ? themeConfig.ERROR : themeConfig.TEXT_SECONDARY;
      return React.createElement("div", {
        key: "metric-change",
        style: {
          fontSize: themeConfig.CHANGE_FONT_SIZE,
          fontWeight: "500",
          color: changeColor,
          textAlign: "center"
        }
      }, change);
    }
    // Get container style based on icon type
  }, {
    key: "getContainerStyle",
    value: function getContainerStyle(themeConfig) {
      var isNormalMode = themeConfig.ICON_TYPE === "normal";
      return {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: isNormalMode ? "column" : "row",
        justifyContent: "center",
        alignItems: "center",
        gap: isNormalMode ? themeConfig.ELEMENT_GAP : undefined
      };
    }
  }, {
    key: "render",
    value: function render() {
      var data = this.props.data;
      var themeConfig = this.getMetricThemeConfig();
      if (!data) {
        return this.renderEmptyState(themeConfig);
      }
      var parsedData = this.parseUnifiedData(data);
      var elements = this.buildRenderElements(parsedData, themeConfig);
      var containerStyle = this.getContainerStyle(themeConfig);
      return React.createElement("div", {
        style: containerStyle
      }, elements.map(function (item) {
        return React.createElement(React.Fragment, {
          key: item.key
        }, item.element);
      }));
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(data) {
        return _regenerator().w(function (_context) {
          while (1) switch (_context.n) {
            case 0:
              return _context.a(2, data);
          }
        }, _callee);
      }));
      function preprocessData(_x) {
        return _preprocessData.apply(this, arguments);
      }
      return preprocessData;
    }()
  }]);
}(React.Component);
window.MetricCard = MetricCard;

// KPI indicator card - Specifically for displaying key performance indicators, supports multiple indicators display and target value comparison
var KPICard = /*#__PURE__*/function (_React$Component1) {
  function KPICard(props) {
    _classCallCheck(this, KPICard);
    return _callSuper(this, KPICard, [props]);
  }
  _inherits(KPICard, _React$Component1);
  return _createClass(KPICard, [{
    key: "getKPIThemeConfig",
    value: function getKPIThemeConfig() {
      var config = this.props.dashboardConfig;
      var baseFontSize = parseFloat(config.BASE_FONT_SIZE);
      var iconSize = "".concat(baseFontSize * 1.25, "px");
      return {
        FONT_SIZE: "".concat(baseFontSize, "px"),
        LABEL_FONT_SIZE_FIRST: "".concat(baseFontSize * 1.5, "px"),
        VALUE_FONT_SIZE_FIRST: "".concat(baseFontSize * 1.5, "px"),
        ICON_SIZE_FIRST: iconSize,
        LABEL_FONT_SIZE: "".concat(baseFontSize, "px"),
        VALUE_FONT_SIZE: "".concat(baseFontSize, "px"),
        ICON_SIZE: iconSize,
        UNIT_FONT_SIZE: "".concat(baseFontSize, "px"),
        ELEMENT_GAP: "".concat(parseFloat(config.CARD_GAP) * 0.75, "px"),
        ICON_GAP: "".concat(parseFloat(config.CARD_GAP) * 0.75, "px"),
        CELL_PADDING_RIGHT: "5em",
        TEXT_PRIMARY: config.COLORS_TEXT_PRIMARY,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY,
        SUCCESS: config.COLORS_SUCCESS,
        ERROR: config.COLORS_ERROR,
        WARNING: config.COLORS_WARNING,
        PRIMARY: config.COLORS_PRIMARY
      };
    }
  }, {
    key: "validateIconDuplication",
    value:
    // Validate icon duplication and collect warnings
    function validateIconDuplication(indicators) {
      var _this15 = this;
      if (!indicators || !Array.isArray(indicators)) return;
      var iconCounts = {};
      var duplicatedIcons = [];
      // Count icon occurrences
      indicators.forEach(function (indicator, index) {
        if (indicator.icon) {
          var icon = indicator.icon;
          if (!iconCounts[icon]) {
            iconCounts[icon] = [];
          }
          iconCounts[icon].push(index);
        }
      });
      // Find duplicated icons
      Object.entries(iconCounts).forEach(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
          icon = _ref2[0],
          indices = _ref2[1];
        if (indices.length >= 2) {
          duplicatedIcons.push({
            icon: icon,
            count: indices.length,
            positions: indices.map(function (i) {
              return i + 1;
            }).join(", ") // Convert to 1-based indexing
          });
        }
      });
      // Collect warnings to ErrorCollector
      if (duplicatedIcons.length > 0 && window.ErrorCollector) {
        duplicatedIcons.forEach(function (_ref3) {
          var icon = _ref3.icon,
            count = _ref3.count,
            positions = _ref3.positions;
          var warningMessage = language.t("warning.kpiDuplicateIcon", "KPI card has duplicate icon '{icon}' used {count} times at positions: {positions}. Consider using different icons for better visual distinction.", {
            icon: icon,
            count: count,
            positions: positions
          });
          window.ErrorCollector.collectWarning({
            type: "KPI_CONFIG_WARNING",
            category: "COMPONENT_RENDER",
            message: warningMessage,
            details: {
              cardId: _this15.props.cardId,
              cardType: "KPICard",
              duplicatedIcon: icon,
              count: count,
              positions: positions
            },
            source: "KPICard"
          });
        });
      }
      return duplicatedIcons;
    }
    // Parse data format
  }, {
    key: "parseUnifiedData",
    value: function parseUnifiedData(data) {
      // If already in correct format, return directly
      if (data && data.indicators) {
        return data;
      }
      // If not in correct format, return empty data
      return {
        indicators: []
      };
    }
  }, {
    key: "getKPIStatus",
    value: function getKPIStatus(value, target) {
      if (!target) return "good";
      var ratio = value / target;
      if (ratio >= 0.9) return "excellent";
      if (ratio >= 0.7) return "good";
      if (ratio >= 0.5) return "warning";
      return "danger";
    }
    // Format numeric display
  }, {
    key: "formatValue",
    value: function formatValue(value) {
      if (typeof value === "string") return value;
      if (value >= 100000000) {
        return (value / 100000000).toFixed(2) + "亿";
      }
      if (value >= 10000) {
        return (value / 10000).toFixed(2) + "万";
      }
      return value.toLocaleString();
    }
    // Render icon - Support tabler-icons and emoji
  }, {
    key: "renderIcon",
    value: function renderIcon(icon, iconSize, iconColor) {
      if (!icon) return null;
      var themeConfig = this.getKPIThemeConfig();
      // Parse main indicator (first row) icon size value (remove px unit)
      var mainIconSizeValue = parseFloat(themeConfig.ICON_SIZE_FIRST);
      // Create icon container style - All icon containers use main indicator size
      var containerStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "".concat(mainIconSizeValue, "px"),
        height: "".concat(mainIconSizeValue, "px")
      };
      // Use configured icon color or default color
      var iconColorStyle = iconColor || this.getKPIThemeConfig().TEXT_PRIMARY;
      // Check if it's a tabler-icons class name (starts with ti-)
      if (typeof icon === "string" && icon.startsWith("ti-")) {
        return React.createElement("div", {
          style: containerStyle
        }, React.createElement("i", {
          className: "ti ".concat(icon),
          style: {
            fontSize: iconSize,
            color: iconColorStyle
          }
        }));
      }
      // Otherwise render in original way (emoji or other characters)
      return React.createElement("div", {
        style: containerStyle
      }, React.createElement("span", {
        style: {
          fontSize: iconSize,
          color: iconColorStyle
        }
      }, icon));
    }
  }, {
    key: "renderKPIRow",
    value: function renderKPIRow(kpi, index) {
      var label = kpi.label,
        value = kpi.value,
        target = kpi.target,
        _kpi$unit = kpi.unit,
        unit = _kpi$unit === void 0 ? "" : _kpi$unit,
        icon = kpi.icon,
        iconColor = kpi.iconColor;
      var status = this.getKPIStatus(value, target);
      var themeConfig = this.getKPIThemeConfig();
      // Status colors
      var getStatusColor = function getStatusColor(status) {
        var statusColors = {
          excellent: themeConfig.SUCCESS,
          good: themeConfig.PRIMARY,
          warning: themeConfig.WARNING,
          danger: themeConfig.ERROR
        };
        return statusColors[status] || themeConfig.TEXT_PRIMARY;
      };
      // First row uses larger font
      var isFirst = index === 0;
      var fontSize = isFirst ? themeConfig.LABEL_FONT_SIZE_FIRST : themeConfig.LABEL_FONT_SIZE;
      var valueFontSize = isFirst ? themeConfig.VALUE_FONT_SIZE_FIRST : themeConfig.VALUE_FONT_SIZE;
      var iconSize = isFirst ? themeConfig.ICON_SIZE_FIRST : themeConfig.ICON_SIZE;
      return React.createElement("tr", {
        key: "kpi-row-".concat(index)
      }, [
      // Left cell: icon and label
      React.createElement("td", {
        key: "label-cell",
        style: {
          textAlign: "left",
          verticalAlign: "middle",
          paddingRight: themeConfig.CELL_PADDING_RIGHT,
          whiteSpace: "nowrap"
        }
      }, React.createElement("div", {
        key: "label-content",
        style: {
          display: "flex",
          alignItems: "center",
          gap: themeConfig.ICON_GAP
        }
      }, [
      // Icon (if any)
      icon && this.renderIcon(icon, iconSize, iconColor),
      // Label
      React.createElement("span", {
        key: "label",
        style: {
          fontSize: fontSize,
          fontWeight: isFirst ? "bold" : "500",
          // Label bold, first row bolder
          color: isFirst ? themeConfig.TEXT_PRIMARY : themeConfig.TEXT_SECONDARY
        }
      }, label)])),
      // Right cell: value
      React.createElement("td", {
        key: "value-cell",
        style: {
          textAlign: "right",
          verticalAlign: "middle",
          whiteSpace: "nowrap"
        }
      }, React.createElement("div", {
        key: "value",
        style: {
          display: "flex",
          alignItems: "baseline",
          justifyContent: "flex-end",
          gap: "2px"
        }
      }, [
      // Value - Use status color
      React.createElement("span", {
        key: "value",
        style: {
          fontSize: valueFontSize,
          fontWeight: "bold",
          color: getStatusColor(status)
        }
      }, this.formatValue(value)),
      // Unit - Use light color
      unit && React.createElement("span", {
        key: "unit",
        style: {
          fontSize: themeConfig.UNIT_FONT_SIZE,
          fontWeight: "normal",
          color: themeConfig.TEXT_SECONDARY,
          whiteSpace: "nowrap"
        }
      }, unit)]))]);
    }
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      // Validate icon duplication when component mounts
      if (this.props.data) {
        var parsedData = this.parseUnifiedData(this.props.data);
        var _parsedData$indicator = parsedData.indicators,
          indicators = _parsedData$indicator === void 0 ? [] : _parsedData$indicator;
        this.validateIconDuplication(indicators);
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this16 = this;
      var data = this.props.data;
      var themeConfig = this.getKPIThemeConfig();
      if (!data) {
        return React.createElement("div", {
          style: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: themeConfig.TEXT_SECONDARY,
            fontSize: themeConfig.FONT_SIZE
          }
        }, null);
      }
      var parsedData = this.parseUnifiedData(data);
      var _parsedData$indicator2 = parsedData.indicators,
        indicators = _parsedData$indicator2 === void 0 ? [] : _parsedData$indicator2;
      return React.createElement("div", {
        style: {
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }
      }, React.createElement("table", {
        style: {
          width: "auto",
          borderCollapse: "separate",
          // Change to separate to support border-spacing
          borderSpacing: "0 0",
          // Remove original spacing, use spacing rows for control
          margin: "0 auto"
        }
      }, React.createElement("tbody", {
        key: "kpi-tbody"
      }, indicators.map(function (indicator, index) {
        return [_this16.renderKPIRow(indicator, index),
        // Add spacing rows for all indicators except the last one
        index < indicators.length - 1 && React.createElement("tr", {
          key: "spacer-".concat(index),
          style: {
            height: themeConfig.ELEMENT_GAP
          }
        })];
      }).flat().filter(Boolean))));
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(data) {
        return _regenerator().w(function (_context2) {
          while (1) switch (_context2.n) {
            case 0:
              return _context2.a(2, data);
          }
        }, _callee2);
      }));
      function preprocessData(_x2) {
        return _preprocessData2.apply(this, arguments);
      }
      return preprocessData;
    }()
  }]);
}(React.Component);
window.KPICard = KPICard;

// Text card - Suitable for displaying text content, supports multiple paragraphs and custom styles
var TextCard = /*#__PURE__*/function (_React$Component10) {
  function TextCard(props) {
    _classCallCheck(this, TextCard);
    return _callSuper(this, TextCard, [props]);
  }
  _inherits(TextCard, _React$Component10);
  return _createClass(TextCard, [{
    key: "getTextThemeConfig",
    value: function getTextThemeConfig() {
      var config = this.props.dashboardConfig;
      return {
        FONT_SIZE: config.BASE_FONT_SIZE,
        FONT_FAMILY: config.BODY_FONT_FAMILY,
        LINE_HEIGHT: "1.5",
        PARAGRAPH_MARGIN_BOTTOM: config.CARD_GAP,
        CODE_PADDING: config.CARD_GAP,
        CODE_BORDER_RADIUS: config.CARD_BORDER_RADIUS,
        TEXT_PRIMARY: config.COLORS_TEXT_PRIMARY,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY,
        PRIMARY: config.COLORS_PRIMARY,
        CODE_BACKGROUND: "rgba(64, 158, 255, 0.1)"
      };
    }
  }, {
    key: "parseUnifiedData",
    value: function parseUnifiedData(data) {
      if (typeof data === "string") {
        return {
          content: [data]
        };
      }
      if (data && data.content && Array.isArray(data.content)) {
        return data;
      }
      // Ensure content is an array
      if (data && data.content && !Array.isArray(data.content)) {
        return _objectSpread(_objectSpread({}, data), {}, {
          content: [data.content]
        });
      }
      // If not in correct format, return default data
      var themeConfig = this.getTextThemeConfig();
      return {
        content: [],
        textAlign: "left",
        fontSize: themeConfig.FONT_SIZE,
        color: themeConfig.TEXT_PRIMARY,
        fontWeight: "normal",
        lineHeight: themeConfig.LINE_HEIGHT
      };
    }
  }, {
    key: "renderTextContent",
    value: function renderTextContent(content) {
      if (!Array.isArray(content)) return null;
      var themeConfig = this.getTextThemeConfig();
      return content.map(function (text, index) {
        return React.createElement("div", {
          key: index,
          style: {
            marginBottom: index < content.length - 1 ? themeConfig.PARAGRAPH_MARGIN_BOTTOM : "0"
          }
        }, text);
      });
    }
  }, {
    key: "parseSimpleMarkdown",
    value: function parseSimpleMarkdown(text) {
      // Simple markup parsing: **bold**, *italic*, `code`
      var parts = [];
      var partIndex = 0;
      var themeConfig = this.getTextThemeConfig();
      // Handle bold **text**
      text = text.replace(/\*\*(.*?)\*\*/g, function (match, content, offset) {
        var placeholder = "__BOLD_".concat(partIndex, "__");
        parts[partIndex] = React.createElement("strong", {
          key: "bold-".concat(partIndex)
        }, content);
        partIndex++;
        return placeholder;
      });
      // Handle italic *text*
      text = text.replace(/\*(.*?)\*/g, function (match, content, offset) {
        var placeholder = "__ITALIC_".concat(partIndex, "__");
        parts[partIndex] = React.createElement("em", {
          key: "italic-".concat(partIndex)
        }, content);
        partIndex++;
        return placeholder;
      });
      // Handle code `text`
      text = text.replace(/`(.*?)`/g, function (match, content, offset) {
        var placeholder = "__CODE_".concat(partIndex, "__");
        parts[partIndex] = React.createElement("code", {
          key: "code-".concat(partIndex),
          style: {
            backgroundColor: themeConfig.CODE_BACKGROUND,
            padding: themeConfig.CODE_PADDING,
            borderRadius: themeConfig.CODE_BORDER_RADIUS,
            fontSize: "0.9em",
            fontFamily: "monospace"
          }
        }, content);
        partIndex++;
        return placeholder;
      });
      // Handle line breaks
      var lines = text.split("\n");
      var result = [];
      lines.forEach(function (line, lineIndex) {
        var lineParts = [];
        var lastIndex = 0;
        // Replace placeholders
        line.replace(/__(\w+)_(\d+)__/g, function (match, type, index, offset) {
          if (offset > lastIndex) {
            lineParts.push(line.slice(lastIndex, offset));
          }
          lineParts.push(parts[parseInt(index)]);
          lastIndex = offset + match.length;
          return match;
        });
        if (lastIndex < line.length) {
          lineParts.push(line.slice(lastIndex));
        }
        result.push(React.createElement("div", {
          key: "line-".concat(lineIndex)
        }, lineParts.length > 0 ? lineParts : line));
      });
      return result;
    }
  }, {
    key: "render",
    value: function render() {
      var data = this.props.data;
      var themeConfig = this.getTextThemeConfig();
      if (!data) {
        return React.createElement("div", {
          style: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: themeConfig.TEXT_SECONDARY,
            fontSize: themeConfig.FONT_SIZE
          }
        }, null);
      }
      var parsedData = this.parseUnifiedData(data);
      var _parsedData$content = parsedData.content,
        content = _parsedData$content === void 0 ? [] : _parsedData$content,
        _parsedData$textAlign = parsedData.textAlign,
        textAlign = _parsedData$textAlign === void 0 ? "left" : _parsedData$textAlign,
        _parsedData$fontSize = parsedData.fontSize,
        fontSize = _parsedData$fontSize === void 0 ? themeConfig.FONT_SIZE : _parsedData$fontSize,
        _parsedData$color = parsedData.color,
        color = _parsedData$color === void 0 ? themeConfig.TEXT_PRIMARY : _parsedData$color,
        _parsedData$fontWeigh = parsedData.fontWeight,
        fontWeight = _parsedData$fontWeigh === void 0 ? "normal" : _parsedData$fontWeigh,
        _parsedData$lineHeigh = parsedData.lineHeight,
        lineHeight = _parsedData$lineHeigh === void 0 ? themeConfig.LINE_HEIGHT : _parsedData$lineHeigh;
      return React.createElement("div", {
        style: {
          height: "100%",
          overflow: "auto"
        }
      }, React.createElement("div", {
        style: {
          fontSize: fontSize,
          lineHeight: lineHeight,
          textAlign: textAlign,
          color: color,
          fontWeight: fontWeight,
          fontFamily: themeConfig.FONT_FAMILY,
          wordWrap: "break-word",
          wordBreak: "break-word"
        }
      }, this.renderTextContent(content)));
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(data) {
        return _regenerator().w(function (_context3) {
          while (1) switch (_context3.n) {
            case 0:
              return _context3.a(2, data);
          }
        }, _callee3);
      }));
      function preprocessData(_x3) {
        return _preprocessData3.apply(this, arguments);
      }
      return preprocessData;
    }()
  }]);
}(React.Component);
window.TextCard = TextCard;

// Image card - Used to display image content, supports multiple display modes and style configurations
var ImageCard = /*#__PURE__*/function (_React$Component11) {
  function ImageCard(props) {
    var _this17;
    _classCallCheck(this, ImageCard);
    _this17 = _callSuper(this, ImageCard, [props]);
    // Handle image load success
    _defineProperty(_this17, "onImageLoad", function () {
      _this17.setState({
        imageLoaded: true,
        imageError: false,
        loading: false
      });
    });
    // Handle image load failure
    _defineProperty(_this17, "onImageError", function () {
      _this17.setState({
        imageError: true,
        imageLoaded: false,
        loading: false
      });
    });
    // Handle image load start
    _defineProperty(_this17, "onImageLoadStart", function () {
      _this17.setState({
        loading: true,
        imageError: false
      });
    });
    _this17.state = {
      imageLoaded: false,
      imageError: false,
      loading: false
    };
    return _this17;
  }
  _inherits(ImageCard, _React$Component11);
  return _createClass(ImageCard, [{
    key: "getImageThemeConfig",
    value: function getImageThemeConfig() {
      var config = this.props.dashboardConfig;
      var fontSize = config.BASE_FONT_SIZE;
      return {
        FONT_SIZE: fontSize,
        ERROR_ICON_SIZE: fontSize,
        ERROR_ICON_MARGIN: config.CARD_GAP,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY,
        ERROR: config.COLORS_ERROR
      };
    }
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      var data = this.props.data;
      var parsedData = this.parseUnifiedData(data);
      if (parsedData.src) {
        this.setState({
          loading: true
        });
      }
    }
    // Parse data format
  }, {
    key: "parseUnifiedData",
    value: function parseUnifiedData(data) {
      // String directly as image URL
      if (typeof data === "string") {
        return {
          src: data
        };
      }
      // If already in correct format, return directly
      if (data && _typeof(data) === "object") {
        return _objectSpread({
          src: data.src || "",
          alt: data.alt || "Image",
          fit: data.fit || "contain",
          // contain, cover, fill, scale-down, none
          position: data.position || "center",
          // center, top, bottom, left, right
          borderRadius: data.borderRadius || "0",
          opacity: data.opacity || 1
        }, data);
      }
      // Default data
      return {
        src: "",
        alt: "Image",
        fit: "contain",
        position: "center",
        borderRadius: "0",
        opacity: 1
      };
    }
  }, {
    key: "renderPlaceholderContent",
    value:
    // Render placeholder content
    function renderPlaceholderContent() {
      return React.createElement("div", {
        style: {
          width: "100%",
          height: "100%",
          opacity: 0.6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        dangerouslySetInnerHTML: {
          __html: "<svg width=\"100%\" height=\"100%\" viewBox=\"0 0 100 101\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n            <rect width=\"100\" height=\"100\" transform=\"translate(0 0.644531)\" fill=\"#F5F5F5\"/>\n            <g clip-path=\"url(#clip0_1523_1075)\">\n            <path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M26.9314 32.1412C26.3485 33.2823 25.8076 34.9424 25.4444 37.0812C24.9538 39.9702 24.8483 43.3763 25.2113 46.7587C25.5754 50.1511 26.3953 53.3785 27.6552 55.9705C27.9377 56.5518 28.2365 57.0896 28.55 57.5838C28.551 57.283 28.5534 56.9801 28.5559 56.677C28.5567 56.579 28.5575 56.4809 28.5583 56.3829C28.5615 55.9522 28.5644 55.57 28.5644 55.234C28.5644 53.763 28.7233 51.2491 30.3367 49.0879C32.0872 46.7429 34.9745 45.5275 38.8748 45.5275H43.5939C41.5288 42.9323 38.218 39.2985 34.6954 36.4277C32.8451 34.9198 31.0329 33.7021 29.3907 32.9389C28.4054 32.481 27.59 32.237 26.9314 32.1412ZM59.3251 45.5275H64.0442C67.9445 45.5275 70.8317 46.7429 72.5823 49.0879C74.1957 51.2491 74.3545 53.763 74.3545 55.234C74.3545 55.57 74.3574 55.9522 74.3607 56.3829C74.3615 56.4809 74.3623 56.5789 74.3631 56.6769C74.3656 56.9801 74.368 57.2829 74.3689 57.5838C74.6825 57.0896 74.9812 56.5518 75.2638 55.9705C76.5237 53.3785 77.3436 50.1511 77.7077 46.7587C78.0707 43.3763 77.9652 39.9702 77.4746 37.0812C77.1114 34.9424 76.5705 33.2823 75.9876 32.1412C75.329 32.237 74.5136 32.481 73.5283 32.9389C71.8861 33.7021 70.0739 34.9198 68.2236 36.4277C64.701 39.2985 61.3901 42.9323 59.3251 45.5275ZM69.4353 67.2021C69.0601 67.3429 68.6761 67.4654 68.2932 67.5721C66.7937 67.9901 65.0501 68.2377 63.3361 68.2997C61.6299 68.3614 59.8018 68.2449 58.1591 67.8432C56.634 67.4702 54.6817 66.71 53.4692 65.021C52.8904 64.2148 52.3563 63.8649 52.0384 63.7147C51.899 63.6488 51.7932 63.6175 51.7312 63.6033L51.4595 63.6406L51.1878 63.6033C51.1258 63.6175 51.02 63.6488 50.8806 63.7147C50.5627 63.8649 50.0285 64.2148 49.4498 65.021C48.2373 66.71 46.285 67.4702 44.7599 67.8432C43.1172 68.2449 41.2891 68.3614 39.5829 68.2997C37.8689 68.2377 36.1253 67.9901 34.6258 67.5721C34.2429 67.4654 33.8589 67.3429 33.4837 67.2021C33.1468 68.5861 32.8422 69.6304 32.5714 70.4095L32.5708 70.4111C35.4459 73.7358 41.9777 78.7009 51.3746 78.4484L51.4595 78.4461L51.5444 78.4484C60.9412 78.7009 67.4731 73.7358 70.3482 70.4111L70.3476 70.4095C70.0768 69.6304 69.7722 68.5861 69.4353 67.2021ZM27.383 65.5421C25.0156 63.8047 23.2513 61.3679 21.9718 58.7356C20.312 55.3209 19.3471 51.3428 18.9276 47.4337C18.507 43.5148 18.6192 39.5235 19.2138 36.0222C19.7923 32.6157 20.8924 29.2844 22.7491 27.022L23.4832 26.1276L24.6209 25.9187C27.2072 25.4439 29.8054 26.1601 32.0533 27.2048C34.3433 28.2691 36.6093 29.8326 38.6868 31.5257C42.033 34.2527 45.1404 37.5229 47.3955 40.1963C47.8028 40.099 48.1874 40.0291 48.5265 39.977C49.6448 39.8049 50.7232 39.7618 51.4595 39.7781C52.1958 39.7618 53.2742 39.8049 54.3925 39.977C54.7315 40.0291 55.1162 40.099 55.5235 40.1963C57.7786 37.5229 60.886 34.2527 64.2322 31.5257C66.3097 29.8326 68.5757 28.2691 70.8657 27.2048C73.1136 26.1601 75.7118 25.4439 78.298 25.9187L79.4358 26.1276L80.1699 27.022C82.0266 29.2844 83.1267 32.6157 83.7052 36.0222C84.2997 39.5235 84.412 43.5148 83.9914 47.4337C83.5719 51.3428 82.607 55.3209 80.9472 58.7356C79.6677 61.3679 77.9034 63.8047 75.536 65.5421C75.781 66.5618 75.9931 67.3242 76.1681 67.8816L79.3992 68.3561L76.69 72.4966C73.7984 76.9155 64.9454 85.0981 51.4595 84.7709C37.9736 85.0981 29.1205 76.9155 26.229 72.4966L23.5198 68.3561L26.7508 67.8816C26.9259 67.3242 27.1379 66.5618 27.383 65.5421ZM35.4002 52.8713C35.0591 53.3281 34.8843 54.0869 34.8843 55.234C34.8843 55.5966 34.8812 56.0017 34.878 56.4228L34.8779 56.4312C34.8646 58.1714 34.8572 59.2234 34.9625 60.0483C35.034 60.6082 35.1405 60.8946 35.2557 61.0843C35.2709 61.0926 35.2881 61.1017 35.3076 61.1116C35.5136 61.2166 35.8483 61.3495 36.3219 61.4815C37.2684 61.7453 38.5101 61.9341 39.8113 61.9812C41.1201 62.0286 42.3369 61.9269 43.2594 61.7014C44.0955 61.4969 44.3456 61.2784 44.3513 61.2846C46.5267 58.2844 49.3729 57.175 51.4595 57.2781C53.5461 57.175 56.3922 58.2845 58.5677 61.2847C58.5733 61.2786 58.8235 61.4969 59.6596 61.7014C60.5821 61.9269 61.7989 62.0286 63.1077 61.9812C64.4089 61.9341 65.6506 61.7453 66.5971 61.4815C67.0707 61.3495 67.4054 61.2166 67.6114 61.1116C67.6308 61.1017 67.6481 61.0926 67.6633 61.0843C67.7785 60.8946 67.885 60.6082 67.9565 60.0483C68.0618 59.2234 68.0544 58.1714 68.0411 56.4312L68.041 56.4221C68.0378 56.0012 68.0347 55.5964 68.0347 55.234C68.0347 54.0869 67.8599 53.3281 67.5188 52.8713C67.315 52.5982 66.627 51.8501 64.0442 51.8501H38.8748C36.292 51.8501 35.604 52.5982 35.4002 52.8713Z\" fill=\"#E9E9E9\"/>\n            <path d=\"M13.4036 29.3616C13.7296 29.9246 14.5906 29.6939 14.5914 29.0433L14.596 25.2805C14.5962 25.0536 14.7173 24.8439 14.9137 24.7302L18.17 22.8449C18.7331 22.5189 18.5024 21.6579 17.8518 21.6571L14.089 21.6525C13.8621 21.6523 13.6524 21.5312 13.5387 21.3348L11.6534 18.0785C11.3274 17.5154 10.4664 17.7461 10.4656 18.3967L10.461 22.1595C10.4607 22.3864 10.3397 22.5961 10.1433 22.7098L6.88693 24.5951C6.32385 24.9211 6.55456 25.7821 7.2052 25.7829L10.968 25.7875C11.1949 25.7878 11.4045 25.9088 11.5183 26.1052L13.4036 29.3616Z\" fill=\"#E9E9E9\"/>\n            <path d=\"M88.6057 71.1174C88.6062 71.5512 89.1802 71.705 89.3975 71.3296L90.6544 69.1587C90.7302 69.0278 90.87 68.9471 91.0213 68.9469L93.5298 68.9439C93.9635 68.9433 94.1174 68.3693 93.742 68.152L91.5711 66.8951C91.4401 66.8193 91.3594 66.6795 91.3592 66.5282L91.3562 64.0197C91.3557 63.586 90.7817 63.4322 90.5643 63.8075L89.3074 65.9785C89.2316 66.1094 89.0919 66.1901 88.9406 66.1903L86.4321 66.1933C85.9983 66.1938 85.8445 66.7678 86.2199 66.9852L88.3908 68.2421C88.5217 68.3179 88.6024 68.4576 88.6026 68.6089L88.6057 71.1174Z\" fill=\"#E9E9E9\"/>\n            </g>\n            <defs>\n            <clipPath id=\"clip0_1523_1075\">\n            <rect x=\"5\" y=\"5.64453\" width=\"90\" height=\"90\" rx=\"4.74074\" fill=\"white\"/>\n            </clipPath>\n            </defs>\n            </svg>"
        }
      });
    }
    // Render placeholder
  }, {
    key: "renderPlaceholder",
    value: function renderPlaceholder() {
      var dashboardConfig = this.props.dashboardConfig;
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }
      }, [
      // SVG icon container, fixed size
      React.createElement("div", {
        key: "icon-container",
        style: {
          width: "40px",
          height: "40px",
          marginBottom: "8px"
        }
      }, this.renderPlaceholderContent()),
      // Custom text
      React.createElement("div", {
        key: "text",
        style: {
          color: dashboardConfig.COLORS_TEXT_SECONDARY,
          fontSize: "12px"
        }
      }, "Please configure image URL")]);
    }
    // Render image loading error
  }, {
    key: "renderImageError",
    value: function renderImageError() {
      var dashboardConfig = this.props.dashboardConfig;
      var config = dashboardConfig;
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: config.COLORS_ERROR,
          fontSize: "12px",
          padding: "20px"
        }
      }, [React.createElement("div", {
        key: "icon",
        style: {
          fontSize: "24px",
          marginBottom: "8px"
        }
      }, React.createElement("i", {
        className: "ti ti-photo-off",
        style: {
          fontSize: "24px",
          color: "inherit"
        }
      })), React.createElement("div", {
        key: "text"
      }, language.t("error.imageLoadFailed", "Image loading failed"))]);
    }
  }, {
    key: "render",
    value: function render() {
      var data = this.props.data;
      var _this$state5 = this.state,
        imageError = _this$state5.imageError,
        loading = _this$state5.loading,
        imageLoaded = _this$state5.imageLoaded;
      if (imageError) {
        return this.renderImageError();
      }
      // Show placeholder when no data or no image source
      if (!data) {
        var themeConfig = this.getImageThemeConfig();
        return React.createElement("div", {
          style: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: themeConfig.TEXT_SECONDARY,
            fontSize: themeConfig.FONT_SIZE
          }
        }, "Image card");
      }
      var parsedData = this.parseUnifiedData(data);
      if (!parsedData.src) {
        return this.renderPlaceholder();
      }
      return React.createElement("div", {
        style: {
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative"
        }
      }, [
      // Placeholder - Show when image is loading or not loaded
      (loading || !imageLoaded) && React.createElement("div", {
        key: "placeholder-overlay",
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F5F5",
          zIndex: 1,
          borderRadius: parsedData.borderRadius
        }
      }, this.renderPlaceholderContent()),
      // Image element
      React.createElement("img", {
        key: "image",
        src: parsedData.src,
        alt: parsedData.alt,
        onLoad: this.onImageLoad,
        onError: this.onImageError,
        onLoadStart: this.onImageLoadStart,
        style: {
          objectFit: parsedData.fit,
          objectPosition: parsedData.position,
          borderRadius: parsedData.borderRadius,
          opacity: imageLoaded ? parsedData.opacity : 0,
          width: "100%",
          height: "100%",
          display: "block",
          transition: "opacity 0.3s ease"
        }
      })]);
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(data) {
        return _regenerator().w(function (_context4) {
          while (1) switch (_context4.n) {
            case 0:
              return _context4.a(2, data);
          }
        }, _callee4);
      }));
      function preprocessData(_x4) {
        return _preprocessData4.apply(this, arguments);
      }
      return preprocessData;
    }()
  }]);
}(React.Component);
window.ImageCard = ImageCard;

// Table card - Suitable for displaying detailed data lists and ranking information
var TableCard = /*#__PURE__*/function (_React$Component12) {
  function TableCard(props) {
    var _this18;
    _classCallCheck(this, TableCard);
    _this18 = _callSuper(this, TableCard, [props]);
    // Virtual scrolling: Calculate visible range
    _defineProperty(_this18, "calculateVisibleRange", function (scrollTop, containerHeight, rowHeight, totalRows) {
      var overscan = 5; // Render extra rows for smooth scrolling
      var startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
      var visibleRows = Math.ceil(containerHeight / rowHeight);
      var endIndex = Math.min(totalRows - 1, startIndex + visibleRows + overscan * 2);
      return {
        startIndex: startIndex,
        endIndex: endIndex
      };
    });
    // Virtual scrolling: Handle scroll event
    _defineProperty(_this18, "handleVirtualScroll", function (event) {
      var scrollTop = event.target.scrollTop;
      var containerHeight = event.target.clientHeight;
      var themeConfig = _this18.getTableThemeConfig();
      var rowHeight = parseInt(themeConfig.CELL_HEIGHT);
      // Use cached processed data
      var _this18$getProcessedD = _this18.getProcessedData(),
        processedData = _this18$getProcessedD.data;
      var totalRows = processedData.length;
      var _this18$calculateVisi = _this18.calculateVisibleRange(scrollTop, containerHeight, rowHeight, totalRows),
        startIndex = _this18$calculateVisi.startIndex,
        endIndex = _this18$calculateVisi.endIndex;
      _this18.setState({
        scrollTop: scrollTop,
        containerHeight: containerHeight,
        startIndex: startIndex,
        endIndex: endIndex
      });
    });
    // Virtual scrolling: Update container height on mount/resize (with debouncing)
    _defineProperty(_this18, "updateContainerHeight", function () {
      if (_this18.tableContainerRef.current) {
        var containerHeight = _this18.tableContainerRef.current.clientHeight;
        var containerWidth = _this18.tableContainerRef.current.clientWidth;
        // Skip update if dimensions haven't changed significantly
        if (Math.abs(containerHeight - _this18.state.containerHeight) < 5) {
          return;
        }
        var themeConfig = _this18.getTableThemeConfig();
        var rowHeight = parseInt(themeConfig.CELL_HEIGHT);
        // Use cached processed data
        var _this18$getProcessedD2 = _this18.getProcessedData(),
          processedData = _this18$getProcessedD2.data;
        var totalRows = processedData.length;
        var _this18$calculateVisi2 = _this18.calculateVisibleRange(_this18.state.scrollTop, containerHeight, rowHeight, totalRows),
          startIndex = _this18$calculateVisi2.startIndex,
          endIndex = _this18$calculateVisi2.endIndex;
        _this18.setState({
          containerHeight: containerHeight,
          startIndex: startIndex,
          endIndex: endIndex
        });
      }
    });
    // Debounced version of updateContainerHeight for resize events
    _defineProperty(_this18, "getDebouncedUpdateContainerHeight", function () {
      if (!_this18.debouncedUpdateContainerHeight) {
        var _window$UTILS;
        _this18.debouncedUpdateContainerHeight = (_window$UTILS = window.UTILS) !== null && _window$UTILS !== void 0 && _window$UTILS.debounce ? window.UTILS.debounce(_this18.updateContainerHeight, 100) : _this18.updateContainerHeight;
      }
      return _this18.debouncedUpdateContainerHeight;
    });
    // Reset scroll position to top and update virtual scroll state
    _defineProperty(_this18, "resetScrollToTop", function () {
      if (_this18.tableContainerRef.current) {
        // Reset scroll position
        _this18.tableContainerRef.current.scrollTop = 0;
        // Update virtual scroll state
        var containerHeight = _this18.tableContainerRef.current.clientHeight;
        var themeConfig = _this18.getTableThemeConfig();
        var rowHeight = parseInt(themeConfig.CELL_HEIGHT);
        // Use cached processed data
        var _this18$getProcessedD3 = _this18.getProcessedData(),
          processedData = _this18$getProcessedD3.data;
        var totalRows = processedData.length;
        var _this18$calculateVisi3 = _this18.calculateVisibleRange(0, containerHeight, rowHeight, totalRows),
          startIndex = _this18$calculateVisi3.startIndex,
          endIndex = _this18$calculateVisi3.endIndex;
        _this18.setState({
          scrollTop: 0,
          startIndex: startIndex,
          endIndex: endIndex
        });
      }
    });
    // Build column indexes for fast filtering
    _defineProperty(_this18, "buildColumnIndexes", function (tableData, columns) {
      // Skip if data hasn't changed
      if (_this18.rawDataRef === tableData) {
        return;
      }
      _this18.rawDataRef = tableData;
      _this18.columnIndexes.clear();
      _this18.sortedIndexes.clear();
      if (!Array.isArray(tableData) || tableData.length === 0) {
        return;
      }
      // Build indexes for filterable columns
      columns.forEach(function (column) {
        if (!column.filterable) return;
        var columnKey = column.dataIndex;
        var valueMap = new Map(); // value -> Set of row indexes
        var sortedRowIndexes = []; // Pre-sorted row indexes for this column
        // Build value index and collect data for sorting
        tableData.forEach(function (row, rowIndex) {
          var cellValue = row[columnKey];
          // Build filter index
          if (cellValue != null) {
            var normalizedValue = _this18.normalizeValueForIndex(cellValue, column.dataType);
            if (!valueMap.has(normalizedValue)) {
              valueMap.set(normalizedValue, new Set());
            }
            valueMap.get(normalizedValue).add(rowIndex);
          }
          // Collect for sorting
          sortedRowIndexes.push({
            index: rowIndex,
            value: cellValue
          });
        });
        // Store filter index
        _this18.columnIndexes.set(columnKey, valueMap);
        // Pre-sort indexes for this column
        if (column.sortable) {
          sortedRowIndexes.sort(function (a, b) {
            return _this18.compareValues(a.value, b.value, column.dataType);
          });
          _this18.sortedIndexes.set(columnKey, sortedRowIndexes.map(function (item) {
            return item.index;
          }));
        }
      });
    });
    // Normalize value for indexing
    _defineProperty(_this18, "normalizeValueForIndex", function (value, dataType) {
      if (value == null) return null;
      switch (dataType) {
        case "number":
          return Number(value);
        case "date":
          return new Date(value).getTime();
        case "time":
          return _this18.getTimeTimestamp(value);
        case "string":
        default:
          return String(value).toLowerCase();
      }
    });
    // Compare values for sorting
    _defineProperty(_this18, "compareValues", function (aValue, bValue, dataType) {
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return -1;
      if (bValue == null) return 1;
      switch (dataType) {
        case "number":
          return Number(aValue) - Number(bValue);
        case "date":
          return new Date(aValue) - new Date(bValue);
        case "time":
          return _this18.getTimeTimestamp(aValue) - _this18.getTimeTimestamp(bValue);
        case "string":
        default:
          return String(aValue).localeCompare(String(bValue));
      }
    });
    // Fast filtering using indexes
    _defineProperty(_this18, "fastFilterData", function (tableData, filters, columns) {
      if (!filters || Object.keys(filters).length === 0) {
        return Array.from({
          length: tableData.length
        }, function (_, i) {
          return i;
        });
      }
      var resultIndexes = null;
      // Process each filter
      Object.entries(filters).forEach(function (_ref4) {
        var _ref5 = _slicedToArray(_ref4, 2),
          columnKey = _ref5[0],
          filterValue = _ref5[1];
        if (!filterValue || filterValue === "") return;
        var column = columns.find(function (col) {
          return col.dataIndex === columnKey;
        });
        if (!column) return;
        var columnIndexes = _this18.columnIndexes.get(columnKey);
        var matchingIndexes = new Set();
        if (columnIndexes) {
          // Use index for fast lookup
          matchingIndexes = _this18.getMatchingIndexesFromIndex(columnIndexes, filterValue, column.dataType);
        } else {
          // Fallback to linear search
          matchingIndexes = _this18.getMatchingIndexesLinear(tableData, columnKey, filterValue, column.dataType);
        }
        // Intersect with previous results
        if (resultIndexes === null) {
          resultIndexes = matchingIndexes;
        } else {
          resultIndexes = new Set(_toConsumableArray(resultIndexes).filter(function (x) {
            return matchingIndexes.has(x);
          }));
        }
      });
      return resultIndexes ? Array.from(resultIndexes) : [];
    });
    // Get matching indexes from pre-built index
    _defineProperty(_this18, "getMatchingIndexesFromIndex", function (columnIndexes, filterValue, dataType) {
      var matchingIndexes = new Set();
      switch (dataType) {
        case "number":
          _this18.matchNumberFromIndex(columnIndexes, filterValue, matchingIndexes);
          break;
        case "date":
          _this18.matchDateFromIndex(columnIndexes, filterValue, matchingIndexes);
          break;
        case "time":
          _this18.matchTimeFromIndex(columnIndexes, filterValue, matchingIndexes);
          break;
        case "string":
        default:
          _this18.matchStringFromIndex(columnIndexes, filterValue, matchingIndexes);
          break;
      }
      return matchingIndexes;
    });
    // Match string values from index
    _defineProperty(_this18, "matchStringFromIndex", function (columnIndexes, filterValue, matchingIndexes) {
      var lowerFilterValue = filterValue.toLowerCase();
      var _iterator2 = _createForOfIteratorHelper(columnIndexes),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _step2$value = _slicedToArray(_step2.value, 2),
            indexedValue = _step2$value[0],
            rowIndexes = _step2$value[1];
          if (indexedValue && indexedValue.includes(lowerFilterValue)) {
            rowIndexes.forEach(function (idx) {
              return matchingIndexes.add(idx);
            });
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    });
    // Match number values from index
    _defineProperty(_this18, "matchNumberFromIndex", function (columnIndexes, filterValue, matchingIndexes) {
      if (filterValue.includes("-")) {
        // Range filtering
        var _filterValue$split = filterValue.split("-"),
          _filterValue$split2 = _slicedToArray(_filterValue$split, 2),
          minStr = _filterValue$split2[0],
          maxStr = _filterValue$split2[1];
        var min = minStr ? Number(minStr) : -Infinity;
        var max = maxStr ? Number(maxStr) : Infinity;
        var _iterator3 = _createForOfIteratorHelper(columnIndexes),
          _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
            var _step3$value = _slicedToArray(_step3.value, 2),
              indexedValue = _step3$value[0],
              rowIndexes = _step3$value[1];
            if (indexedValue >= min && indexedValue <= max) {
              rowIndexes.forEach(function (idx) {
                return matchingIndexes.add(idx);
              });
            }
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      } else {
        // Contains matching
        var filterNum = filterValue;
        var _iterator4 = _createForOfIteratorHelper(columnIndexes),
          _step4;
        try {
          for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
            var _step4$value = _slicedToArray(_step4.value, 2),
              _indexedValue = _step4$value[0],
              _rowIndexes = _step4$value[1];
            if (_indexedValue.toString().includes(filterNum)) {
              _rowIndexes.forEach(function (idx) {
                return matchingIndexes.add(idx);
              });
            }
          }
        } catch (err) {
          _iterator4.e(err);
        } finally {
          _iterator4.f();
        }
      }
    });
    // Match date values from index
    _defineProperty(_this18, "matchDateFromIndex", function (columnIndexes, filterValue, matchingIndexes) {
      // Similar logic to existing filterDate but using index
      if (filterValue.includes(",")) {
        var _filterValue$split3 = filterValue.split(","),
          _filterValue$split4 = _slicedToArray(_filterValue$split3, 2),
          startTs = _filterValue$split4[0],
          endTs = _filterValue$split4[1];
        var startTimestamp = startTs ? parseInt(startTs) : -Infinity;
        var endTimestamp = endTs ? parseInt(endTs) : Infinity;
        var _iterator5 = _createForOfIteratorHelper(columnIndexes),
          _step5;
        try {
          for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
            var _step5$value = _slicedToArray(_step5.value, 2),
              indexedValue = _step5$value[0],
              rowIndexes = _step5$value[1];
            if (indexedValue >= startTimestamp && indexedValue <= endTimestamp) {
              rowIndexes.forEach(function (idx) {
                return matchingIndexes.add(idx);
              });
            }
          }
        } catch (err) {
          _iterator5.e(err);
        } finally {
          _iterator5.f();
        }
      } else {
        // Fallback to string matching for complex date formats
        var _iterator6 = _createForOfIteratorHelper(columnIndexes),
          _step6;
        try {
          for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
            var _step6$value = _slicedToArray(_step6.value, 2),
              _indexedValue2 = _step6$value[0],
              _rowIndexes2 = _step6$value[1];
            var dateStr = new Date(_indexedValue2).toLocaleDateString();
            if (dateStr.includes(filterValue)) {
              _rowIndexes2.forEach(function (idx) {
                return matchingIndexes.add(idx);
              });
            }
          }
        } catch (err) {
          _iterator6.e(err);
        } finally {
          _iterator6.f();
        }
      }
    });
    // Match time values from index
    _defineProperty(_this18, "matchTimeFromIndex", function (columnIndexes, filterValue, matchingIndexes) {
      // Similar logic to existing filterTime but using index
      if (filterValue.includes(",")) {
        var _filterValue$split5 = filterValue.split(","),
          _filterValue$split6 = _slicedToArray(_filterValue$split5, 2),
          startTs = _filterValue$split6[0],
          endTs = _filterValue$split6[1];
        var startTimestamp = startTs ? parseInt(startTs) : -Infinity;
        var endTimestamp = endTs ? parseInt(endTs) : Infinity;
        var _iterator7 = _createForOfIteratorHelper(columnIndexes),
          _step7;
        try {
          for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
            var _step7$value = _slicedToArray(_step7.value, 2),
              indexedValue = _step7$value[0],
              rowIndexes = _step7$value[1];
            if (indexedValue >= startTimestamp && indexedValue <= endTimestamp) {
              rowIndexes.forEach(function (idx) {
                return matchingIndexes.add(idx);
              });
            }
          }
        } catch (err) {
          _iterator7.e(err);
        } finally {
          _iterator7.f();
        }
      } else {
        // String matching for time
        var _iterator8 = _createForOfIteratorHelper(columnIndexes),
          _step8;
        try {
          for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
            var _step8$value = _slicedToArray(_step8.value, 2),
              _indexedValue3 = _step8$value[0],
              _rowIndexes3 = _step8$value[1];
            var timeStr = new Date(_indexedValue3).toTimeString().substr(0, 5);
            if (timeStr.includes(filterValue)) {
              _rowIndexes3.forEach(function (idx) {
                return matchingIndexes.add(idx);
              });
            }
          }
        } catch (err) {
          _iterator8.e(err);
        } finally {
          _iterator8.f();
        }
      }
    });
    // Fallback linear search when index is not available
    _defineProperty(_this18, "getMatchingIndexesLinear", function (tableData, columnKey, filterValue, dataType) {
      var matchingIndexes = new Set();
      tableData.forEach(function (row, index) {
        var cellValue = row[columnKey];
        if (cellValue == null) return;
        var matches = false;
        switch (dataType) {
          case "number":
            matches = _this18.filterNumber(cellValue, filterValue);
            break;
          case "date":
            matches = _this18.filterDate(cellValue, filterValue);
            break;
          case "time":
            matches = _this18.filterTime(cellValue, filterValue);
            break;
          case "string":
          default:
            matches = String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
            break;
        }
        if (matches) {
          matchingIndexes.add(index);
        }
      });
      return matchingIndexes;
    });
    // Performance optimization: Get processed data with advanced caching and indexing
    _defineProperty(_this18, "getProcessedData", function () {
      var data = _this18.props.data;
      if (!data) return {
        columns: [],
        data: []
      };
      var parsedData = _this18.parseUnifiedData(data);
      var columns = parsedData.columns,
        tableData = parsedData.data;
      if (!Array.isArray(tableData)) return {
        columns: [],
        data: []
      };
      // Build indexes if needed
      _this18.buildColumnIndexes(tableData, columns);
      var _this18$state = _this18.state,
        sortColumn = _this18$state.sortColumn,
        sortDirection = _this18$state.sortDirection,
        filters = _this18$state.filters;
      // Simple cache check - only compare filter and sort state
      var cache = _this18.processedDataCache;
      var filtersStr = JSON.stringify(filters);
      if (cache.result && cache.filters === filtersStr && cache.sortColumn === sortColumn && cache.sortDirection === sortDirection) {
        return {
          columns: columns,
          data: cache.result
        };
      }
      // Fast processing using indexes and virtual rendering
      var filteredRowIndexes;
      // Use fast filtering with indexes
      filteredRowIndexes = _this18.fastFilterData(tableData, filters, columns);
      // Apply sorting using pre-sorted indexes when possible
      if (sortColumn && sortDirection) {
        var sortColumnConfig = columns.find(function (col) {
          return col.dataIndex === sortColumn;
        });
        if (sortColumnConfig && _this18.sortedIndexes.has(sortColumn)) {
          // Use pre-sorted indexes
          var preSortedIndexes = _this18.sortedIndexes.get(sortColumn);
          var filteredSet = new Set(filteredRowIndexes);
          if (sortDirection === "asc") {
            filteredRowIndexes = preSortedIndexes.filter(function (idx) {
              return filteredSet.has(idx);
            });
          } else {
            filteredRowIndexes = preSortedIndexes.filter(function (idx) {
              return filteredSet.has(idx);
            }).reverse();
          }
        } else {
          // Fallback to traditional sorting
          var filteredData = filteredRowIndexes.map(function (idx) {
            return {
              index: idx,
              data: tableData[idx]
            };
          });
          filteredData.sort(function (a, b) {
            var comparison = _this18.compareValues(a.data[sortColumn], b.data[sortColumn], sortColumnConfig.dataType);
            return sortDirection === "asc" ? comparison : -comparison;
          });
          filteredRowIndexes = filteredData.map(function (item) {
            return item.index;
          });
        }
      }
      // Store filtered indexes for virtual rendering
      _this18.virtualRenderCache.filteredRowIndexes = filteredRowIndexes;
      // Convert indexes back to data for compatibility
      var processedData = filteredRowIndexes.map(function (idx) {
        return tableData[idx];
      });
      // Update cache
      _this18.processedDataCache = {
        filters: filtersStr,
        sortColumn: sortColumn,
        sortDirection: sortDirection,
        result: processedData
      };
      return {
        columns: columns,
        data: processedData
      };
    });
    // Handle column sort
    _defineProperty(_this18, "handleSort", function (column) {
      if (!column.sortable) return;
      var _this18$state2 = _this18.state,
        sortColumn = _this18$state2.sortColumn,
        sortDirection = _this18$state2.sortDirection;
      var newDirection = "asc";
      if (sortColumn === column.dataIndex) {
        if (sortDirection === "asc") {
          newDirection = "desc";
        } else if (sortDirection === "desc") {
          // Reset sort
          _this18.setState({
            sortColumn: null,
            sortDirection: null
          });
          return;
        }
      }
      _this18.setState({
        sortColumn: column.dataIndex,
        sortDirection: newDirection
      });
    });
    // Handle column filter
    _defineProperty(_this18, "handleFilter", function (column, value) {
      if (!column.filterable) return;
      _this18.setState(function (prevState) {
        return {
          filters: _objectSpread(_objectSpread({}, prevState.filters), {}, _defineProperty({}, column.dataIndex, value))
        };
      }, function () {
        // Reset scroll to top after filter is applied
        _this18.resetScrollToTop();
      });
    });
    // Show filter popup
    _defineProperty(_this18, "showFilterPopup", function (column, event) {
      var _this18$props$dashboa;
      if (!column.filterable) return;
      // Prevent event bubbling
      event.stopPropagation();
      // Get filter button position (precise reference point)
      var filterButton = event.currentTarget;
      var buttonRect = filterButton.getBoundingClientRect();
      // Calculate popup position relative to viewport, based on filter button
      var popupWidth = 200;
      var popupHeight = 150; // Estimated popup height
      var buttonCenterX = buttonRect.left + buttonRect.width / 2;
      var popupLeft = buttonCenterX - popupWidth / 2;
      var popupTop = buttonRect.bottom + 12;
      // Get container padding configuration
      var containerPadding = ((_this18$props$dashboa = _this18.props.dashboardConfig) === null || _this18$props$dashboa === void 0 || (_this18$props$dashboa = _this18$props$dashboa.GRID_CONTAINER_PADDING) === null || _this18$props$dashboa === void 0 ? void 0 : _this18$props$dashboa[0]) || 8;
      // Ensure popup doesn't exceed viewport boundaries, reserve container padding
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      // Horizontal position adjustment
      var finalLeft = Math.max(containerPadding, Math.min(popupLeft, viewportWidth - popupWidth - containerPadding));
      // Vertical position adjustment - if not enough space below, show above button
      var finalTop = popupTop;
      if (popupTop + popupHeight > viewportHeight - containerPadding) {
        finalTop = buttonRect.top - popupHeight - 12;
        // If not enough space above either, force display below but adjust within bounds
        if (finalTop < containerPadding) {
          finalTop = Math.max(containerPadding, viewportHeight - popupHeight - containerPadding);
        }
      }
      _this18.setState({
        activeFilterPopup: column.dataIndex,
        filterPopupPosition: {
          top: finalTop,
          left: finalLeft
        },
        filterButtonRect: buttonRect // Save button position info
      });
    });
    // Close filter popup
    _defineProperty(_this18, "closeFilterPopup", function () {
      _this18.setState({
        activeFilterPopup: null,
        filterButtonRect: null
      });
    });
    // Handle column hover
    _defineProperty(_this18, "handleColumnHover", function (columnIndex) {
      _this18.setState({
        hoveredColumn: columnIndex
      });
    });
    // Handle column leave
    _defineProperty(_this18, "handleColumnLeave", function () {
      _this18.setState({
        hoveredColumn: null
      });
    });
    // Sort data based on column type
    _defineProperty(_this18, "sortData", function (data, column, direction) {
      if (!column || !direction) return data;
      return _toConsumableArray(data).sort(function (a, b) {
        var aValue = a[column.dataIndex];
        var bValue = b[column.dataIndex];
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === "asc" ? -1 : 1;
        if (bValue == null) return direction === "asc" ? 1 : -1;
        var comparison = 0;
        switch (column.dataType) {
          case "number":
            comparison = Number(aValue) - Number(bValue);
            break;
          case "date":
            comparison = new Date(aValue) - new Date(bValue);
            break;
          case "time":
            // Use timestamp for comparison
            var timestampA = _this18.getTimeTimestamp(aValue);
            var timestampB = _this18.getTimeTimestamp(bValue);
            comparison = timestampA - timestampB;
            break;
          case "string":
          default:
            comparison = String(aValue).localeCompare(String(bValue));
            break;
        }
        return direction === "asc" ? comparison : -comparison;
      });
    });
    // Get time timestamp for sorting
    _defineProperty(_this18, "getTimeTimestamp", function (value) {
      if (!value) return 0;
      var today = new Date().toISOString().split("T")[0];
      // If it's a datetime string, extract time part
      if (value.includes("T") || value.includes(" ")) {
        var timePart = value.split(/[T ]/)[1];
        if (timePart) {
          var _timeMatch = timePart.match(/(\d{1,2}):(\d{1,2})/);
          if (_timeMatch) {
            var timeStr = "".concat(_timeMatch[1].padStart(2, "0"), ":").concat(_timeMatch[2].padStart(2, "0"));
            return new Date("".concat(today, "T").concat(timeStr, ":00")).getTime();
          }
        }
      }
      // Direct time format
      var timeMatch = String(value).match(/(\d{1,2}):(\d{1,2})/);
      if (timeMatch) {
        var _timeStr = "".concat(timeMatch[1].padStart(2, "0"), ":").concat(timeMatch[2].padStart(2, "0"));
        return new Date("".concat(today, "T").concat(_timeStr, ":00")).getTime();
      }
      return 0;
    });
    // Filter number values with range support
    _defineProperty(_this18, "filterNumber", function (cellValue, filterValue) {
      var numValue = Number(cellValue);
      if (isNaN(numValue)) return false;
      // Check if it's range filtering
      if (filterValue.includes("-")) {
        var _filterValue$split7 = filterValue.split("-"),
          _filterValue$split8 = _slicedToArray(_filterValue$split7, 2),
          minStr = _filterValue$split8[0],
          maxStr = _filterValue$split8[1];
        var min = minStr ? Number(minStr) : -Infinity;
        var max = maxStr ? Number(maxStr) : Infinity;
        return numValue >= min && numValue <= max;
      } else {
        // Single number filtering, supports contains matching
        return numValue.toString().includes(filterValue);
      }
    });
    // Filter date values with range support
    _defineProperty(_this18, "filterDate", function (cellValue, filterValue) {
      var cellDate = new Date(cellValue);
      if (isNaN(cellDate.getTime())) return false;
      // Check if it's timestamp format (comma separated)
      if (filterValue.includes(",")) {
        var _filterValue$split9 = filterValue.split(","),
          _filterValue$split0 = _slicedToArray(_filterValue$split9, 2),
          startTs = _filterValue$split0[0],
          endTs = _filterValue$split0[1];
        var cellTimestamp = cellDate.getTime();
        // Handle single-sided ranges
        if (startTs && !endTs) {
          // Only start timestamp, no end limit
          var startTimestamp = parseInt(startTs);
          return !isNaN(startTimestamp) && cellTimestamp >= startTimestamp;
        } else if (!startTs && endTs) {
          // Only end timestamp, no start limit
          var endTimestamp = parseInt(endTs);
          return !isNaN(endTimestamp) && cellTimestamp <= endTimestamp;
        } else if (startTs && endTs) {
          // Both timestamps
          var _startTimestamp3 = parseInt(startTs);
          var _endTimestamp3 = parseInt(endTs);
          return !isNaN(_startTimestamp3) && !isNaN(_endTimestamp3) && cellTimestamp >= _startTimestamp3 && cellTimestamp <= _endTimestamp3;
        }
      }
      // Compatible with traditional format (~ separator)
      if (filterValue.includes("~")) {
        var _filterValue$split1 = filterValue.split("~"),
          _filterValue$split10 = _slicedToArray(_filterValue$split1, 2),
          startStr = _filterValue$split10[0],
          endStr = _filterValue$split10[1];
        var startDate = startStr ? new Date(startStr) : new Date("1900-01-01");
        var endDate = endStr ? new Date(endStr) : new Date("2100-12-31");
        return cellDate >= startDate && cellDate <= endDate;
      }
      // Single date filtering, supports date string contains matching
      return cellDate.toLocaleDateString().includes(filterValue) || cellValue.includes(filterValue);
    });
    // Filter time values with range support
    _defineProperty(_this18, "filterTime", function (cellValue, filterValue) {
      // Convert cell value to timestamp for comparison
      var getCellTimestamp = function getCellTimestamp(value) {
        if (!value) return null;
        var today = new Date().toISOString().split("T")[0];
        // If it's a datetime string, extract time part
        if (value.includes("T") || value.includes(" ")) {
          var timePart = value.split(/[T ]/)[1];
          if (timePart) {
            var _timeMatch2 = timePart.match(/(\d{1,2}):(\d{1,2})/);
            if (_timeMatch2) {
              var timeStr = "".concat(_timeMatch2[1].padStart(2, "0"), ":").concat(_timeMatch2[2].padStart(2, "0"));
              return new Date("".concat(today, "T").concat(timeStr, ":00")).getTime();
            }
          }
        }
        // Direct time format
        var timeMatch = String(value).match(/(\d{1,2}):(\d{1,2})/);
        if (timeMatch) {
          var _timeStr2 = "".concat(timeMatch[1].padStart(2, "0"), ":").concat(timeMatch[2].padStart(2, "0"));
          return new Date("".concat(today, "T").concat(_timeStr2, ":00")).getTime();
        }
        return null;
      };
      var cellTimestamp = getCellTimestamp(cellValue);
      if (cellTimestamp === null) return false;
      // Check if it's timestamp format (comma separated)
      if (filterValue.includes(",")) {
        var _filterValue$split11 = filterValue.split(","),
          _filterValue$split12 = _slicedToArray(_filterValue$split11, 2),
          startTs = _filterValue$split12[0],
          endTs = _filterValue$split12[1];
        // Handle single-sided ranges
        if (startTs && !endTs) {
          // Only start timestamp, no end limit
          var startTimestamp = parseInt(startTs);
          return !isNaN(startTimestamp) && cellTimestamp >= startTimestamp;
        } else if (!startTs && endTs) {
          // Only end timestamp, no start limit
          var endTimestamp = parseInt(endTs);
          return !isNaN(endTimestamp) && cellTimestamp <= endTimestamp;
        } else if (startTs && endTs) {
          // Both timestamps
          var _startTimestamp4 = parseInt(startTs);
          var _endTimestamp4 = parseInt(endTs);
          return !isNaN(_startTimestamp4) && !isNaN(_endTimestamp4) && cellTimestamp >= _startTimestamp4 && cellTimestamp <= _endTimestamp4;
        }
      }
      // Compatible with traditional format (~ separator)
      if (filterValue.includes("~")) {
        var today = new Date().toISOString().split("T")[0];
        var _filterValue$split13 = filterValue.split("~"),
          _filterValue$split14 = _slicedToArray(_filterValue$split13, 2),
          startStr = _filterValue$split14[0],
          endStr = _filterValue$split14[1];
        var startTime = startStr || "00:00";
        var endTime = endStr || "23:59";
        var _startTimestamp5 = new Date("".concat(today, "T").concat(startTime, ":00")).getTime();
        var _endTimestamp5 = new Date("".concat(today, "T").concat(endTime, ":59")).getTime();
        return cellTimestamp >= _startTimestamp5 && cellTimestamp <= _endTimestamp5;
      }
      // Single time filtering, convert to string for contains matching
      var cellTimeStr = new Date(cellTimestamp).toTimeString().substr(0, 5);
      return cellTimeStr.includes(filterValue);
    });
    // Filter data based on column type
    _defineProperty(_this18, "filterData", function (data, filters, columns) {
      if (!filters || Object.keys(filters).length === 0) return data;
      return data.filter(function (row) {
        return Object.entries(filters).every(function (_ref6) {
          var _ref7 = _slicedToArray(_ref6, 2),
            columnKey = _ref7[0],
            filterValue = _ref7[1];
          if (!filterValue || filterValue === "") return true;
          var column = columns.find(function (col) {
            return col.dataIndex === columnKey;
          });
          if (!column) return true;
          var cellValue = row[columnKey];
          if (cellValue == null) return false;
          switch (column.dataType) {
            case "number":
              return _this18.filterNumber(cellValue, filterValue);
            case "date":
              return _this18.filterDate(cellValue, filterValue);
            case "time":
              return _this18.filterTime(cellValue, filterValue);
            case "string":
            default:
              return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
          }
        });
      });
    });
    _this18.state = {
      sortColumn: null,
      // Current sort column
      sortDirection: null,
      // 'asc' or 'desc'
      filters: {},
      // Filter values for each column
      activeFilterPopup: null,
      // Currently active filter popup column
      filterPopupPosition: {
        top: 0,
        left: 0
      },
      // Filter popup position
      hoveredColumn: null,
      // Currently hovered column
      // Virtual scrolling state
      scrollTop: 0,
      // Current scroll position
      containerHeight: 0,
      // Container height
      startIndex: 0,
      // First visible row index
      endIndex: 0 // Last visible row index
    };
    // Refs for virtual scrolling
    _this18.tableContainerRef = React.createRef();
    _this18.virtualScrollRef = React.createRef();
    _this18.resizeObserver = null;
    // Performance optimization: Cache processed data
    _this18.processedDataCache = {
      filters: null,
      sortColumn: null,
      sortDirection: null,
      result: null
    };
    // Advanced optimization: Column indexes and virtual rendering cache
    _this18.columnIndexes = new Map(); // Column value indexes for fast filtering
    _this18.sortedIndexes = new Map(); // Pre-sorted row indexes for each column
    _this18.rawDataRef = null; // Reference to raw data for index validation
    _this18.virtualRenderCache = {
      filteredRowIndexes: null,
      // Indexes of filtered rows
      visibleData: null,
      // Currently visible data slice
      lastVisibleRange: {
        start: -1,
        end: -1
      } // Last rendered range
    };
    return _this18;
  }
  _inherits(TableCard, _React$Component12);
  return _createClass(TableCard, [{
    key: "getTableThemeConfig",
    value: function getTableThemeConfig() {
      var config = this.props.dashboardConfig;
      return {
        CELL_MIN_WIDTH: config.TABLE_CELL_MIN_WIDTH,
        CELL_HEIGHT: config.TABLE_CELL_HEIGHT,
        CELL_PADDING: config.TABLE_CELL_PADDING,
        FONT_SIZE: config.TABLE_FONT_SIZE,
        BORDER_RADIUS: config.TABLE_BORDER_RADIUS,
        HEADER_BACKGROUND_OPACITY: 0.1,
        BORDER_LIGHT_OPACITY: 0.2,
        HOVER_BACKGROUND_OPACITY: 0.05,
        PRIMARY: config.COLORS_PRIMARY,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY,
        HEADER_BACKGROUND: config.TABLE_HEADER_BACKGROUND_COLOR,
        BORDER: config.TABLE_BORDER_COLOR
      };
    }
  }, {
    key: "renderEmptyState",
    value: function renderEmptyState() {
      var themeConfig = this.getTableThemeConfig();
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.FONT_SIZE
        }
      }, language.t("common.noData"));
    }
  }, {
    key: "componentDidMount",
    value:
    // Component lifecycle methods for virtual scrolling
    function componentDidMount() {
      this.updateContainerHeight();
      // Set up window resize listener with debouncing
      var debouncedUpdate = this.getDebouncedUpdateContainerHeight();
      window.addEventListener("resize", debouncedUpdate);
      // Set up ResizeObserver for container size changes
      if (window.ResizeObserver && this.tableContainerRef.current) {
        this.resizeObserver = new ResizeObserver(function (entries) {
          var _iterator9 = _createForOfIteratorHelper(entries),
            _step9;
          try {
            for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
              var entry = _step9.value;
              // Use debounced update for ResizeObserver as well
              debouncedUpdate();
            }
          } catch (err) {
            _iterator9.e(err);
          } finally {
            _iterator9.f();
          }
        });
        this.resizeObserver.observe(this.tableContainerRef.current);
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      // Clean up window resize listener
      var debouncedUpdate = this.getDebouncedUpdateContainerHeight();
      window.removeEventListener("resize", debouncedUpdate);
      // Clean up ResizeObserver
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      // Clean up debounced function
      if (this.debouncedUpdateContainerHeight) {
        this.debouncedUpdateContainerHeight = null;
      }
      // Clean up performance cache
      this.processedDataCache = {
        filters: null,
        sortColumn: null,
        sortDirection: null,
        result: null
      };
      // Clean up advanced optimization caches
      this.columnIndexes.clear();
      this.sortedIndexes.clear();
      this.rawDataRef = null;
      this.virtualRenderCache = {
        filteredRowIndexes: null,
        visibleData: null,
        lastVisibleRange: {
          start: -1,
          end: -1
        }
      };
    }
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps, prevState) {
      var _this19 = this;
      // Clear cache if data changes
      if (prevProps.data !== this.props.data) {
        this.processedDataCache.result = null;
        // Clear advanced caches as well
        this.columnIndexes.clear();
        this.sortedIndexes.clear();
        this.rawDataRef = null;
        this.virtualRenderCache.filteredRowIndexes = null;
      }
      // Check if filters have changed (excluding initial mount)
      var filtersChanged = prevState.filters !== this.state.filters && Object.keys(prevState.filters).length > 0;
      // Update virtual scroll when data, filters, or sort change
      if (prevProps.data !== this.props.data || prevState.filters !== this.state.filters || prevState.sortColumn !== this.state.sortColumn || prevState.sortDirection !== this.state.sortDirection) {
        this.updateContainerHeight();
        // Reset scroll to top ONLY when filters change (backup mechanism)
        if (filtersChanged) {
          // Use setTimeout to ensure DOM is updated
          setTimeout(function () {
            _this19.resetScrollToTop();
          }, 0);
        }
      }
      // Set up ResizeObserver if it wasn't available during mount but is now available
      if (window.ResizeObserver && !this.resizeObserver && this.tableContainerRef.current) {
        var debouncedUpdate = this.getDebouncedUpdateContainerHeight();
        this.resizeObserver = new ResizeObserver(function (entries) {
          var _iterator0 = _createForOfIteratorHelper(entries),
            _step0;
          try {
            for (_iterator0.s(); !(_step0 = _iterator0.n()).done;) {
              var entry = _step0.value;
              debouncedUpdate();
            }
          } catch (err) {
            _iterator0.e(err);
          } finally {
            _iterator0.f();
          }
        });
        this.resizeObserver.observe(this.tableContainerRef.current);
      }
    }
  }, {
    key: "parseUnifiedData",
    value: function parseUnifiedData(data) {
      if (data && data.columns && data.data) {
        return data;
      }
      // If not in standard format, return empty data
      return {
        columns: [],
        data: []
      };
    }
  }, {
    key: "render",
    value: function render() {
      var _this20 = this;
      var data = this.props.data;
      if (!data) {
        return this.renderEmptyState();
      }
      // Use cached processed data
      var _this$getProcessedDat = this.getProcessedData(),
        columns = _this$getProcessedDat.columns,
        processedData = _this$getProcessedDat.data;
      if (!Array.isArray(processedData)) {
        return this.renderEmptyState();
      }
      if (processedData.length === 0) {
        return this.renderEmptyState();
      }
      var themeConfig = this.getTableThemeConfig();
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid ".concat(themeConfig.BORDER),
          borderRadius: themeConfig.BORDER_RADIUS,
          position: "relative"
        }
      }, React.createElement("div", {
        ref: this.tableContainerRef,
        className: "table-container",
        style: {
          flex: 1,
          overflowX: "auto",
          overflowY: "auto"
        },
        onScroll: this.handleVirtualScroll
      }, this.renderVirtualTable(columns, processedData)),
      // Render filter popup
      this.state.activeFilterPopup && React.createElement(FilterPopup, {
        column: columns.find(function (col) {
          return col.dataIndex === _this20.state.activeFilterPopup;
        }),
        value: this.state.filters[this.state.activeFilterPopup] || "",
        position: this.state.filterPopupPosition,
        buttonRect: this.state.filterButtonRect,
        dashboardConfig: this.props.dashboardConfig,
        onChange: function onChange(value) {
          var column = columns.find(function (col) {
            return col.dataIndex === _this20.state.activeFilterPopup;
          });
          _this20.handleFilter(column, value);
        },
        onClose: this.closeFilterPopup
      }));
    }
  }, {
    key: "renderVirtualTable",
    value: function renderVirtualTable(columns, tableData) {
      var themeConfig = this.getTableThemeConfig();
      var rowHeight = parseInt(themeConfig.CELL_HEIGHT);
      var totalRows = tableData.length;
      var _this$state6 = this.state,
        startIndex = _this$state6.startIndex,
        endIndex = _this$state6.endIndex;
      // Calculate virtual scroll dimensions
      var totalHeight = totalRows * rowHeight;
      var offsetY = startIndex * rowHeight;
      // Get visible data slice
      var visibleData = tableData.slice(startIndex, endIndex + 1);
      return React.createElement("div", {
        style: {
          position: "relative",
          height: "".concat(totalHeight, "px"),
          width: "100%"
        }
      },
      // Virtual table container
      React.createElement("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          transform: "translateY(".concat(offsetY, "px)")
        }
      }, React.createElement("table", {
        style: {
          width: "100%",
          minWidth: "".concat(columns.length * parseInt(themeConfig.CELL_MIN_WIDTH), "px"),
          borderCollapse: "collapse",
          fontSize: themeConfig.FONT_SIZE,
          margin: 0,
          tableLayout: "fixed"
        }
      },
      // Only render header when at the top
      startIndex === 0 && this.renderTableHeader(columns), this.renderVirtualTableBody(columns, visibleData, startIndex))),
      // Sticky header (always visible)
      React.createElement("div", {
        style: {
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          backgroundColor: "transparent"
        }
      }, React.createElement("table", {
        style: {
          width: "100%",
          minWidth: "".concat(columns.length * parseInt(themeConfig.CELL_MIN_WIDTH), "px"),
          borderCollapse: "collapse",
          fontSize: themeConfig.FONT_SIZE,
          margin: 0,
          tableLayout: "fixed"
        }
      }, this.renderTableHeader(columns))));
    }
  }, {
    key: "renderTable",
    value: function renderTable(columns, tableData) {
      var themeConfig = this.getTableThemeConfig();
      return React.createElement("table", {
        style: {
          width: "100%",
          minWidth: "".concat(columns.length * parseInt(themeConfig.CELL_MIN_WIDTH), "px"),
          // Dynamically calculate minimum width
          borderCollapse: "collapse",
          fontSize: themeConfig.FONT_SIZE,
          margin: 0,
          tableLayout: "fixed"
        }
      }, this.renderTableHeader(columns), this.renderTableBody(columns, tableData));
    }
  }, {
    key: "renderTableHeader",
    value: function renderTableHeader(columns) {
      var _this21 = this;
      var themeConfig = this.getTableThemeConfig();
      var _this$state7 = this.state,
        sortColumn = _this$state7.sortColumn,
        sortDirection = _this$state7.sortDirection,
        filters = _this$state7.filters,
        hoveredColumn = _this$state7.hoveredColumn,
        activeFilterPopup = _this$state7.activeFilterPopup;
      return React.createElement("thead", null, React.createElement("tr", {
        style: {
          background: themeConfig.HEADER_BACKGROUND,
          position: "sticky",
          top: 0,
          zIndex: 10,
          boxShadow: "0 1px 0 ".concat(themeConfig.BORDER)
        }
      }, columns.map(function (col, index) {
        return React.createElement("th", {
          key: index,
          title: col.title,
          // Add title attribute to show complete column title
          style: {
            padding: themeConfig.CELL_PADDING,
            textAlign: "left",
            color: "#ffffff",
            fontWeight: "500",
            fontSize: themeConfig.FONT_SIZE,
            width: col.width || themeConfig.CELL_MIN_WIDTH,
            minWidth: themeConfig.CELL_MIN_WIDTH,
            verticalAlign: "middle"
          },
          onMouseEnter: function onMouseEnter() {
            return _this21.handleColumnHover(index);
          },
          onMouseLeave: function onMouseLeave() {
            return _this21.handleColumnLeave();
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: themeConfig.CELL_HEIGHT
          }
        },
        // Header title
        React.createElement("span", {
          style: {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1
          }
        }, col.title),
        // Control buttons container
        React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            marginLeft: "8px",
            gap: "2px"
          }
        },
        // Filter button - only show on hover, when filtered, or when popup is active
        col.filterable && (hoveredColumn === index || filters[col.dataIndex] || activeFilterPopup === col.dataIndex) && React.createElement("div", {
          className: "table-control-button ".concat(filters[col.dataIndex] || activeFilterPopup === col.dataIndex ? "active" : ""),
          onClick: function onClick(e) {
            e.stopPropagation();
            _this21.showFilterPopup(col, e);
          }
        }, React.createElement("i", {
          className: filters[col.dataIndex] ? "ti ti-filter-filled" : "ti ti-filter",
          style: {
            fontSize: "12px",
            color: "#ffffff",
            opacity: filters[col.dataIndex] ? 1 : 0.7
          }
        })),
        // Sort button - only show on hover, when active, or when popup is active
        col.sortable && (hoveredColumn === index || sortColumn === col.dataIndex || activeFilterPopup === col.dataIndex) && React.createElement("div", {
          className: "table-control-button ".concat(sortColumn === col.dataIndex ? "active" : ""),
          onClick: function onClick(e) {
            e.stopPropagation();
            _this21.handleSort(col);
          }
        }, React.createElement("i", {
          className: sortColumn === col.dataIndex ? sortDirection === "asc" ? "ti ti-sort-ascending" : "ti ti-sort-descending" : "ti ti-arrows-sort",
          style: {
            fontSize: "12px",
            color: "#ffffff",
            opacity: sortColumn === col.dataIndex ? 1 : 0.7
          }
        })))));
      })));
    }
  }, {
    key: "renderVirtualTableBody",
    value: function renderVirtualTableBody(columns, visibleData, startIndex) {
      var themeConfig = this.getTableThemeConfig();
      return React.createElement("tbody", null, visibleData.map(function (row, relativeIndex) {
        var actualRowIndex = startIndex + relativeIndex;
        return React.createElement("tr", {
          key: actualRowIndex,
          className: "table-row",
          style: {
            "--hover-color": "".concat(themeConfig.PRIMARY).concat(Math.round(themeConfig.HOVER_BACKGROUND_OPACITY * 255).toString(16).padStart(2, "0"))
          }
        }, columns.map(function (col, colIndex) {
          var cellValue = col.formatter ? col.formatter(row[col.dataIndex]) : row[col.dataIndex];
          return React.createElement("td", {
            key: colIndex,
            title: String(cellValue || ""),
            // Add title attribute to show complete cell content
            style: {
              padding: themeConfig.CELL_PADDING,
              textAlign: "left",
              borderBottom: "1px solid ".concat(themeConfig.BORDER),
              color: themeConfig.TEXT_SECONDARY,
              width: col.width || themeConfig.CELL_MIN_WIDTH,
              minWidth: themeConfig.CELL_MIN_WIDTH,
              height: themeConfig.CELL_HEIGHT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }
          }, cellValue);
        }));
      }));
    }
  }, {
    key: "renderTableBody",
    value: function renderTableBody(columns, tableData) {
      var themeConfig = this.getTableThemeConfig();
      return React.createElement("tbody", null, tableData.map(function (row, rowIndex) {
        return React.createElement("tr", {
          key: rowIndex,
          className: "table-row",
          style: {
            "--hover-color": "".concat(themeConfig.PRIMARY).concat(Math.round(themeConfig.HOVER_BACKGROUND_OPACITY * 255).toString(16).padStart(2, "0"))
          }
        }, columns.map(function (col, colIndex) {
          var cellValue = col.formatter ? col.formatter(row[col.dataIndex]) : row[col.dataIndex];
          return React.createElement("td", {
            key: colIndex,
            title: String(cellValue || ""),
            // Add title attribute to show complete cell content
            style: {
              padding: themeConfig.CELL_PADDING,
              textAlign: "left",
              borderBottom: "1px solid ".concat(themeConfig.BORDER),
              color: themeConfig.TEXT_SECONDARY,
              width: col.width || themeConfig.CELL_MIN_WIDTH,
              minWidth: themeConfig.CELL_MIN_WIDTH,
              height: themeConfig.CELL_HEIGHT,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }
          }, cellValue);
        }));
      }));
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(data) {
        return _regenerator().w(function (_context5) {
          while (1) switch (_context5.n) {
            case 0:
              return _context5.a(2, data);
          }
        }, _callee5);
      }));
      function preprocessData(_x5) {
        return _preprocessData5.apply(this, arguments);
      }
      return preprocessData;
    }()
  }]);
}(React.Component);
window.TableCard = TableCard;

// Mobile touch handler for chart interactions
var ChartMobileTouchHandler = /*#__PURE__*/function () {
  function ChartMobileTouchHandler(chartCard) {
    _classCallCheck(this, ChartMobileTouchHandler);
    this.chartCard = chartCard;
    // Bind touch event handler
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }
  // Handle touch end event - remove interaction effects
  return _createClass(ChartMobileTouchHandler, [{
    key: "handleTouchEnd",
    value: function handleTouchEnd(event) {
      var chart = this.chartCard.chartInstanceRef.current;
      if (chart) {
        // Destroy tooltip and clear all interaction states after a short delay
        setTimeout(function () {
          if (chart) {
            // Hide tooltip first
            chart.dispatchAction({
              type: "hideTip"
            });
            // Destroy tooltip component to ensure it's completely removed
            var tooltipComponent = chart.getModel().getComponent("tooltip");
            if (tooltipComponent) {
              chart.dispatchAction({
                type: "updateAxisPointer",
                currTrigger: "leave",
                x: -1,
                y: -1
              });
            }
            // Hide axisPointer for all axes
            chart.dispatchAction({
              type: "updateAxisPointer",
              currTrigger: "leave"
            });
            // Clear pie chart emphasis states
            chart.dispatchAction({
              type: "downplay"
            });
            // Force clear any remaining tooltip DOM elements
            var tooltipDom = chart.getDom().querySelector(".echarts-tooltip");
            if (tooltipDom) {
              tooltipDom.style.display = "none";
            }
          }
        }, 100);
      }
    }
  }, {
    key: "addEventListeners",
    value: function addEventListeners(element) {
      element.addEventListener("touchend", this.handleTouchEnd, {
        passive: true
      });
    }
  }, {
    key: "removeEventListeners",
    value: function removeEventListeners(element) {
      element.removeEventListener("touchend", this.handleTouchEnd);
    }
    // Mobile-specific ECharts configuration
  }], [{
    key: "optimizeConfigForMobile",
    value: function optimizeConfigForMobile(option) {
      // 创建深拷贝避免修改原配置
      var chartOption = JSON.parse(JSON.stringify(option));
      // 移动端强制设置 tooltip.confine: true
      if (!chartOption.tooltip) {
        chartOption.tooltip = {};
      }
      chartOption.tooltip.confine = true;
      return chartOption;
    }
  }]);
}(); // Chart card component - Chart display component integrated with ECharts functionality
var ChartCard = /*#__PURE__*/function (_React$Component13) {
  function ChartCard(props) {
    var _this22;
    _classCallCheck(this, ChartCard);
    _this22 = _callSuper(this, ChartCard, [props]);
    _this22.chartRef = React.createRef();
    _this22.chartInstanceRef = React.createRef();
    _this22.containerRef = React.createRef();
    _this22.resizeObserverRef = React.createRef();
    _this22.state = {
      error: null
    };
    // Initialize mobile touch handler
    _this22.mobileTouchHandler = new ChartMobileTouchHandler(_this22);
    return _this22;
  }
  _inherits(ChartCard, _React$Component13);
  return _createClass(ChartCard, [{
    key: "validateEChartsOption",
    value:
    // Validate ECharts option and collect warnings without blocking execution
    function validateEChartsOption(option) {
      var _this23 = this;
      var warnings = [];
      if (!option) return warnings;
      // Check if legend or visualMap components exist
      var hasLegendOrVisualMap = function hasLegendOrVisualMap() {
        var hasLegend = option.legend !== undefined;
        var hasVisualMap = option.visualMap !== undefined;
        if (option.series) {
          var series = Array.isArray(option.series) ? option.series : [option.series];
          series.forEach(function (item) {
            if (item.legend) hasLegend = true;
            if (item.visualMap) hasVisualMap = true;
          });
        }
        return {
          hasLegend: hasLegend,
          hasVisualMap: hasVisualMap
        };
      };
      // Validate legend configuration
      var validateLegend = function validateLegend(legend) {
        var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
        var prefixStr = prefix ? "".concat(prefix, ".") : "";
        // Check if position is explicitly declared
        var hasPosition = legend.left !== undefined || legend.right !== undefined || legend.top !== undefined || legend.bottom !== undefined;
        if (!hasPosition) {
          warnings.push("".concat(prefixStr).concat(language.t("warning.legendPositionRequired", "legend must explicitly declare position (left/right/top/bottom)")));
        }
        // Recommend enabling scroll type
        if (!legend.type || legend.type !== "scroll") {
          warnings.push("".concat(prefixStr).concat(language.t("warning.legendScrollRecommended", "legend should enable type: 'scroll' to avoid taking up too much space")));
        }
      };
      // Validate grid configuration
      var validateGrid = function validateGrid(grid) {
        // Check for deprecated containLabel configuration
        if (grid.containLabel === true) {
          warnings.push(language.t("warning.gridContainLabelDeprecated", "grid.containLabel is deprecated in ECharts v6.0.0, recommend using { left: 0, right: 0, top: 0, bottom: 0, containLabel: false } configuration"));
        }
        // Check if position properties are strings or percentages
        ["left", "right", "top", "bottom"].forEach(function (prop) {
          if (grid[prop] !== undefined && typeof grid[prop] === "string") {
            warnings.push("grid.".concat(prop, " ").concat(language.t("warning.gridPositionMustBeNumber", "must be a number, strings or percentages are not allowed")));
          }
        });
        // Check if any position property is not zero and warn user to verify necessity
        var nonZeroPositions = ["left", "right", "top", "bottom"].filter(function (prop) {
          return grid[prop] !== undefined && grid[prop] !== 0;
        });
        if (nonZeroPositions.length > 0) {
          var message = language.t("warning.gridNonZeroPosition", "has non-zero position values ({positions}). Consider using grid.outerBounds instead for better layout control when legend or visualMap components are present.", {
            positions: nonZeroPositions.map(function (prop) {
              return "".concat(prop, ": ").concat(grid[prop]);
            }).join(", ")
          });
          warnings.push("grid ".concat(message));
        }
        // Check outerBounds configuration
        var _hasLegendOrVisualMap = hasLegendOrVisualMap(),
          hasLegend = _hasLegendOrVisualMap.hasLegend,
          hasVisualMap = _hasLegendOrVisualMap.hasVisualMap;
        // Skip outerBounds validation for map charts
        var isMapChart = ChartCard.hasMapComponent(option);
        if (grid.outerBounds) {
          if (!hasLegend && !hasVisualMap) {
            warnings.push(language.t("warning.gridOuterBoundsUnnecessary", "grid.outerBounds should only be used when legend or visualMap components are configured, otherwise remove this configuration"));
          }
          // Check if outerBounds properties are numbers
          ["left", "right", "top", "bottom"].forEach(function (prop) {
            if (grid.outerBounds[prop] !== undefined && typeof grid.outerBounds[prop] !== "number") {
              warnings.push("grid.outerBounds.".concat(prop, " ").concat(language.t("warning.gridOuterBoundsMustBeNumber", "must be a number, strings or percentages are not allowed")));
            }
          });
        } else {
          // Skip outerBounds requirement for special chart types:
          // - Map charts: don't require outerBounds even if visualMap is present
          // - Pie charts: don't require outerBounds even if legend is present
          var isPieChart = ChartCard.hasPieComponent(option);
          var shouldSkipOuterBoundsCheck = isMapChart || isPieChart && hasLegend && !hasVisualMap;
          if (!shouldSkipOuterBoundsCheck && (hasLegend || hasVisualMap)) {
            warnings.push(language.t("warning.gridOuterBoundsRequired", "grid.outerBounds must be configured to reserve space when legend or visualMap components are present"));
          }
        }
      };
      // Validate grid configuration
      if (option.grid) {
        validateGrid(option.grid);
      }
      // Validate top-level legend configuration
      if (option.legend) {
        validateLegend(option.legend);
      }
      // Validate series configuration
      if (option.series) {
        var series = Array.isArray(option.series) ? option.series : [option.series];
        series.forEach(function (item, index) {
          if (item.legend) {
            validateLegend(item.legend, "series[".concat(index, "]"));
          }
        });
      }
      // Collect warnings to ErrorCollector
      if (warnings.length > 0 && window.ErrorCollector) {
        warnings.forEach(function (warningMessage) {
          window.ErrorCollector.collectWarning({
            type: "ECHARTS_CONFIG_WARNING",
            category: "COMPONENT_RENDER",
            message: warningMessage,
            details: {
              cardId: _this23.props.cardId,
              cardType: "ChartCard"
            },
            source: "ChartCard"
          });
        });
      }
      return warnings;
    }
    // Handle chart configuration options
  }, {
    key: "createChartOption",
    value: function createChartOption(option) {
      return this.props.isMobile ? ChartMobileTouchHandler.optimizeConfigForMobile(option) : option;
    }
  }, {
    key: "getDebouncedResize",
    value: function getDebouncedResize() {
      var _this24 = this;
      return window.UTILS.debounce(function () {
        if (_this24.chartInstanceRef.current && _this24.containerRef.current) {
          var containerRect = _this24.containerRef.current.getBoundingClientRect();
          if (containerRect.width > 0 && containerRect.height > 0) {
            _this24.chartInstanceRef.current.resize({
              width: containerRect.width,
              height: containerRect.height
            });
          }
        }
      }, 100);
    }
  }, {
    key: "initChart",
    value: function () {
      var _initChart = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6() {
        var _this25 = this;
        var error, option, containerRect, echartsThemeName, chart, _t;
        return _regenerator().w(function (_context6) {
          while (1) switch (_context6.p = _context6.n) {
            case 0:
              if (!(this.chartRef && this.chartRef.current && this.props.data)) {
                _context6.n = 4;
                break;
              }
              _context6.p = 1;
              // Reset error state
              this.setState({
                error: null
              });
              // Validate ECharts option and collect warnings (non-blocking)
              this.validateEChartsOption(this.props.data);
              // Check if it's a valid ECharts configuration (data already validated in preprocessData)
              if (ChartCard.isValidEChartsOption(this.props.data)) {
                _context6.n = 2;
                break;
              }
              error = new Error(language.t("error.invalidEChartsConfig", "Invalid ECharts configuration data"));
              if (window.ErrorCollector) {
                window.ErrorCollector.collectInvalidEChartsConfigError("ChartCard");
              }
              throw error;
            case 2:
              // Process configuration through createChartOption method
              option = this.createChartOption(this.props.data); // Clean up old chart instance
              if (this.chartInstanceRef && this.chartInstanceRef.current) {
                this.chartInstanceRef.current.dispose();
              }
              // Get container dimensions
              containerRect = this.chartRef.current.getBoundingClientRect(); // Initialize chart with theme
              echartsThemeName = this.props.echartsThemeName;
              chart = echarts.init(this.chartRef.current, echartsThemeName, {
                width: containerRect.width === undefined ? "auto" : containerRect.width,
                height: containerRect.height === undefined ? "auto" : containerRect.height
              });
              if (this.chartInstanceRef) {
                this.chartInstanceRef.current = chart;
              }
              // Listen for ECharts internal errors
              chart.on("error", function (chartError) {
                console.error("ECharts internal error:", chartError);
                if (window.ErrorCollector) {
                  window.ErrorCollector.collectEChartsRenderError(chartError, "ChartCard");
                }
                _this25.setState({
                  error: new Error(language.t("error.chartRenderError", "Error occurred during chart rendering"))
                });
              });
              // Set chart configuration
              chart.setOption(option, true);
              // Resize chart
              if (this.chartInstanceRef && this.chartInstanceRef.current) {
                this.chartInstanceRef.current.resize();
              }
              _context6.n = 4;
              break;
            case 3:
              _context6.p = 3;
              _t = _context6.v;
              console.error("ECharts rendering failed:", _t);
              this.setState({
                error: _t
              });
            case 4:
              return _context6.a(2);
          }
        }, _callee6, this, [[1, 3]]);
      }));
      function initChart() {
        return _initChart.apply(this, arguments);
      }
      return initChart;
    }()
  }, {
    key: "destroy",
    value: function destroy() {
      if (this.resizeObserverRef.current) {
        this.resizeObserverRef.current.disconnect();
      }
      if (this.chartInstanceRef.current) {
        this.chartInstanceRef.current.dispose();
        this.chartInstanceRef.current = null;
      }
    }
    // Helper method to handle chart initialization with error handling
  }, {
    key: "handleChartInit",
    value: function handleChartInit(context) {
      var _this26 = this;
      return this.initChart().catch(function (error) {
        console.error("Chart initialization failed during ".concat(context, ":"), error);
        _this26.setState({
          error: error
        });
      });
    }
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      // Initialize chart (data already preprocessed in BaseCard)
      this.handleChartInit("component mount");
      // Set up window resize listener
      var debouncedResize = this.getDebouncedResize();
      window.addEventListener("resize", debouncedResize);
      if (this.containerRef.current && window.ResizeObserver) {
        this.resizeObserverRef.current = new ResizeObserver(debouncedResize);
        this.resizeObserverRef.current.observe(this.containerRef.current);
      }
      // Add mobile touch event listeners
      if (this.props.isMobile && this.chartRef.current) {
        this.mobileTouchHandler.addEventListeners(this.chartRef.current);
      }
    }
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      if (prevProps.data !== this.props.data) {
        // Reset error state
        this.setState({
          error: null
        });
        // Re-initialize chart (data already preprocessed in BaseCard)
        this.handleChartInit("component update");
      }
      // Handle mobile state changes
      if (prevProps.isMobile !== this.props.isMobile && this.chartRef.current) {
        if (this.props.isMobile) {
          this.mobileTouchHandler.addEventListeners(this.chartRef.current);
        } else {
          this.mobileTouchHandler.removeEventListeners(this.chartRef.current);
        }
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      var debouncedResize = this.getDebouncedResize();
      window.removeEventListener("resize", debouncedResize);
      // Remove mobile touch event listeners (only if they were added)
      if (this.props.isMobile && this.chartRef.current) {
        this.mobileTouchHandler.removeEventListeners(this.chartRef.current);
      }
      this.destroy();
    }
  }, {
    key: "render",
    value: function render() {
      var _this$props4 = this.props,
        data = _this$props4.data,
        dashboardConfig = _this$props4.dashboardConfig;
      // If there's an error, throw it for ErrorBoundary to catch
      if (this.state.error) {
        throw this.state.error;
      }
      if (!data) {
        return React.createElement("div", {
          style: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: dashboardConfig.COLORS_TEXT_SECONDARY
          }
        }, null);
      }
      return React.createElement("div", {
        ref: this.containerRef,
        style: {
          flex: 1,
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: "100%"
        }
      }, React.createElement("div", {
        ref: this.chartRef,
        style: {
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0
        }
      }));
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(data) {
        var mapNames, success, _t2;
        return _regenerator().w(function (_context7) {
          while (1) switch (_context7.p = _context7.n) {
            case 0:
              _context7.p = 0;
              if (ChartCard.isValidEChartsOption(data)) {
                _context7.n = 1;
                break;
              }
              throw new Error(language.t("error.invalidEChartsConfig", "Invalid ECharts configuration data"));
            case 1:
              if (!ChartCard.hasMapComponent(data)) {
                _context7.n = 4;
                break;
              }
              mapNames = ChartCard.extractMapNames(data);
              if (!window.MapManager) {
                _context7.n = 3;
                break;
              }
              _context7.n = 2;
              return window.MapManager.ensureMapsRegistered(mapNames);
            case 2:
              success = _context7.v;
              if (!success) {
                console.warn("[ChartCard] Map preloading failed, but continue processing: ".concat(mapNames.join(", ")));
              }
              _context7.n = 4;
              break;
            case 3:
              console.warn("[ChartCard] MapManager not found, skip map preloading");
            case 4:
              return _context7.a(2, data);
            case 5:
              _context7.p = 5;
              _t2 = _context7.v;
              console.error("[ChartCard] Data preprocessing failed:", _t2);
              throw _t2;
            case 6:
              return _context7.a(2);
          }
        }, _callee7, null, [[0, 5]]);
      }));
      function preprocessData(_x6) {
        return _preprocessData6.apply(this, arguments);
      }
      return preprocessData;
    }() // Static method: Check if it's a valid ECharts configuration object
  }, {
    key: "isValidEChartsOption",
    value: function isValidEChartsOption(data) {
      return data && _typeof(data) === "object" && !Array.isArray(data) && (data.series || data.xAxis || data.yAxis || data.title || data.tooltip || data.legend);
    }
    // Static method: Check if configuration contains map components
  }, {
    key: "hasMapComponent",
    value: function hasMapComponent(option) {
      if (!option) return false;
      // Check for map type in series
      if (option.series) {
        var hasMapSeries = Array.isArray(option.series) ? option.series.some(function (series) {
          return series.type === "map";
        }) : option.series.type === "map";
        if (hasMapSeries) return true;
      }
      // Check geo component
      if (option.geo && option.geo.map) {
        return true;
      }
      return false;
    }
    // Static method: Check if configuration contains pie charts
  }, {
    key: "hasPieComponent",
    value: function hasPieComponent(option) {
      if (!option) return false;
      // Check for pie type in series
      if (option.series) {
        var hasPieSeries = Array.isArray(option.series) ? option.series.some(function (series) {
          return series.type === "pie";
        }) : option.series.type === "pie";
        if (hasPieSeries) return true;
      }
      return false;
    }
    // Static method: Extract required map names from configuration
  }, {
    key: "extractMapNames",
    value: function extractMapNames(option) {
      if (!option) return [];
      var mapNames = [];
      // Extract map names from series
      if (option.series) {
        var series = Array.isArray(option.series) ? option.series : [option.series];
        series.forEach(function (s) {
          if (s.type === "map" && s.map) {
            mapNames.push(s.map);
          }
        });
      }
      // Extract map names from geo component
      if (option.geo && option.geo.map) {
        mapNames.push(option.geo.map);
      }
      return _toConsumableArray(new Set(mapNames));
    }
  }]);
}(React.Component);
window.ChartCard = ChartCard;

// Markdown card - Simplest marked implementation
var MarkdownCard = /*#__PURE__*/function (_React$Component14) {
  function MarkdownCard() {
    _classCallCheck(this, MarkdownCard);
    return _callSuper(this, MarkdownCard, arguments);
  }
  _inherits(MarkdownCard, _React$Component14);
  return _createClass(MarkdownCard, [{
    key: "generateThemeCSS",
    value: function generateThemeCSS() {
      var config = MarkdownCard.getMarkdownThemeConfig(this.props.dashboardConfig);
      var cssRules = [];
      cssRules.push("\n      .markdown-content {\n        font-size: ".concat(config.fontSize, ";\n        line-height: ").concat(config.lineHeight, ";\n        color: ").concat(config.color, ";\n        font-family: ").concat(config.fontFamily, ";\n        height: 100%;\n        overflow-y: auto;\n        box-sizing: border-box;\n      }\n    "));
      Object.keys(config).forEach(function (selector) {
        if (_typeof(config[selector]) === "object" && config[selector] !== null) {
          var styles = Object.entries(config[selector]).map(function (_ref8) {
            var _ref9 = _slicedToArray(_ref8, 2),
              prop = _ref9[0],
              value = _ref9[1];
            // Convert camelCase to kebab-case
            var cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
            return "".concat(cssProp, ": ").concat(value);
          }).join("; ");
          cssRules.push(".markdown-content ".concat(selector, " { ").concat(styles, "; }"));
        }
      });
      return cssRules.join("\n");
    }
  }, {
    key: "render",
    value: function render() {
      var content = "";
      if (typeof this.props.data === "string") {
        content = this.props.data;
      } else if (this.props.data && this.props.data.content) {
        content = this.props.data.content;
      }
      if (!content.trim()) {
        return React.createElement("div", {
          style: {
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999"
          }
        }, language.t("common.noData", "No data"));
      }
      if (!window.marked) {
        return React.createElement("div", {
          style: {
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ff4d4f"
          }
        }, language.t("error.markedLibraryNotLoaded", "marked library not loaded"));
      }
      var html = "";
      try {
        html = window.marked.parse(content);
      } catch (error) {
        return React.createElement("div", {
          style: {
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ff4d4f"
          }
        }, "".concat(language.t("error.renderError", "Render error"), ": ").concat(error.message));
      }
      var themeCSS = this.generateThemeCSS();
      return React.createElement("div", {
        style: {
          height: "100%",
          overflow: "hidden"
        }
      }, [React.createElement("style", {
        key: "markdown-theme",
        dangerouslySetInnerHTML: {
          __html: themeCSS
        }
      }), React.createElement("div", {
        key: "markdown-content",
        className: "markdown-content",
        dangerouslySetInnerHTML: {
          __html: html
        }
      })]);
    }
  }], [{
    key: "preprocessData",
    value: function () {
      var _preprocessData7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(data) {
        return _regenerator().w(function (_context8) {
          while (1) switch (_context8.n) {
            case 0:
              return _context8.a(2, data);
          }
        }, _callee8);
      }));
      function preprocessData(_x7) {
        return _preprocessData7.apply(this, arguments);
      }
      return preprocessData;
    }()
  }, {
    key: "getMarkdownThemeConfig",
    value: function getMarkdownThemeConfig(dashboardConfig) {
      var baseFontSize = (dashboardConfig === null || dashboardConfig === void 0 ? void 0 : dashboardConfig.BASE_FONT_SIZE) || "14px";
      var textColor = (dashboardConfig === null || dashboardConfig === void 0 ? void 0 : dashboardConfig.COLORS_TEXT_PRIMARY) || "#333333";
      return {
        fontSize: baseFontSize,
        lineHeight: "1.6",
        color: textColor,
        fontFamily: (dashboardConfig === null || dashboardConfig === void 0 ? void 0 : dashboardConfig.BODY_FONT_FAMILY) || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h1: {
          fontSize: "1.8em",
          fontWeight: "bold",
          marginBottom: "0.5em"
        },
        h2: {
          fontSize: "1.5em",
          fontWeight: "bold",
          marginBottom: "0.5em"
        },
        h3: {
          fontSize: "1.3em",
          fontWeight: "bold",
          marginBottom: "0.4em"
        },
        h4: {
          fontSize: "1.1em",
          fontWeight: "bold",
          marginBottom: "0.4em"
        },
        p: {
          marginBottom: "0.8em"
        },
        code: {
          backgroundColor: "#f5f5f5",
          padding: "0.2em 0.4em",
          borderRadius: "3px",
          fontSize: "0.9em"
        },
        pre: {
          backgroundColor: "#f5f5f5",
          padding: "0.8em",
          borderRadius: "4px",
          overflow: "auto"
        },
        ul: {
          paddingLeft: "1.5em",
          marginBottom: "0.8em"
        },
        ol: {
          paddingLeft: "1.5em",
          marginBottom: "0.8em"
        },
        a: {
          color: (dashboardConfig === null || dashboardConfig === void 0 ? void 0 : dashboardConfig.COLORS_PRIMARY) || "#0969da",
          textDecoration: "none"
        },
        table: {
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "0.8em"
        },
        th: {
          padding: "0.5em",
          border: "1px solid #ddd",
          fontWeight: "bold"
        },
        td: {
          padding: "0.5em",
          border: "1px solid #ddd"
        }
      };
    }
  }]);
}(React.Component);
window.MarkdownCard = MarkdownCard;

// Empty state component - Used to display no data or empty list state
var Empty = /*#__PURE__*/function (_React$Component15) {
  function Empty(props) {
    _classCallCheck(this, Empty);
    return _callSuper(this, Empty, [props]);
  }
  _inherits(Empty, _React$Component15);
  return _createClass(Empty, [{
    key: "getEmptyThemeConfig",
    value: function getEmptyThemeConfig() {
      var config = this.props.dashboardConfig;
      return {
        ICON_COLOR: (config === null || config === void 0 ? void 0 : config.COLORS_BORDER) || "#e6e7ea"
      };
    }
  }, {
    key: "render",
    value: function render() {
      var themeConfig = this.getEmptyThemeConfig();
      var _this$props5 = this.props,
        _this$props5$iconColo = _this$props5.iconColor,
        iconColor = _this$props5$iconColo === void 0 ? themeConfig.ICON_COLOR : _this$props5$iconColo,
        _this$props5$style = _this$props5.style,
        style = _this$props5$style === void 0 ? {} : _this$props5$style,
        _this$props5$classNam = _this$props5.className,
        className = _this$props5$classNam === void 0 ? "" : _this$props5$classNam;
      var mergedStyle = _objectSpread({}, style);
      return React.createElement("svg", {
        width: "60",
        height: "55",
        viewBox: "0 0 60 55",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        className: className,
        style: mergedStyle
      }, React.createElement("path", {
        transform: "translate(-38, -3.5)",
        fillRule: "evenodd",
        clipRule: "evenodd",
        d: "M45.5548 9.73505C45.0215 10.7793 44.5265 12.2984 44.1941 14.2555C43.7452 16.8992 43.6487 20.016 43.9809 23.1113C44.314 26.2155 45.0643 29.1689 46.2172 31.5408C46.4758 32.0727 46.7491 32.5648 47.0361 33.0171C47.0369 32.7418 47.0392 32.4647 47.0414 32.1872C47.0422 32.0975 47.0429 32.0078 47.0436 31.9181C47.0466 31.524 47.0492 31.1743 47.0492 30.8668C47.0492 29.5207 47.1946 27.2203 48.6709 25.2427C50.2729 23.0968 52.9149 21.9846 56.484 21.9846H60.8024C58.9127 19.6098 55.883 16.2846 52.6595 13.6575C50.9664 12.2777 49.308 11.1634 47.8053 10.465C46.9037 10.046 46.1575 9.82273 45.5548 9.73505ZM75.1977 21.9846H79.516C83.0851 21.9846 85.7271 23.0968 87.3291 25.2427C88.8054 27.2203 88.9508 29.5207 88.9508 30.8668C88.9508 31.1743 88.9534 31.524 88.9564 31.9181C88.9571 32.0078 88.9578 32.0975 88.9586 32.1872C88.9608 32.4646 88.9631 32.7417 88.9639 33.0171C89.2509 32.5648 89.5242 32.0727 89.7828 31.5408C90.9357 29.1689 91.686 26.2155 92.0191 23.1113C92.3513 20.016 92.2548 16.8992 91.8059 14.2555C91.4735 12.2984 90.9785 10.7793 90.4452 9.73505C89.8425 9.82273 89.0963 10.046 88.1947 10.465C86.692 11.1634 85.0336 12.2777 83.3405 13.6575C80.117 16.2846 77.0873 19.6098 75.1977 21.9846ZM84.4493 41.8186C84.1059 41.9474 83.7546 42.0595 83.4042 42.1572C82.032 42.5396 80.4365 42.7662 78.868 42.8229C77.3067 42.8794 75.6339 42.7728 74.1307 42.4052C72.735 42.0639 70.9486 41.3682 69.8391 39.8227C69.3094 39.085 68.8207 38.7647 68.5298 38.6273C68.4022 38.567 68.3053 38.5383 68.2486 38.5254L68 38.5595L67.7514 38.5254C67.6947 38.5383 67.5978 38.567 67.4703 38.6273C67.1793 38.7647 66.6906 39.085 66.1609 39.8227C65.0514 41.3682 63.265 42.0639 61.8693 42.4052C60.3661 42.7728 58.6933 42.8794 57.132 42.8229C55.5635 42.7662 53.968 42.5396 52.5958 42.1572C52.2454 42.0595 51.8941 41.9474 51.5507 41.8186C51.2425 43.085 50.9637 44.0406 50.7159 44.7536L50.7154 44.755C53.3463 47.7974 59.3235 52.3409 67.9223 52.1098L68 52.1077L68.0777 52.1098C76.6765 52.3409 82.6537 47.7974 85.2846 44.755L85.2841 44.7536C85.0363 44.0406 84.7575 43.085 84.4493 41.8186ZM45.9681 40.2995C43.8018 38.7097 42.1873 36.4798 41.0164 34.071C39.4976 30.9463 38.6147 27.306 38.2308 23.7289C37.8459 20.1428 37.9486 16.4905 38.4927 13.2865C39.022 10.1693 40.0287 7.12086 41.7277 5.05064L42.3995 4.23216L43.4406 4.04101C45.8073 3.60652 48.1848 4.26189 50.2418 5.21788C52.3373 6.19178 54.4109 7.62251 56.312 9.17184C59.374 11.6673 62.2175 14.6597 64.2811 17.1061C64.6538 17.0171 65.0058 16.9532 65.3161 16.9054C66.3394 16.748 67.3263 16.7086 68 16.7234C68.6737 16.7086 69.6606 16.748 70.6839 16.9054C70.9942 16.9532 71.3462 17.0171 71.7189 17.1061C73.7825 14.6597 76.626 11.6673 79.688 9.17184C81.5891 7.62251 83.6627 6.19178 85.7582 5.21788C87.8152 4.26189 90.1927 3.60652 92.5594 4.04101L93.6005 4.23216L94.2723 5.05064C95.9713 7.12086 96.978 10.1693 97.5073 13.2865C98.0514 16.4905 98.1541 20.1428 97.7692 23.7289C97.3853 27.306 96.5024 30.9463 94.9836 34.071C93.8127 36.4798 92.1982 38.7097 90.0319 40.2995C90.2561 41.2327 90.4502 41.9303 90.6104 42.4403L93.567 42.8746L91.0879 46.6634C88.4419 50.7071 80.3406 58.1948 68 57.8953C55.6594 58.1948 47.5581 50.7071 44.9121 46.6634L42.433 42.8746L45.3896 42.4403C45.5498 41.9303 45.7439 41.2327 45.9681 40.2995ZM53.3045 28.7047C52.9924 29.1228 52.8324 29.8171 52.8324 30.8668C52.8324 31.1986 52.8295 31.5693 52.8266 31.9546L52.8265 31.9623C52.8144 33.5548 52.8076 34.5174 52.904 35.2723C52.9694 35.7846 53.0668 36.0467 53.1722 36.2203C53.1861 36.2279 53.2019 36.2362 53.2198 36.2453C53.4082 36.3414 53.7145 36.4629 54.1479 36.5838C55.0141 36.8252 56.1503 36.9979 57.341 37.041C58.5387 37.0844 59.6521 36.9914 60.4963 36.7849C61.2613 36.5979 61.4902 36.3979 61.4954 36.4036C63.4862 33.6582 66.0906 32.6429 68 32.7373C69.9094 32.6429 72.5138 33.6583 74.5045 36.4037C74.5097 36.398 74.7387 36.5979 75.5037 36.7849C76.3479 36.9914 77.4613 37.0844 78.659 37.041C79.8497 36.9979 80.9859 36.8252 81.8521 36.5838C82.2855 36.4629 82.5918 36.3414 82.7802 36.2453C82.7981 36.2362 82.8139 36.2279 82.8278 36.2203C82.9332 36.0467 83.0306 35.7846 83.096 35.2723C83.1924 34.5174 83.1856 33.5548 83.1735 31.9623L83.1734 31.954C83.1705 31.5689 83.1676 31.1984 83.1676 30.8668C83.1676 29.8171 83.0076 29.1228 82.6955 28.7047C82.509 28.4548 81.8795 27.7702 79.516 27.7702H56.484C54.1205 27.7702 53.491 28.4548 53.3045 28.7047Z",
        fill: iconColor
      }));
    }
  }]);
}(React.Component);
window.Empty = Empty;

// Card component - Main card component providing common functionality and styles
var BaseCard = /*#__PURE__*/function (_React$Component16) {
  function BaseCard(props) {
    var _this27;
    _classCallCheck(this, BaseCard);
    _this27 = _callSuper(this, BaseCard, [props]);
    _this27.state = {
      data: null,
      dataLoading: true,
      childLoading: false,
      error: null,
      renderStatus: "loading",
      isEditingTitle: false,
      editingTitle: ""
    };
    _this27.hasNotifiedRenderComplete = false;
    return _this27;
  }
  _inherits(BaseCard, _React$Component16);
  return _createClass(BaseCard, [{
    key: "notifyRenderStatusChange",
    value: function notifyRenderStatusChange(status) {
      var error = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      this.setState({
        renderStatus: status
      });
      if (this.hasNotifiedRenderComplete && (status === "success" || status === "error")) {
        return;
      }
      if (status === "success" || status === "error") {
        this.hasNotifiedRenderComplete = true;
      }
      if (this.props.onRenderStatusChange) {
        this.props.onRenderStatusChange({
          cardId: this.cardId,
          status: status,
          error: error,
          timestamp: Date.now()
        });
      }
    }
  }, {
    key: "getBaseCardThemeConfig",
    value: function getBaseCardThemeConfig() {
      var config = this.props.dashboardConfig;
      var fontSize = config.BASE_FONT_SIZE;
      var titleFontSize = config.CARD_TITLE_FONT_SIZE;
      return {
        FONT_SIZE: fontSize,
        TITLE_FONT_SIZE: titleFontSize,
        LOADING_FONT_SIZE: fontSize,
        ERROR_MESSAGE_FONT_SIZE: fontSize,
        ERROR_DETAIL_FONT_SIZE: fontSize,
        LOADING_ICON_SIZE: "20px",
        ERROR_ICON_SIZE: "24px",
        NO_DATA_ICON_SIZE: "24px",
        DRAG_HANDLE_WIDTH: "32px",
        DELETE_BUTTON_SIZE: "18px",
        DELETE_BUTTON_ICON_SIZE: "12px",
        TITLE_MARGIN_BOTTOM: config.CARD_GAP,
        LOADING_ICON_MARGIN: config.CARD_GAP,
        ERROR_ICON_MARGIN: config.CARD_GAP,
        ERROR_MESSAGE_MARGIN: config.CARD_GAP,
        NO_DATA_ICON_MARGIN: config.CARD_GAP,
        NO_DATA_MESSAGE_MARGIN: config.CARD_GAP,
        STATE_PADDING: config.CARD_GAP,
        DRAG_HANDLE_TOP: "-".concat(config.CARD_GAP),
        // Negative card padding value
        DRAG_HANDLE_LEFT: "50%",
        DRAG_HANDLE_MARGIN_LEFT: "-16px",
        // Negative half width for centering
        DRAG_HANDLE_BORDER_RADIUS: config.CARD_BORDER_RADIUS,
        DELETE_BUTTON_TOP: "1px",
        DELETE_BUTTON_RIGHT: "0px",
        DELETE_BUTTON_BORDER_RADIUS: config.CARD_BORDER_RADIUS,
        TEXT_PRIMARY: config.COLORS_TEXT_PRIMARY,
        TEXT_SECONDARY: config.COLORS_TEXT_SECONDARY,
        ERROR: config.COLORS_ERROR,
        NO_DATA_OPACITY: 0.8,
        ERROR_DETAIL_OPACITY: 0.7,
        LOADING_TEXT_OPACITY: 0.7
      };
    }
    // Load data after component mount
  }, {
    key: "componentDidMount",
    value: function () {
      var _componentDidMount = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9() {
        return _regenerator().w(function (_context9) {
          while (1) switch (_context9.n) {
            case 0:
              _context9.n = 1;
              return this.loadCardData();
            case 1:
              // Add global mouse release event listener to ensure drag state is properly cleared
              this.handleGlobalMouseUp = function () {
                var draggingItems = document.querySelectorAll(".react-grid-item.dragging-immediate");
                draggingItems.forEach(function (item) {
                  item.classList.remove("dragging-immediate");
                });
              };
              document.addEventListener("mouseup", this.handleGlobalMouseUp);
              document.addEventListener("mouseleave", this.handleGlobalMouseUp);
            case 2:
              return _context9.a(2);
          }
        }, _callee9, this);
      }));
      function componentDidMount() {
        return _componentDidMount.apply(this, arguments);
      }
      return componentDidMount;
    }()
  }, {
    key: "componentDidUpdate",
    value: function () {
      var _componentDidUpdate = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0(prevProps) {
        return _regenerator().w(function (_context0) {
          while (1) switch (_context0.n) {
            case 0:
              if (!(prevProps.getCardData !== this.props.getCardData)) {
                _context0.n = 1;
                break;
              }
              _context0.n = 1;
              return this.loadCardData();
            case 1:
              return _context0.a(2);
          }
        }, _callee0, this);
      }));
      function componentDidUpdate(_x8) {
        return _componentDidUpdate.apply(this, arguments);
      }
      return componentDidUpdate;
    }()
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      if (this.handleGlobalMouseUp) {
        document.removeEventListener("mouseup", this.handleGlobalMouseUp);
        document.removeEventListener("mouseleave", this.handleGlobalMouseUp);
      }
    }
  }, {
    key: "loadCardData",
    value: function () {
      var _loadCardData = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1() {
        var _this$props6, getCardData, type, rawData, error, processedData, componentClass, _error, _t3, _t4, _t5;
        return _regenerator().w(function (_context1) {
          while (1) switch (_context1.p = _context1.n) {
            case 0:
              _this$props6 = this.props, getCardData = _this$props6.getCardData, type = _this$props6.type; // Notify loading start
              this.notifyRenderStatusChange("loading");
              // If no getCardData function is provided, set to no data state
              if (!(!getCardData || typeof getCardData !== "function")) {
                _context1.n = 1;
                break;
              }
              this.setState({
                data: null,
                dataLoading: false,
                childLoading: false,
                error: null
              });
              // Notify render success (no data is also considered success state)
              this.notifyRenderStatusChange("success");
              return _context1.a(2);
            case 1:
              _context1.p = 1;
              // Set data loading state
              this.setState({
                dataLoading: true,
                error: null
              });
              // Asynchronously get data, pass in csvManager instance
              _context1.p = 2;
              _context1.n = 3;
              return getCardData(window.CSVManager);
            case 3:
              rawData = _context1.v;
              _context1.n = 5;
              break;
            case 4:
              _context1.p = 4;
              _t3 = _context1.v;
              console.error("[BaseCard] Raw data fetch failed (".concat(this.cardId, "):"), _t3);
              error = new Error("Data fetch failed: ".concat(_t3.message));
              if (window.ErrorCollector) {
                window.ErrorCollector.collectDataFetchError(this.cardId, _t3, "BaseCard");
              }
              throw error;
            case 5:
              // Data fetch completed, start child component preprocessing
              this.setState({
                dataLoading: false,
                childLoading: true
              });
              // Preprocess according to card type
              processedData = rawData; // Get corresponding component class and its static preprocessing method
              componentClass = this.getComponentClass(type);
              if (!(componentClass && typeof componentClass.preprocessData === "function")) {
                _context1.n = 10;
                break;
              }
              _context1.p = 6;
              _context1.n = 7;
              return componentClass.preprocessData(rawData);
            case 7:
              processedData = _context1.v;
              // Check preprocessing result, log warning if there are error flags
              if (processedData._preprocessed === false && processedData._preprocessError) {
                console.warn("[BaseCard] ".concat(type, " type data preprocessing has warning (").concat(this.cardId, "): ").concat(processedData._preprocessError));
              }
              _context1.n = 10;
              break;
            case 8:
              _context1.p = 8;
              _t4 = _context1.v;
              console.error("[BaseCard] ".concat(type, " type data preprocessing failed (").concat(this.cardId, "):"), _t4);
              // Decide processing strategy based on error severity
              if (!(_t4.code && _t4.code.includes("INVALID"))) {
                _context1.n = 9;
                break;
              }
              // Serious error (data format error), throw to user
              _error = new Error("Data format error: ".concat(_t4.message));
              if (window.ErrorCollector) {
                window.ErrorCollector.collectDataFormatError(this.cardId, _t4, "BaseCard");
              }
              throw _error;
            case 9:
              // Non-serious error (such as network error), continue with original data
              console.warn("[BaseCard] Preprocessing failed, continue rendering with original data (".concat(this.cardId, ")"));
              processedData = _objectSpread(_objectSpread({}, rawData), {}, {
                _preprocessed: false,
                _preprocessError: _t4.message,
                _preprocessedAt: Date.now()
              });
            case 10:
              // All processing completed
              this.setState({
                data: processedData,
                dataLoading: false,
                childLoading: false,
                error: null
              });
              // Notify render success
              this.notifyRenderStatusChange("success");
              _context1.n = 12;
              break;
            case 11:
              _context1.p = 11;
              _t5 = _context1.v;
              console.error("[BaseCard] Card data loading failed (".concat(this.cardId, "):"), _t5);
              // Set error state
              this.setState({
                data: null,
                dataLoading: false,
                childLoading: false,
                error: _t5
              });
              // Notify render failure
              this.notifyRenderStatusChange("error", _t5);
            case 12:
              return _context1.a(2);
          }
        }, _callee1, this, [[6, 8], [2, 4], [1, 11]]);
      }));
      function loadCardData() {
        return _loadCardData.apply(this, arguments);
      }
      return loadCardData;
    }() // Get component class
  }, {
    key: "getComponentClass",
    value: function getComponentClass(type) {
      var componentClasses = {
        metric: window.MetricCard,
        kpi: window.KPICard,
        table: window.TableCard,
        text: window.TextCard,
        image: window.ImageCard,
        echarts: window.ChartCard
      };
      return componentClasses[type];
    }
    // Calculate overall loading state
  }, {
    key: "isLoading",
    get: function get() {
      return this.state.dataLoading || this.state.childLoading;
    }
    // Get card ID
  }, {
    key: "cardId",
    get: function get() {
      return this.props.id || "card-".concat(Date.now());
    }
    // Get card title
  }, {
    key: "cardTitle",
    get: function get() {
      return this.props.title || "";
    }
    // Get card title alignment
  }, {
    key: "cardTitleAlign",
    get: function get() {
      return this.props.titleAlign || "left";
    }
    // Start editing title
  }, {
    key: "startEditingTitle",
    value: function startEditingTitle() {
      this.setState({
        isEditingTitle: true,
        editingTitle: this.cardTitle
      });
    }
    // Save title changes
  }, {
    key: "saveTitleEdit",
    value: function saveTitleEdit() {
      var newTitle = this.state.editingTitle.trim();
      if (this.props.onTitleChange) {
        this.props.onTitleChange(this.cardId, newTitle);
      }
      this.setState({
        isEditingTitle: false,
        editingTitle: ""
      });
    }
    // Cancel title editing
  }, {
    key: "cancelTitleEdit",
    value: function cancelTitleEdit() {
      this.setState({
        isEditingTitle: false,
        editingTitle: ""
      });
    }
    // Handle title input change
  }, {
    key: "handleTitleInputChange",
    value: function handleTitleInputChange(value) {
      this.setState({
        editingTitle: value
      });
    }
    // Handle title input key press
  }, {
    key: "handleTitleInputKeyPress",
    value: function handleTitleInputKeyPress(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        this.saveTitleEdit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.cancelTitleEdit();
      }
    }
    // Handle title input blur
  }, {
    key: "handleTitleInputBlur",
    value: function handleTitleInputBlur(event) {
      // Check if the blur is caused by clicking on the alignment button
      var relatedTarget = event.relatedTarget || document.activeElement;
      var isClickingAlignmentButton = relatedTarget && (relatedTarget.closest(".action-button.input-button") || relatedTarget.classList.contains("input-button"));
      // Only save if not clicking on alignment button
      if (!isClickingAlignmentButton) {
        this.saveTitleEdit();
      }
    }
    // Toggle title alignment (left -> center -> right -> left)
  }, {
    key: "toggleTitleAlignment",
    value: function toggleTitleAlignment() {
      var currentAlign = this.cardTitleAlign;
      var newAlign;
      switch (currentAlign) {
        case "left":
          newAlign = "center";
          break;
        case "center":
          newAlign = "right";
          break;
        case "right":
          newAlign = "left";
          break;
        default:
          newAlign = "center";
      }
      if (this.props.onTitleAlignChange) {
        this.props.onTitleAlignChange(this.cardId, newAlign);
      }
    }
    // Get card type
  }, {
    key: "cardType",
    get: function get() {
      return this.props.type || "base";
    }
    // Get card style
  }, {
    key: "cardStyle",
    get: function get() {
      return this.props.style || {};
    }
    // Get card class name
  }, {
    key: "cardClassName",
    get: function get() {
      return this.props.className || "";
    }
    // Get card container style
  }, {
    key: "getContainerStyle",
    value: function getContainerStyle() {
      return _objectSpread({
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }, this.cardStyle);
    }
    // Render unified loading state (includes data loading and child component loading)
  }, {
    key: "renderLoadingState",
    value: function renderLoadingState() {
      var themeConfig = this.getBaseCardThemeConfig();
      // Unified loading state for both data loading and child loading
      var icon = React.createElement("i", {
        className: "ti ti-loader loading-icon-spin",
        style: {
          fontSize: "24px"
        }
      });
      var loadingText = language.t("common.loading");
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.LOADING_FONT_SIZE
        }
      }, React.createElement("div", {
        key: "loading-icon",
        style: {
          fontSize: themeConfig.LOADING_ICON_SIZE,
          marginBottom: themeConfig.LOADING_ICON_MARGIN
        }
      }, icon), React.createElement("div", {
        key: "loading-text",
        style: {
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.LOADING_FONT_SIZE,
          opacity: themeConfig.LOADING_TEXT_OPACITY
        }
      }, loadingText));
    }
    // Render error state
  }, {
    key: "renderErrorState",
    value: function renderErrorState() {
      var _this$state$error;
      var themeConfig = this.getBaseCardThemeConfig();
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: themeConfig.STATE_PADDING,
          textAlign: "center"
        }
      }, [React.createElement("div", {
        key: "error-icon",
        style: {
          fontSize: themeConfig.ERROR_ICON_SIZE,
          marginBottom: themeConfig.ERROR_ICON_MARGIN,
          opacity: themeConfig.NO_DATA_OPACITY
        }
      }, React.createElement("i", {
        className: "ti ti-alert-triangle",
        style: {
          fontSize: "24px",
          color: "#ff6b6b"
        }
      })), React.createElement("div", {
        key: "error-message",
        style: {
          color: themeConfig.ERROR,
          fontSize: themeConfig.ERROR_MESSAGE_FONT_SIZE,
          fontWeight: "500",
          marginBottom: themeConfig.ERROR_MESSAGE_MARGIN
        }
      }, language.t("error.title")), React.createElement("div", {
        key: "error-detail",
        style: {
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.ERROR_DETAIL_FONT_SIZE,
          opacity: themeConfig.ERROR_DETAIL_OPACITY
        }
      }, ((_this$state$error = this.state.error) === null || _this$state$error === void 0 ? void 0 : _this$state$error.message) || language.t("common.error"))]);
    }
    // Render no data state
  }, {
    key: "renderNoDataState",
    value: function renderNoDataState() {
      var themeConfig = this.getBaseCardThemeConfig();
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: themeConfig.STATE_PADDING,
          textAlign: "center",
          color: themeConfig.TEXT_SECONDARY
        }
      }, [React.createElement("div", {
        key: "no-data-icon",
        style: {
          fontSize: themeConfig.NO_DATA_ICON_SIZE,
          marginBottom: themeConfig.NO_DATA_ICON_MARGIN,
          opacity: themeConfig.NO_DATA_OPACITY
        }
      }, React.createElement("i", {
        className: "ti ti-inbox",
        style: {
          fontSize: "24px",
          color: "#666"
        }
      })), React.createElement("div", {
        key: "no-data-message",
        style: {
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.LOADING_FONT_SIZE,
          fontWeight: "500",
          marginBottom: themeConfig.NO_DATA_MESSAGE_MARGIN
        }
      }, language.t("common.noData"))]);
    }
    // Create child card component based on type
  }, {
    key: "createChildCard",
    value: function createChildCard() {
      var _this28 = this;
      var _this$props7 = this.props,
        type = _this$props7.type,
        dashboardConfig = _this$props7.dashboardConfig,
        getCardData = _this$props7.getCardData;
      var _this$state8 = this.state,
        data = _this$state8.data,
        dataLoading = _this$state8.dataLoading,
        childLoading = _this$state8.childLoading,
        error = _this$state8.error;
      // If loading (data loading or child component loading), show loading state
      if (dataLoading || childLoading) {
        return this.renderLoadingState();
      }
      // If loading error, show error state
      if (error) {
        return this.renderErrorState();
      }
      // If no getCardData function is provided, show no data state
      if (!getCardData || typeof getCardData !== "function") {
        return this.renderNoDataState();
      }
      // If data loading succeeded but data is empty, show no data state
      if (!data) {
        return this.renderNoDataState();
      }
      var cardTypes = {
        // Base cards
        base: function base() {
          return _this28.renderDefaultContent();
        },
        metric: MetricCard,
        kpi: KPICard,
        table: TableCard,
        text: TextCard,
        image: ImageCard,
        markdown: MarkdownCard,
        // Chart cards - unified use of echarts type
        echarts: ChartCard
      };
      var CardComponent = cardTypes[type];
      var childElement;
      if (typeof CardComponent === "function" && CardComponent !== this.renderDefaultContent) {
        // Render child card component, pass in preprocessed data
        childElement = React.createElement(CardComponent, {
          data: data,
          dashboardConfig: dashboardConfig,
          cardId: this.cardId,
          isMobile: this.props.isMobile || false,
          echartsThemeName: this.props.echartsThemeName
        });
      } else if (CardComponent === this.renderDefaultContent) {
        // Render default content
        childElement = CardComponent();
      } else {
        // Unknown type, render default content
        childElement = this.renderDefaultContent();
      }
      // Wrap child card component with ErrorBoundary
      return React.createElement(window.ErrorBoundary, {
        cardType: type,
        cardId: this.cardId,
        dashboardConfig: dashboardConfig
      }, childElement);
    }
    // Render default card content
  }, {
    key: "renderDefaultContent",
    value: function renderDefaultContent() {
      var themeConfig = this.getBaseCardThemeConfig();
      return React.createElement("div", {
        style: {
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: themeConfig.TEXT_SECONDARY,
          fontSize: themeConfig.FONT_SIZE
        }
      }, null);
    }
    // Render drag handle
  }, {
    key: "renderDragHandle",
    value: function renderDragHandle() {
      var _this$props$editorCon;
      var isDraggable = ((_this$props$editorCon = this.props.editorConfig) === null || _this$props$editorCon === void 0 ? void 0 : _this$props$editorCon.DRAGGABLE) || false;
      if (!isDraggable) return null;
      var themeConfig = this.getBaseCardThemeConfig();
      return React.createElement("div", {
        key: "drag-handle",
        className: "drag-handle",
        style: {
          position: "absolute",
          top: themeConfig.DRAG_HANDLE_TOP,
          left: themeConfig.DRAG_HANDLE_LEFT,
          marginLeft: themeConfig.DRAG_HANDLE_MARGIN_LEFT,
          width: themeConfig.DRAG_HANDLE_WIDTH,
          height: "12px",
          // Reduce height
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "0 0 2px 2px",
          // Only bottom rounded corners
          backgroundColor: "rgba(128, 128, 128, 0.3)",
          // Gray semi-transparent background
          // Remove inline opacity and visibility styles, let CSS control show/hide
          transition: "all 0.2s ease",
          zIndex: 10
        },
        onMouseDown: function onMouseDown(e) {
          // Immediately add dragging style class to parent element
          var gridItem = e.currentTarget.closest(".react-grid-item");
          if (gridItem) {
            gridItem.classList.add("dragging-immediate");
          }
        },
        onMouseUp: function onMouseUp(e) {
          // Remove immediate drag style
          var gridItem = e.currentTarget.closest(".react-grid-item");
          if (gridItem) {
            gridItem.classList.remove("dragging-immediate");
          }
        }
      }, React.createElement("svg", {
        width: "16",
        height: "10",
        viewBox: "0 0 16 10",
        fill: "none",
        style: {
          pointerEvents: "none",
          display: "block",
          margin: "auto"
        }
      }, [React.createElement("rect", {
        key: "line1",
        x: "2",
        y: "2",
        width: "12",
        height: "1.2",
        fill: themeConfig.TEXT_SECONDARY,
        rx: "0.6"
      }), React.createElement("rect", {
        key: "line2",
        x: "2",
        y: "4.4",
        width: "12",
        height: "1.2",
        fill: themeConfig.TEXT_SECONDARY,
        rx: "0.6"
      }), React.createElement("rect", {
        key: "line3",
        x: "2",
        y: "6.8",
        width: "12",
        height: "1.2",
        fill: themeConfig.TEXT_SECONDARY,
        rx: "0.6"
      })]));
    }
    // Render unified action button with configurable parameters
  }, {
    key: "renderActionButton",
    value: function renderActionButton(config) {
      var key = config.key,
        className = config.className,
        icon = config.icon,
        onClick = config.onClick,
        onMouseDown = config.onMouseDown,
        _config$condition = config.condition,
        condition = _config$condition === void 0 ? true : _config$condition,
        _config$tooltip = config.tooltip,
        tooltip = _config$tooltip === void 0 ? null : _config$tooltip;
      if (!condition) return null;
      var themeConfig = this.getBaseCardThemeConfig();
      return React.createElement("div", {
        key: key,
        className: className,
        style: {
          width: themeConfig.DELETE_BUTTON_SIZE,
          height: themeConfig.DELETE_BUTTON_SIZE,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: themeConfig.DELETE_BUTTON_BORDER_RADIUS,
          transition: "all 0.2s ease"
        },
        onClick: onClick,
        onMouseDown: onMouseDown,
        title: tooltip
      }, React.createElement("i", {
        className: icon,
        style: _objectSpread({
          fontSize: themeConfig.DELETE_BUTTON_ICON_SIZE,
          color: themeConfig.TEXT_SECONDARY,
          pointerEvents: "none"
        }, icon === "ti ti-x" && {
          transform: "translateX(0.45px) translateY(0.6px)"
        })
      }));
    }
    // Render expand button (for modal)
  }, {
    key: "renderExpandButton",
    value: function renderExpandButton() {
      var _this$props$editorCon2,
        _this29 = this;
      var isExpandable = ((_this$props$editorCon2 = this.props.editorConfig) === null || _this$props$editorCon2 === void 0 ? void 0 : _this$props$editorCon2.EXPANDABLE) || false;
      return this.renderActionButton({
        key: "expand-button",
        className: "action-button",
        icon: "ti ti-maximize",
        condition: isExpandable,
        onClick: function onClick(e) {
          e.preventDefault();
          e.stopPropagation();
          _this29.showInModal();
        },
        tooltip: language.t("common.expandInModal")
      });
    }
    // Render delete button
  }, {
    key: "renderDeleteButton",
    value: function renderDeleteButton() {
      var _this$props$editorCon3,
        _this30 = this;
      var isDeletable = ((_this$props$editorCon3 = this.props.editorConfig) === null || _this$props$editorCon3 === void 0 ? void 0 : _this$props$editorCon3.DELETABLE) || false;
      return this.renderActionButton({
        key: "delete-button",
        className: "action-button",
        icon: "ti ti-x",
        condition: isDeletable,
        onClick: function onClick(e) {
          e.preventDefault();
          e.stopPropagation();
          if (_this30.props.onDeleteCard) {
            _this30.props.onDeleteCard(_this30.cardId);
          }
        },
        tooltip: language.t("common.deleteCard")
      });
    }
    // Render add title button
  }, {
    key: "renderAddTitleButton",
    value: function renderAddTitleButton() {
      var _this$props$editorCon4,
        _this31 = this;
      var isEditable = ((_this$props$editorCon4 = this.props.editorConfig) === null || _this$props$editorCon4 === void 0 ? void 0 : _this$props$editorCon4.EDITABLE) || false;
      return this.renderActionButton({
        key: "add-title-button",
        className: "action-button",
        icon: "ti ti-edit",
        condition: isEditable,
        onClick: function onClick(e) {
          e.preventDefault();
          e.stopPropagation();
          _this31.startEditingTitle();
        },
        tooltip: language.t("common.addTitle")
      });
    }
    // Render title alignment button
  }, {
    key: "renderTitleAlignmentButton",
    value: function renderTitleAlignmentButton() {
      var _this$props$editorCon5,
        _this32 = this;
      var isEditable = ((_this$props$editorCon5 = this.props.editorConfig) === null || _this$props$editorCon5 === void 0 ? void 0 : _this$props$editorCon5.EDITABLE) || false;
      var isEditingTitle = this.state.isEditingTitle;
      // Only show when editing title
      if (!isEditingTitle || !isEditable) return null;
      // Get next alignment icon (show what will happen when clicked)
      var getNextAlignmentIcon = function getNextAlignmentIcon(currentAlign) {
        switch (currentAlign) {
          case "left":
            return "ti ti-align-center";
          // Next: center
          case "center":
            return "ti ti-align-right";
          // Next: right
          case "right":
            return "ti ti-align-left";
          // Next: left
          default:
            return "ti ti-align-center";
          // Default next: center
        }
      };
      return this.renderActionButton({
        key: "title-alignment-button",
        className: "action-button input-button",
        icon: getNextAlignmentIcon(this.cardTitleAlign),
        condition: true,
        onClick: function onClick(e) {
          e.preventDefault();
          e.stopPropagation();
          _this32.toggleTitleAlignment();
        },
        onMouseDown: function onMouseDown(e) {
          // Prevent button from taking focus, which would cause input blur
          e.preventDefault();
        }
      });
    }
    // Render title content (either text or input)
  }, {
    key: "renderTitleContent",
    value: function renderTitleContent(themeConfig) {
      var _this$props$editorCon6,
        _this33 = this;
      var isEditable = ((_this$props$editorCon6 = this.props.editorConfig) === null || _this$props$editorCon6 === void 0 ? void 0 : _this$props$editorCon6.EDITABLE) || false;
      var _this$state9 = this.state,
        isEditingTitle = _this$state9.isEditingTitle,
        editingTitle = _this$state9.editingTitle;
      if (isEditingTitle && isEditable) {
        // Render input with alignment button positioned inside
        return React.createElement("div", {
          style: {
            position: "relative",
            display: "inline-block"
          }
        }, [React.createElement(window.Input, {
          key: "title-input",
          value: editingTitle,
          onChange: function onChange(value) {
            return _this33.handleTitleInputChange(value);
          },
          onKeyDown: function onKeyDown(e) {
            return _this33.handleTitleInputKeyPress(e);
          },
          onBlur: function onBlur(e) {
            return _this33.handleTitleInputBlur(e);
          },
          autoFocus: true,
          style: {
            width: "100%",
            maxWidth: "160px",
            height: "100%"
          },
          inputStyle: {
            paddingRight: "24px"
          }
        }), React.createElement("div", {
          key: "alignment-button-container",
          style: {
            position: "absolute",
            right: "4px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10
          }
        }, this.renderTitleAlignmentButton())].filter(Boolean));
      } else {
        // Render normal title text
        return React.createElement("span", {
          className: "card-title",
          style: {
            cursor: isEditable ? "pointer" : undefined,
            maxWidth: "100%",
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "2px"
          },
          onClick: isEditable ? function () {
            return _this33.startEditingTitle();
          } : undefined,
          title: this.cardTitle
        }, [React.createElement("div", {
          style: {
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            color: themeConfig.TEXT_PRIMARY,
            fontSize: themeConfig.TITLE_FONT_SIZE,
            fontWeight: "500",
            flex: 1
          }
        }, this.cardTitle), isEditable && this.renderActionButton({
          key: "title-edit-button",
          className: "action-button title-edit-button",
          icon: "ti ti-edit",
          condition: true,
          onClick: function onClick(e) {
            e.preventDefault();
            e.stopPropagation();
            _this33.startEditingTitle();
          },
          tooltip: language.t("common.editTitle")
        })].filter(Boolean));
      }
    }
    // Render action buttons container
  }, {
    key: "renderActionButtons",
    value: function renderActionButtons() {
      var _this$props$editorCon7, _this$props$editorCon8, _this$props$editorCon9;
      var isAbsolute = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      var isExpandable = ((_this$props$editorCon7 = this.props.editorConfig) === null || _this$props$editorCon7 === void 0 ? void 0 : _this$props$editorCon7.EXPANDABLE) || false;
      var isDeletable = ((_this$props$editorCon8 = this.props.editorConfig) === null || _this$props$editorCon8 === void 0 ? void 0 : _this$props$editorCon8.DELETABLE) || false;
      var isEditable = ((_this$props$editorCon9 = this.props.editorConfig) === null || _this$props$editorCon9 === void 0 ? void 0 : _this$props$editorCon9.EDITABLE) || false;
      var hasTitle = !!this.cardTitle;
      // When absolute positioning (no title), check if we have add title button or other buttons
      // When not absolute (has title), check if we have expand/delete buttons
      var hasButtons = isAbsolute ? isEditable && !hasTitle || isExpandable || isDeletable : isExpandable || isDeletable;
      // If no action buttons are enabled, return null
      if (!hasButtons) return null;
      var buttons = [];
      // Add title button only when no title exists and in absolute mode
      if (isAbsolute && !hasTitle && isEditable) {
        buttons.push(this.renderAddTitleButton());
      }
      // Add expand button if enabled
      if (isExpandable) {
        buttons.push(this.renderExpandButton());
      }
      // Add delete button if enabled
      if (isDeletable) {
        buttons.push(this.renderDeleteButton());
      }
      var themeConfig = this.getBaseCardThemeConfig();
      return React.createElement("div", {
        key: "action-buttons",
        className: "action-buttons-container",
        style: _objectSpread({
          display: "flex",
          alignItems: "center",
          gap: "2px",
          // Gap between buttons
          flexShrink: 0
        }, isAbsolute && {
          position: "absolute",
          top: themeConfig.DELETE_BUTTON_TOP,
          right: themeConfig.DELETE_BUTTON_RIGHT,
          zIndex: 30 // Higher than table sticky header (z-index: 20)
        })
      }, buttons);
    }
    // Calculate action buttons width for center alignment offset
  }, {
    key: "calculateActionButtonsWidth",
    value: function calculateActionButtonsWidth() {
      var _this$props$editorCon0, _this$props$editorCon1;
      var isExpandable = ((_this$props$editorCon0 = this.props.editorConfig) === null || _this$props$editorCon0 === void 0 ? void 0 : _this$props$editorCon0.EXPANDABLE) || false;
      var isDeletable = ((_this$props$editorCon1 = this.props.editorConfig) === null || _this$props$editorCon1 === void 0 ? void 0 : _this$props$editorCon1.DELETABLE) || false;
      var themeConfig = this.getBaseCardThemeConfig();
      var buttonCount = 0;
      if (isExpandable) buttonCount++;
      if (isDeletable) buttonCount++;
      if (buttonCount === 0) return 0;
      // Calculate total width: button size * count + gap between buttons
      var buttonSize = parseFloat(themeConfig.DELETE_BUTTON_SIZE);
      var gap = 2; // Gap between buttons as defined in renderActionButtons
      var totalWidth = buttonSize * buttonCount + gap * (buttonCount - 1);
      return totalWidth;
    }
    // Render card header (title + action buttons)
  }, {
    key: "renderCardHeader",
    value: function renderCardHeader() {
      var _this34 = this;
      var hasTitle = !!this.cardTitle;
      var isEditingTitle = this.state.isEditingTitle;
      // If no title and not editing, return null (action buttons will be rendered absolutely)
      if (!hasTitle && !isEditingTitle) return null;
      var themeConfig = this.getBaseCardThemeConfig();
      var headerElements = [];
      // Convert textAlign values to justifyContent values
      var getJustifyContent = function getJustifyContent(align) {
        switch (align) {
          case "left":
            return "flex-start";
          case "center":
            return "center";
          case "right":
            return "flex-end";
          default:
            return "flex-start";
        }
      };
      // Create action buttons if they exist (not absolute when header is rendered)
      var actionButtons = this.renderActionButtons(false);
      var actionButtonsWidth = this.calculateActionButtonsWidth();
      // Calculate title container style with center alignment offset
      var getTitleContainerStyle = function getTitleContainerStyle() {
        var baseStyle = {
          flex: 1,
          // Take remaining space
          minWidth: 0,
          // Allow text to shrink
          display: "flex",
          justifyContent: getJustifyContent(_this34.cardTitleAlign),
          height: "100%",
          alignItems: "center"
        };
        // For center alignment in non-editing state, offset by half the action buttons width plus gap to achieve true centering
        if (_this34.cardTitleAlign === "center" && !isEditingTitle && actionButtons && actionButtonsWidth > 0) {
          var gap = 4; // Gap between title and buttons as defined in renderCardHeader
          var offset = (actionButtonsWidth + gap) / 2;
          baseStyle.transform = "translateX(".concat(offset, "px)");
        }
        return baseStyle;
      };
      // Create title element (always create when header is rendered)
      var titleElement = React.createElement("div", {
        key: "card-title-container",
        className: "card-title-container",
        style: getTitleContainerStyle()
      }, this.renderTitleContent(themeConfig));
      // Add elements in different order based on title alignment
      if (this.cardTitleAlign === "right") {
        // When title is right-aligned, put action buttons first, then title
        if (actionButtons) {
          headerElements.push(actionButtons);
        }
        headerElements.push(titleElement);
      } else {
        // Default order: title first, then action buttons
        headerElements.push(titleElement);
        if (actionButtons) {
          headerElements.push(actionButtons);
        }
      }
      return React.createElement("div", {
        key: "card-header",
        className: "card-header",
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "20px",
          marginBottom: themeConfig.TITLE_MARGIN_BOTTOM,
          flexShrink: 0,
          gap: "4px" // Gap between title and buttons
        }
      }, headerElements);
    }
    // Show card in modal
  }, {
    key: "showInModal",
    value: function showInModal() {
      if (window.CardModal) {
        var title = this.cardTitle;
        try {
          window.CardModal.open(title, this.createChildCard());
        } catch (error) {
          console.error("Error opening modal:", error);
        }
      } else {
        console.error("CardModal not found on window object");
      }
    }
    // Render complete card
  }, {
    key: "render",
    value: function render() {
      var _this$props$editorCon10, _this$props$editorCon11, _this$props$editorCon12, _React;
      var hasTitle = !!this.cardTitle;
      var isEditingTitle = this.state.isEditingTitle;
      var isExpandable = ((_this$props$editorCon10 = this.props.editorConfig) === null || _this$props$editorCon10 === void 0 ? void 0 : _this$props$editorCon10.EXPANDABLE) || false;
      var isDeletable = ((_this$props$editorCon11 = this.props.editorConfig) === null || _this$props$editorCon11 === void 0 ? void 0 : _this$props$editorCon11.DELETABLE) || false;
      var isEditable = ((_this$props$editorCon12 = this.props.editorConfig) === null || _this$props$editorCon12 === void 0 ? void 0 : _this$props$editorCon12.EDITABLE) || false;
      // Check if we should show action buttons when no title (and not editing)
      var hasActionButtons = isExpandable || isDeletable || isEditable && !hasTitle;
      var containerStyle = _objectSpread(_objectSpread({}, this.getContainerStyle()), {}, {
        position: "relative" // Ensure drag handle can be absolutely positioned
      });
      var elements = [this.renderDragHandle(), this.renderCardHeader(), this.createChildCard()];
      // If no title, not editing, but has action buttons, add absolutely positioned action buttons
      if (!hasTitle && !isEditingTitle && hasActionButtons) {
        elements.splice(1, 0, this.renderActionButtons(true)); // Insert after drag handle, before header
      }
      return React.createElement("div", {
        className: "base-card ".concat(this.cardClassName),
        style: containerStyle,
        "data-card-id": this.cardId,
        "data-card-type": this.cardType
      }, (_React = React).createElement.apply(_React, [React.Fragment, null].concat(_toConsumableArray(elements.filter(Boolean)))));
    }
  }]);
}(React.Component);
window.BaseCard = BaseCard;

// Error collector - Unified collection and management of various errors in the dashboard
var ErrorCollector = /*#__PURE__*/function () {
  function ErrorCollector() {
    _classCallCheck(this, ErrorCollector);
    this.errors = [];
    this.errorCounts = new Map();
    this.warnings = [];
    this.warningCounts = new Map();
    this.listeners = [];
    this.initGlobalErrorHandlers();
  }
  return _createClass(ErrorCollector, [{
    key: "initGlobalErrorHandlers",
    value: function initGlobalErrorHandlers() {
      var _this35 = this;
      window.addEventListener("error", function (event) {
        var _event$error;
        _this35.collectError({
          type: "JAVASCRIPT_ERROR",
          category: "RUNTIME",
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: (_event$error = event.error) === null || _event$error === void 0 ? void 0 : _event$error.stack,
          source: "window.error"
        });
      });
      window.addEventListener("unhandledrejection", function (event) {
        var _event$reason, _event$reason2;
        _this35.collectError({
          type: "UNHANDLED_PROMISE_REJECTION",
          category: "RUNTIME",
          message: ((_event$reason = event.reason) === null || _event$reason === void 0 ? void 0 : _event$reason.message) || String(event.reason),
          stack: (_event$reason2 = event.reason) === null || _event$reason2 === void 0 ? void 0 : _event$reason2.stack,
          source: "unhandledrejection"
        });
      });
      document.addEventListener("ComponentError", function (event) {
        _this35.collectError({
          type: "REACT_COMPONENT_ERROR",
          category: "COMPONENT_RENDER",
          message: event.detail.error,
          stack: event.detail.stack,
          componentStack: event.detail.componentStack,
          cardType: event.detail.cardType,
          cardId: event.detail.cardId,
          source: "ErrorBoundary"
        });
      });
    }
  }, {
    key: "collectError",
    value: function collectError(errorInfo) {
      var error = _objectSpread({
        id: this.generateErrorId(),
        timestamp: Date.now(),
        type: errorInfo.type || "UNKNOWN_ERROR",
        category: errorInfo.category || "UNKNOWN",
        message: errorInfo.message || "Unknown error",
        details: errorInfo.details || {},
        stack: errorInfo.stack,
        componentStack: errorInfo.componentStack,
        source: errorInfo.source || "manual",
        severity: "ERROR",
        context: this.captureContext(errorInfo)
      }, errorInfo);
      this.errors.push(error);
      var count = this.errorCounts.get(error.type) || 0;
      this.errorCounts.set(error.type, count + 1);
      this.notifyListeners(error);
      this.logError(error);
      return error.id;
    }
  }, {
    key: "collectWarning",
    value: function collectWarning(warningInfo) {
      var warning = _objectSpread({
        id: this.generateWarningId(),
        timestamp: Date.now(),
        type: warningInfo.type || "UNKNOWN_WARNING",
        category: warningInfo.category || "UNKNOWN",
        message: warningInfo.message || "Unknown warning",
        details: warningInfo.details || {},
        source: warningInfo.source || "manual",
        severity: "WARNING",
        context: this.captureContext(warningInfo)
      }, warningInfo);
      this.warnings.push(warning);
      var count = this.warningCounts.get(warning.type) || 0;
      this.warningCounts.set(warning.type, count + 1);
      this.notifyListeners(warning);
      this.logWarning(warning);
      return warning.id;
    }
  }, {
    key: "collectDataLoadError",
    value: function collectDataLoadError(errorInfo) {
      return this.collectError(_objectSpread(_objectSpread({}, errorInfo), {}, {
        category: "DATA_LOAD",
        type: errorInfo.type || "DATA_LOAD_ERROR"
      }));
    }
  }, {
    key: "collectCSVLoadError",
    value: function collectCSVLoadError(fileName, httpStatus, statusText) {
      var source = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "CSVManager";
      return this.collectError({
        type: "CSV_LOAD_FAILED",
        category: "DATA_LOAD",
        message: "HTTP ".concat(httpStatus, ": ").concat(statusText),
        details: {
          fileName: fileName,
          httpStatus: httpStatus,
          statusText: statusText
        },
        source: source
      });
    }
  }, {
    key: "collectInvalidFileNameError",
    value: function collectInvalidFileNameError(fileName) {
      var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "CSVManager";
      return this.collectError({
        type: "INVALID_FILE_NAME",
        category: "DATA_LOAD",
        message: "Invalid file name",
        details: {
          fileName: fileName,
          fileNameType: _typeof(fileName)
        },
        source: source
      });
    }
  }, {
    key: "collectDataSourceNotFoundError",
    value: function collectDataSourceNotFoundError(fileName) {
      var _window$magicDashboar;
      var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "CSVManager";
      return this.collectError({
        type: "DATA_SOURCE_NOT_FOUND",
        category: "DATA_LOAD",
        message: "File configuration not found in magicDashboard.dataSources: ".concat(fileName),
        details: {
          fileName: fileName,
          availableConfigs: ((_window$magicDashboar = window.magicDashboard) === null || _window$magicDashboar === void 0 || (_window$magicDashboar = _window$magicDashboar.dataSources) === null || _window$magicDashboar === void 0 ? void 0 : _window$magicDashboar.map(function (c) {
            return c.name;
          })) || []
        },
        source: source
      });
    }
  }, {
    key: "collectCSVParseError",
    value: function collectCSVParseError(fileName, parseError) {
      var source = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "CSVManager";
      return this.collectError({
        type: "CSV_PARSE_FAILED",
        category: "DATA_LOAD",
        message: "CSV parsing failed: ".concat(parseError.message || parseError),
        details: {
          fileName: fileName,
          parseError: parseError.message || String(parseError)
        },
        source: source
      });
    }
  }, {
    key: "collectDataFetchError",
    value: function collectDataFetchError(cardId, dataError) {
      var source = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "BaseCard";
      return this.collectError({
        type: "DATA_FETCH_FAILED",
        category: "DATA_LOAD",
        message: "Data fetch failed: ".concat(dataError.message),
        details: {
          cardId: cardId,
          originalError: dataError.message
        },
        source: source
      });
    }
  }, {
    key: "collectDataFormatError",
    value: function collectDataFormatError(cardId, preprocessError) {
      var source = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "BaseCard";
      return this.collectError({
        type: "DATA_FORMAT_ERROR",
        category: "DATA_LOAD",
        message: "Data format error: ".concat(preprocessError.message),
        details: {
          cardId: cardId,
          errorCode: preprocessError.code,
          originalError: preprocessError.message
        },
        source: source
      });
    }
  }, {
    key: "collectInvalidEChartsConfigError",
    value: function collectInvalidEChartsConfigError() {
      var source = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "ChartCard";
      return this.collectError({
        type: "INVALID_ECHARTS_CONFIG",
        category: "COMPONENT_RENDER",
        message: "Invalid ECharts configuration data",
        source: source
      });
    }
  }, {
    key: "collectEChartsRenderError",
    value: function collectEChartsRenderError(chartError) {
      var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "ChartCard";
      return this.collectError({
        type: "ECHARTS_RENDER_ERROR",
        category: "COMPONENT_RENDER",
        message: "Error occurred during chart rendering",
        details: {
          chartError: chartError.message || String(chartError)
        },
        source: source
      });
    }
  }, {
    key: "collectMapLoadError",
    value: function collectMapLoadError(mapUrl, httpStatus, statusText) {
      var source = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "MapManager";
      return this.collectError({
        type: "MAP_LOAD_FAILED",
        category: "CONFIG_DEPENDENCY",
        message: "HTTP ".concat(httpStatus, ": ").concat(statusText),
        details: {
          mapUrl: mapUrl,
          httpStatus: httpStatus,
          statusText: statusText
        },
        source: source
      });
    }
  }, {
    key: "collectCardsWithoutLayoutWarning",
    value: function collectCardsWithoutLayoutWarning(cardsWithoutLayout, totalCardsCount) {
      var source = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "GridDashboard";
      var cardsWithoutLayoutCount = cardsWithoutLayout.length;
      var cardIds = cardsWithoutLayout.map(function (card) {
        return card.id;
      });
      var cardTitles = cardsWithoutLayout.map(function (card) {
        return card.title || "Untitled";
      });
      // Get localized message using the language system
      var message = window.language ? window.language.t("warning.cardsWithoutLayout", "", {
        count: cardsWithoutLayoutCount,
        total: totalCardsCount,
        cardIds: cardIds.join(", ")
      }) : "Found ".concat(cardsWithoutLayoutCount, " card(s) without layout configuration out of ").concat(totalCardsCount, " total cards: ").concat(cardIds.join(", "));
      return this.collectWarning({
        type: "CARDS_WITHOUT_LAYOUT",
        category: "LAYOUT_CONFIG",
        message: message,
        details: {
          cardsWithoutLayoutCount: cardsWithoutLayoutCount,
          totalCardsCount: totalCardsCount,
          cardsWithLayoutCount: totalCardsCount - cardsWithoutLayoutCount,
          cardsWithoutLayoutIds: cardIds,
          cardsWithoutLayoutTitles: cardTitles,
          cardsWithoutLayout: cardsWithoutLayout.map(function (card) {
            return {
              id: card.id,
              title: card.title || "Untitled",
              type: card.type || "Unknown"
            };
          })
        },
        source: source
      });
    }
  }, {
    key: "generateErrorId",
    value: function generateErrorId() {
      return "error_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    }
  }, {
    key: "generateWarningId",
    value: function generateWarningId() {
      return "warning_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
    }
  }, {
    key: "captureContext",
    value: function captureContext(errorInfo) {
      return {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        dashboardState: {
          cardsCount: document.querySelectorAll(".base-card").length,
          loadingCards: document.querySelectorAll(".base-card .loading").length,
          errorCards: document.querySelectorAll(".base-card .error-card").length
        }
      };
    }
  }, {
    key: "logError",
    value: function logError(error) {
      var prefix = "[ErrorCollector]";
      var message = "".concat(prefix, " [ERROR] ").concat(error.type, ": ").concat(error.message);
      console.error(message, error);
    }
  }, {
    key: "logWarning",
    value: function logWarning(warning) {
      var prefix = "[ErrorCollector]";
      var message = "".concat(prefix, " [WARNING] ").concat(warning.type, ": ").concat(warning.message);
      console.warn(message, warning);
    }
  }, {
    key: "notifyListeners",
    value: function notifyListeners(error) {
      this.listeners.forEach(function (listener) {
        try {
          listener(error);
        } catch (e) {
          console.error("[ErrorCollector] Listener execution failed:", e);
        }
      });
    }
  }, {
    key: "addListener",
    value: function addListener(listener) {
      if (typeof listener === "function") {
        this.listeners.push(listener);
      }
    }
  }, {
    key: "removeListener",
    value: function removeListener(listener) {
      var index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }, {
    key: "getErrorStats",
    value: function getErrorStats() {
      var stats = {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        errorsByType: Object.fromEntries(this.errorCounts),
        warningsByType: Object.fromEntries(this.warningCounts),
        errorsByCategory: {},
        warningsByCategory: {},
        errorsBySeverity: {},
        recentErrors: this.errors.slice(-10),
        recentWarnings: this.warnings.slice(-10)
      };
      this.errors.forEach(function (error) {
        var category = error.category;
        stats.errorsByCategory[category] = (stats.errorsByCategory[category] || 0) + 1;
      });
      this.warnings.forEach(function (warning) {
        var category = warning.category;
        stats.warningsByCategory[category] = (stats.warningsByCategory[category] || 0) + 1;
      });
      stats.errorsBySeverity = {
        ERROR: this.errors.length,
        WARNING: this.warnings.length
      };
      return stats;
    }
  }, {
    key: "getErrorsByType",
    value: function getErrorsByType(type) {
      return this.errors.filter(function (error) {
        return error.type === type;
      });
    }
  }, {
    key: "getErrorsByCategory",
    value: function getErrorsByCategory(category) {
      return this.errors.filter(function (error) {
        return error.category === category;
      });
    }
  }, {
    key: "getErrorsByTimeRange",
    value: function getErrorsByTimeRange(startTime, endTime) {
      return this.errors.filter(function (error) {
        return error.timestamp >= startTime && error.timestamp <= endTime;
      });
    }
  }, {
    key: "getWarningsByType",
    value: function getWarningsByType(type) {
      return this.warnings.filter(function (warning) {
        return warning.type === type;
      });
    }
  }, {
    key: "getWarningsByCategory",
    value: function getWarningsByCategory(category) {
      return this.warnings.filter(function (warning) {
        return warning.category === category;
      });
    }
  }, {
    key: "getWarningsByTimeRange",
    value: function getWarningsByTimeRange(startTime, endTime) {
      return this.warnings.filter(function (warning) {
        return warning.timestamp >= startTime && warning.timestamp <= endTime;
      });
    }
  }, {
    key: "clearErrors",
    value: function clearErrors() {
      this.errors = [];
      this.errorCounts.clear();
    }
  }, {
    key: "clearErrorsByType",
    value: function clearErrorsByType(type) {
      this.errors = this.errors.filter(function (error) {
        return error.type !== type;
      });
      this.errorCounts.delete(type);
    }
  }, {
    key: "clearWarnings",
    value: function clearWarnings() {
      this.warnings = [];
      this.warningCounts.clear();
    }
  }, {
    key: "clearWarningsByType",
    value: function clearWarningsByType(type) {
      this.warnings = this.warnings.filter(function (warning) {
        return warning.type !== type;
      });
      this.warningCounts.delete(type);
    }
  }, {
    key: "getStatus",
    value: function getStatus() {
      return {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        listenersCount: this.listeners.length
      };
    }
    // 获取特定卡片ID列表的错误统计
  }, {
    key: "getCardErrorStats",
    value: function getCardErrorStats(cardIds) {
      var cardErrorMap = new Map();
      var cardErrorCounts = new Map();
      // 初始化所有卡片为无错误状态
      cardIds.forEach(function (cardId) {
        cardErrorMap.set(cardId, []);
        cardErrorCounts.set(cardId, 0);
      });
      // 统计每个卡片的错误
      this.errors.forEach(function (error) {
        if (error.cardId && cardIds.includes(error.cardId)) {
          var cardErrors = cardErrorMap.get(error.cardId) || [];
          cardErrors.push(error);
          cardErrorMap.set(error.cardId, cardErrors);
          cardErrorCounts.set(error.cardId, cardErrors.length);
        }
      });
      // 计算有错误的卡片数量
      var cardsWithErrors = Array.from(cardErrorCounts.values()).filter(function (count) {
        return count > 0;
      }).length;
      return {
        totalCards: cardIds.length,
        cardsWithErrors: cardsWithErrors,
        cardsWithoutErrors: cardIds.length - cardsWithErrors,
        cardErrorMap: cardErrorMap,
        cardErrorCounts: cardErrorCounts,
        totalErrorsForCards: Array.from(cardErrorCounts.values()).reduce(function (sum, count) {
          return sum + count;
        }, 0)
      };
    }
  }]);
}();
window.ErrorCollector = new ErrorCollector();
window.ErrorCollector.ErrorCollector = ErrorCollector;

// Debounce function
var debounce = function debounce(func, wait) {
  var timeout;
  return function executedFunction() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var later = function later() {
      clearTimeout(timeout);
      func.apply(void 0, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
// Math utility function - Ceiling with precision support
var ceil = function ceil(value) {
  var precision = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var multiplier = Math.pow(10, precision);
  return Math.ceil(value * multiplier) / multiplier;
};
// Math utility function - Floor with precision support
var floor = function floor(value) {
  var precision = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var multiplier = Math.pow(10, precision);
  return Math.floor(value * multiplier) / multiplier;
};
var getDashboardDefaultConfig = function getDashboardDefaultConfig() {
  var customConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  return {
    // ==================== Common configuration items with config.js ====================
    // Base font size
    BASE_FONT_SIZE: "12px",
    // Grid column count, defines horizontal division quantity
    GRID_COLS: 24,
    // Default row height (pixels), base height for each grid cell
    GRID_DEFAULT_ROW_HEIGHT: 32,
    // Page background color
    BODY_BACKGROUND: "#ffffff",
    // Page gradient background image, css background-image property
    BODY_BACKGROUND_IMAGE: ["linear-gradient(135deg, rgba(49, 92, 236, 0.04) 0%, rgba(248, 250, 252, 0.6) 50%, #ffffff 100%)", "radial-gradient(circle at 15% 85%, rgba(49, 92, 236, 0.06) 0%, transparent 40%)", "radial-gradient(circle at 85% 15%, rgba(49, 92, 236, 0.03) 0%, transparent 40%)"],
    // Page font family
    BODY_FONT_FAMILY: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimSun", sans-serif',
    // Primary color
    COLORS_PRIMARY: "#6851ff",
    // Success status color
    COLORS_SUCCESS: "#52c41a",
    // Warning status color
    COLORS_WARNING: "#faad14",
    // Error status color
    COLORS_ERROR: "#ff4d4f",
    // Primary text color
    COLORS_TEXT_PRIMARY: "rgba(28, 29, 35, 1)",
    // Secondary text color
    COLORS_TEXT_SECONDARY: "rgba(28, 29, 35, 0.8)",
    // Tertiary text color
    COLORS_TEXT_THIRD: "rgba(28, 29, 35, 0.6)",
    // Border color
    COLORS_BORDER: "rgba(28, 29, 35, 0.08)",
    // Card background color
    CARD_BACKGROUND: "rgba(255, 255, 255, 1)",
    // Card title font size
    CARD_TITLE_FONT_SIZE: "14px",
    // Table header background color
    TABLE_HEADER_BACKGROUND_COLOR: "#6851ff",
    // ECharts color palette
    ECHARTS_COLOR: ["#6851ff", "#4c9dff", "#57c7e6", "#4cc9a6", "#3e7d6b", "#f3bd51", "#fd905a", "#e65454", "#f3738c", "#c34b9d", "#7a89a6", "#4c4c5c"],
    // Metric card icon type: circle, normal
    METRIC_CARD_ICON_TYPE: "circle",
    // ==================== Private configuration items ====================
    // Spacing between grid items [horizontal spacing, vertical spacing]
    GRID_MARGIN: [10, 10],
    // Container padding [horizontal padding, vertical padding]
    GRID_CONTAINER_PADDING: [10, 10],
    // Card styling details
    // Card border width (pixels)
    CARD_BORDER_WIDTH: "0px",
    // Card border color
    CARD_BORDER_COLOR: "rgba(28, 29, 35, 0.08)",
    // Border style: solid, dashed, dotted
    CARD_BORDER_STYLE: "solid",
    // Border radius (pixels)
    CARD_BORDER_RADIUS: "4px",
    // Card padding (pixels)
    CARD_GAP: "10px",
    // Card shadow - Very subtle shadow
    CARD_SHADOW: "0 0 8px 1px rgba(0, 0, 0, 0.05)",
    // Hover border color
    CARD_HOVER_BORDER_COLOR: "rgba(28, 29, 35, 0.08)",
    // Border style: solid, dashed, dotted
    CARD_HOVER_BORDER_STYLE: "solid",
    // Hover shadow style - Enhanced subtle elevation
    CARD_HOVER_SHADOW: "0 0 6px 1px rgba(0, 0, 0, 0.1)",
    // Table font size
    TABLE_FONT_SIZE: customConfig.BASE_FONT_SIZE || "12px",
    // Table cell minimum width
    TABLE_CELL_MIN_WIDTH: "80px",
    // Table cell height
    TABLE_CELL_HEIGHT: "32px",
    // Table cell padding
    TABLE_CELL_PADDING: "0 10px",
    // Table border color
    TABLE_BORDER_COLOR: customConfig.COLORS_BORDER || "rgba(28, 29, 35, 0.08)",
    // Table border radius
    TABLE_BORDER_RADIUS: "4px",
    // Enable card hover interaction effects
    INTERACTION_CARD_HOVERABLE: true
  };
};
// Parse color string to RGB values
var parseColorToRGB = function parseColorToRGB(colorStr) {
  // Handle hex colors
  if (colorStr.startsWith("#")) {
    var hex = colorStr.replace("#", "");
    if (hex.length === 3) {
      // Short hex format (#RGB)
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    } else if (hex.length === 6) {
      // Full hex format (#RRGGBB)
      return {
        r: parseInt(hex.substr(0, 2), 16),
        g: parseInt(hex.substr(2, 2), 16),
        b: parseInt(hex.substr(4, 2), 16)
      };
    }
  }
  // Handle rgb() and rgba() colors
  var rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }
  // Handle hsl() and hsla() colors
  var hslMatch = colorStr.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*[\d.]+)?\s*\)/);
  if (hslMatch) {
    var h = parseInt(hslMatch[1], 10);
    var s = parseInt(hslMatch[2], 10) / 100;
    var l = parseInt(hslMatch[3], 10) / 100;
    // Convert HSL to RGB
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(h / 60 % 2 - 1));
    var m = l - c / 2;
    var r, g, b;
    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }
  // Handle named colors (basic set)
  var namedColors = {
    red: {
      r: 255,
      g: 0,
      b: 0
    },
    green: {
      r: 0,
      g: 128,
      b: 0
    },
    blue: {
      r: 0,
      g: 0,
      b: 255
    },
    white: {
      r: 255,
      g: 255,
      b: 255
    },
    black: {
      r: 0,
      g: 0,
      b: 0
    },
    yellow: {
      r: 255,
      g: 255,
      b: 0
    },
    cyan: {
      r: 0,
      g: 255,
      b: 255
    },
    magenta: {
      r: 255,
      g: 0,
      b: 255
    },
    orange: {
      r: 255,
      g: 165,
      b: 0
    },
    purple: {
      r: 128,
      g: 0,
      b: 128
    },
    pink: {
      r: 255,
      g: 192,
      b: 203
    },
    gray: {
      r: 128,
      g: 128,
      b: 128
    },
    grey: {
      r: 128,
      g: 128,
      b: 128
    }
  };
  var lowerColor = colorStr.toLowerCase();
  if (namedColors[lowerColor]) {
    return namedColors[lowerColor];
  }
  // Fallback: return default color
  return {
    r: 0,
    g: 0,
    b: 0
  };
};
// Generate gradient background based on iconColor
var getCircleGradientBackground = function getCircleGradientBackground(iconColor) {
  var fallbackColor = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "#000000";
  var baseColor = iconColor || fallbackColor;
  try {
    // Parse color to RGB
    var rgb = parseColorToRGB(baseColor);
    // Convert RGB to HSL
    var rNorm = rgb.r / 255;
    var gNorm = rgb.g / 255;
    var bNorm = rgb.b / 255;
    var max = Math.max(rNorm, gNorm, bNorm);
    var min = Math.min(rNorm, gNorm, bNorm);
    var diff = max - min;
    var h = 0;
    if (diff !== 0) {
      if (max === rNorm) h = (gNorm - bNorm) / diff % 6;else if (max === gNorm) h = (bNorm - rNorm) / diff + 2;else h = (rNorm - gNorm) / diff + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    var l = (max + min) / 2;
    var s = diff === 0 ? 0 : diff / (1 - Math.abs(2 * l - 1));
    // Create gradient colors
    var lightColor = "hsl(".concat(h, ", ").concat(Math.min(s * 100 + 10, 80), "%, ").concat(Math.min(l * 100 + 15, 75), "%)");
    var darkColor = "hsl(".concat(h, ", ").concat(Math.min(s * 100 + 20, 90), "%, ").concat(Math.max(l * 100 - 10, 40), "%)");
    return "linear-gradient(135deg, ".concat(darkColor, " 0%, ").concat(lightColor, " 100%)");
  } catch (error) {
    // Fallback gradient for unparseable colors
    return "linear-gradient(135deg, ".concat(baseColor, " 0%, ").concat(baseColor, " 100%)");
  }
};
// Compose dashboard configuration by merging default config with custom config
var getComposeDashboardConfig = function getComposeDashboardConfig() {
  var customConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var defaultConfig = getDashboardDefaultConfig(customConfig);
  // Deep merge the configurations, with custom config taking priority
  return _objectSpread(_objectSpread({}, defaultConfig), customConfig);
};
// Generate mobile dashboard configuration based on desktop configuration
var createMobileDashboardConfig = function createMobileDashboardConfig(dashboardConfig) {
  if (!dashboardConfig) {
    return null;
  }
  return _objectSpread(_objectSpread({}, dashboardConfig), {}, {
    GRID_COLS: 12,
    GRID_CONTAINER_PADDING: [6, 6],
    GRID_DEFAULT_ROW_HEIGHT: 32,
    GRID_MARGIN: [6, 6],
    INTERACTION_CARD_HOVERABLE: true,
    BASE_FONT_SIZE: "10px",
    CARD_TITLE_FONT_SIZE: "12px",
    CARD_GAP: "6px",
    TABLE_FONT_SIZE: "11px",
    TABLE_CELL_MIN_WIDTH: "80px",
    TABLE_CELL_HEIGHT: "28px",
    TABLE_CELL_PADDING: "0 6px"
  });
};
// Generate mobile editor configuration based on desktop configuration
var createMobileEditorConfig = function createMobileEditorConfig(editorConfig) {
  return _objectSpread(_objectSpread({}, editorConfig), {}, {
    DRAGGABLE: false,
    RESIZABLE: false,
    DELETABLE: false,
    EXPANDABLE: true
  });
};
// Get opaque background color based on card background, ensuring no transparency
var getOpaqueBackgroundColor = function getOpaqueBackgroundColor() {
  // Get the computed card background color
  var cardBg = getComputedStyle(document.documentElement).getPropertyValue("--card-background").trim();
  if (!cardBg) {
    return "#ffffff"; // Default fallback
  }
  // Check if the color has transparency (contains alpha channel)
  var hasAlpha = cardBg.includes("rgba(") || cardBg.includes("hsla(");
  // If it's already a solid color without alpha, return as is
  if (!hasAlpha) {
    return cardBg;
  }
  // For colors with alpha channel, parse to RGB and return opaque version
  try {
    var rgb = parseColorToRGB(cardBg);
    return "rgb(".concat(rgb.r, ", ").concat(rgb.g, ", ").concat(rgb.b, ")");
  } catch (error) {
    console.warn("[getOpaqueBackgroundColor] Failed to parse color:", cardBg, error);
    // Fallback to white if parsing fails
    return "#ffffff";
  }
};
// Put all utility functions under the UTILS namespace
window.UTILS = {
  debounce: debounce,
  ceil: ceil,
  floor: floor,
  getDashboardDefaultConfig: getDashboardDefaultConfig,
  getComposeDashboardConfig: getComposeDashboardConfig,
  parseColorToRGB: parseColorToRGB,
  getCircleGradientBackground: getCircleGradientBackground,
  createMobileDashboardConfig: createMobileDashboardConfig,
  createMobileEditorConfig: createMobileEditorConfig,
  getOpaqueBackgroundColor: getOpaqueBackgroundColor
};

// Map registration manager
var MapManager = /*#__PURE__*/function () {
  function MapManager() {
    _classCallCheck(this, MapManager);
    this.registeredMaps = new Set();
    this.currentMapsConfig = [];
    this.registrationPromises = new Map();
    this.registrationResults = new Map();
  }
  /**
   * Smart synchronization of map configuration (automatically identify additions and deletions)
   * @param {Array} newMapsConfig - New map configuration array
   */
  return _createClass(MapManager, [{
    key: "syncMapsConfig",
    value: (function () {
      var _syncMapsConfig = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee10(newMapsConfig) {
        var newMaps, oldMaps, addedMaps, removedMaps, modifiedMaps, _iterator1, _step1, removedMap, _iterator10, _step10, modifiedMap, _iterator11, _step11, addedMap, _t6, _t7, _t8;
        return _regenerator().w(function (_context10) {
          while (1) switch (_context10.p = _context10.n) {
            case 0:
              if (window.echarts) {
                _context10.n = 1;
                break;
              }
              console.error("[MapManager] ECharts not loaded");
              return _context10.a(2);
            case 1:
              newMaps = newMapsConfig || [];
              oldMaps = this.currentMapsConfig || [];
              console.log("[MapManager] Starting map configuration synchronization");
              addedMaps = newMaps.filter(function (newMap) {
                return !oldMaps.find(function (oldMap) {
                  return oldMap.name === newMap.name;
                });
              });
              removedMaps = oldMaps.filter(function (oldMap) {
                return !newMaps.find(function (newMap) {
                  return newMap.name === oldMap.name;
                });
              });
              modifiedMaps = newMaps.filter(function (newMap) {
                var oldMap = oldMaps.find(function (old) {
                  return old.name === newMap.name;
                });
                return oldMap && oldMap.url !== newMap.url;
              });
              this.currentMapsConfig = _toConsumableArray(newMaps);
              _iterator1 = _createForOfIteratorHelper(removedMaps);
              _context10.p = 2;
              _iterator1.s();
            case 3:
              if ((_step1 = _iterator1.n()).done) {
                _context10.n = 5;
                break;
              }
              removedMap = _step1.value;
              _context10.n = 4;
              return this.unregisterMap(removedMap.name);
            case 4:
              _context10.n = 3;
              break;
            case 5:
              _context10.n = 7;
              break;
            case 6:
              _context10.p = 6;
              _t6 = _context10.v;
              _iterator1.e(_t6);
            case 7:
              _context10.p = 7;
              _iterator1.f();
              return _context10.f(7);
            case 8:
              _iterator10 = _createForOfIteratorHelper(modifiedMaps);
              _context10.p = 9;
              _iterator10.s();
            case 10:
              if ((_step10 = _iterator10.n()).done) {
                _context10.n = 13;
                break;
              }
              modifiedMap = _step10.value;
              _context10.n = 11;
              return this.unregisterMap(modifiedMap.name);
            case 11:
              this.registrationResults.delete(modifiedMap.name);
              _context10.n = 12;
              return this.registerMap(modifiedMap);
            case 12:
              _context10.n = 10;
              break;
            case 13:
              _context10.n = 15;
              break;
            case 14:
              _context10.p = 14;
              _t7 = _context10.v;
              _iterator10.e(_t7);
            case 15:
              _context10.p = 15;
              _iterator10.f();
              return _context10.f(15);
            case 16:
              _iterator11 = _createForOfIteratorHelper(addedMaps);
              _context10.p = 17;
              _iterator11.s();
            case 18:
              if ((_step11 = _iterator11.n()).done) {
                _context10.n = 20;
                break;
              }
              addedMap = _step11.value;
              _context10.n = 19;
              return this.registerMap(addedMap);
            case 19:
              _context10.n = 18;
              break;
            case 20:
              _context10.n = 22;
              break;
            case 21:
              _context10.p = 21;
              _t8 = _context10.v;
              _iterator11.e(_t8);
            case 22:
              _context10.p = 22;
              _iterator11.f();
              return _context10.f(22);
            case 23:
              console.log("[MapManager] Map configuration synchronization completed");
            case 24:
              return _context10.a(2);
          }
        }, _callee10, this, [[17, 21, 22, 23], [9, 14, 15, 16], [2, 6, 7, 8]]);
      }));
      function syncMapsConfig(_x9) {
        return _syncMapsConfig.apply(this, arguments);
      }
      return syncMapsConfig;
    }()
    /**
     * Register a single map
     * @param {Object} map - Map configuration object {name, url}
     * @returns {Promise<boolean>} Whether registration was successful
     */
    )
  }, {
    key: "registerMap",
    value: (function () {
      var _registerMap = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee11(map) {
        var name, url, cachedResult, registrationPromise, result;
        return _regenerator().w(function (_context11) {
          while (1) switch (_context11.p = _context11.n) {
            case 0:
              name = map.name, url = map.url;
              if (!(!name || !url)) {
                _context11.n = 1;
                break;
              }
              console.warn("[MapManager] Invalid map configuration:", map);
              return _context11.a(2, false);
            case 1:
              if (!this.registrationPromises.has(name)) {
                _context11.n = 3;
                break;
              }
              _context11.n = 2;
              return this.registrationPromises.get(name);
            case 2:
              return _context11.a(2, _context11.v);
            case 3:
              if (!this.registeredMaps.has(name)) {
                _context11.n = 4;
                break;
              }
              return _context11.a(2, true);
            case 4:
              if (!this.registrationResults.has(name)) {
                _context11.n = 5;
                break;
              }
              cachedResult = this.registrationResults.get(name);
              if (!cachedResult) {
                _context11.n = 5;
                break;
              }
              return _context11.a(2, true);
            case 5:
              registrationPromise = this._performRegistration(name, url);
              this.registrationPromises.set(name, registrationPromise);
              _context11.p = 6;
              _context11.n = 7;
              return registrationPromise;
            case 7:
              result = _context11.v;
              this.registrationResults.set(name, result);
              if (result) {
                this.registeredMaps.add(name);
                console.log("[MapManager] SUCCESS ".concat(name, " registration successful"));
              } else {
                console.error("[MapManager] ERROR ".concat(name, " registration failed"));
              }
              return _context11.a(2, result);
            case 8:
              _context11.p = 8;
              this.registrationPromises.delete(name);
              return _context11.f(8);
            case 9:
              return _context11.a(2);
          }
        }, _callee11, this, [[6,, 8, 9]]);
      }));
      function registerMap(_x0) {
        return _registerMap.apply(this, arguments);
      }
      return registerMap;
    }()
    /**
     * Perform actual registration operation
     * @param {string} name - Map name
     * @param {string} url - Map data URL
     * @returns {Promise<boolean>} Whether registration was successful
     */
    )
  }, {
    key: "_performRegistration",
    value: (function () {
      var _performRegistration2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee12(name, url) {
        var response, error, geoJson, _t9;
        return _regenerator().w(function (_context12) {
          while (1) switch (_context12.p = _context12.n) {
            case 0:
              _context12.p = 0;
              _context12.n = 1;
              return fetch(url);
            case 1:
              response = _context12.v;
              if (response.ok) {
                _context12.n = 2;
                break;
              }
              error = new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
              if (window.ErrorCollector) {
                window.ErrorCollector.collectMapLoadError(url, response.status, response.statusText, "MapManager");
              }
              throw error;
            case 2:
              _context12.n = 3;
              return response.json();
            case 3:
              geoJson = _context12.v;
              window.echarts.registerMap(name, geoJson);
              return _context12.a(2, true);
            case 4:
              _context12.p = 4;
              _t9 = _context12.v;
              console.error("[MapManager] ".concat(name, " registration failed:"), _t9.message);
              return _context12.a(2, false);
          }
        }, _callee12, null, [[0, 4]]);
      }));
      function _performRegistration(_x1, _x10) {
        return _performRegistration2.apply(this, arguments);
      }
      return _performRegistration;
    }()
    /**
     * Unregister a single map
     * @param {string} mapName - Map name
     */
    )
  }, {
    key: "unregisterMap",
    value: (function () {
      var _unregisterMap = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee13(mapName) {
        var _t0;
        return _regenerator().w(function (_context13) {
          while (1) switch (_context13.p = _context13.n) {
            case 0:
              if (mapName) {
                _context13.n = 1;
                break;
              }
              console.warn("[MapManager] Invalid map name");
              return _context13.a(2, false);
            case 1:
              if (!this.registrationPromises.has(mapName)) {
                _context13.n = 2;
                break;
              }
              _context13.n = 2;
              return this.registrationPromises.get(mapName);
            case 2:
              if (this.registeredMaps.has(mapName)) {
                _context13.n = 3;
                break;
              }
              return _context13.a(2, true);
            case 3:
              _context13.p = 3;
              window.echarts.registerMap(mapName, {
                type: "FeatureCollection",
                features: []
              });
              this.registeredMaps.delete(mapName);
              this.registrationResults.delete(mapName);
              return _context13.a(2, true);
            case 4:
              _context13.p = 4;
              _t0 = _context13.v;
              console.error("[MapManager] ERROR ".concat(mapName, " unregistration failed:"), _t0.message);
              return _context13.a(2, false);
          }
        }, _callee13, this, [[3, 4]]);
      }));
      function unregisterMap(_x11) {
        return _unregisterMap.apply(this, arguments);
      }
      return unregisterMap;
    }()
    /**
     * Check if map is registered
     * @param {string} mapName - Map name
     */
    )
  }, {
    key: "isMapRegistered",
    value: function isMapRegistered(mapName) {
      return this.registeredMaps.has(mapName);
    }
    /**
     * Check if map is being registered
     * @param {string} mapName - Map name
     */
  }, {
    key: "isMapRegistering",
    value: function isMapRegistering(mapName) {
      return this.registrationPromises.has(mapName);
    }
    /**
     * Ensure specified map is registered (if exists in configuration but not registered, attempt to register)
     * @param {string} mapName - Map name
     * @returns {Promise<boolean>} Whether successfully registered or already registered
     */
  }, {
    key: "ensureMapRegistered",
    value: (function () {
      var _ensureMapRegistered = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee14(mapName) {
        var mapConfig;
        return _regenerator().w(function (_context14) {
          while (1) switch (_context14.n) {
            case 0:
              if (!this.isMapRegistered(mapName)) {
                _context14.n = 1;
                break;
              }
              return _context14.a(2, true);
            case 1:
              if (!this.isMapRegistering(mapName)) {
                _context14.n = 3;
                break;
              }
              _context14.n = 2;
              return this.registrationPromises.get(mapName);
            case 2:
              return _context14.a(2, _context14.v);
            case 3:
              mapConfig = this.currentMapsConfig.find(function (map) {
                return map.name === mapName;
              });
              if (!mapConfig) {
                _context14.n = 5;
                break;
              }
              _context14.n = 4;
              return this.registerMap(mapConfig);
            case 4:
              return _context14.a(2, _context14.v);
            case 5:
              console.warn("[MapManager] Map \"".concat(mapName, "\" not in configuration"));
              return _context14.a(2, false);
          }
        }, _callee14, this);
      }));
      function ensureMapRegistered(_x12) {
        return _ensureMapRegistered.apply(this, arguments);
      }
      return ensureMapRegistered;
    }()
    /**
     * Ensure multiple maps are all registered
     * @param {string[]} mapNames - Array of map names
     * @returns {Promise<boolean>} Whether all maps are successfully registered
     */
    )
  }, {
    key: "ensureMapsRegistered",
    value: (function () {
      var _ensureMapsRegistered = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee16(mapNames) {
        var _this36 = this;
        var results, successCount, allSuccess;
        return _regenerator().w(function (_context16) {
          while (1) switch (_context16.n) {
            case 0:
              if (!(!mapNames || mapNames.length === 0)) {
                _context16.n = 1;
                break;
              }
              return _context16.a(2, true);
            case 1:
              console.log("[MapManager] Starting to ensure ".concat(mapNames.length, " maps are registered"));
              _context16.n = 2;
              return Promise.all(mapNames.map(/*#__PURE__*/function () {
                var _ref0 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee15(mapName) {
                  var _t1;
                  return _regenerator().w(function (_context15) {
                    while (1) switch (_context15.p = _context15.n) {
                      case 0:
                        _context15.p = 0;
                        _context15.n = 1;
                        return _this36.ensureMapRegistered(mapName);
                      case 1:
                        return _context15.a(2, _context15.v);
                      case 2:
                        _context15.p = 2;
                        _t1 = _context15.v;
                        console.error("[MapManager] Error occurred while ensuring map \"".concat(mapName, "\" registration:"), _t1);
                        return _context15.a(2, false);
                    }
                  }, _callee15, null, [[0, 2]]);
                }));
                return function (_x14) {
                  return _ref0.apply(this, arguments);
                };
              }()));
            case 2:
              results = _context16.v;
              successCount = results.filter(Boolean).length;
              allSuccess = results.every(function (result) {
                return result === true;
              });
              console.log("[MapManager] Map registration completed: ".concat(successCount, "/").concat(mapNames.length, " successful"));
              return _context16.a(2, allSuccess);
          }
        }, _callee16);
      }));
      function ensureMapsRegistered(_x13) {
        return _ensureMapsRegistered.apply(this, arguments);
      }
      return ensureMapsRegistered;
    }())
  }]);
}();
window.MapManager = MapManager;
window.MapManager = new MapManager();

// CSV data management controller
var CSVManager = /*#__PURE__*/function () {
  function CSVManager() {
    _classCallCheck(this, CSVManager);
    this.dataSources = new Map();
    this.loadingPromises = new Map();
  }
  /**
   * Load CSV data file
   * @param {string} fileName - File name, corresponding to the name field in magicDashboard.dataSources array
   * @returns {Promise<CSVParseResult>} Returns parsed CSV data
   */
  return _createClass(CSVManager, [{
    key: "load",
    value: (function () {
      var _load = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee18(fileName) {
        var error, loadingPromise, result, _t11;
        return _regenerator().w(function (_context18) {
          while (1) switch (_context18.p = _context18.n) {
            case 0:
              if (!(!fileName || typeof fileName !== "string")) {
                _context18.n = 1;
                break;
              }
              error = new Error("Invalid file name");
              if (window.ErrorCollector) {
                window.ErrorCollector.collectInvalidFileNameError(fileName, "CSVManager");
              }
              throw error;
            case 1:
              if (!this.loadingPromises.has(fileName)) {
                _context18.n = 3;
                break;
              }
              _context18.n = 2;
              return this.loadingPromises.get(fileName);
            case 2:
              return _context18.a(2, _context18.v);
            case 3:
              if (!this.dataSources.has(fileName)) {
                _context18.n = 4;
                break;
              }
              return _context18.a(2, this.dataSources.get(fileName));
            case 4:
              loadingPromise = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee17() {
                var _window$magicDashboar2;
                var dataSourceConfig, dataSource, _error2, fileUrl, response, _error3, csvText, _t10;
                return _regenerator().w(function (_context17) {
                  while (1) switch (_context17.p = _context17.n) {
                    case 0:
                      dataSourceConfig = ((_window$magicDashboar2 = window.magicDashboard) === null || _window$magicDashboar2 === void 0 ? void 0 : _window$magicDashboar2.dataSources) || [];
                      dataSource = dataSourceConfig.find(function (config) {
                        return config.name === fileName;
                      });
                      if (!(!dataSource || !dataSource.url)) {
                        _context17.n = 1;
                        break;
                      }
                      _error2 = new Error("File configuration not found in magicDashboard.dataSources: ".concat(fileName));
                      if (window.ErrorCollector) {
                        window.ErrorCollector.collectDataSourceNotFoundError(fileName, "CSVManager");
                      }
                      throw _error2;
                    case 1:
                      fileUrl = dataSource.url;
                      console.log("[CSVManager] Starting to load file: ".concat(fileName));
                      _context17.p = 2;
                      _context17.n = 3;
                      return fetch(fileUrl);
                    case 3:
                      response = _context17.v;
                      if (response.ok) {
                        _context17.n = 4;
                        break;
                      }
                      _error3 = new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                      if (window.ErrorCollector) {
                        window.ErrorCollector.collectCSVLoadError(fileName, response.status, response.statusText, "CSVManager");
                      }
                      throw _error3;
                    case 4:
                      _context17.n = 5;
                      return response.text();
                    case 5:
                      csvText = _context17.v;
                      if (window.Papa) {
                        _context17.n = 6;
                        break;
                      }
                      throw new Error("[CSVManager] PapaParse library not loaded, cannot parse CSV file: ".concat(fileName));
                    case 6:
                      return _context17.a(2, new Promise(function (resolve, reject) {
                        window.Papa.parse(csvText, {
                          header: true,
                          skipEmptyLines: true,
                          trimHeaders: true,
                          worker: true,
                          complete: function complete(results) {
                            if (results.errors && results.errors.length > 0) {
                              console.warn("[CSVManager] CSV parsing warnings (".concat(fileName, "):"), results.errors);
                            }
                            resolve({
                              data: results.data,
                              meta: results.meta,
                              errors: results.errors,
                              name: fileName,
                              url: fileUrl,
                              fields: results.meta.fields
                            });
                          },
                          error: function error(_error4) {
                            console.error("[CSVManager] CSV parsing failed (".concat(fileName, "):"), _error4);
                            var parseError = new Error("CSV parsing failed: ".concat(_error4.message || _error4));
                            if (window.ErrorCollector) {
                              window.ErrorCollector.collectCSVParseError(fileName, _error4, "CSVManager");
                            }
                            reject(parseError);
                          }
                        });
                      }));
                    case 7:
                      _context17.p = 7;
                      _t10 = _context17.v;
                      throw new Error("File loading failed (".concat(fileName, "): ").concat(_t10.message));
                    case 8:
                      return _context17.a(2);
                  }
                }, _callee17, null, [[2, 7]]);
              }))();
              this.loadingPromises.set(fileName, loadingPromise);
              _context18.p = 5;
              _context18.n = 6;
              return loadingPromise;
            case 6:
              result = _context18.v;
              this.dataSources.set(fileName, result);
              console.log("[CSVManager] SUCCESS ".concat(fileName, " loading successful"));
              return _context18.a(2, result);
            case 7:
              _context18.p = 7;
              _t11 = _context18.v;
              console.error("[CSVManager] ERROR ".concat(fileName, " loading failed:"), _t11);
              throw _t11;
            case 8:
              _context18.p = 8;
              this.loadingPromises.delete(fileName);
              return _context18.f(8);
            case 9:
              return _context18.a(2);
          }
        }, _callee18, this, [[5, 7, 8, 9]]);
      }));
      function load(_x15) {
        return _load.apply(this, arguments);
      }
      return load;
    }())
  }]);
}();
window.CSVManager = CSVManager;
window.CSVManager = new CSVManager();

// Smart CSS value formatting - automatically add px unit to numbers
function formatCSSValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") {
    return "".concat(value, "px");
  }
  if (typeof value === "string") {
    var trimmedValue = value.trim();
    if (/\d+(px|%|em|rem|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch|fr)$/i.test(trimmedValue)) {
      return trimmedValue;
    }
    if (/^(auto|inherit|initial|unset|none|normal|bold|italic|center|left|right|top|bottom|middle|baseline)$/i.test(trimmedValue)) {
      return trimmedValue;
    }
    var numValue = parseFloat(trimmedValue);
    if (!isNaN(numValue) && trimmedValue === numValue.toString()) {
      return "".concat(numValue, "px");
    }
  }
  return value;
}
// Apply theme styles
function applyThemeStyles(dashboardConfig) {
  var root = document.documentElement;
  if (!dashboardConfig) return;
  if (dashboardConfig.BODY_BACKGROUND) {
    root.style.setProperty("--body-background", dashboardConfig.BODY_BACKGROUND);
  }
  if (dashboardConfig.BODY_BACKGROUND_IMAGE && Array.isArray(dashboardConfig.BODY_BACKGROUND_IMAGE)) {
    root.style.setProperty("--body-background-image", dashboardConfig.BODY_BACKGROUND_IMAGE.join(", "));
  }
  if (dashboardConfig.BASE_FONT_SIZE) {
    root.style.setProperty("--base-font-size", dashboardConfig.BASE_FONT_SIZE);
  }
  if (dashboardConfig.BODY_FONT_FAMILY) {
    root.style.setProperty("--body-font-family", dashboardConfig.BODY_FONT_FAMILY);
  }
  if (dashboardConfig.COLORS_PRIMARY) {
    root.style.setProperty("--color-primary", dashboardConfig.COLORS_PRIMARY);
  }
  if (dashboardConfig.COLORS_SUCCESS) {
    root.style.setProperty("--color-success", dashboardConfig.COLORS_SUCCESS);
  }
  if (dashboardConfig.COLORS_WARNING) {
    root.style.setProperty("--color-warning", dashboardConfig.COLORS_WARNING);
  }
  if (dashboardConfig.COLORS_ERROR) {
    root.style.setProperty("--color-error", dashboardConfig.COLORS_ERROR);
  }
  if (dashboardConfig.COLORS_TEXT_PRIMARY) {
    root.style.setProperty("--color-text-primary", dashboardConfig.COLORS_TEXT_PRIMARY);
  }
  if (dashboardConfig.COLORS_TEXT_SECONDARY) {
    root.style.setProperty("--color-text-secondary", dashboardConfig.COLORS_TEXT_SECONDARY);
  }
  if (dashboardConfig.COLORS_BORDER) {
    root.style.setProperty("--color-border", dashboardConfig.COLORS_BORDER);
  }
  if (dashboardConfig.CARD_BACKGROUND) {
    root.style.setProperty("--card-background", dashboardConfig.CARD_BACKGROUND);
  }
  if (dashboardConfig.CARD_TITLE_FONT_SIZE) {
    root.style.setProperty("--card-title-font-size", formatCSSValue(dashboardConfig.CARD_TITLE_FONT_SIZE));
  }
  if (dashboardConfig.CARD_BORDER_WIDTH) {
    root.style.setProperty("--card-border-width", formatCSSValue(dashboardConfig.CARD_BORDER_WIDTH));
  }
  if (dashboardConfig.CARD_BORDER_COLOR) {
    root.style.setProperty("--card-border-color", dashboardConfig.CARD_BORDER_COLOR);
  }
  if (dashboardConfig.CARD_BORDER_STYLE) {
    root.style.setProperty("--card-border-style", dashboardConfig.CARD_BORDER_STYLE);
  }
  if (dashboardConfig.CARD_BORDER_RADIUS) {
    root.style.setProperty("--card-border-radius", formatCSSValue(dashboardConfig.CARD_BORDER_RADIUS));
  }
  if (dashboardConfig.CARD_GAP) {
    root.style.setProperty("--card-gap", formatCSSValue(dashboardConfig.CARD_GAP));
  }
  if (dashboardConfig.CARD_SHADOW) {
    root.style.setProperty("--card-shadow", dashboardConfig.CARD_SHADOW);
  }
  // Set CSS variables for card hover effects (only when hover effects are enabled)
  if (dashboardConfig.INTERACTION_CARD_HOVERABLE) {
    if (dashboardConfig.CARD_HOVER_BORDER_COLOR) {
      root.style.setProperty("--card-hover-border-color", dashboardConfig.CARD_HOVER_BORDER_COLOR);
    }
    if (dashboardConfig.CARD_HOVER_BORDER_STYLE) {
      root.style.setProperty("--card-hover-border-style", dashboardConfig.CARD_HOVER_BORDER_STYLE);
    }
    if (dashboardConfig.CARD_HOVER_SHADOW) {
      root.style.setProperty("--card-hover-shadow", dashboardConfig.CARD_HOVER_SHADOW);
    }
    root.style.setProperty("--card-hover-enabled", "1");
  } else {
    // Disable hover effects
    root.style.setProperty("--card-hover-enabled", "0");
  }
  // Button interaction colors
  root.style.setProperty("--button-hover-bg", "rgba(128, 128, 128, 0.3)");
  root.style.setProperty("--button-active-bg", "rgba(128, 128, 128, 0.5)");
  root.style.setProperty("--button-hover-opacity", "0.8");
  root.style.setProperty("--button-active-opacity", "1");
  // Table control button colors (white overlay style)
  root.style.setProperty("--table-button-hover-bg", "rgba(255, 255, 255, 0.1)");
  root.style.setProperty("--table-button-active-bg", "rgba(255, 255, 255, 0.3)");
  root.style.setProperty("--table-button-active-state-bg", "rgba(255, 255, 255, 0.2)");
  root.style.setProperty("--table-button-active-hover-bg", "rgba(255, 255, 255, 0.25)");
  root.style.setProperty("--table-button-active-active-bg", "rgba(255, 255, 255, 0.35)");
  // Compatible with old version CSS variable names
  if (dashboardConfig.CARD_BACKGROUND) {
    root.style.setProperty("--color-card-bg", dashboardConfig.CARD_BACKGROUND);
  }
  if (dashboardConfig.CARD_BORDER_RADIUS) {
    root.style.setProperty("--border-radius-small", formatCSSValue(dashboardConfig.CARD_BORDER_RADIUS));
  }
  if (dashboardConfig.CARD_SHADOW) {
    root.style.setProperty("--shadow-card", dashboardConfig.CARD_SHADOW);
  }
  if (dashboardConfig.CARD_HOVER_SHADOW) {
    root.style.setProperty("--shadow-hover", dashboardConfig.CARD_HOVER_SHADOW);
  }
}
window.StyleUtils = {
  formatCSSValue: formatCSSValue,
  applyThemeStyles: applyThemeStyles
};

// Mobile Grid Layout Component
var MobileGridLayout = /*#__PURE__*/function (_React$Component17) {
  function MobileGridLayout(props) {
    var _this37;
    _classCallCheck(this, MobileGridLayout);
    _this37 = _callSuper(this, MobileGridLayout, [props]);
    // Cache for layout calculations to avoid recalculating
    _this37.layoutCache = new Map();
    _this37.sortedCardsCache = null;
    _this37.lastCardsHash = null;
    return _this37;
  }
  // Generate hash for cards array to detect changes
  _inherits(MobileGridLayout, _React$Component17);
  return _createClass(MobileGridLayout, [{
    key: "generateCardsHash",
    value: function generateCardsHash(cards) {
      return cards.map(function (card) {
        return "".concat(card.id, "-").concat(card.type, "-").concat(JSON.stringify(card.layout));
      }).join("|");
    }
    // Get mobile ECharts theme name
  }, {
    key: "getMobileEChartsThemeName",
    value: function getMobileEChartsThemeName() {
      return (window.ECHARTS_THEME_NAME || "dashboard") + "_mobile";
    }
    // Get sorted cards with caching
  }, {
    key: "getSortedCards",
    value: function getSortedCards(cards) {
      var cardsHash = this.generateCardsHash(cards);
      // Return cached result if cards haven't changed
      if (this.lastCardsHash === cardsHash && this.sortedCardsCache) {
        return this.sortedCardsCache;
      }
      // Calculate new sorted cards
      var sortedCards = _toConsumableArray(cards).sort(function (a, b) {
        // Priority order: metric > kpi (comparison) > others
        var getPriority = function getPriority(card) {
          if (card.type === "metric") return 1;
          if (card.type === "kpi") return 2; // KPI cards are often comparison cards
          return 3;
        };
        return getPriority(a) - getPriority(b);
      });
      // Cache the result
      this.sortedCardsCache = sortedCards;
      this.lastCardsHash = cardsHash;
      return sortedCards;
    }
    // Calculate height based on KPI content
  }, {
    key: "calculateKPIHeight",
    value: function calculateKPIHeight(cardData) {
      // Check actual KPI card properties
      var hasTitle = cardData.title && cardData.title.trim() !== "";
      // Base height for KPI card (minimum space needed)
      var height = 0.5;
      // Add height for title if present
      if (hasTitle) {
        height += 1; // Title space
      }
      // Add height based on number of indicators
      if (cardData.data && cardData.data.indicators && Array.isArray(cardData.data.indicators)) {
        var indicatorCount = cardData.data.indicators.length;
        // Each indicator needs minimal space in mobile layout
        if (indicatorCount <= 2) {
          // 1-2 indicators: each takes ~1 unit
          height += indicatorCount * 1;
        } else if (indicatorCount <= 4) {
          // 3-4 indicators: each takes ~0.8 units (more compact)
          height += indicatorCount * 0.8;
        } else {
          // 5+ indicators: each takes ~0.7 units (very compact)
          height += indicatorCount * 0.7;
        }
        // Add minimal padding for visual separation
        height += 0.3;
      } else {
        // Default to 2 indicators if data structure is not available
        height += 2 * 1 + 0.3;
      }
      // Ensure minimum and maximum bounds for KPI
      // Minimum: 2 units (very compact)
      // Maximum: 7 units (for cases with many indicators)
      return Math.max(2, Math.min(Math.ceil(height), 7));
    }
    // Calculate height based on markdown content
  }, {
    key: "calculateMarkdownHeight",
    value: function calculateMarkdownHeight(cardData) {
      // Check if card has title
      var hasTitle = cardData.title && cardData.title.trim() !== "";
      // Base height for markdown card
      var height = 2;
      // Add height for title if present
      if (hasTitle) height += 1;
      // Calculate height based on markdown content
      if (cardData.data && cardData.data.content && typeof cardData.data.content === "string") {
        var content = cardData.data.content.trim();
        // Count lines in markdown content
        var lines = content.split("\n");
        var contentLines = 0;
        var _iterator12 = _createForOfIteratorHelper(lines),
          _step12;
        try {
          for (_iterator12.s(); !(_step12 = _iterator12.n()).done;) {
            var line = _step12.value;
            var trimmedLine = line.trim();
            if (trimmedLine === "") {
              // Empty lines add minimal height
              contentLines += 0.3;
            } else if (trimmedLine.startsWith("#")) {
              // Headers take more space
              var headerLevel = (trimmedLine.match(/^#+/) || [""])[0].length;
              contentLines += headerLevel <= 2 ? 1.5 : 1.2;
            } else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ") || /^\d+\.\s/.test(trimmedLine)) {
              // List items
              contentLines += 1;
            } else if (trimmedLine.startsWith("```")) {
              // Code blocks take more space
              contentLines += 1.5;
            } else {
              // Regular text lines
              // Estimate line wrapping based on content length (assuming ~50 chars per line on mobile)
              var estimatedLines = Math.ceil(trimmedLine.length / 50);
              contentLines += Math.max(1, estimatedLines);
            }
          }
          // Convert content lines to grid height units (approximately 2-3 content lines per grid unit)
        } catch (err) {
          _iterator12.e(err);
        } finally {
          _iterator12.f();
        }
        height += Math.ceil(contentLines / 2.5);
      } else {
        // Default height if no content available
        height += 3;
      }
      // Ensure minimum and maximum bounds for markdown
      return Math.max(4, Math.min(Math.ceil(height), 12));
    }
    // Convert desktop layout to mobile layout intelligently with caching
  }, {
    key: "convertToMobileLayout",
    value: function convertToMobileLayout(card, cardIndex, totalCols, allCards) {
      // Create cache key for this specific layout calculation
      var cacheKey = "".concat(card.id, "-").concat(cardIndex, "-").concat(totalCols, "-").concat(allCards.length);
      // Return cached result if available
      if (this.layoutCache.has(cacheKey)) {
        return this.layoutCache.get(cacheKey);
      }
      var cardType = card.type;
      var desktopLayout = card.layout;
      if (cardType === "metric") {
        // Metric cards: 2 per row
        var mobileWidth = Math.floor(totalCols / 2);
        var mobileHeight = 2; // Smaller height for metric cards on mobile
        // Find how many metric cards are before this one
        var metricCardsBefore = 0;
        for (var i = 0; i < cardIndex; i++) {
          if (allCards[i].type === "metric") {
            metricCardsBefore++;
          }
        }
        // Calculate position based on metric card index
        var metricRowIndex = Math.floor(metricCardsBefore / 2);
        var isFirstInRow = metricCardsBefore % 2 === 0;
        // Calculate Y position considering non-metric cards before this metric card
        var yPosition = 0;
        for (var _i = 0; _i < cardIndex; _i++) {
          var prevCard = allCards[_i];
          if (prevCard.type !== "metric") {
            // Non-metric card takes full row
            var prevDesktopAspectRatio = prevCard.layout.w / prevCard.layout.h;
            var prevMobileHeight = Math.max(3, Math.min(Math.round(totalCols / prevDesktopAspectRatio), 8));
            yPosition += prevMobileHeight + 1;
          }
        }
        // Add metric rows height
        yPosition += metricRowIndex * (mobileHeight + 1);
        var layout = {
          i: card.id,
          x: isFirstInRow ? 0 : mobileWidth,
          y: yPosition,
          w: mobileWidth,
          h: mobileHeight,
          minW: Math.min(desktopLayout.minW || mobileWidth, mobileWidth),
          minH: Math.min(desktopLayout.minH || mobileHeight, mobileHeight),
          maxW: Math.min(desktopLayout.maxW || mobileWidth, mobileWidth),
          maxH: Math.min(desktopLayout.maxH || mobileHeight, mobileHeight)
        };
        // Cache the result
        this.layoutCache.set(cacheKey, layout);
        return layout;
      } else if (cardType === "kpi") {
        // KPI cards: 1 per row (full width) with dynamic height based on content
        var _mobileWidth = totalCols;
        var _mobileHeight = this.calculateKPIHeight(card);
        console.log("mobileHeight", _mobileHeight);
        // Calculate Y position considering all previous cards
        var _yPosition = 0;
        for (var _i2 = 0; _i2 < cardIndex; _i2++) {
          var _prevCard = allCards[_i2];
          if (_prevCard.type === "metric") {
            // Check if this metric card starts a new row
            var _metricCardsBefore = 0;
            for (var j = 0; j < _i2; j++) {
              if (allCards[j].type === "metric") {
                _metricCardsBefore++;
              }
            }
            var isFirstMetricInRow = _metricCardsBefore % 2 === 0;
            if (isFirstMetricInRow) {
              _yPosition += 2 + 1; // metric card height + gap
            }
          } else {
            // Non-metric card (KPI or other cards)
            var _prevMobileHeight = void 0;
            if (_prevCard.type === "kpi") {
              _prevMobileHeight = this.calculateKPIHeight(_prevCard);
            } else {
              // Height calculation for different card types
              _prevMobileHeight = 6; // Base height for other cards
              if (_prevCard.type === "echarts") {
                _prevMobileHeight = 7; // ECharts cards: base + 1
              } else if (_prevCard.type === "table") {
                _prevMobileHeight = 8; // Table cards: base + 2
              } else if (_prevCard.type === "markdown") {
                _prevMobileHeight = this.calculateMarkdownHeight(_prevCard); // Markdown cards: intelligent height calculation
              }
            }
            _yPosition += _prevMobileHeight + 1;
          }
        }
        var _layout = {
          i: card.id,
          x: 0,
          y: _yPosition,
          w: _mobileWidth,
          h: _mobileHeight,
          minW: Math.min(desktopLayout.minW || _mobileWidth, _mobileWidth),
          minH: Math.min(desktopLayout.minH || _mobileHeight, _mobileHeight),
          maxW: Math.min(desktopLayout.maxW || _mobileWidth, _mobileWidth),
          maxH: Math.min(desktopLayout.maxH || _mobileHeight, _mobileHeight)
        };
        // Cache the result
        this.layoutCache.set(cacheKey, _layout);
        return _layout;
      } else {
        // Other cards (chart, table, text, image, etc.): 1 per row (full width) with fixed height
        var _mobileWidth2 = totalCols;
        // Height calculation for different card types (except metric and KPI)
        var _mobileHeight2 = 6; // Base height for other cards
        if (cardType === "echarts") {
          _mobileHeight2 = 7; // ECharts cards: base + 1
        } else if (cardType === "table") {
          _mobileHeight2 = 8; // Table cards: base + 2
        } else if (cardType === "markdown") {
          _mobileHeight2 = this.calculateMarkdownHeight(card); // Markdown cards: intelligent height calculation
        }
        // Calculate Y position considering all previous cards
        var _yPosition2 = 0;
        for (var _i3 = 0; _i3 < cardIndex; _i3++) {
          var _prevCard2 = allCards[_i3];
          if (_prevCard2.type === "metric") {
            // Check if this metric card starts a new row
            var _metricCardsBefore2 = 0;
            for (var _j = 0; _j < _i3; _j++) {
              if (allCards[_j].type === "metric") {
                _metricCardsBefore2++;
              }
            }
            var _isFirstMetricInRow = _metricCardsBefore2 % 2 === 0;
            if (_isFirstMetricInRow) {
              _yPosition2 += 2 + 1; // metric card height + gap
            }
          } else {
            // Non-metric card (KPI or other cards)
            var _prevMobileHeight2 = void 0;
            if (_prevCard2.type === "kpi") {
              _prevMobileHeight2 = this.calculateKPIHeight(_prevCard2);
            } else {
              // Height calculation for different card types
              _prevMobileHeight2 = 6; // Base height for other cards
              if (_prevCard2.type === "echarts") {
                _prevMobileHeight2 = 7; // ECharts cards: base + 1
              } else if (_prevCard2.type === "table") {
                _prevMobileHeight2 = 8; // Table cards: base + 2
              } else if (_prevCard2.type === "markdown") {
                _prevMobileHeight2 = this.calculateMarkdownHeight(_prevCard2); // Markdown cards: intelligent height calculation
              }
            }
            _yPosition2 += _prevMobileHeight2 + 1;
          }
        }
        var _layout2 = {
          i: card.id,
          x: 0,
          y: _yPosition2,
          w: _mobileWidth2,
          h: _mobileHeight2,
          minW: Math.min(desktopLayout.minW || _mobileWidth2, _mobileWidth2),
          minH: Math.min(desktopLayout.minH || _mobileHeight2, _mobileHeight2),
          maxW: Math.min(desktopLayout.maxW || _mobileWidth2, _mobileWidth2),
          maxH: Math.min(desktopLayout.maxH || _mobileHeight2, _mobileHeight2)
        };
        // Cache the result
        this.layoutCache.set(cacheKey, _layout2);
        return _layout2;
      }
    }
    // Optimize re-rendering by checking if props have actually changed
  }, {
    key: "shouldComponentUpdate",
    value: function shouldComponentUpdate(nextProps) {
      // Check if cards array has changed
      if (this.props.cards !== nextProps.cards) {
        return true;
      }
      // Check if other important props have changed
      if (this.props.visible !== nextProps.visible || this.props.editorConfig !== nextProps.editorConfig || this.props.dashboardConfig !== nextProps.dashboardConfig) {
        return true;
      }
      return false;
    }
    // Clear cache when component unmounts
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      this.layoutCache.clear();
      this.sortedCardsCache = null;
      this.lastCardsHash = null;
    }
    // Clear cache when cards change significantly
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      // If cards array reference changed, clear layout cache
      if (prevProps.cards !== this.props.cards) {
        this.layoutCache.clear();
      }
    }
    // Check and register mobile ECharts theme on component mount
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      this.ensureMobileEChartsTheme();
    }
    // Ensure mobile ECharts theme is registered
  }, {
    key: "ensureMobileEChartsTheme",
    value: function ensureMobileEChartsTheme() {
      var echartsThemeName = this.getMobileEChartsThemeName();
      // Check if ECharts is available and theme is not already registered
      if (window.echarts && window.GET_ECHARTS_THEME_CONFIG) {
        // Use mobile dashboard configuration directly from props
        var dashboardConfig = this.props.dashboardConfig;
        try {
          var mobileThemeConfig = window.GET_ECHARTS_THEME_CONFIG(dashboardConfig);
          window.echarts.registerTheme(echartsThemeName, mobileThemeConfig);
        } catch (error) {
          console.warn("Failed to register mobile ECharts theme: ".concat(echartsThemeName), error);
        }
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _React2,
        _this38 = this;
      var _this$props8 = this.props,
        cards = _this$props8.cards,
        editorConfig = _this$props8.editorConfig,
        dashboardConfig = _this$props8.dashboardConfig,
        visible = _this$props8.visible,
        createCardFromConfig = _this$props8.createCardFromConfig,
        GridLayout = _this$props8.GridLayout;
      // Define mobile-specific ECharts theme configuration
      var echartsThemeName = this.getMobileEChartsThemeName();
      // Get sorted cards with caching
      var sortedCards = this.getSortedCards(cards);
      // Create card elements for mobile (no drag/resize/hover support) using sorted cards
      // Use map with optimized rendering
      var cardElements = sortedCards.map(function (cardConfig) {
        var className = "grid-item mobile-grid-item non-draggable non-resizable non-hoverable";
        var cardElement = visible ? createCardFromConfig(cardConfig, {
          editorConfig: editorConfig,
          dashboardConfig: dashboardConfig,
          echartsThemeName: echartsThemeName
        }) : null;
        return React.createElement("div", {
          key: cardConfig.id,
          className: className,
          style: {
            visibility: visible ? "visible" : "hidden"
          }
        }, cardElement);
      });
      return React.createElement(React.Fragment, null, (_React2 = React).createElement.apply(_React2, [GridLayout, {
        className: "layout mobile-layout",
        layout: sortedCards.map(function (card, index) {
          return _this38.convertToMobileLayout(card, index, dashboardConfig.GRID_COLS, sortedCards);
        }),
        cols: dashboardConfig.GRID_COLS,
        rowHeight: dashboardConfig.GRID_DEFAULT_ROW_HEIGHT,
        isDraggable: false,
        // Force disable dragging on mobile
        isResizable: false,
        // Force disable resizing on mobile
        margin: dashboardConfig.GRID_MARGIN,
        containerPadding: dashboardConfig.GRID_CONTAINER_PADDING,
        useCSSTransforms: true,
        transformScale: 1,
        allowOverlap: false,
        preventCollision: true // Prevent collision on mobile
      }].concat(_toConsumableArray(cardElements))),
      // No resizing overlay for mobile since resizing is disabled
      null);
    }
  }]);
}(React.Component);
window.MobileGridLayout = MobileGridLayout;

// Grid dashboard component
var GridDashboard = /*#__PURE__*/function (_React$Component18) {
  function GridDashboard(props) {
    var _window$UTILS2, _window$UTILS3;
    var _this39;
    _classCallCheck(this, GridDashboard);
    _this39 = _callSuper(this, GridDashboard, [props]);
    var WidthProvider = window.ReactGridLayout.WidthProvider;
    _this39.GridLayout = WidthProvider(window.ReactGridLayout);
    var initialIsMobile = _this39.detectMobileDevice();
    _this39.state = {
      visible: false,
      rowHeight: _this39.calculateDynamicRowHeight(),
      isResizing: false,
      isDragging: false,
      isExpanding: false,
      isMobile: initialIsMobile
    };
    // Cache for mobile configurations to avoid recreating on each render
    // Initialize with default values based on initial mobile state
    _this39.mobileConfigCache = {
      editorConfig: initialIsMobile ? (_window$UTILS2 = window.UTILS) === null || _window$UTILS2 === void 0 ? void 0 : _window$UTILS2.createMobileEditorConfig(props.editorConfig) : null,
      dashboardConfig: initialIsMobile ? (_window$UTILS3 = window.UTILS) === null || _window$UTILS3 === void 0 ? void 0 : _window$UTILS3.createMobileDashboardConfig(props.dashboardConfig) : null,
      lastEditorConfigRef: initialIsMobile ? props.editorConfig : null,
      lastDashboardConfigRef: initialIsMobile ? props.dashboardConfig : null
    };
    _this39.cardRenderStatus = new Map();
    _this39.hasNotifiedAllCardsComplete = false;
    _this39.handleResize = _this39.handleResize.bind(_this39);
    _this39.handleDragStart = _this39.handleDragStart.bind(_this39);
    _this39.handleDragStop = _this39.handleDragStop.bind(_this39);
    _this39.handleResizeStart = _this39.handleResizeStart.bind(_this39);
    _this39.handleResizeStop = _this39.handleResizeStop.bind(_this39);
    _this39.handleCardRenderStatusChange = _this39.handleCardRenderStatusChange.bind(_this39);
    _this39.detectMobileDevice = _this39.detectMobileDevice.bind(_this39);
    _this39.debouncedResize = window.UTILS.debounce(_this39.handleResize, 100);
    return _this39;
  }
  // Detect if current device is mobile with comprehensive checks
  _inherits(GridDashboard, _React$Component18);
  return _createClass(GridDashboard, [{
    key: "detectMobileDevice",
    value: function detectMobileDevice() {
      // Check if touch is supported
      var hasTouchSupport = "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
      // Enhanced user agent detection with more modern patterns
      var userAgent = navigator.userAgent || navigator.vendor || window.opera || "";
      var isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|phone|tablet/i.test(userAgent);
      // Check for specific mobile platforms
      var isAndroid = /android/i.test(userAgent);
      var isIOS = /iphone|ipad|ipod/i.test(userAgent);
      var isWindowsMobile = /windows phone|iemobile|wpdesktop/i.test(userAgent);
      // Screen size checks with different thresholds
      var screenWidth = Math.max(window.innerWidth, window.screen.width);
      var screenHeight = Math.max(window.innerHeight, window.screen.height);
      var isMobileScreenSize = screenWidth <= 768;
      var isSmallScreen = Math.min(screenWidth, screenHeight) <= 480; // Definitely mobile
      // Check device pixel ratio (high DPI mobile devices)
      var devicePixelRatio = window.devicePixelRatio || 1;
      var hasHighDPI = devicePixelRatio > 1.5;
      // Check for mobile-specific CSS media queries support
      var isMobileMediaQuery = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
      // Combine all indicators with weighted logic
      var mobileIndicators = [isSmallScreen,
      // Strong indicator
      isAndroid || isIOS || isWindowsMobile,
      // Strong indicator
      isMobileUserAgent && hasTouchSupport,
      // Medium indicator
      isMobileScreenSize && hasTouchSupport,
      // Medium indicator
      isMobileMediaQuery && hasHighDPI // Weak indicator
      ];
      // Return true if we have strong indicators or multiple medium indicators
      var strongIndicators = mobileIndicators.slice(0, 2).filter(Boolean).length;
      var mediumIndicators = mobileIndicators.slice(2, 4).filter(Boolean).length;
      var weakIndicators = mobileIndicators.slice(4).filter(Boolean).length;
      return strongIndicators > 0 || mediumIndicators >= 2 || mediumIndicators >= 1 && weakIndicators >= 1;
    }
    // Get mobile configurations with caching
  }, {
    key: "getMobileConfigs",
    value: function getMobileConfigs(editorConfig, dashboardConfig) {
      var _window$UTILS4, _window$UTILS5;
      // Check if configs have changed (by reference)
      if (this.mobileConfigCache.lastEditorConfigRef === editorConfig && this.mobileConfigCache.lastDashboardConfigRef === dashboardConfig && this.mobileConfigCache.editorConfig && this.mobileConfigCache.dashboardConfig) {
        return {
          mobileEditorConfig: this.mobileConfigCache.editorConfig,
          mobileDashboardConfig: this.mobileConfigCache.dashboardConfig
        };
      }
      // Create new mobile configurations
      var mobileEditorConfig = (_window$UTILS4 = window.UTILS) === null || _window$UTILS4 === void 0 ? void 0 : _window$UTILS4.createMobileEditorConfig(editorConfig);
      var mobileDashboardConfig = (_window$UTILS5 = window.UTILS) === null || _window$UTILS5 === void 0 ? void 0 : _window$UTILS5.createMobileDashboardConfig(dashboardConfig);
      // Cache the configurations
      this.mobileConfigCache.editorConfig = mobileEditorConfig;
      this.mobileConfigCache.dashboardConfig = mobileDashboardConfig;
      this.mobileConfigCache.lastEditorConfigRef = editorConfig;
      this.mobileConfigCache.lastDashboardConfigRef = dashboardConfig;
      return {
        mobileEditorConfig: mobileEditorConfig,
        mobileDashboardConfig: mobileDashboardConfig
      };
    }
  }, {
    key: "handleCardRenderStatusChange",
    value: function handleCardRenderStatusChange(statusInfo) {
      var cardId = statusInfo.cardId,
        status = statusInfo.status,
        error = statusInfo.error,
        timestamp = statusInfo.timestamp;
      this.cardRenderStatus.set(cardId, {
        status: status,
        error: error,
        timestamp: timestamp
      });
      this.checkAllCardsRenderComplete();
    }
  }, {
    key: "checkAllCardsRenderComplete",
    value: function checkAllCardsRenderComplete() {
      var _this40 = this;
      var cards = this.props.cards;
      if (!cards || !Array.isArray(cards) || cards.length === 0) {
        return;
      }
      if (this.hasNotifiedAllCardsComplete) {
        return;
      }
      // Only check cards that will actually be rendered (cards with valid layout)
      var validCards = cards.filter(function (card) {
        return card.layout && _typeof(card.layout) === "object";
      });
      var cardsWithoutLayout = cards.filter(function (card) {
        return !card.layout || _typeof(card.layout) !== "object";
      });
      // Check if all valid cards (cards that will be rendered) are complete
      var allValidCardsComplete = validCards.every(function (card) {
        var status = _this40.cardRenderStatus.get(card.id);
        return status && (status.status === "success" || status.status === "error");
      });
      if (allValidCardsComplete) {
        this.hasNotifiedAllCardsComplete = true;
        // Create status for rendered cards
        var validCardsStatus = validCards.map(function (card) {
          return _objectSpread({
            cardId: card.id,
            cardTitle: card.title,
            cardType: card.type
          }, _this40.cardRenderStatus.get(card.id));
        });
        // Create status for cards without layout (mark as skipped)
        var skippedCardsStatus = cardsWithoutLayout.map(function (card) {
          return {
            cardId: card.id,
            cardTitle: card.title,
            cardType: card.type,
            status: "skipped",
            error: null,
            timestamp: Date.now(),
            reason: "No layout configuration"
          };
        });
        // Combine all cards status
        var allCardsStatus = [].concat(_toConsumableArray(validCardsStatus), _toConsumableArray(skippedCardsStatus));
        var successCount = validCardsStatus.filter(function (card) {
          return card.status === "success";
        }).length;
        var errorCount = validCardsStatus.filter(function (card) {
          return card.status === "error";
        }).length;
        var skippedCount = skippedCardsStatus.length;
        if (this.props.onAllCardsRenderComplete) {
          this.props.onAllCardsRenderComplete({
            totalCards: cards.length,
            renderedCards: validCards.length,
            successCount: successCount,
            errorCount: errorCount,
            skippedCount: skippedCount,
            cardsStatus: allCardsStatus,
            timestamp: Date.now()
          });
        }
      }
    }
  }, {
    key: "resetRenderStatus",
    value: function resetRenderStatus(newCards) {
      var _this41 = this;
      this.cardRenderStatus.clear();
      this.hasNotifiedAllCardsComplete = false;
      if (newCards && Array.isArray(newCards)) {
        // Only initialize status for cards that will actually be rendered (cards with valid layout)
        var validCards = newCards.filter(function (card) {
          return card.layout && _typeof(card.layout) === "object";
        });
        validCards.forEach(function (card) {
          _this41.cardRenderStatus.set(card.id, {
            status: "loading",
            error: null,
            timestamp: Date.now()
          });
        });
      }
    }
  }, {
    key: "calculateDynamicRowHeight",
    value: function calculateDynamicRowHeight() {
      var config = this.props.dashboardConfig;
      if (!config) return 32;
      var wrapperHeight = window.innerHeight;
      var layoutMargin = config.GRID_MARGIN[0];
      var layoutPadding = config.GRID_CONTAINER_PADDING[0];
      var maxRows = window.UTILS.ceil((wrapperHeight + layoutMargin - layoutPadding + layoutPadding) / (config.GRID_DEFAULT_ROW_HEIGHT + layoutMargin), 0);
      var maxRowsHeight = maxRows * config.GRID_DEFAULT_ROW_HEIGHT + (maxRows - 1) * layoutMargin + layoutPadding * 2;
      var subtractHeight = wrapperHeight - maxRowsHeight;
      var subRowHeight = window.UTILS.floor(subtractHeight / maxRows, 2);
      var resultRowHeight = config.GRID_DEFAULT_ROW_HEIGHT + subRowHeight;
      return resultRowHeight;
    }
  }, {
    key: "handleResize",
    value: function handleResize() {
      var newRowHeight = this.calculateDynamicRowHeight();
      var newIsMobile = this.detectMobileDevice();
      if (newRowHeight !== this.state.rowHeight || newIsMobile !== this.state.isMobile) {
        this.setState({
          rowHeight: newRowHeight,
          isMobile: newIsMobile
        });
      }
    }
  }, {
    key: "handleDragStart",
    value: function handleDragStart(layout, oldItem, newItem, placeholder, e, element) {
      this.setState({
        isDragging: true
      });
      if (this.props.onDragStart) {
        this.props.onDragStart(layout, oldItem, newItem, placeholder, e, element);
      }
    }
  }, {
    key: "handleDragStop",
    value: function handleDragStop(layout, oldItem, newItem, placeholder, e, element) {
      this.setState({
        isDragging: false
      });
      if (this.props.onDragStop) {
        this.props.onDragStop(layout, oldItem, newItem, placeholder, e, element);
      }
    }
  }, {
    key: "handleResizeStart",
    value: function handleResizeStart(layout, oldItem, newItem, placeholder, e, element) {
      this.setState({
        isResizing: true
      });
      if (this.props.onResizeStart) {
        this.props.onResizeStart(layout, oldItem, newItem, placeholder, e, element);
      }
    }
  }, {
    key: "handleResizeStop",
    value: function handleResizeStop(layout, oldItem, newItem, placeholder, e, element) {
      this.setState({
        isResizing: false
      });
      if (this.props.onResizeStop) {
        this.props.onResizeStop(layout, oldItem, newItem, placeholder, e, element);
      }
    }
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      var _window$DashboardFram,
        _this42 = this;
      window.addEventListener("resize", this.debouncedResize);
      this.handleResize();
      this.resetRenderStatus(this.props.cards);
      // Apply theme styles based on current mobile state
      var configToApply = this.state.isMobile ? this.getMobileConfigs(this.props.editorConfig, this.props.dashboardConfig).mobileDashboardConfig : this.props.dashboardConfig;
      if ((_window$DashboardFram = window.DashboardFramework) !== null && _window$DashboardFram !== void 0 && _window$DashboardFram.applyThemeStyles && configToApply) {
        window.DashboardFramework.applyThemeStyles(configToApply);
      }
      setTimeout(function () {
        _this42.setState({
          visible: true
        });
      }, 100);
    }
    // Check card changes when component updates
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps, prevState) {
      // If card list changes, reset render status
      if (prevProps.cards !== this.props.cards) {
        this.resetRenderStatus(this.props.cards);
      }
      // Clear mobile config cache if editor or dashboard config changes
      if (prevProps.editorConfig !== this.props.editorConfig || prevProps.dashboardConfig !== this.props.dashboardConfig) {
        this.mobileConfigCache.editorConfig = null;
        this.mobileConfigCache.dashboardConfig = null;
        this.mobileConfigCache.lastEditorConfigRef = null;
        this.mobileConfigCache.lastDashboardConfigRef = null;
      }
      // If dashboard configuration changes, apply theme styles
      if (prevProps.dashboardConfig !== this.props.dashboardConfig) {
        var _window$DashboardFram2;
        if ((_window$DashboardFram2 = window.DashboardFramework) !== null && _window$DashboardFram2 !== void 0 && _window$DashboardFram2.applyThemeStyles && this.props.dashboardConfig) {
          window.DashboardFramework.applyThemeStyles(this.props.dashboardConfig);
        }
      }
      // If mobile state changes, apply appropriate theme styles
      if (prevState.isMobile !== this.state.isMobile) {
        var _window$DashboardFram3;
        var configToApply = this.state.isMobile ? this.getMobileConfigs(this.props.editorConfig, this.props.dashboardConfig).mobileDashboardConfig : this.props.dashboardConfig;
        if ((_window$DashboardFram3 = window.DashboardFramework) !== null && _window$DashboardFram3 !== void 0 && _window$DashboardFram3.applyThemeStyles && configToApply) {
          window.DashboardFramework.applyThemeStyles(configToApply);
        }
      }
    }
    // Remove event listeners when component unmounts
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      window.removeEventListener("resize", this.debouncedResize);
    }
    // Create card instance based on card configuration with dynamic parameters
  }, {
    key: "createCardFromConfig",
    value: function createCardFromConfig(cardConfig) {
      for (var _len2 = arguments.length, additionalProps = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        additionalProps[_key2 - 1] = arguments[_key2];
      }
      // Extract common props and merge additional props if provided
      var extraProps = additionalProps.length > 0 ? Object.assign.apply(Object, [{}].concat(additionalProps)) : {};
      return React.createElement(window.BaseCard, _objectSpread(_objectSpread({}, cardConfig), {}, {
        onRenderStatusChange: this.handleCardRenderStatusChange,
        isMobile: this.state.isMobile,
        echartsThemeName: window.ECHARTS_THEME_NAME || "default"
      }, extraProps));
    }
    // Filter cards and collect layout warnings
  }, {
    key: "filterCardsAndCollectWarnings",
    value: function filterCardsAndCollectWarnings(cards, source) {
      // Separate cards with and without layout property
      var validCards = cards.filter(function (card) {
        return card.layout && _typeof(card.layout) === "object";
      });
      var cardsWithoutLayout = cards.filter(function (card) {
        return !card.layout || _typeof(card.layout) !== "object";
      });
      // Collect warning if there are cards without layout
      if (cardsWithoutLayout.length > 0 && window.ErrorCollector) {
        window.ErrorCollector.collectCardsWithoutLayoutWarning(cardsWithoutLayout, cards.length, source);
      }
      return validCards;
    }
    // Render mobile layout
  }, {
    key: "renderMobileLayout",
    value: function renderMobileLayout() {
      var _this$props9 = this.props,
        cards = _this$props9.cards,
        editorConfig = _this$props9.editorConfig,
        dashboardConfig = _this$props9.dashboardConfig;
      var visible = this.state.visible;
      // Filter cards and collect layout warnings
      var validCards = this.filterCardsAndCollectWarnings(cards, "GridDashboard.renderMobileLayout");
      // Get cached mobile configurations
      var _this$getMobileConfig = this.getMobileConfigs(editorConfig, dashboardConfig),
        mobileEditorConfig = _this$getMobileConfig.mobileEditorConfig,
        mobileDashboardConfig = _this$getMobileConfig.mobileDashboardConfig;
      return React.createElement(window.MobileGridLayout, {
        cards: validCards,
        editorConfig: mobileEditorConfig,
        dashboardConfig: mobileDashboardConfig,
        visible: visible,
        createCardFromConfig: this.createCardFromConfig.bind(this),
        GridLayout: this.GridLayout
      });
    }
    // Render desktop layout
  }, {
    key: "renderDesktopLayout",
    value: function renderDesktopLayout() {
      var _this43 = this,
        _React3;
      var _this$props0 = this.props,
        cards = _this$props0.cards,
        onLayoutChange = _this$props0.onLayoutChange,
        editorConfig = _this$props0.editorConfig,
        dashboardConfig = _this$props0.dashboardConfig,
        onDeleteCard = _this$props0.onDeleteCard,
        onTitleChange = _this$props0.onTitleChange,
        onTitleAlignChange = _this$props0.onTitleAlignChange;
      var GridLayout = this.GridLayout;
      var _this$state0 = this.state,
        rowHeight = _this$state0.rowHeight,
        visible = _this$state0.visible,
        isResizing = _this$state0.isResizing;
      var config = dashboardConfig;
      // Filter cards and collect layout warnings
      var validCards = this.filterCardsAndCollectWarnings(cards, "GridDashboard.renderDesktopLayout");
      // Desktop grid configuration
      var gridConfig = {
        cols: config.GRID_COLS,
        margin: config.GRID_MARGIN,
        containerPadding: config.GRID_CONTAINER_PADDING
      };
      // Create card elements for desktop
      var cardElements = validCards.map(function (cardConfig) {
        var isDraggable = (editorConfig === null || editorConfig === void 0 ? void 0 : editorConfig.DRAGGABLE) || false;
        var isHoverable = dashboardConfig.INTERACTION_CARD_HOVERABLE;
        var className = "grid-item desktop-grid-item ".concat(isDraggable ? "draggable" : "non-draggable", " ").concat(isHoverable ? "hoverable" : "");
        return React.createElement("div", {
          key: cardConfig.id,
          className: className,
          style: {
            visibility: visible ? "visible" : "hidden"
          }
        }, visible ? _this43.createCardFromConfig(cardConfig, {
          editorConfig: editorConfig,
          dashboardConfig: dashboardConfig,
          onDeleteCard: onDeleteCard,
          onTitleChange: onTitleChange,
          onTitleAlignChange: onTitleAlignChange
        }) : null);
      });
      return React.createElement(React.Fragment, null, (_React3 = React).createElement.apply(_React3, [GridLayout, {
        className: "layout desktop-layout",
        layout: validCards.map(function (card) {
          return _objectSpread({
            i: card.id
          }, card.layout);
        }),
        onLayoutChange: onLayoutChange,
        onDragStart: this.handleDragStart,
        onDragStop: this.handleDragStop,
        onResizeStart: this.handleResizeStart,
        onResizeStop: this.handleResizeStop,
        cols: gridConfig.cols,
        rowHeight: rowHeight,
        isDraggable: (editorConfig === null || editorConfig === void 0 ? void 0 : editorConfig.DRAGGABLE) || false,
        isResizable: (editorConfig === null || editorConfig === void 0 ? void 0 : editorConfig.RESIZABLE) || false,
        resizeHandles: ["se", "sw", "ne", "nw"],
        margin: gridConfig.margin,
        containerPadding: gridConfig.containerPadding,
        draggableHandle: editorConfig !== null && editorConfig !== void 0 && editorConfig.DRAGGABLE ? ".drag-handle" : null,
        useCSSTransforms: true,
        transformScale: 1,
        allowOverlap: false,
        preventCollision: false,
        draggableCancel: ""
      }].concat(_toConsumableArray(cardElements))), isResizing ? React.createElement("div", {
        className: "resizing-overlay desktop-resizing-overlay",
        style: {
          height: document.documentElement.scrollHeight
        }
      }) : null);
    }
  }, {
    key: "render",
    value: function render() {
      var cards = this.props.cards;
      var isMobile = this.state.isMobile;
      var config = this.props.dashboardConfig;
      if (!config) return null;
      // Check if there is card data
      if (!cards || !Array.isArray(cards) || cards.length === 0) {
        return null; // GridDashboard doesn't handle empty state directly, let parent Dashboard component handle it
      }
      // Route to appropriate render method based on device type
      return isMobile ? this.renderMobileLayout() : this.renderDesktopLayout();
    }
  }]);
}(React.Component);
window.GridDashboard = GridDashboard;

// Dashboard application main component
var Dashboard = /*#__PURE__*/function (_React$Component19) {
  function Dashboard(props) {
    var _this44;
    _classCallCheck(this, Dashboard);
    _this44 = _callSuper(this, Dashboard, [props]);
    _this44.state = {
      cards: null
    };
    _this44.isInitialized = false;
    _this44.handleLayoutChange = _this44.handleLayoutChange.bind(_this44);
    _this44.handleAllCardsRenderComplete = _this44.handleAllCardsRenderComplete.bind(_this44);
    _this44.handleDeleteCard = _this44.handleDeleteCard.bind(_this44);
    _this44.handleTitleChange = _this44.handleTitleChange.bind(_this44);
    _this44.handleTitleAlignChange = _this44.handleTitleAlignChange.bind(_this44);
    return _this44;
  }
  _inherits(Dashboard, _React$Component19);
  return _createClass(Dashboard, [{
    key: "shouldTriggerDataChange",
    value: function shouldTriggerDataChange(oldCards, newCards) {
      if (oldCards === newCards) return false;
      if (!oldCards && !newCards) return false;
      if (!oldCards || !newCards) return true;
      if (!Array.isArray(oldCards) || !Array.isArray(newCards)) return true;
      if (oldCards.length !== newCards.length) return true;
      try {
        var _loop = function _loop() {
            var oldCard = oldCards[i];
            var newCard = newCards.find(function (card) {
              return card.id === oldCard.id;
            });
            if (!newCard || oldCard.type !== newCard.type || oldCard.title !== newCard.title) {
              return {
                v: true
              };
            }
          },
          _ret;
        for (var i = 0; i < oldCards.length; i++) {
          _ret = _loop();
          if (_ret) return _ret.v;
        }
        return false;
      } catch (error) {
        return true;
      }
    }
  }, {
    key: "handleAllCardsRenderComplete",
    value: function handleAllCardsRenderComplete(renderInfo) {
      var totalCards = renderInfo.totalCards,
        cardsStatus = renderInfo.cardsStatus,
        timestamp = renderInfo.timestamp;
      // 从 ErrorCollector 获取更准确的错误统计
      var errorCount = 0;
      var successCount = totalCards;
      var enhancedCardsStatus = cardsStatus;
      if (window.ErrorCollector) {
        // 获取所有卡片ID
        var cardIds = cardsStatus.map(function (card) {
          return card.cardId;
        });
        // 从 ErrorCollector 获取错误统计
        var errorStats = window.ErrorCollector.getCardErrorStats(cardIds);
        // 使用 ErrorCollector 的错误统计
        errorCount = errorStats.cardsWithErrors;
        successCount = errorStats.cardsWithoutErrors;
        // 增强卡片状态信息，添加 ErrorCollector 的错误详情
        enhancedCardsStatus = cardsStatus.map(function (card) {
          var cardErrors = errorStats.cardErrorMap.get(card.cardId) || [];
          var hasErrorCollectorErrors = cardErrors.length > 0;
          return _objectSpread(_objectSpread({}, card), {}, {
            // 如果 ErrorCollector 中有错误，则标记为错误状态
            status: hasErrorCollectorErrors ? "error" : card.status,
            errorCollectorErrors: cardErrors,
            errorCollectorErrorCount: cardErrors.length,
            // 保留原始渲染状态用于对比
            originalRenderStatus: card.status
          });
        });
      } else {
        // 如果 ErrorCollector 不可用，使用原始统计
        errorCount = renderInfo.errorCount;
        successCount = renderInfo.successCount;
      }
      // 构建增强的渲染信息
      var enhancedRenderInfo = {
        totalCards: totalCards,
        successCount: successCount,
        errorCount: errorCount,
        cardsStatus: enhancedCardsStatus,
        timestamp: timestamp
      };
      // Trigger callback
      if (this.props.onAllCardsRenderComplete) {
        this.props.onAllCardsRenderComplete(enhancedRenderInfo);
      }
      var skippedCount = enhancedRenderInfo.skippedCount || 0;
      var renderedCards = enhancedRenderInfo.renderedCards || totalCards;
      // Trigger global custom event
      var event = new CustomEvent("DashboardAllCardsRenderComplete", {
        detail: {
          totalCards: totalCards,
          renderedCards: renderedCards,
          successCount: successCount,
          errorCount: errorCount,
          skippedCount: skippedCount,
          timestamp: timestamp,
          renderDuration: timestamp - (this.dashboardStartTime || timestamp)
        }
      });
      console.log("[Dashboard] All cards rendering completed - Total: ".concat(totalCards, ", Rendered: ").concat(renderedCards, ", Success: ").concat(successCount, ", Failed: ").concat(errorCount, ", Skipped: ").concat(skippedCount, " (Source: ").concat(window.ErrorCollector ? "ErrorCollector" : "RenderStatus", ")"));
      document.dispatchEvent(event);
    }
    // Trigger data change event
  }, {
    key: "triggerDataChangeEvent",
    value: function triggerDataChangeEvent(oldCards, newCards, type) {
      // Trigger callback
      if (this.props.onDashboardCardsChange) {
        this.props.onDashboardCardsChange({
          cards: newCards,
          oldCards: oldCards,
          type: type
        });
      }
      // Trigger global event
      var event = new CustomEvent("DashboardCardsChange", {
        detail: {
          cards: newCards,
          oldCards: oldCards,
          type: type,
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(event);
    }
    // Update cards state
  }, {
    key: "updateCardsState",
    value: function updateCardsState(newCards) {
      var oldCards = this.state.cards;
      // Check if data change event needs to be triggered
      if (this.shouldTriggerDataChange(oldCards, newCards)) {
        this.triggerDataChangeEvent(oldCards, newCards, "cards");
      }
      this.setState({
        cards: newCards
      });
    }
    // Check if layout has changed
  }, {
    key: "hasLayoutChanged",
    value: function hasLayoutChanged(newLayouts) {
      if (!this.state.cards || !Array.isArray(newLayouts)) {
        return false;
      }
      try {
        return this.state.cards.some(function (card) {
          var currentLayout = card.layout || {};
          var newLayoutItem = newLayouts.find(function (layoutItem) {
            return layoutItem && layoutItem.i === card.id;
          });
          return newLayoutItem && (currentLayout.x !== newLayoutItem.x || currentLayout.y !== newLayoutItem.y || currentLayout.w !== newLayoutItem.w || currentLayout.h !== newLayoutItem.h);
        });
      } catch (error) {
        console.warn("Error checking layout changes:", error);
        return true;
      }
    }
    // Update card layouts
  }, {
    key: "updateCardLayouts",
    value: function updateCardLayouts(layouts) {
      if (!this.state.cards || !Array.isArray(layouts)) {
        return;
      }
      if (!this.hasLayoutChanged(layouts)) {
        return;
      }
      try {
        // Update layout information
        var updatedCards = this.state.cards.map(function (card) {
          var newLayoutItem = layouts.find(function (layoutItem) {
            return layoutItem && layoutItem.i === card.id;
          });
          if (newLayoutItem) {
            var i = newLayoutItem.i,
              layoutWithoutI = _objectWithoutProperties(newLayoutItem, _excluded);
            return _objectSpread(_objectSpread({}, card), {}, {
              layout: layoutWithoutI
            });
          }
          return card;
        });
        var oldCards = this.state.cards;
        this.setState({
          cards: updatedCards
        });
        // Trigger layout change events
        this.triggerLayoutChangeEvents(oldCards, updatedCards, layouts);
      } catch (error) {
        console.warn("Error updating card layouts:", error);
      }
    }
    // Trigger layout change related events
  }, {
    key: "triggerLayoutChangeEvents",
    value: function triggerLayoutChangeEvents(oldCards, newCards, layouts) {
      // Trigger data change event (layout type)
      this.triggerDataChangeEvent(oldCards, newCards, "layout");
      // Trigger dedicated layout change event
      if (this.props.onLayoutChange) {
        this.props.onLayoutChange({
          layouts: layouts,
          type: "layout",
          timestamp: Date.now()
        });
      }
      var layoutEvent = new CustomEvent("DashboardLayoutChange", {
        detail: {
          layouts: layouts,
          cards: newCards,
          type: "layout",
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(layoutEvent);
    }
    // Handle layout change
  }, {
    key: "handleLayoutChange",
    value: function handleLayoutChange(layouts) {
      // layouts parameter is directly a layout array
      if (!Array.isArray(layouts)) {
        console.warn("Invalid layouts parameter:", layouts);
        return;
      }
      this.updateCardLayouts(layouts);
      // Trigger external callback
      if (this.props.onLayoutChange) {
        this.props.onLayoutChange({
          layouts: layouts
        });
      }
    }
    // Update state when component receives new props
  }, {
    key: "componentDidUpdate",
    value: function componentDidUpdate(prevProps) {
      if (this.hasCardsChanged(prevProps.dashboardCards, this.props.dashboardCards)) {
        this.updateCardsState(this.props.dashboardCards);
      }
    }
    // Check if card data has changed
  }, {
    key: "hasCardsChanged",
    value: function hasCardsChanged(prevCards, currentCards) {
      if (prevCards === currentCards) return false;
      if (!prevCards && !currentCards) return false;
      if (!prevCards || !currentCards) return true;
      if (prevCards.length !== currentCards.length) return true;
      // Different references are considered as changes (since we ensure new references are created only when real changes occur)
      return true;
    }
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      // Record dashboard start time
      this.dashboardStartTime = Date.now();
      // Initialize state
      if (!this.isInitialized) {
        this.setState({
          cards: this.props.dashboardCards
        });
        this.isInitialized = true;
      }
    }
    // Handle title change
  }, {
    key: "handleTitleChange",
    value: function handleTitleChange(cardId, newTitle) {
      var currentCards = this.state.cards || this.props.dashboardCards;
      if (!currentCards) return;
      // Find and update the card with new title
      var updatedCards = currentCards.map(function (card) {
        if (card.id === cardId) {
          return _objectSpread(_objectSpread({}, card), {}, {
            title: newTitle
          });
        }
        return card;
      });
      // Trigger data change event before updating state
      this.triggerDataChangeEvent(currentCards, updatedCards, "title");
      // Update local state
      this.setState({
        cards: updatedCards
      });
      // Update global state
      if (this.props.configManager && this.props.configManager.setDashboardCards) {
        this.props.configManager.setDashboardCards(updatedCards);
      }
    }
    // Handle title alignment change
  }, {
    key: "handleTitleAlignChange",
    value: function handleTitleAlignChange(cardId, newAlign) {
      var currentCards = this.state.cards || this.props.dashboardCards;
      if (!currentCards) return;
      // Find and update the card with new title alignment
      var updatedCards = currentCards.map(function (card) {
        if (card.id === cardId) {
          return _objectSpread(_objectSpread({}, card), {}, {
            titleAlign: newAlign
          });
        }
        return card;
      });
      // Trigger data change event before updating state
      this.triggerDataChangeEvent(currentCards, updatedCards, "titleAlign");
      // Update local state
      this.setState({
        cards: updatedCards
      });
      // Update global state
      if (this.props.configManager && this.props.configManager.setDashboardCards) {
        this.props.configManager.setDashboardCards(updatedCards);
      }
    }
    // Delete card
  }, {
    key: "handleDeleteCard",
    value: function handleDeleteCard(cardId) {
      var currentCards = this.state.cards || this.props.dashboardCards;
      if (!currentCards) return;
      var updatedCards = currentCards.filter(function (card) {
        return card.id !== cardId;
      });
      // Trigger data change event before updating state
      this.triggerDataChangeEvent(currentCards, updatedCards, "delete");
      // Update local state
      this.setState({
        cards: updatedCards
      });
      // Update global state
      if (this.props.configManager && this.props.configManager.setDashboardCards) {
        this.props.configManager.setDashboardCards(updatedCards);
      }
      // Trigger layout change callback
      if (this.props.onLayoutChange) {
        var layouts = updatedCards.map(function (card) {
          return _objectSpread({
            i: card.id
          }, card.layout);
        });
        this.props.onLayoutChange({
          layouts: layouts
        });
      }
    }
    // Get current layout
  }, {
    key: "getLayouts",
    value: function getLayouts() {
      if (!this.state.cards) return [];
      return this.state.cards.map(function (card) {
        return _objectSpread({
          i: card.id
        }, card.layout);
      });
    }
  }, {
    key: "render",
    value: function render() {
      var _window$magicDashboar3;
      // Use card data from component state, fallback to props if not available
      var cards = this.state.cards || this.props.dashboardCards;
      var editorConfig = this.props.editorConfig;
      // Check if dashboard is ready
      var isDashboardReady = ((_window$magicDashboar3 = window.magicDashboard) === null || _window$magicDashboar3 === void 0 ? void 0 : _window$magicDashboar3.ready) === true;
      // Check if there is no card data
      var hasCards = cards && Array.isArray(cards) && cards.length > 0;
      // Render dashboard
      return React.createElement("div", {
        className: "dashboard-container"
      }, hasCards && isDashboardReady ? React.createElement(window.GridDashboard, {
        cards: cards,
        editorConfig: editorConfig,
        dashboardConfig: this.props.dashboardConfig,
        onLayoutChange: this.handleLayoutChange,
        onAllCardsRenderComplete: this.handleAllCardsRenderComplete,
        onDeleteCard: this.handleDeleteCard,
        onTitleChange: this.handleTitleChange,
        onTitleAlignChange: this.handleTitleAlignChange
      }) : React.createElement(window.Empty, {
        dashboardConfig: this.props.dashboardConfig,
        style: {
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) scale(1.5)"
        }
      }));
    }
  }]);
}(React.Component);
window.Dashboard = Dashboard;

// Main application component
function DashboardApp() {
  var _window$magicDashboar4, _window$magicDashboar5, _window$magicDashboar6, _window$magicDashboar7, _window$magicDashboar8, _window$magicDashboar9;
  var _React4 = React,
    useState = _React4.useState;
  var _useState = useState(((_window$magicDashboar4 = window.magicDashboard) === null || _window$magicDashboar4 === void 0 ? void 0 : _window$magicDashboar4.geo) || []),
    _useState2 = _slicedToArray(_useState, 2),
    geoConfig = _useState2[0],
    setGeoConfig = _useState2[1];
  var _useState3 = useState({
      EDITABLE: ((_window$magicDashboar5 = window.magicDashboard) === null || _window$magicDashboar5 === void 0 ? void 0 : _window$magicDashboar5.editable) || false,
      DRAGGABLE: ((_window$magicDashboar6 = window.magicDashboard) === null || _window$magicDashboar6 === void 0 ? void 0 : _window$magicDashboar6.draggable) || false,
      RESIZABLE: ((_window$magicDashboar7 = window.magicDashboard) === null || _window$magicDashboar7 === void 0 ? void 0 : _window$magicDashboar7.resizable) || false,
      DELETABLE: ((_window$magicDashboar8 = window.magicDashboard) === null || _window$magicDashboar8 === void 0 ? void 0 : _window$magicDashboar8.deletable) || false,
      EXPANDABLE: ((_window$magicDashboar9 = window.magicDashboard) === null || _window$magicDashboar9 === void 0 ? void 0 : _window$magicDashboar9.expandable) || false
    }),
    _useState4 = _slicedToArray(_useState3, 2),
    editorConfig = _useState4[0],
    setEditorConfig = _useState4[1];
  var _useState5 = useState(window.DASHBOARD_CARDS || []),
    _useState6 = _slicedToArray(_useState5, 2),
    dashboardCards = _useState6[0],
    setDashboardCards = _useState6[1];
  var _useState7 = useState(window.DASHBOARD_CONFIG || {}),
    _useState8 = _slicedToArray(_useState7, 2),
    dashboardConfig = _useState8[0],
    setDashboardConfig = _useState8[1];
  var composeDashboardConfig = React.useMemo(function () {
    return window.UTILS.getComposeDashboardConfig(dashboardConfig);
  }, [dashboardConfig]);
  // Simplified configuration manager - only keep 4 setState methods
  var configManager = React.useMemo(function () {
    return {
      setGeoConfig: setGeoConfig,
      setEditorConfig: setEditorConfig,
      setDashboardCards: setDashboardCards,
      setDashboardConfig: setDashboardConfig
    };
  }, [setGeoConfig, setEditorConfig, setDashboardCards, setDashboardConfig]);
  // Sync state to window global variables
  React.useEffect(function () {
    if (window.magicDashboard) {
      window.magicDashboard.geo = geoConfig;
    }
  }, [geoConfig]);
  React.useEffect(function () {
    if (window.magicDashboard) {
      window.magicDashboard.editable = editorConfig.EDITABLE;
      window.magicDashboard.draggable = editorConfig.DRAGGABLE;
      window.magicDashboard.resizable = editorConfig.RESIZABLE;
      window.magicDashboard.deletable = editorConfig.DELETABLE;
      window.magicDashboard.expandable = editorConfig.EXPANDABLE;
    }
  }, [editorConfig]);
  React.useEffect(function () {
    window.DASHBOARD_CARDS = dashboardCards;
  }, [dashboardCards]);
  React.useEffect(function () {
    window.DASHBOARD_CONFIG = dashboardConfig;
  }, [dashboardConfig]);
  // Expose configuration manager to global and trigger initialization complete event
  React.useEffect(function () {
    window.configManager = configManager;
    // Trigger custom event to notify that configManager is ready
    var configManagerReadyEvent = new CustomEvent("ConfigManagerReady", {
      detail: configManager
    });
    // Delay triggering event to ensure all initialization is completed
    setTimeout(function () {
      document.dispatchEvent(configManagerReadyEvent);
    }, 100);
  }, [configManager]);
  // Smart sync map configuration (automatically recognize additions and deletions)
  React.useEffect(function () {
    if (window.echarts && window.MapManager) {
      // Asynchronously sync map configuration
      window.MapManager.syncMapsConfig(geoConfig).catch(function (error) {
        console.error("[App] 地图配置同步失败:", error);
      });
    }
  }, [geoConfig]);
  return React.createElement(window.DashboardFramework.Dashboard, {
    geoConfig: geoConfig,
    editorConfig: editorConfig,
    dashboardCards: dashboardCards,
    dashboardConfig: composeDashboardConfig,
    configManager: configManager,
    onDashboardCardsChange: function onDashboardCardsChange(data) {
      if (data.cards) {
        setDashboardCards(_toConsumableArray(data.cards));
      }
    }
  });
}
window.DashboardApp = DashboardApp;
// Set global framework object
window.DashboardFramework = {
  // Core classes
  Dashboard: window.Dashboard,
  GridDashboard: window.GridDashboard,
  // Data managers
  MapManager: window.MapManager,
  CSVManager: window.CSVManager,
  // Style functions
  applyThemeStyles: (_window$StyleUtils = window.StyleUtils) === null || _window$StyleUtils === void 0 ? void 0 : _window$StyleUtils.applyThemeStyles,
  formatCSSValue: (_window$StyleUtils2 = window.StyleUtils) === null || _window$StyleUtils2 === void 0 ? void 0 : _window$StyleUtils2.formatCSSValue
};