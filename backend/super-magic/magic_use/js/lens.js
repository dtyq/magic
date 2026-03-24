/**
 * @fileoverview MagicLens - 智能网页内容转Markdown工具
 *
 * 该脚本分析网页 DOM 结构，提取主要内容，并将其转换为 Markdown 格式。
 * 它能够处理各种 HTML 元素，包括标题、段落、列表、链接、图片、代码块和表格。
 * 脚本在提取过程中应用了复杂的可见性与视口过滤逻辑，确保只提取用户实际
 * 感兴趣的内容。
 *
 * @version 1.5.1  // 适配结构化链接（如文章卡片）
 * @license MIT
 * @author Your Name/Team
 */

/**
 * =========================================================================
 * **重要核心设计原则与注释 - 后续维护者必读！**
 * =========================================================================
 *
 * **背景**:
 * 在开发过程中，我们遇到了一个棘手的问题：当使用 'viewport' 模式时，
 * 即使页面上的内容在视觉上位于视口内，脚本有时也无法提取它们，或者提取
 * 了过多视口外的内容。这个问题在包含复杂布局、滚动容器或懒加载内容的
 * 页面上尤为突出。
 *
 * **根本原因**:
 * 最初的实现中，可见性（包括视口检查）是在处理每个节点时递归进行的。
 * 如果一个父容器元素（如 `<div>`）因为部分超出视口边界而被判定为"不在视口内"，
 * 那么它的所有子孙节点（无论它们是否在视口内）都会被直接跳过，导致内容丢失。
 * 反之，如果一个大的父容器元素只要有一小部分与视口重叠，则其所有子节点
 * （包括视口外的）的内容都可能被包含进来。这种"一刀切"的逻辑无法准确反映
 * 实际用户看到的内容。
 *
 * **最终解决方案："最小内容单元视口过滤原则"**:
 * 为了解决上述问题，并确保提取结果的准确性和健壮性（我们倾向于"宁可识别多了，
 * 也别识别少了"以避免丢失重要信息），我们采用了基于"最小内容单元"的视口过滤
 * 策略。其核心思想是：
 *
 * 1.  **硬性过滤优先**: `processNode` 函数作为处理入口，首先进行硬性过滤。
 *     只有当一个元素是"绝对不可见"（如 CSS 设置为 `display:none`,
 *     `visibility:hidden`, `opacity:0`，或者没有实际尺寸 `width/height <= 1px`，
 *     或者是 `IGNORED_TAGS` 中定义的忽略标签）时，才会**彻底停止**对该节点
 *     及其所有子孙节点的处理。这是最基础的过滤层，排除掉结构上或样式上
 *     明确隐藏的元素。
 *
 * 2.  **视口检查下沉**: **`processNode` 本身不再进行任何视口检查** (`isElementInViewport`)。
 *     是否在视口内的判断逻辑被**下沉**到更具体的、负责处理特定类型元素的
 *     `processXYZ` 函数中。这避免了在处理节点树的早期就因父容器的视口状态
 *     而错误地排除整个子树。
 *
 * 3.  **容器元素不检查视口**: 对于**容器类**元素（如 `<div>`, `<p>`, `<h1>-<h6>`,
 *     `<li>`, `<strong>`, `<em>` 等），它们的处理函数 (`processParagraph`,
 *     `processHeading`, `processGenericBlock` 等）**不再进行视口检查**。
 *     它们的主要职责是无条件地递归处理其子节点（调用 `_processAndCombineChildren`），
 *     然后将子节点返回的、**已经被视口过滤过的** Markdown 内容，用自身的
 *     Markdown 结构（如 `#`, `**`, 列表标记）包裹起来。这样可以确保即使容器
 *     跨越视口边界，其内部真正可见的内容也能被正确提取和格式化。
 *
 * 4.  **叶子/原子/结构性元素检查自身视口**: 对于**直接产生内容**或**结构不可分割**
 *     的元素（我们称之为"最小单元"或"原子单元"），它们的处理函数 (`processImage`,
 *     `processLink`, `processCodeBlock`, `processTable`, `processHorizontalRule`,
 *     `processInlineCode`) **必须**在 `scope='viewport'` 模式下，使用
 *     `utils.isElementInViewport` 检查**自身**是否在视口内（并满足可见阈值）。
 *     如果不在视口内，则直接返回 `null`，过滤掉该元素。这保证了只有实际可见
 *     的图片、链接、代码块、表格等原子内容被提取。
 *
 * 5.  **文本节点的特殊处理**: 文本节点 (`Node.TEXT_NODE`) 无法直接获取精确的
 *     边界框或应用 `isElementInViewport`。因此，`processTextNode` 函数采用
 *     **近似策略**：在 `scope='viewport'` 模式下，它会检查其**直接父元素
 *     (`parentElement`)** 是否满足 `utils.isElementInViewport` 条件。只有
 *     父元素被认为在视口内时，该文本节点才会被处理。这是在无法获取文本精确
 *     渲染范围的情况下，最接近"最小单元"原则的实用、且相对可靠的方法。虽然
 *     不完美（可能包含父元素在视口内但文本本身滚动到视口外的情况），但它是
 *     权衡准确性与实现复杂度的结果。
 *
 * 6.  **`utils.isElementInViewport` 的鲁棒性**: 该函数不仅检查元素的边界框
 *     (`getBoundingClientRect`) 是否与视口 (`window.innerWidth/Height`) 重叠，
 *     还引入了**最小可见绝对像素面积** (`MIN_ABSOLUTE_AREA_IN_VIEWPORT`)
 *     和**最小可见相对面积比例** (`MIN_AREA_RATIO_IN_VIEWPORT`) 的阈值。
 *     只有当元素的可见部分足够"显著"（达到任一阈值）时，才被认为是在视口内。
 *     这能有效避免那些仅有几个像素与视口重叠的大型元素被错误地判定为可见，
 *     从而提高了视口判断的准确性和鲁棒性。
 *
 * **维护警告**:
 * **请务必保留并深入理解此注释！** 上述视口过滤逻辑是本工具的核心竞争力之一，
 * 是解决复杂网页内容提取准确性问题的关键设计，经过了大量的测试场景验证和多轮
 * 调试迭代才最终确定。
 *
 * **绝对不要**轻易修改以下内容，除非你完全理解其设计意图和对整体流程的潜在影响：
 *   - `processNode` 的基础过滤逻辑（硬性过滤）。
 *   - 各 `processXYZ` 函数中关于**是否**进行 `isElementInViewport` 检查的职责分配。
 *     （容器不查，原子查，文本查父级）。
 *   - `utils.isElementInViewport` 的核心判断标准（重叠检查 + 双重阈值）。
 *
 * 错误的修改极有可能导致之前已解决的"视口内容提取不准"问题重现，或者引入新的、
 * 更隐蔽的 Bug。在进行任何相关调整前，请务必充分测试各种边界情况。
 * =========================================================================
 */

(function() {
  'use strict'; // 启用严格模式，有助于捕捉常见错误

  // ==========================================================================
  // § 1. 全局常量与配置 (Global Constants & Configuration)
  // ==========================================================================

  /** @constant {number} 默认的基础字号 (px)，用于某些样式推断 */
  const DEFAULT_BASE_FONT_SIZE = 16;
  /** @constant {number} 标题字号相对基础字号的最小比例阈值，用于推断标题级别 */
  const HEADING_FONT_SIZE_RATIO = 1.2;
  /** @constant {number} Markdown 规范支持的最大标题层级 */
  const HEADING_LEVELS = 6;
  /** @constant {number} 认为有效的文本内容的最小字符长度 */
  const MIN_TEXT_LENGTH = 2; // 过滤掉过短、无意义的文本片段
  /** @constant {number} 允许处理的 URL 最大长度，防止异常数据 */
  const MAX_URL_LENGTH = 1000;
  /** @constant {number} 允许处理的 DATA URL 最大长度，防止异常数据 */
  const MAX_DATA_URL_LENGTH = 100;
  /** @constant {number} 允许处理的图片 alt 文本最大长度 */
  const MAX_ALT_LENGTH = 250;
  /** @constant {string} Data URI 的标准前缀 */
  const DATA_URI_PREFIX = 'data:';
  /**
   * @constant {number} 元素在视口中需占据的最小绝对像素面积阈值 (px²)。
   * 用于 `isElementInViewport` 函数，增加视口判断的鲁棒性，过滤掉那些
   * 仅仅是边缘或角落与视口有微小重叠的大尺寸元素。
   * (此值可根据实际测试效果进行微调)
   */
  const MIN_ABSOLUTE_AREA_IN_VIEWPORT = 50; // 例如：至少要有 50 平方像素在视口内
  /**
   * @constant {number} 元素在视口中需占据的最小相对面积比例阈值 (0 到 1)。
   * 用于 `isElementInViewport` 函数，逻辑同上，提供另一种维度的过滤。
   * (此值可根据实际测试效果进行微调)
   */
  const MIN_AREA_RATIO_IN_VIEWPORT = 0.2; // 例如：元素自身面积的 20% 必须在视口内

  /**
   * @constant {number} 允许处理的 Data URI 的最大长度。
   * 对于体积过大的 Data URI (通常是内嵌的大图片或文件)，直接处理可能消耗过多
   * 资源或导致 Markdown 文件过大，因此设置一个上限。
   * 特别是在图片懒加载场景，有时会用短的占位符 Data URI。
   */
  const MAX_DATA_URI_LENGTH_FOR_LAZY_LOAD = 2048;

  /**
   * @constant {Set<string>} 硬性忽略规则：这些标签及其所有子孙节点将永远不会被处理。
   * 主要包含脚本、样式、元信息、头部、导航、页脚、侧边栏、表单元素、iframe、SVG 等
   * 通常不属于主体阅读内容的标签。 `I` 标签常被用作图标字体，也在此排除。
   */
  const IGNORED_TAGS = new Set([
      'SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'HEAD',
      'NAV', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'INPUT',
      'TEXTAREA', 'SELECT', 'OPTION', 'IFRAME', 'SVG', 'I'
  ]);

  /**
   * @constant {RegExp} 用于匹配应被忽略的标记元素的类名规则。
   * 当前匹配所有带有 'magic-marker-' 前缀的类名，这些通常是由页面上的标记工具添加的元素。
   */
  const IGNORED_CLASS_PATTERN = /magic-marker-/;

  /**
   * @constant {Set<string>} 用于快速判断常见的 HTML 块级元素标签。
   * 这有助于 `isBlockElement` 的快速判断，也用于 `contentFinder` 识别潜在内容块。
   */
  const BLOCK_TAGS_FOR_ALL_SCOPE = new Set([
      'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI',
      'BLOCKQUOTE', 'PRE', 'ARTICLE', 'SECTION', 'MAIN', 'TABLE',
      'FIGURE', 'UL', 'OL', 'DETAILS', 'SUMMARY', 'HR'
  ]);

  /**
   * @constant {Set<string>} 用于快速判断常见的 HTML 行内元素标签。
   * 这有助于 `isInlineElement` 的快速判断。
   */
   const INLINE_TAGS = new Set([
       'SPAN', 'A', 'IMG', 'CODE', 'STRONG', 'B', 'EM', 'I', // 'I' 被忽略了，但理论上是行内
       'SUB', 'SUP', 'MARK', 'SMALL', 'Q', 'CITE', 'ABBR',
       'TIME', 'VAR', 'KBD', 'SAMP', 'BR', 'WBR'
   ]);

  // ==========================================================================
  // § 2. 实用工具函数 (Utility Functions)
  //    包含文本处理、样式获取、可见性判断、URL处理等基础功能。
  // ==========================================================================
  const utils = {
    /**
     * 清理文本字符串：
     * 1. 将多个连续的空白字符（空格、制表符、换行符等）替换为单个空格。
     * 2. 移除字符串首尾的空白。
     * @param {string | null | undefined} text - 输入文本。
     * @returns {string} 清理后的文本，如果输入无效则返回空字符串。
     */
    cleanText: (text) => {
      if (!text) {
          return '';
      }
      // \s 匹配任何空白字符，+ 匹配一个或多个
      return text.replace(/\s+/g, ' ').trim();
    },

    /**
     * 判断输入是否为空白字符串 (null, undefined, 或只包含空白的字符串)。
     * @param {string | null | undefined} text - 输入文本。
     * @returns {boolean} 如果文本为空白则返回 true。
     */
    isEmptyText: (text) => {
      // 检查 null/undefined，或者 trim 后长度为 0
      return !text || text.trim().length === 0;
    },

    /**
     * 安全地获取元素的计算样式 (Computed Style)。
     * 使用 `window.getComputedStyle`，并包含错误处理。
     * @param {Element} element - 目标 DOM 元素。
     * @returns {CSSStyleDeclaration | null} 计算样式对象，或在失败时返回 null。
     */
    getStyle: (element) => {
      try {
        // 确保传入的是一个有效的 Element 对象
        if (!(element instanceof Element)) {
            return null;
        }
        return window.getComputedStyle(element);
      } catch (e) {
        // 在某些边缘情况（例如元素在获取样式前被移除）下可能抛出异常
        // console.warn("MagicLens: Failed to get computed style for element:", element, e); // 调试时可取消注释
        return null;
      }
    },

    /**
     * 判断元素是否根据 CSS 规则可见（硬性规则，不考虑视口）。
     * 这是 `processNode` 中进行硬性过滤的第一步。
     * 检查关键的 CSS 属性：`display`, `visibility`, `opacity`, `clip`, `clip-path`。
     * @param {Element} element - 目标 DOM 元素。
     * @returns {boolean} 如果 CSS 判定可见则返回 true。
     */
    isCssVisible: (element) => {
      // 必须是有效元素且能获取样式
      if (!element || typeof element.getBoundingClientRect !== 'function') {
          return false;
      }
      const style = utils.getStyle(element);
      if (!style) {
          return false; // 获取样式失败，保守处理为不可见
      }

      // 检查各种导致元素不可见的 CSS 情况
      const isInvisible =
          style.display === 'none' ||          // display: none
          style.visibility === 'hidden' ||     // visibility: hidden
          style.opacity === '0' ||             // opacity: 0 (字符串)
          parseFloat(style.opacity) === 0 ||   // opacity: 0 (数值)
          style.clip === 'rect(0px, 0px, 0px, 0px)' || // 旧 clip 属性隐藏
          style.clipPath === 'inset(100%)';    // clip-path 完全裁剪隐藏

      return !isInvisible; // 如果没有命中任何不可见规则，则认为 CSS 可见
    },

    /**
     * 判断元素是否有实际的渲染尺寸（硬性规则，不考虑视口）。
     * 这是 `processNode` 中进行硬性过滤的第二步。
     * 检查元素的 `offsetWidth/Height` 或 `getBoundingClientRect` 的 `width/height` 是否大于 1px。
     * 包含一个回退逻辑：即使元素本身无尺寸，如果它直接包含有意义的文本内容，也视为有维度。
     * @param {Element} element - 目标 DOM 元素。
     * @returns {boolean} 如果元素有实际渲染尺寸则返回 true。
     */
    hasPositiveDimensions: (element) => {
      // 必须是有效元素且能获取尺寸
      if (!element || typeof element.getBoundingClientRect !== 'function') {
          return false;
      }

      const rect = element.getBoundingClientRect();
      // 优先检查 offsetWidth/Height (更常用) 或 rect 的 width/height
      // 使用 > 1 是为了避免某些情况下 1px 的边框或占位元素
      const hasExplicitSize = (element.offsetWidth > 1 && element.offsetHeight > 1) ||
                              (rect.width > 1 && rect.height > 1);

      // 回退检查：对于某些内联元素或特殊情况，可能自身无尺寸但其文本内容是可见的
      // 检查其 textContent 是否包含至少 MIN_TEXT_LENGTH 个非空白字符
      const directTextContent = element.textContent || '';
      const hasMeaningfulText = !utils.isEmptyText(directTextContent) &&
                                directTextContent.length >= MIN_TEXT_LENGTH;

      // 只要有明确尺寸 或 包含有意义文本，就认为其有正维度
      return hasExplicitSize || hasMeaningfulText;
    },

    /**
     * [核心视口判断函数] 判断元素是否在视口 (Viewport) 内，并且其可见部分满足最小面积/比例要求。
     * 这是实现"最小内容单元视口过滤原则"的关键函数。
     * 被各 `processXYZ` 函数在 `scope='viewport'` 模式下调用，用于判断原子元素或文本节点的父元素。
     * @param {Element} element - 目标 DOM 元素。
     * @returns {boolean} 如果元素在视口内且足够显著可见则返回 true。
     */
    isElementInViewport: (element) => {
      // 必须是有效元素且能获取边界框
      if (!element || typeof element.getBoundingClientRect !== 'function') {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      // --- 1. 基础重叠检查 (快速排除完全在视口外的元素) ---
      // 检查元素的边界是否至少有一部分在视口坐标范围内
      const overlaps =
          rect.bottom > 0 &&              // 元素的底部在视口顶部之下
          rect.top < viewportHeight &&    // 元素的顶部在视口底部之上
          rect.right > 0 &&             // 元素的右侧在视口左侧之右
          rect.left < viewportWidth;      // 元素的左侧在视口右侧之左

      if (!overlaps) {
        // console.debug(`MagicLens (isElementInViewport): Basic overlap check failed. Element:`, element); // 调试时可开启
        return false; // 完全不重叠，直接判定不在视口内
      }

      // --- 2. 计算可见区域的实际矩形和面积 ---
      // 元素与视口重叠部分的实际坐标
      const visibleLeft = Math.max(0, rect.left);
      const visibleTop = Math.max(0, rect.top);
      const visibleRight = Math.min(viewportWidth, rect.right);
      const visibleBottom = Math.min(viewportHeight, rect.bottom);

      // 计算可见部分的宽度和高度，确保为非负值
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      // 计算可见部分的面积
      const visibleArea = visibleWidth * visibleHeight;

      // --- 3. 计算元素总面积和可见面积比例 ---
      const totalArea = rect.width * rect.height;
      // 计算可见面积占总面积的比例，避免除以零
      const visibleRatio = totalArea > 0 ? visibleArea / totalArea : 0;

      // --- 4. 应用双重阈值判断 ---
      // 只要满足 最小绝对面积 或 最小相对比例 中的任意一个，就认为元素在视口内足够显著
      const meetsThreshold =
          visibleArea >= MIN_ABSOLUTE_AREA_IN_VIEWPORT ||
          visibleRatio >= MIN_AREA_RATIO_IN_VIEWPORT;

      /* // 详细调试日志，可按需开启
      console.debug(`MagicLens (isElementInViewport): Element:`, element,
                    `Rect: {T:${rect.top.toFixed(0)}, L:${rect.left.toFixed(0)}, B:${rect.bottom.toFixed(0)}, R:${rect.right.toFixed(0)}, W:${rect.width.toFixed(0)}, H:${rect.height.toFixed(0)}}`,
                    `Viewport: {W:${viewportWidth}, H:${viewportHeight}}`,
                    `Visible Rect: {T:${visibleTop.toFixed(0)}, L:${visibleLeft.toFixed(0)}, B:${visibleBottom.toFixed(0)}, R:${visibleRight.toFixed(0)}, W:${visibleWidth.toFixed(0)}, H:${visibleHeight.toFixed(0)}}`,
                    `Visible Area: ${visibleArea.toFixed(1)} (Min: ${MIN_ABSOLUTE_AREA_IN_VIEWPORT})`,
                    `Visible Ratio: ${visibleRatio.toFixed(2)} (Min: ${MIN_AREA_RATIO_IN_VIEWPORT})`,
                    `Meets Threshold: ${meetsThreshold}`);
      */

      return meetsThreshold;
    },

    /**
     * [保留，主要供 contentFinder 使用] 综合可见性判断。
     * 结合了 CSS 可见性、尺寸检查，以及（可选的）视口检查。
     * `contentFinder` 用它进行初步筛选，减少后续处理的节点数量。
     * @param {Element} element - 目标 DOM 元素。
     * @param {'all' | 'viewport'} [scope='viewport'] - 判断范围。
     * @returns {boolean} 如果元素综合判断为可见则返回 true。
     */
    isEffectivelyVisible: (element, scope = "viewport") => {
      // 基础的硬性过滤必须通过
      if (!utils.isCssVisible(element) || !utils.hasPositiveDimensions(element)) {
          return false;
      }

      // 检查元素的类名是否匹配需要忽略的模式
      if (element.className && typeof element.className === 'string' && IGNORED_CLASS_PATTERN.test(element.className)) {
          return false;
      }

      // 如果是 'viewport' 范围，则额外进行视口检查
      if (scope === 'viewport' && !utils.isElementInViewport(element)) {
          return false;
      }
      // 所有检查都通过
      return true;
    },

    /**
     * 判断一个元素是否为有效的、值得提取的 IMG 元素。
     * 检查：
     * 1. 标签名是否为 'IMG'。
     * 2. 是否 CSS 可见且有正尺寸。
     * 3. 是否能获取到有效的、非占位符的图像 URL。
     * @param {HTMLImageElement} imgElement - 目标图片元素。
     * @returns {boolean} 如果是有效图片则返回 true。
     */
    isValidImage: (imgElement) => {
      // 基本类型和标签检查
      if (!imgElement || imgElement.tagName !== 'IMG') {
          return false;
      }
      // 硬性可见性检查
      if (!utils.isCssVisible(imgElement) || !utils.hasPositiveDimensions(imgElement)) {
          return false;
      }
      // 获取图像 URL，并进行有效性检查
      const imageUrl = utils.getImageUrl(imgElement);
      if (!imageUrl || imageUrl.length > MAX_URL_LENGTH || utils.isPlaceholderSvgDataUri(imageUrl)) {
          // URL 无效、过长，或者是已知的 SVG 占位符
          return false;
      }
      // 所有检查通过
      return true;
    },

    /**
     * 检查给定的 URL 是否是一个常见的 1x1 SVG 占位符 Data URI。
     * 这种占位符常用于懒加载或其他目的，不应被视为真实图片内容。
     * @param {string} url - 图片 URL。
     * @returns {boolean} 如果是 1x1 SVG 占位符则返回 true。
     */
    isPlaceholderSvgDataUri: (url) => {
      if (!url || !url.startsWith('data:image/svg+xml')) {
          return false; // 不是 SVG Data URI
      }
      try {
        let svgContent = '';
        const base64Marker = ';base64,';
        const commaIndex = url.indexOf(',');
        if (commaIndex === -1) return false; // 格式错误

        const header = url.substring(0, commaIndex);
        const data = url.substring(commaIndex + 1);

        // 解码 SVG 内容 (可能是 Base64 或 URL 编码)
        if (header.includes(base64Marker)) {
          svgContent = atob(data);
        } else {
          svgContent = decodeURIComponent(data);
        }

        // 简单检查是否包含 <svg> 标签，没有则极可能是占位符
        if (!svgContent.toLowerCase().includes('<svg')) {
            return true;
        }

        // 查找 <svg> 标签并检查 width 和 height 属性
        const svgTagMatch = svgContent.match(/<svg[^>]*>/i);
        if (svgTagMatch) {
          const svgTag = svgTagMatch[0];
          // 正则表达式检查 width="1" 或 height="1" (可能带 px 单位，引号可选)
          const widthMatch = /\bwidth\s*=\s*["\']?\s*1(px)?\s*["\']?/i.test(svgTag);
          const heightMatch = /\bheight\s*=\s*["\']?\s*1(px)?\s*["\']?/i.test(svgTag);
          // 如果同时匹配到 width=1 和 height=1，则认为是占位符
          return widthMatch && heightMatch;
        }
      } catch (e) {
        // 解码或处理出错，保守处理为非占位符
        // console.warn("Error checking SVG placeholder:", e, url); // 调试时可开启
      }
      // 默认不是占位符
      return false;
    },

    /**
     * 获取图片的有效最终 URL。
     * 探测顺序：
     * 1. `element.currentSrc` (浏览器当前实际渲染的 src，最可靠)
     * 2. 常见的懒加载属性 (`data-src`, `data-original` 等)
     * 3. 标准的 `element.src` 属性
     * 在每一步都会进行有效性检查（非空、非占位符、协议允许、长度限制）。
     * @param {HTMLImageElement} imgElement - 目标图片元素。
     * @returns {string | null} 解析后的绝对 URL，或在找不到有效 URL 时返回 null。
     */
    getImageUrl: (imgElement) => {
      if (!(imgElement instanceof HTMLImageElement)) {
          return null;
      }

      let potentialPlaceholderSrc = null; // 用于记录可能的占位符，以备后续没有更好选择时

      // 1. 尝试 `currentSrc` (最高优先级)
      const currentSrc = imgElement.currentSrc;
      if (currentSrc && currentSrc !== window.location.href && currentSrc !== 'about:blank') {
          if (!utils.isPlaceholderSvgDataUri(currentSrc)) {
              const resolvedUrl = utils.resolveUrl(currentSrc);
              if (resolvedUrl) {
                  return resolvedUrl; // 找到有效的 currentSrc
              }
          } else {
              potentialPlaceholderSrc = currentSrc; // 记录占位符 currentSrc
          }
      }

      // 2. 探测常见的懒加载属性
      const lazyLoadAttributes = [
          'data-src', 'data-original', 'data-original-src', 'data-lazy-src',
          'data-lazy', 'lazy-src', 'data-url'
      ];
      for (const attr of lazyLoadAttributes) {
          const attrValue = imgElement.getAttribute(attr);
          // 必须有值，非空，非 Data URI (懒加载通常用真实 URL)，非 about:blank
          if (attrValue && attrValue.trim() && !attrValue.startsWith(DATA_URI_PREFIX) && attrValue !== 'about:blank') {
              if (!utils.isPlaceholderSvgDataUri(attrValue)) {
                  const resolvedUrl = utils.resolveUrl(attrValue);
                  if (resolvedUrl) {
                      return resolvedUrl; // 找到有效的懒加载 src
                  }
              }
              // 注意：不记录懒加载属性中的占位符，因为 src 属性优先级更高
          }
      }

      // 3. 尝试标准 `src` 属性 (最低优先级)
      const standardSrc = imgElement.getAttribute('src') || '';
      if (standardSrc && standardSrc !== window.location.href && standardSrc !== 'about:blank') {
          if (!utils.isPlaceholderSvgDataUri(standardSrc)) {
              // 允许处理 Data URI，但有长度限制
              const isPotentiallyValidDataUri = standardSrc.startsWith(DATA_URI_PREFIX) &&
                                               standardSrc.length < MAX_DATA_URI_LENGTH_FOR_LAZY_LOAD;
              if (!standardSrc.startsWith(DATA_URI_PREFIX) || isPotentiallyValidDataUri) {
                  const resolvedUrl = utils.resolveUrl(standardSrc);
                  if (resolvedUrl) {
                      return resolvedUrl; // 找到有效的标准 src
                  }
              }
          } else if (!potentialPlaceholderSrc) { // 只有在之前没记录过占位符时才记录 src 的占位符
              potentialPlaceholderSrc = standardSrc;
          }
      }

      // 如果所有尝试都失败，返回 null (表示未找到可用的、非占位符的 URL)
      // 在某些策略下，如果只找到了占位符，也可以考虑返回 potentialPlaceholderSrc，但当前策略是忽略
      return null;
    },

    /**
     * 将相对 URL 或协议相对 URL (//...) 解析为绝对 URL。
     * 使用 `URL` 构造函数和 `document.baseURI`。
     * 限制允许的协议 (http, https, ftp, mailto, data)。
     * 限制 Data URI 的长度。
     * @param {string | null | undefined} url - 输入的 URL 字符串。
     * @returns {string | null} 解析后的绝对 URL，或在无效或不允许时返回 null。
     */
    resolveUrl: (url) => {
      if (!url || typeof url !== 'string') {
          return null;
      }
      const trimmedUrl = url.trim();
      // 过滤掉空字符串和 javascript: 伪协议
      if (trimmedUrl === '' || trimmedUrl.toLowerCase().startsWith('javascript:')) {
          return null;
      }

      try {
        let absoluteUrlStr = trimmedUrl;
        // 处理协议相对 URL (以 // 开头)
        if (absoluteUrlStr.startsWith('//')) {
          absoluteUrlStr = window.location.protocol + absoluteUrlStr;
        }

        // 使用 URL 构造函数进行解析，第二个参数提供基础 URL
        const absoluteUrl = new URL(absoluteUrlStr, document.baseURI || window.location.href);

        // 限制允许的协议
        const allowedProtocols = ['http:', 'https:', 'ftp:', 'mailto:', 'data:'];
        if (!allowedProtocols.includes(absoluteUrl.protocol)) {
          // console.warn("MagicLens: Ignoring URL with disallowed protocol:", absoluteUrl.protocol, absoluteUrl.href); // 调试时可开启
          return null;
        }

        // 对 Data URI 进行长度限制
        if (absoluteUrl.protocol === 'data:' && absoluteUrl.href.length > MAX_DATA_URL_LENGTH) {
          // console.warn("MagicLens: Ignoring long data URI:", absoluteUrl.href.substring(0, 50) + "..."); // 调试时可开启
          return null;
        }

        // 返回解析后的绝对 URL 字符串
        return absoluteUrl.href;
      } catch (e) {
        // URL 解析失败 (无效的 URL 格式)
        // console.warn("MagicLens: Failed to resolve URL:", url, e); // 调试时可开启
        return null;
      }
    },

    /**
     * 获取图片的替代文本 (Alt Text)。
     * 尝试顺序：
     * 1. `alt` 属性
     * 2. `title` 属性
     * 3. `aria-label` 属性
     * 4. 父级 `<figure>` 内的 `<figcaption>` 内容
     * 5. 从图片 URL 中提取文件名作为回退
     * 对提取的文本进行清理，过滤掉常见的无意义占位符（如 'image', 'logo', UUID 等）。
     * 如果所有尝试都失败或只得到无意义文本，则返回默认值 "图像"。
     * 限制最终返回文本的最大长度。
     * @param {HTMLImageElement} imgElement - 目标图片元素。
     * @returns {string} 获取到的替代文本 (经过清理和长度限制)。
     */
     getImageAlt: (imgElement) => {
      if (!(imgElement instanceof HTMLImageElement)) {
        return '图像'; // 非图片元素，返回默认值
      }

      let alt = '';

      // 定义获取 alt 文本的来源函数数组，按优先级排列
      const sources = [
        () => imgElement.getAttribute('alt'),      // 1. alt 属性
        () => imgElement.getAttribute('title'),     // 2. title 属性
        () => imgElement.getAttribute('aria-label'),// 3. aria-label 属性
        () => {                                      // 4. figcaption
          const figure = imgElement.closest('figure');
          const figcaption = figure ? figure.querySelector('figcaption') : null;
          return figcaption ? figcaption.textContent : null;
        },
        () => {                                      // 5. 从 URL 文件名提取
          const src = utils.getImageUrl(imgElement); // 复用 getImageUrl 获取有效 URL
          // 忽略 data:, about:, javascript: 协议
          const protocolStopRegex = /^(data:|about:blank|javascript:)/i;
          if (src && !protocolStopRegex.test(src)) {
            try {
              const urlObject = new URL(src);
              // 获取路径最后一部分作为文件名
              const filename = urlObject.pathname.split('/').pop();
              if (filename) {
                // 解码、移除扩展名、替换分隔符为空格、合并空格
                return decodeURIComponent(filename)
                  .replace(/\.\w+$/, '') // 移除常见文件扩展名
                  .replace(/[-_]+/g, ' ') // 替换 - 和 _ 为空格
                  .replace(/\s+/g, ' ')  // 合并多个空格
                  .trim();
              }
            } catch (e) { /* 解析 URL 或处理文件名失败，忽略 */ }
          }
          return null; // 无法从 URL 提取
        }
      ];

      // 常见的无意义或占位符 alt 文本的正则表达式 (不区分大小写)
      // 包括：常见词、纯数字 ID、UUID
      const commonJunkRegex = /^(image|img|logo|icon|banner|spacer|loading|photo|picture|bild|foto|spacer|transparent|empty|blank|placeholder|avatar|figure|grafik|_\d+|-\d+)$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

      // 遍历来源，找到第一个有效的、有意义的 alt 文本
      for (const source of sources) {
        const potentialAlt = (source() || '').trim(); // 获取并清理首尾空白
        // 必须满足最小长度，且不能匹配到垃圾文本模式
        if (potentialAlt.length >= MIN_TEXT_LENGTH && !commonJunkRegex.test(potentialAlt)) {
          alt = potentialAlt;
          break; // 找到满意的 alt，停止查找
        }
      }

      // 如果循环结束后 alt 仍然为空，则使用默认值
      if (!alt) {
        alt = '图像';
      }

      // 对最终结果进行长度限制
      return alt.length > MAX_ALT_LENGTH ? alt.substring(0, MAX_ALT_LENGTH) + '...' : alt;
    },


    /**
     * 判断一个元素是否为有效的、值得提取的 A (链接) 元素。
     * 检查：
     * 1. 标签名是否为 'A'。
     * 2. 是否 CSS 可见且有正尺寸。
     * 3. `href` 属性解析后是否为有效的、非页面内锚点、非 JS 的 URL。
     * 4. 链接是否包含有意义的文本内容 或 包含一个有效的图片。
     * @param {HTMLAnchorElement} linkElement - 目标链接元素。
     * @returns {boolean} 如果是有效链接则返回 true。
     */
    isValidLink: (linkElement) => {
      // 基本类型和标签检查
      if (!linkElement || linkElement.tagName !== 'A') {
          return false;
      }
      // 硬性可见性检查
      if (!utils.isCssVisible(linkElement) || !utils.hasPositiveDimensions(linkElement)) {
          return false;
      }

      // 检查 href 属性
      const href = linkElement.getAttribute('href');
      const resolvedHref = utils.resolveUrl(href); // 解析为绝对 URL 并检查协议
      if (!resolvedHref ||           // 无效或被阻止的 URL
          resolvedHref.startsWith('#') || // 页面内锚点
          resolvedHref.toLowerCase().startsWith('javascript:') // Javascript 伪协议
         ) {
          return false;
      }
      // 检查 URL 长度
      if (resolvedHref.length > MAX_URL_LENGTH) {
          return false;
      }

      // 检查链接内容：必须包含有效文本 或 有效图片
      // 1. 检查文本内容
      const textContent = utils.cleanText(linkElement.textContent);
      const hasMeaningfulText = textContent.length >= MIN_TEXT_LENGTH;

      // 2. 检查是否包含有效图片作为子元素
      // 使用 Array.from 将 HTMLCollection 转为数组以便使用 .some()
      const hasVisibleImage = Array.from(linkElement.children).some(child =>
          child.tagName === 'IMG' && utils.isValidImage(/** @type {HTMLImageElement} */(child))
      );

      // 只要有文本 或 有图片，就认为是有效链接
      return hasMeaningfulText || hasVisibleImage;
    },

    /**
     * 判断元素是否为块级元素 (Block-level element)。
     * 优先检查标签名是否在 `BLOCK_TAGS_FOR_ALL_SCOPE` 集合中。
     * 如果不在，则检查其计算样式的 `display` 属性是否为常见的块级值。
     * @param {Element} element - 目标 DOM 元素。
     * @returns {boolean} 如果是块级元素则返回 true。
     */
    isBlockElement: (element) => {
      if (!element || typeof element.tagName !== 'string') {
          return false;
      }
      // 快速检查已知块级标签
      if (BLOCK_TAGS_FOR_ALL_SCOPE.has(element.tagName.toUpperCase())) {
          return true;
      }
      // 获取计算样式进行判断
      const style = utils.getStyle(element);
      if (!style) {
          return false; // 获取样式失败，无法判断，保守返回 false
      }
      // 检查常见的块级 display 值
      const blockDisplays = [
          'block', 'flex', 'grid', 'table', 'list-item',
          'flow-root', 'article', 'section', 'main', 'figure', 'details'
          // 注意：'inline-block' 不是纯粹的块级，这里不包含
      ];
      return blockDisplays.includes(style.display);
    },

    /**
     * 判断元素是否为行内元素 (Inline-level element)。
     * 优先检查标签名是否在 `INLINE_TAGS` 集合中。
     * 如果不在，则检查其计算样式的 `display` 属性是否以 'inline' 开头 (包括 'inline', 'inline-block', 'inline-flex' 等)。
     * @param {Element} element - 目标 DOM 元素。
     * @returns {boolean} 如果是行内元素则返回 true。
     */
    isInlineElement: (element) => {
      if (!element || typeof element.tagName !== 'string') {
          return false;
      }
      // 快速检查已知行内标签
      if (INLINE_TAGS.has(element.tagName.toUpperCase())) {
          return true;
      }
      // 获取计算样式进行判断
      const style = utils.getStyle(element);
      if (!style) {
          return false; // 获取样式失败，无法判断，保守返回 false
      }
      // 检查 display 是否以 'inline' 开头
      return style.display.startsWith('inline');
    },

    /**
     * 获取文档的基础字号 (通常是 body 的 font-size)。
     * 用于 `styleAnalyzer.getHeadingLevel` 计算相对字号。
     * @returns {number} 计算得到的基础字号 (px)，失败时返回默认值。
     */
    getBaseFontSize: () => {
      try {
        const bodyStyle = utils.getStyle(document.body);
        // 解析 body 的 font-size，如果失败或无效，使用默认值
        return parseFloat(bodyStyle?.fontSize) || DEFAULT_BASE_FONT_SIZE;
      } catch (e) {
        // console.warn("MagicLens: Failed to get base font size."); // 调试时可开启
        return DEFAULT_BASE_FONT_SIZE;
      }
    },

    /**
     * [主要供 contentFinder 使用] 判断一个节点是否可能是包含主要内容的元素。
     * 用于 `contentFinder` 的 TreeWalker 过滤器，快速识别潜在的顶级内容块。
     * 检查条件：
     * 1. 是元素节点。
     * 2. 不是被忽略的标签 (`IGNORED_TAGS`)。
     * 3. 不带有被忽略的类名模式 (如 `magic-marker-*`)。
     * 4. 包含有意义的直接文本子节点。
     * 5. 或包含有效的直接图片子元素。
     * 6. 或者是常见的容器标签 (如 ARTICLE, P, DIV, LI 等)。
     * @param {Node} node - 目标 DOM 节点。
     * @param {'all' | 'viewport'} [scope='viewport'] - 判断范围 (虽然此函数目前不直接用 scope，但保持接口一致)。
     * @returns {boolean} 如果节点可能是内容元素则返回 true。
     */
    isPotentiallyContentElement: (node, scope = "viewport") => {
      // 必须是元素节点
      if (node.nodeType !== Node.ELEMENT_NODE || !node.tagName || typeof node.hasChildNodes !== 'function') {
        return false;
      }

      const element = /** @type {Element} */ (node);
      const tagName = element.tagName.toUpperCase();

      // 1. 过滤忽略标签
      if (IGNORED_TAGS.has(tagName)) {
        return false;
      }

      // 2. 过滤带有忽略类名模式的元素
      if (element.className && typeof element.className === 'string' && IGNORED_CLASS_PATTERN.test(element.className)) {
        return false;
      }

      // 3. 检查是否有直接的有意义文本内容
      let hasDirectMeaningfulText = false;
      if (element.hasChildNodes()) {
        for (const childNode of element.childNodes) {
          // 只检查直接的文本子节点
          if (childNode.nodeType === Node.TEXT_NODE) {
            const cleanedText = utils.cleanText(childNode.textContent);
            if (cleanedText.length >= MIN_TEXT_LENGTH) {
              hasDirectMeaningfulText = true;
              break; // 找到一个就够了
            }
          }
        }
      }

      // 4. 检查是否有直接的有效图片子元素
      const hasVisibleDirectImage = Array.from(element.children).some(child =>
        child.tagName === 'IMG' && utils.isValidImage(/** @type {HTMLImageElement} */(child))
      );

      // 5. 检查是否是常见的主要内容容器标签
      const majorContainerTags = [
          'ARTICLE', 'MAIN', 'SECTION', 'P', 'DIV', 'BLOCKQUOTE',
          'LI', 'TD', 'TH', 'FIGURE', 'PRE', 'DETAILS', 'SUMMARY'
          // 注意：H1-H6 也是块级，但通常内容较少，这里不作为主要容器判断依据
      ];
      const isMajorContainer = majorContainerTags.includes(tagName);

      // 满足任一条件即可：有文本、有图片、是主要容器
      return hasDirectMeaningfulText || hasVisibleDirectImage || isMajorContainer;
    },

    /**
     * 判断节点是否为空白文本节点或注释节点。
     * 用于在处理子节点时跳过这些无意义的节点。
     * @param {Node} node - 目标 DOM 节点。
     * @returns {boolean} 如果是空白或注释节点则返回 true。
     */
    isWhitespaceOrCommentNode: (node) => {
      return (
          // 是注释节点
          node.nodeType === Node.COMMENT_NODE ||
          // 是文本节点，并且其内容为空白
          (node.nodeType === Node.TEXT_NODE && utils.isEmptyText(node.textContent))
      );
    },

    /**
     * 从 Markdown 文本中剥离掉常见的 Markdown 标记，尝试还原为纯文本。
     * 用于在某些需要纯文本内容的场景（如判断链接文本、标题内容）。
     * 注意：这个剥离过程可能不完美，特别是对于嵌套或复杂的 Markdown。
     * @param {string | null | undefined} markdownText - 输入的 Markdown 文本。
     * @returns {string} 尝试剥离标记后的文本。
     */
    stripMarkdown: (markdownText) => {
        if (!markdownText) return '';
        let text = markdownText;

        // 移除代码块 (```...```, ~~~...~~~)
        text = text.replace(/^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)\n*/gm, '');
        // 移除块引用标记 (>)
        text = text.replace(/^(?:>\s*)+/gm, '');
        // 移除列表标记 (- * + 1.)
        text = text.replace(/^(\s*(?:[-*+]|\d+\.)\s+)/gm, '');
        // 移除水平线
        text = text.replace(/^(?:-{3,}|_{3,}|\*{3,})\s*$/gm, '');
        // 移除图片标记 (![alt](url))
        text = text.replace(/!\[.*?]\(.*?\)/g, '');
        // 移除链接标记，保留链接文本 ([text](url) -> text)，尝试处理嵌套（最多3层）
        for (let i = 0; i < 3; i++) {
            text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
        }
        // 移除粗体 (**text**, __text__)
        text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
        // 移除斜体 (*text*, _text_)
        text = text.replace(/(\*|_)(.*?)\1/g, '$2');
        // 移除删除线 (~~text~~)
        text = text.replace(/~~(.*?)~~/g, '$1');
        // 移除行内代码 (`code`)
        text = text.replace(/`(.+?)`/g, '$1');
        // 移除标题标记 (# heading)
        text = text.replace(/^#+\s*/gm, '');
        // 移除 HTML 标签 (可能残留)
        text = text.replace(/<[^>]*>/g, '');
        // 合并多个换行为一个
        text = text.replace(/\n{2,}/g, '\n');
        // 移除行首行尾多余空格，合并文本中的多余空格
        text = text.replace(/[ \t\v\f\r]+/g, ' ');
        text = text.replace(/\n /g, '\n'); // 清理换行后的空格

        return text.trim();
    }
  }; // --- End of utils ---

  // ==========================================================================
  // § 3. 样式分析器 (Style Analyzer)
  //    用于根据元素的计算样式推断其语义角色（如标题级别、粗体、斜体）。
  // ==========================================================================
  const styleAnalyzer = {
      /**
       * 根据元素的标签名或计算样式（字号、字重）推断其标题级别 (1-6)。
       * 优先使用 H1-H6 标签名。
       * 如果不是标准标题标签，则基于字号相对于基础字号的比例、以及字重来判断。
       * @param {Element} element - 目标 DOM 元素。
       * @returns {number} 推断的标题级别 (1-6)，如果不是标题则返回 0。
       */
      getHeadingLevel: (element) => {
          if (!element || typeof element.tagName !== 'string') {
              return 0;
          }

          // 1. 优先使用 H1-H6 标签名
          const tagName = element.tagName.toLowerCase();
          if (tagName.match(/^h([1-6])$/)) {
              return parseInt(tagName.substring(1));
          }

          // 2. 如果不是标准标题标签，尝试根据样式推断 (必须是块级元素)
          if (!utils.isBlockElement(element)) {
              return 0; // 行内元素不太可能是标题
          }

          try {
              const style = utils.getStyle(element);
              if (!style) {
                  return 0; // 无法获取样式
              }

              const fontSize = parseFloat(style.fontSize);
              const baseFontSize = utils.getBaseFontSize();
              const fontWeightStr = style.fontWeight;

              // 解析字重 (normal=400, bold=700)
              let fontWeight = 400;
              if (fontWeightStr === 'bold') {
                  fontWeight = 700;
              } else if (!isNaN(parseInt(fontWeightStr))) {
                  fontWeight = parseInt(fontWeightStr);
              }

              // 必须有有效的字号且大于基础字号
              if (!fontSize || !baseFontSize || fontSize <= baseFontSize) {
                  return 0;
              }

              // 计算字号比例
              const sizeRatio = fontSize / baseFontSize;

              // 同时满足字号比例阈值 和 最小字重阈值 (e.g., >= 600)
              if (sizeRatio >= HEADING_FONT_SIZE_RATIO && fontWeight >= 600) {
                  // 根据字号比例估算级别 (这些比例是经验值，可能需要调整)
                  let level;
                  if (sizeRatio >= 2.0) level = 1;
                  else if (sizeRatio >= 1.5) level = 2;
                  else if (sizeRatio >= 1.3) level = 3;
                  else if (sizeRatio >= 1.17) level = 4;
                  else level = 5; // 最小满足条件的定为 H5

                  // 如果字重非常高 (>= 700)，可以适当提升级别（但不能升到 H1 以上）
                  if (fontWeight >= 700 && level > 1) {
                      level--;
                  }

                  // 确保级别在 1-6 之间
                  return Math.min(HEADING_LEVELS, Math.max(1, level));
              }
          } catch (e) {
              // console.warn("MagicLens: Error analyzing heading style:", element, e); // 调试时可开启
              return 0; // 出错时返回 0
          }

          return 0; // 不满足条件，不是标题
      },

      /**
       * 判断元素的计算样式是否为粗体。
       * @param {Element} element - 目标 DOM 元素。
       * @returns {boolean} 如果是粗体则返回 true。
       */
      isBold: (element) => {
          try {
              const style = utils.getStyle(element);
              if (!style) return false;
              const fontWeightStr = style.fontWeight;
              // 检查 fontWeight 是否为 'bold' 或 数值 >= 600
              return fontWeightStr === 'bold' || (parseInt(fontWeightStr) >= 600);
          } catch (e) {
              return false; // 出错时返回 false
          }
      },

      /**
       * 判断元素的计算样式是否为斜体。
       * @param {Element} element - 目标 DOM 元素。
       * @returns {boolean} 如果是斜体则返回 true。
       */
      isItalic: (element) => {
          try {
              const style = utils.getStyle(element);
              if (!style) return false;
              // 检查 fontStyle 是否为 'italic' 或 'oblique'
              return style.fontStyle === 'italic' || style.fontStyle === 'oblique';
          } catch (e) {
              return false; // 出错时返回 false
          }
      },
  }; // --- End of styleAnalyzer ---

  // ==========================================================================
  // § 4. Markdown 生成器 (Markdown Generator)
  //    提供一组函数，用于将处理好的内容片段格式化为 Markdown 字符串。
  // ==========================================================================
  const markdownGenerator = {
      /** 生成 Markdown 标题 */
      heading: (text, level) => {
          // 确保级别在 1-6 之间
          const validLevel = Math.max(1, Math.min(HEADING_LEVELS, level));
          return `${'#'.repeat(validLevel)} ${text.trim()}\n\n`; // 加两个换行形成段落
      },
      /** 生成 Markdown 段落 */
      paragraph: (text) => {
          return `${text.trim()}\n\n`; // 加两个换行
      },
      /** 生成 Markdown 粗体 */
      bold: (text) => {
          return `**${text.trim()}**`;
      },
      /** 生成 Markdown 斜体 */
      italic: (text) => {
          return `*${text.trim()}*`;
      },
      /** 生成 Markdown 图片 */
      image: (alt, url) => {
          // 对 alt 和 url 中的特殊字符进行简单转义可能更健壮，但暂不处理
          return `![${alt.trim()}](${url})\n\n`; // 图片是块级元素，加两个换行
      },
      /** 生成 Markdown 链接 */
      link: (text, url) => {
          return `[${text.trim()}](${url})`;
      },
      /** 生成 Markdown 列表项 */
      listItem: (text, level = 0, isOrdered = false, index = 1) => {
          // 计算缩进 (每个层级 2 个空格)
          const indent = '  '.repeat(level);
          // 确定列表标记 (有序或无序)
          const marker = isOrdered ? `${index}. ` : '- ';
          // text 由调用方确保 trim 或处理换行
          return `${indent}${marker}${text}`;
      },
      /** 生成 Markdown 块引用 */
      blockquote: (text) => {
          // 对每一行添加 "> " 前缀
          const lines = text.trim().split('\n');
          const quotedLines = lines.map(line => `> ${line}`);
          return `${quotedLines.join('\n')}\n\n`; // 结尾加两个换行
      },
      /** 生成 Markdown 代码块 */
      codeBlock: (text, language = '') => {
          // 确保语言标识符不含空格或特殊字符 (可选增强)
          const langIdentifier = language.trim().split(/\s+/)[0] || '';
          return `\`\`\`${langIdentifier}\n${text.trim()}\n\`\`\`\n\n`; // 结尾加两个换行
      },
      /** 生成 Markdown 行内代码 */
      inlineCode: (text) => {
          // 对于行内代码，需要特别注意内容中是否包含 ` 字符，理论上需要转义
          // 但简单起见，这里只做 trim
          return `\`${text.trim()}\``;
      },
      /** 生成 Markdown 水平线 */
      horizontalRule: () => {
          return `---\n\n`; // 结尾加两个换行
      },
      /** 生成 Markdown 删除线 */
      strikethrough: (text) => {
          return `~~${text.trim()}~~`;
      }
  }; // --- End of markdownGenerator ---

  // ==========================================================================
  // § 5. 内容提取器 (Content Extractor)
  //    负责遍历 DOM 节点，根据节点类型、内容和可见性规则，递归地生成 Markdown。
  // ==========================================================================
  const contentExtractor = {
    /** 使用 WeakSet 存储已处理过的节点，防止无限循环（例如在循环引用或处理错误时） */
    processedNodes: new WeakSet(),

    /**
     * @typedef {object} ProcessResult 单个节点处理后的结果对象
     * @property {string} markdown - 该节点及其子节点生成的 Markdown 字符串片段。
     * @property {boolean} isBlock - 标记该结果是否代表一个块级 Markdown 元素
     *                             （影响后续拼接时的换行逻辑）。
     * @property {Element} [processedNode] - (可选) 记录被特定处理器（如 structuredLink）主要处理的节点，用于 skipNode 逻辑
     */

    /**
     * 主入口函数：接收一个顶层元素数组，生成完整的 Markdown 文档。
     * @param {Element[]} elements - 由 `contentFinder` 找到的顶层相关元素数组。
     * @param {object} globalContext - 全局上下文，包含 `scope` ('all'或'viewport')。
     * @returns {string} 拼接并清理后的最终 Markdown 字符串。
     */
    generateMarkdownFromElements: function(elements, globalContext = {}) {
      this.processedNodes = new WeakSet(); // 每次调用重置，防止跨次调用的干扰
      let combinedMarkdown = '';
      let lastElementResult = null; // 记录上一个有效结果，用于判断拼接方式

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        // 调用 processNode 处理每个顶层元素，传入全局上下文和顶层标记
        const elementResult = this.processNode(element, {
            ...globalContext,
            isTopLevelElement: true // 标记这是从顶层开始处理的元素
        });

        // 忽略无效或空的返回结果
        if (!elementResult || utils.isEmptyText(elementResult.markdown)) {
          continue;
        }

        // --- 智能 Markdown 拼接逻辑 ---
        if (combinedMarkdown === '') {
          // 第一个有效结果，直接赋值
          combinedMarkdown = elementResult.markdown;
        } else {
          // 判断是否需要在当前结果和之前结果之间添加块级分隔符（通常是两个换行）
          // 需要分隔符的情况：当前结果是块级，或者上一个结果是块级
          const requiresBlockSeparator = elementResult.isBlock || (lastElementResult && lastElementResult.isBlock);

          if (requiresBlockSeparator) {
            // 需要块级分隔：确保之前的 markdown 以两个换行结束，然后附加新的 markdown（移除其可能的前导换行）
            combinedMarkdown = combinedMarkdown.replace(/(\n{2,})?$/, '\n\n') + elementResult.markdown.replace(/^\n+/, '');
          } else {
            // 不需要块级分隔（两个行内元素相邻）：
            // 检查连接处是否需要添加空格。如果任意一边以空白结束/开始，则不加；否则加一个空格。
            const endsWithSpaceOrNL = /[\s\n]$/.test(combinedMarkdown);
            const startsWithSpaceOrNL = /^[\s\n]/.test(elementResult.markdown);
            const separator = (endsWithSpaceOrNL || startsWithSpaceOrNL) ? '' : ' ';
            // 拼接：移除各自的首尾空白（防止累积），中间根据需要加空格
            combinedMarkdown = combinedMarkdown.trimEnd() + separator + elementResult.markdown.trimStart();
          }
        }
        // 更新上一个有效结果
        lastElementResult = elementResult;
      }

      // 最终清理：
      // 1. 合并连续三个或以上的换行为两个换行。
      // 2. 移除最终结果的首尾空白。
      return combinedMarkdown.replace(/\n{3,}/g, '\n\n').trim();
    },

    /**
     * [核心递归处理函数] 处理单个 DOM 节点（元素节点或文本节点）。
     * 主要职责：
     * 1. 防循环检查。
     * 2. 硬性过滤（忽略标签、CSS不可见、无尺寸）。
     * 3. 根据节点类型分发给 `processElementNode` 或 `processTextNode`。
     * 4. 错误捕获与处理。
     * **注意：此函数本身不执行视口检查。**
     * @param {Node} node - 当前要处理的 DOM 节点。
     * @param {object} context - 当前处理上下文，包含 scope, listLevel, isTopLevelElement 等。
     * @returns {ProcessResult | null} 处理结果对象，或在过滤、出错、无内容时返回 null。
     */
    processNode: function(node, context = {}) {
      // 1. 基本过滤：无效节点 或 已处理过 (防循环)
      if (!node || this.processedNodes.has(node)) {
          // console.debug("Node skipped (null or already processed)");
          return null;
      }
      // 跳过空白文本节点和注释节点
      if (utils.isWhitespaceOrCommentNode(node)) {
          // console.debug("Node skipped (whitespace or comment)");
          return null;
      }

      // 2. 对元素节点执行硬性过滤 (CSS可见性、尺寸、忽略标签)
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = /** @type {Element} */ (node);
        const tagName = element.tagName.toUpperCase();

        // 2a. 检查是否为忽略标签
        if (IGNORED_TAGS.has(tagName)) {
          // console.debug(`Node skipped (ignored tag: ${tagName})`, element);
          this.processedNodes.add(node); // 标记为已处理，即使被忽略
          return null; // 硬停止，不再处理此节点及其子孙
        }

        // 2b. 检查元素类名是否匹配需要忽略的模式
        if (element.className && typeof element.className === 'string' && IGNORED_CLASS_PATTERN.test(element.className)) {
          // console.debug(`Node skipped (ignored class pattern: ${element.className})`, element);
          this.processedNodes.add(node); // 标记为已处理，即使被忽略
          return null; // 硬停止
        }

        // 2c. 检查 CSS 可见性和是否有正尺寸
        const cssVisible = utils.isCssVisible(element);
        const hasDimensions = utils.hasPositiveDimensions(element);
        if (!cssVisible || !hasDimensions) {
          // console.debug(`Node skipped (CSS hidden=${!cssVisible}, no dimensions=${!hasDimensions})`, element);
          this.processedNodes.add(node); // 标记为已处理
          return null; // 硬停止
        }
        // --- 硬性过滤通过 ---
      }

      // 3. 标记节点为正在处理 (添加到 processedNodes)
      //    注意：即使后续处理失败或返回 null，也应标记，避免再次尝试。
      this.processedNodes.add(node);

      // 4. 根据节点类型分发处理
      let result = null;
      let caughtError = null;
      try {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 处理元素节点
          result = this.processElementNode(/** @type {Element} */(node), context);
        } else if (node.nodeType === Node.TEXT_NODE) {
          // 处理文本节点
          result = this.processTextNode(/** @type {Text} */(node), context);
        }
        // 其他节点类型 (如注释节点已在前面过滤) 直接忽略，result 保持 null
      } catch (e) {
        // 捕获处理过程中可能出现的异常
        console.error("MagicLens: Error processing node:", node, e);
        caughtError = e;
        result = null; // 出错时结果无效
      } finally {
        // 5. 后处理：检查返回结果是否有效
        if (result && utils.isEmptyText(result.markdown) && !caughtError) {
          // 如果返回了结果对象，但其 markdown 内容为空白，并且不是因为错误导致的，
          // 那么也认为这个节点的处理结果是无效的。
          result = null;
        }
        // 如果 result 为 null (因为被过滤、出错、或本身无内容)，最终返回 null
      }

      return result; // 返回 ProcessResult 或 null
    },

    /**
     * [核心修改点] 处理文本节点 (`Node.TEXT_NODE`)。
     * 主要逻辑：
     * 1. 在 `scope='viewport'` 模式下，检查其父元素的视口可见性（使用 `utils.isElementInViewport`）。
     *    如果父元素不在视口内，则忽略此文本节点 (返回 `null`)。
     * 2. 清理文本内容 (`utils.cleanText`)。
     * 3. 如果清理后文本为空，返回 `null`。
     * 4. 否则，返回包含清理后文本的 `ProcessResult` 对象 (`isBlock: false`)。
     * @param {Text} node - 文本节点。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processTextNode: function(node, context) {
      // 1. 视口检查 (仅在 'viewport' 模式下，且存在父元素时)
      if (context.scope === 'viewport') {
          const parentElement = node.parentElement;
          // 必须有父元素，且父元素在视口内
          if (!parentElement || !utils.isElementInViewport(parentElement)) {
              // 父元素无效或不在视口内，根据"最小单元原则"的近似策略，忽略此文本
              // console.debug("Text node skipped (parent element is outside viewport or null)", node); // 调试时可开启
              return null;
          }
          // --- 父元素在视口内，继续处理 ---
      }

      // 2. 清理文本内容
      const text = utils.cleanText(node.textContent);

      // 3. 检查清理后的文本是否为空
      if (utils.isEmptyText(text)) {
          // console.debug("Text node skipped (empty after cleaning)", node); // 调试时可开启
          return null;
      }

      // 4. 返回有效的文本结果
      return {
          markdown: text,
          isBlock: false // 文本节点本身是行内性质
      };
    },

    /**
     * [核心分发函数] 处理元素节点 (`Node.ELEMENT_NODE`)。
     * 根据元素的 `tagName` 将处理任务分发给具体的 `processXYZ` 函数。
     * 对于无法直接匹配到的标签，会尝试通过 `styleAnalyzer` 判断是否为标题，
     * 或者判断是块级还是行内元素，然后调用通用的处理函数。
     * @param {Element} element - 元素节点。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 由具体处理函数返回的结果或 null。
     */
    processElementNode: function(element, context) {
      const tagName = element.tagName.toUpperCase();
      // 创建子上下文，继承父上下文，并将 isTopLevelElement 设为 false
      const childContext = { ...context, isTopLevelElement: false };
      let result = null;

      // --- 特殊处理：结构化链接 ---
      // 如果是 A 标签，并且其直接子元素包含块级元素 (如 h1-6, p, div 等)
      if (tagName === 'A' && Array.from(element.children).some(child => utils.isBlockElement(child))) {
          // 尝试使用新的处理函数
          result = this.processStructuredLink(element, childContext);
          // 如果 processStructuredLink 成功处理，直接返回结果
          if (result) {
              return result;
          }
          // 如果 processStructuredLink 返回 null (例如无法找到标题)，则会继续往下走，
          // 但通常我们期望结构化链接必须能被此函数处理，避免回退到 processLink。
          // 这里可以根据需要决定是否让它回退到下面的 'A' case 或直接返回 null。
          // 目前行为：如果 processStructuredLink 返回 null，则不进行后续处理（即返回 null）
          return null;
      }
      // --- 结束特殊处理 ---

      // 使用 switch 语句根据 tagName 分发处理
      switch (tagName) {
        // --- 标题 ---
        case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
          result = this.processHeading(element, childContext, parseInt(tagName.substring(1)));
          break;
        // --- 段落 ---
        case 'P':
          result = this.processParagraph(element, childContext);
          break;
        // --- 链接 ---
        case 'A':
          // 只有在上面的特殊处理没有捕获时，才会执行这里
          result = this.processLink(element, childContext); // *包含视口检查*
          break;
        // --- 图片 ---
        case 'IMG':
          result = this.processImage(element, childContext); // *包含视口检查*
          break;
        // --- 列表 ---
        case 'UL': // 无序列表
          result = this.processList(element, childContext, false); // isOrdered = false
          break;
        case 'OL': // 有序列表
          result = this.processList(element, childContext, true);  // isOrdered = true
          break;
        // --- 列表项 ---
        case 'LI':
          // 从上下文中获取列表级别、是否有序、以及当前项的索引
          const listLevel = context.listLevel || 0;
          const isOrderedList = context.isOrderedList || false;
          const listItemIndex = context.listItemIndex || 1;
          result = this.processListItem(element, childContext, listLevel, isOrderedList, listItemIndex);
          break;
        // --- 块引用 ---
        case 'BLOCKQUOTE':
          result = this.processBlockquote(element, childContext);
          break;
        // --- 代码块 ---
        case 'PRE':
          result = this.processCodeBlock(element, childContext); // *包含视口检查*
          break;
        // --- 行内代码 ---
        case 'CODE':
          // 只有当 CODE 不在 PRE 内部时才作为行内代码处理
          // (PRE 内的 CODE 由 processCodeBlock 处理其内容)
          result = element.closest('pre') ? null : this.processInlineCode(element, childContext); // *包含视口检查*
          break;
        // --- 换行 ---
        case 'BR':
          // 直接转换为 Markdown 的硬换行 (两个空格 + 换行符)
          result = { markdown: '  \n', isBlock: false }; // 无视口检查
          break;
        // --- 水平线 ---
        case 'HR':
          result = this.processHorizontalRule(element, childContext); // *包含视口检查*
          break;
        // --- 行内样式 ---
        case 'STRONG': case 'B': // 粗体
          result = this.processStyledInline(element, childContext, markdownGenerator.bold);
          break;
        case 'EM': case 'I': // 斜体 (注意：I 标签如果没被 IGNORED_TAGS 排除)
          result = this.processStyledInline(element, childContext, markdownGenerator.italic);
          break;
        case 'S': case 'STRIKE': case 'DEL': // 删除线
          result = this.processStyledInline(element, childContext, markdownGenerator.strikethrough);
          break;
        // --- 表格 ---
        case 'TABLE':
          // --- 修改：调用新的判断函数 ---
          if (this.isLayoutTable(/** @type {HTMLTableElement} */(element))) {
            // 如果是布局表格，则像处理 DIV 一样处理其内容
            // console.debug("MagicLens: Treating table as layout block:", element); // Optional debug log
            result = this.processGenericBlock(element, childContext);
          } else {
            // 否则，按原来的方式处理为数据表格
            // console.debug("MagicLens: Treating table as data table:", element); // Optional debug log
            result = this.processTable(element, childContext);
          }
          // --- 结束修改 ---
          break;
        // 表格内部结构元素 (TR, THEAD, TBODY, TFOOT)：
        // 这些元素本身不直接生成 Markdown，而是作为容器。
        // 将它们作为通用块级元素处理，主要目的是递归处理它们的子节点 (TD/TH)。
        case 'TR': case 'TBODY': case 'THEAD': case 'TFOOT':
          result = this.processGenericBlock(element, childContext);
          break;
        // 表格单元格 (TD, TH)：
        // 将单元格内容视为一个段落来处理，提取其内部文本或行内元素。
        case 'TD': case 'TH':
          result = this.processParagraph(element, childContext); // 按段落处理单元格内容
          break;
        // --- 其他常见块级/容器 ---
        case 'FIGURE':    // 通常包含 IMG 和 FIGCAPTION
        case 'DETAILS':   // 可折叠区域
          result = this.processGenericBlock(element, childContext); // 作为通用块处理
          break;
        case 'FIGCAPTION': // 图片标题
        case 'SUMMARY':    // DETAILS 的标题
          result = this.processParagraph(element, childContext); // 按段落处理其内容
          break;

        // --- 默认处理 (未知或未明确处理的标签) ---
        default:
          // 1. 尝试判断是否为样式化的标题
          const headingLevel = styleAnalyzer.getHeadingLevel(element);
          if (headingLevel > 0) {
            result = this.processHeading(element, childContext, headingLevel);
          }
          // 2. 检查是否是通过CSS样式实现的粗体
          else if (styleAnalyzer.isBold(element)) {
            result = this.processStyledInline(element, childContext, markdownGenerator.bold);
          }
          // 3. 如果不是标题或CSS粗体，判断是块级还是行内
          else if (utils.isBlockElement(element)) {
            // 作为通用块级元素处理
            result = this.processGenericBlock(element, childContext);
          } else {
            // 作为通用行内元素处理
            result = this.processGenericInline(element, childContext);
          }
          break;
      } // --- End of switch ---

      return result; // 返回具体处理函数的结果
    },

    /**
     * [核心递归辅助函数] 递归处理一个元素的所有子节点，并将它们的有效 Markdown 结果智能地拼接起来。
     * @param {Element} element - 父元素。
     * @param {object} context - 当前处理上下文 (会传递给子节点的 `processNode`)。
     *                         增加 `skipNode` 选项来跳过特定子节点。
     * @returns {ProcessResult | null} 包含所有有效子节点拼接后 Markdown 的结果对象，
     *                                或在没有有效子内容时返回 null。
     *                                `isBlock` 属性表示子节点中是否包含块级元素。
     */
    _processAndCombineChildren: function(element, context) {
      let combinedMarkdown = '';
      let lastChildResult = null; // 记录上一个有效子结果
      let listItemCounter = 1; // 用于有序列表项的索引计数
      let containsBlockChild = false; // 标记子节点中是否包含块级元素

      // 遍历所有子节点 (包括文本节点和元素节点)
      for (const child of element.childNodes) {
        // --- 新增：跳过指定节点 ---
        if (context.skipNode && child === context.skipNode) {
            continue;
        }
        // --- 结束新增 ---

        // 为列表项 (LI) 创建特定的上下文，传递索引
        let nodeContext = context;
        if (child.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (child).tagName === 'LI' && context.isOrderedList) {
          nodeContext = { ...context, listItemIndex: listItemCounter };
        }

        // 递归调用 processNode 处理子节点
        const childResult = this.processNode(child, nodeContext);

        // 忽略无效或空的子结果
        if (!childResult || utils.isEmptyText(childResult.markdown)) {
          continue;
        }

        // 如果子结果是块级，则标记父级组合结果也应视为块级（影响后续拼接）
        if (childResult.isBlock) {
          containsBlockChild = true;
        }

        // --- 智能拼接逻辑 (与 generateMarkdownFromElements 类似) ---
        if (combinedMarkdown === '') {
          combinedMarkdown = childResult.markdown;
        } else {
          // 之前的块级分隔符逻辑可能过于宽松，导致过多换行，尤其是在行内元素之间。
          // 优化：仅当 *两者之一* 是块级时才需要块级分隔符。
          const requiresBlockSeparator = childResult.isBlock || (lastChildResult && lastChildResult.isBlock);

          if (requiresBlockSeparator) {
            // 确保之前的 markdown 以适当的换行结束
            // 如果前一个不是块级，可能只需要一个换行？ 保持 '\n\n' 更安全
            combinedMarkdown = combinedMarkdown.replace(/(\n{1,2})?$/, '\n\n') + childResult.markdown.replace(/^\n+/, '');
          } else {
            // 两个行内元素相邻
            const endsWithSpaceOrNL = /[\s\n]$/.test(combinedMarkdown);
            const startsWithSpaceOrNL = /^[\s\n]/.test(childResult.markdown);
            const separator = (endsWithSpaceOrNL || startsWithSpaceOrNL) ? '' : ' ';
            // 移除各自的首尾空白（防止累积），中间根据需要加空格
            combinedMarkdown = combinedMarkdown.trimEnd() + separator + childResult.markdown.trimStart();
          }
        }
        lastChildResult = childResult; // 更新上一个有效子结果

        // 如果处理的是有序列表项，递增计数器
        if (child.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (child).tagName === 'LI' && context.isOrderedList) {
          listItemCounter++;
        }
      } // --- End of childNodes loop ---

      // 如果遍历完所有子节点后，没有收集到任何有效的 Markdown 内容
      if (utils.isEmptyText(combinedMarkdown)) {
        return null; // 返回 null 表示此元素没有有效内容
      }

      // 返回包含组合后 Markdown 和块级标记的结果对象
      // 优化：如果父元素本身是行内标签 (e.g., span, a) 且子元素不含块级，则整体应为行内
      const parentIsInline = utils.isInlineElement(element);
      return {
        markdown: combinedMarkdown,
        isBlock: containsBlockChild || !parentIsInline // 包含块子元素，或者父元素不是行内元素时，整体视为块
      };
    },

    /**
     * [新增处理函数] 处理结构化链接（如文章卡片），这类链接内部包含块级元素（标题、段落等）。
     * 它会将链接内的第一个标题作为链接文本，生成带链接的 Markdown 标题，
     * 然后处理链接内剩余的内容，追加在标题之后。
     * @param {Element} element - 结构化链接的 A 元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processStructuredLink: function(element, context) {
        // 1. 视口检查 (同 processLink)
        if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
            return null;
        }

        // 2. 获取 URL
        const rawHref = element.getAttribute('href');
        const url = utils.resolveUrl(rawHref);
        if (!url) {
            return null; // URL 无效
        }

        // 3. 查找链接内的第一个标题元素 (h1-h6)
        const headingElement = element.querySelector('h1, h2, h3, h4, h5, h6');
        if (!headingElement) {
            // console.warn("MagicLens (StructuredLink): No heading found inside the link, cannot process as structured link.", element);
            return null; // 没有找到标题，无法按预期处理
        }
        const headingLevel = parseInt(headingElement.tagName.substring(1));

        // 4. 提取标题文本
        // 使用 _processAndCombineChildren 处理标题元素自身，获取其内容
        const headingContentResult = this._processAndCombineChildren(headingElement, { ...context, isInHeading: true });
        let titleText = '';
        if (headingContentResult && !utils.isEmptyText(headingContentResult.markdown)) {
            titleText = utils.stripMarkdown(headingContentResult.markdown); // 剥离 Markdown
        }
        if (utils.isEmptyText(titleText)) {
            // console.warn("MagicLens (StructuredLink): Heading found, but its text content is empty.", headingElement);
            return null; // 标题文本为空，无法处理
        }

        // 5. 生成带链接的 Markdown 标题
        // 格式: ## [Title](url)
        const linkedHeadingMd = `${'#'.repeat(headingLevel)} [${titleText}](${url})\n\n`;

        // 6. 处理链接内剩余的内容 (跳过已处理的标题元素)
        const remainingContext = { ...context, skipNode: headingElement };
        const remainingChildrenResult = this._processAndCombineChildren(element, remainingContext);

        let remainingContentMd = '';
        if (remainingChildrenResult && !utils.isEmptyText(remainingChildrenResult.markdown)) {
            remainingContentMd = remainingChildrenResult.markdown.trimStart(); // 移除可能的前导空白/换行
        }

        // 7. 组合最终 Markdown
        const finalMd = linkedHeadingMd + remainingContentMd;

        return {
            markdown: finalMd.trim(), // 最终清理首尾空白
            isBlock: true, // 结构化链接通常表示一个块级内容
            processedNode: headingElement // 记录主要处理的节点
        };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理标题元素 (H1-H6 或样式推断的标题)。
     * 依赖 `_processAndCombineChildren` 获取子节点内容 (已被过滤)。
     * 特殊处理：如果标题只包含一个有效的链接，直接使用链接的 Markdown。
     * 否则，获取子节点组合文本，剥离 Markdown 标记后，用 `markdownGenerator.heading` 格式化。
     * @param {Element} element - 标题元素。
     * @param {object} context - 当前处理上下文。
     * @param {number} level - 标题级别 (1-6)。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processHeading: function(element, context, level) {
      // 特殊情况：标题内容仅为一个链接
      const significantChildren = Array.from(element.childNodes).filter(n => !utils.isWhitespaceOrCommentNode(n));
      const firstSignificantChild = significantChildren.length === 1 ? significantChildren[0] : null;

      if (firstSignificantChild &&
          firstSignificantChild.nodeType === Node.ELEMENT_NODE &&
          /**@type{Element}*/(firstSignificantChild).tagName === 'A' &&
          utils.isValidLink(/**@type{HTMLAnchorElement}*/(firstSignificantChild)))
      {
          const linkElement = /**@type{HTMLAnchorElement}*/(firstSignificantChild);
          // --- 修改：检查这个链接是否是结构化链接 ---
          const isStructured = Array.from(linkElement.children).some(child => utils.isBlockElement(child));
          let linkResult = null;
          if (isStructured) {
              // 如果是结构化链接，尝试用 processStructuredLink 处理
              linkResult = this.processStructuredLink(linkElement, { ...context, isInHeading: true });
          } else {
              // 否则，用普通 processLink 处理
              linkResult = this.processLink(linkElement, { ...context, isInHeading: true });
          }
          // --- 结束修改 ---

          if (linkResult && !utils.isEmptyText(linkResult.markdown)) {
              // --- 修改：如果处理的是结构化链接，它返回的已经是带 # 的完整标题，直接返回
              if (isStructured) {
                  return linkResult; // 直接返回结构化链接的结果
              } else {
              // --- 结束修改 ---
                  // 如果是普通链接，则用 H 标签包裹
                  return {
                      markdown: markdownGenerator.heading(linkResult.markdown, level),
                      isBlock: true
                  };
              }
          }
      }

      // 默认情况：处理所有子节点
      const childrenResult = this._processAndCombineChildren(element, { ...context, isInHeading: true });
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }

      // 从子节点组合的 Markdown 中剥离标记，得到纯文本标题内容
      const plainText = utils.stripMarkdown(childrenResult.markdown);
      if (utils.isEmptyText(plainText)) {
          return null; // 剥离后为空，也视为无效
      }

      // 使用纯文本生成 Markdown 标题
      return {
          markdown: markdownGenerator.heading(plainText, level),
          isBlock: true
      };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理段落元素 (`<p>`) 或类似段落的元素 (如 `<td>`, `<figcaption>`)。
     * 依赖 `_processAndCombineChildren` 获取子节点内容 (已被过滤)。
     * 将子节点组合的 Markdown 清理内部多余换行后，用 `markdownGenerator.paragraph` 格式化。
     * @param {Element} element - 段落或类似元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processParagraph: function(element, context) {
      // 处理所有子节点
      const childrenResult = this._processAndCombineChildren(element, { ...context, isInParagraph: true });
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }

      // 清理子节点组合 Markdown 中的多余换行（段落内部通常不需要多个连续换行）
      const cleanedContent = childrenResult.markdown
          .replace(/\n{2,}/g, '\n') // 合并多个换行为一个
          .trim(); // 移除首尾空白

      if (utils.isEmptyText(cleanedContent)) {
          return null; // 清理后为空，视为无效
      }

      // 使用清理后的内容生成 Markdown 段落
      return {
          markdown: markdownGenerator.paragraph(cleanedContent),
          isBlock: true // 段落是块级
      };
    },

    /**
     * [原子/结构性处理函数 - 检查视口] 处理链接元素 (`<a>`)。
     * 1. 使用 `utils.isValidLink` 检查链接是否有效。
     * 2. 在 `scope='viewport'` 模式下，使用 `utils.isElementInViewport` 检查自身可见性 (如果不是顶层元素)。
     * 3. 获取 `href` 属性并解析为绝对 URL。
     * 4. 确定链接文本：
     *    - 优先使用内部唯一有效图片的 alt 文本。
     *    - 否则，处理子节点，剥离 Markdown 标记后作为文本。
     * 5. 如果 URL 和文本都有效，使用 `markdownGenerator.link` 格式化。
     * @param {Element} element - 链接元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processLink: function(element, context) {
      // 1. 基础有效性检查 (标签、CSS、尺寸、href、内容)
      if (!utils.isValidLink(/** @type {HTMLAnchorElement} */(element))) {
          // console.debug("Link skipped (invalid)", element);
          return null;
      }

      // 2. 视口检查 (仅在 'viewport' 模式且非顶层元素时)
      //    顶层元素已由 contentFinder 做了初步视口检查，这里避免重复检查顶层。
      //    原子元素的视口检查是"硬停止"，不满足条件直接返回 null。
      if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
          // console.debug("Link skipped (outside viewport)", element);
          return null;
      }
      // --- 视口检查通过 (或 scope='all' 或 isTopLevelElement) ---

      // 3. 获取并解析 URL
      const rawHref = element.getAttribute('href');
      const url = utils.resolveUrl(rawHref);
      if (!url) {
          // console.debug("Link skipped (failed to resolve URL)", element);
          return null; // 解析失败或 URL 被阻止
      }

      // 4. 确定链接文本内容
      let linkText = '';
      const directChildren = Array.from(element.children);
      // 检查是否只包含一个直接子元素，且该子元素是有效图片
      const directImg = /** @type {HTMLImageElement | null} */ (
          directChildren.length === 1 &&
          directChildren[0].tagName === 'IMG' &&
          utils.isValidImage(/**@type {HTMLImageElement}*/(directChildren[0]))
          ? directChildren[0] : null
      );

      if (directImg) {
          // 如果是图片链接，使用图片的 alt 文本作为链接文本
          linkText = utils.getImageAlt(directImg);
          // console.debug("Link text from image alt:", linkText);
      }

      // 如果没有从图片获取到文本，或者文本为空，则尝试处理子节点获取文本
      if (utils.isEmptyText(linkText)) {
          const childrenResult = this._processAndCombineChildren(element, { ...context, isInLink: true });
          if (childrenResult && !utils.isEmptyText(childrenResult.markdown)) {
              // 从子节点组合的 Markdown 中剥离标记
              linkText = utils.stripMarkdown(childrenResult.markdown);
              // console.debug("Link text from children:", linkText);
          }
      }

      // 如果最终无法获取有效的链接文本
      if (utils.isEmptyText(linkText)) {
          // console.debug("Link skipped (no valid text content)", element);
          return null;
      }

      // 5. 生成 Markdown 链接
      return {
          markdown: markdownGenerator.link(linkText, url),
          isBlock: false // 链接是行内元素
      };
    },

    /**
     * [原子/结构性处理函数 - 检查视口] 处理图片元素 (`<img>`)。
     * 1. 使用 `utils.isValidImage` 检查图片是否有效。
     * 2. 在 `scope='viewport'` 模式下，使用 `utils.isElementInViewport` 检查自身可见性 (如果不是顶层元素)。
     * 3. 使用 `utils.getImageAlt` 获取替代文本。
     * 4. 使用 `utils.getImageUrl` 获取有效 URL。
     * 5. 如果 Alt 和 URL 都有效，使用 `markdownGenerator.image` 格式化。
     * @param {Element} element - 图片元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processImage: function(element, context) {
      // 1. 基础有效性检查 (标签、CSS、尺寸、src)
      if (!utils.isValidImage(/** @type {HTMLImageElement} */(element))) {
          // console.debug("Image skipped (invalid)", element);
          return null;
      }

      // 2. 视口检查 (同 processLink)
      if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
          // console.debug("Image skipped (outside viewport)", element);
          return null;
      }
      // --- 视口检查通过 ---

      // 3. 获取 Alt 文本
      const alt = utils.getImageAlt(/** @type {HTMLImageElement} */(element));
      // 4. 获取 URL
      const url = utils.getImageUrl(/** @type {HTMLImageElement} */(element));

      // 5. 必须同时有有效的 URL (alt 可以是默认值 "图像")
      if (!url) {
          // console.debug("Image skipped (no valid URL found)", element);
          return null;
      }

      // 6. 生成 Markdown 图片
      return {
          markdown: markdownGenerator.image(alt, url),
          isBlock: true // 图片在 Markdown 中通常视为块级元素（单独一行）
      };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理列表元素 (`<ul>` 或 `<ol>`)。
     * 1. 确定列表级别 (`context.listLevel`)。
     * 2. 遍历所有子元素，只处理 `<li>` 标签。
     * 3. 为每个 `<li>` 调用 `processListItem`，传递更新后的上下文（增加 level，设置 isOrdered, index）。
     * 4. 收集所有有效的列表项 Markdown 结果。
     * 5. 如果没有有效的列表项，返回 `null`。
     * 6. 将所有列表项的 Markdown 用换行符连接起来，并在末尾添加两个换行。
     * @param {Element} element - 列表元素 (UL 或 OL)。
     * @param {object} context - 当前处理上下文。
     * @param {boolean} isOrdered - 标记是否为有序列表 (OL)。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processList: function(element, context, isOrdered) {
      const listLevel = context.listLevel || 0; // 获取当前嵌套级别，默认为 0
      // 创建子上下文，增加列表级别，并传入是否有序的标记
      const childContext = {
          ...context,
          listLevel: listLevel + 1,
          isInList: true, // 标记当前在列表内部
          isOrderedList: isOrdered
      };

      const listItemsResults = []; // 存储有效的列表项结果
      let itemIndex = 1; // 有序列表的索引计数器

      // 遍历直接子元素
      Array.from(element.children).forEach(child => {
          // 只处理 LI 元素
          if (child.tagName === 'LI') {
              // 调用 processListItem 处理列表项，传入索引
              const itemResult = this.processListItem(
                  /** @type {Element} */(child),
                  { ...childContext, listItemIndex: itemIndex } // 传递当前项的索引
              );
              // 如果列表项处理成功且有内容
              if (itemResult && !utils.isEmptyText(itemResult.markdown)) {
                  listItemsResults.push(itemResult); // 收集结果
                  itemIndex++; // 递增索引 (即使是无序列表也递增，虽然不用)
              } else {
                // console.debug("List item skipped (empty or invalid)", child);
              }
          } else {
              // 在 UL/OL 中遇到非 LI 的直接子元素，通常是无效 HTML，忽略它
              // console.warn("MagicLens: Non-LI element found directly inside a list, skipped:", child);
          }
      });

      // 如果没有收集到任何有效的列表项
      if (listItemsResults.length === 0) {
          // console.debug("List skipped (no valid list items)", element);
          return null;
      }

      // 将所有列表项的 Markdown 用换行符连接
      // 注意：processListItem 返回的 markdown 理论上不带结尾换行，所以直接 join(\n)
      const combinedListContent = listItemsResults.map(item => item.markdown).join('\n');

      // 列表作为一个整体是块级元素，末尾需要两个换行
      return {
          markdown: combinedListContent.replace(/(\n{2,})?$/, '\n\n'),
          isBlock: true
      };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理列表项元素 (`<li>`)。
     * 1. 依赖 `_processAndCombineChildren` 获取子节点内容 (已被过滤)。
     * 2. 对子节点组合的 Markdown 进行处理：
     *    - 获取第一行内容。
     *    - 使用 `markdownGenerator.listItem` 格式化第一行（添加缩进和标记）。
     *    - 对后续行添加正确的缩进。
     * 3. 返回包含格式化后列表项内容的 `ProcessResult`。
     * @param {Element} element - 列表项元素 (LI)。
     * @param {object} context - 当前处理上下文 (包含 level, isOrdered, index)。
     * @param {number} level - 当前列表项的嵌套级别。
     * @param {boolean} isOrdered - 父列表是否有序。
     * @param {number} index - 当前列表项在有序列表中的索引。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processListItem: function(element, context, level, isOrdered, index) {
      // 处理列表项的所有子节点
      const childrenResult = this._processAndCombineChildren(element, { ...context, isInsideListItem: true });
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }

      // 获取子节点组合的 Markdown，并按行分割
      const contentMarkdown = childrenResult.markdown.trim(); // 先 trim 移除首尾空白/换行
      const lines = contentMarkdown.split('\n');

      // 处理第一行
      const firstLineText = lines[0].trim(); // 取第一行并 trim
      // 使用生成器格式化第一行，添加缩进和列表标记
      const firstLineMD = markdownGenerator.listItem(firstLineText, level, isOrdered, index);

      // 处理后续行 (如果存在)
      const subsequentLinesMD = lines.slice(1) // 从第二行开始
          .map(line => {
              const trimmedLine = line.trim();
              if (trimmedLine.length === 0) {
                  return ''; // 跳过空行
              }
              // 计算后续行的缩进：当前级别的缩进 + 列表标记的宽度
              // 有序列表标记宽度可能变化 (如 1. vs 10.)，无序列表固定为 2 ('- ')
              const markerWidth = isOrdered ? String(index).length + 2 : 2; // e.g., "1. " is 3 wide, "- " is 2 wide
              const indentSpaces = ' '.repeat(level * 2) + ' '.repeat(markerWidth);
              return `${indentSpaces}${trimmedLine}`; // 添加缩进
          })
          .filter(line => line.length > 0) // 过滤掉处理后可能产生的空行
          .join('\n'); // 用换行符重新连接

      // 组合最终的列表项 Markdown
      const fullListItemMarkdown = firstLineMD + (subsequentLinesMD ? '\n' + subsequentLinesMD : '');

      return {
          markdown: fullListItemMarkdown,
          // 列表项本身可以看作块级，因为它在列表中占单独一行，并且可能包含嵌套块
          isBlock: true
      };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理块引用元素 (`<blockquote>`)。
     * 依赖 `_processAndCombineChildren` 获取子节点内容 (已被过滤)。
     * 将子节点组合的 Markdown 用 `markdownGenerator.blockquote` 格式化（添加 `>` 前缀）。
     * @param {Element} element - 块引用元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processBlockquote: function(element, context) {
      // 处理所有子节点
      const childrenResult = this._processAndCombineChildren(element, { ...context, isInBlockquote: true });
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }

      // 获取清理后的子节点 Markdown
      const cleanedContent = childrenResult.markdown.trim();
      if (utils.isEmptyText(cleanedContent)) {
          return null; // 清理后为空
      }

      // 使用生成器格式化为块引用
      return {
          markdown: markdownGenerator.blockquote(cleanedContent),
          isBlock: true // 块引用是块级元素
      };
    },

    /**
     * [原子/结构性处理函数 - 检查视口] 处理预格式化文本块元素 (`<pre>`)。
     * 1. 在 `scope='viewport'` 模式下，使用 `utils.isElementInViewport` 检查自身可见性。
     * 2. 尝试查找内部的 `<code>` 元素，如果找到则提取 `<code>` 的内容，否则提取 `<pre>` 自身的内容。
     * 3. 使用 `getCodeContentWithNewlines` 提取文本内容，保留原始换行和空白。
     * 4. 尝试从 `<code>` 或 `<pre>` 的 `className` 中提取语言标识符 (如 `language-javascript`)。
     * 5. 使用 `markdownGenerator.codeBlock` 格式化。
     * @param {Element} element - Pre 元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processCodeBlock: function(element, context) {
      // 1. 视口检查 (原子元素，硬停止)
      if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
          // console.debug("Code block (pre) skipped (outside viewport)", element);
          return null;
      }
      // --- 视口检查通过 ---

      // 2. 确定内容源 (内部 code 或 pre 自身)
      const codeElement = element.querySelector('code');
      const targetElement = codeElement || element; // 优先用 code

      // 3. 提取代码内容，保留格式
      const rawText = this.getCodeContentWithNewlines(targetElement);
      if (rawText === null || utils.isEmptyText(rawText.trim())) { // trim()后判断是否为空
          // console.debug("Code block (pre) skipped (empty content)", element);
          return null; // 没有有效内容
      }

      // 4. 尝试提取语言标识符
      let language = '';
      const langElement = codeElement || element; // 从包含内容的元素上找 class
      if (langElement.className) {
          // 匹配 'lang-xxx' 或 'language-xxx' 格式
          const langMatch = langElement.className.match(/(?:lang-|language-)(\S+)/);
          if (langMatch && langMatch[1]) {
              language = langMatch[1];
          }
      }

      // 5. 清理并生成 Markdown 代码块
      const cleanedText = rawText.replace(/\r/g, '').trim(); // 移除 CR 字符并 trim 首尾空白/换行
      return {
          markdown: markdownGenerator.codeBlock(cleanedText, language),
          isBlock: true // 代码块是块级元素
      };
    },

    /**
     * [原子/结构性处理函数 - 检查视口] 处理行内代码元素 (`<code>`，且不在 `<pre>` 内)。
     * 1. 在 `scope='viewport'` 模式下，使用 `utils.isElementInViewport` 检查自身可见性。
     * 2. 获取元素的 `textContent`。
     * 3. 清理文本内容（合并空白）。
     * 4. 如果清理后内容有效，使用 `markdownGenerator.inlineCode` 格式化。
     * @param {Element} element - Code 元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processInlineCode: function(element, context) {
      // 1. 视口检查 (原子元素，硬停止)
      if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
          // console.debug("Inline code skipped (outside viewport)", element);
          return null;
      }
      // --- 视口检查通过 ---

      // 2. 获取文本内容
      const content = element.textContent;
      if (utils.isEmptyText(content)) {
          // console.debug("Inline code skipped (empty content)", element);
          return null;
      }

      // 3. 清理文本 (替换内部连续空白为单个空格，并 trim)
      const cleanedText = content.replace(/\s+/g, ' ').trim();
      if (utils.isEmptyText(cleanedText)) {
          // console.debug("Inline code skipped (empty after cleaning)", element);
          return null;
      }

      // 4. 生成 Markdown 行内代码
      return {
          markdown: markdownGenerator.inlineCode(cleanedText),
          isBlock: false // 行内代码是行内元素
      };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理行内样式元素 (如 `<strong>`, `<em>`, `<s>`)。
     * 依赖 `_processAndCombineChildren` 获取子节点内容 (已被过滤)。
     * 将子节点组合的 Markdown 清理换行和多余空白后，使用传入的 `generator` (如 `markdownGenerator.bold`) 格式化。
     * @param {Element} element - 行内样式元素 (STRONG, EM, S 等)。
     * @param {object} context - 当前处理上下文。
     * @param {function(string): string} generator - 用于格式化内容的 Markdown 生成器函数。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processStyledInline: function(element, context, generator) {
      // 处理所有子节点
      const childrenResult = this._processAndCombineChildren(element, context);
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }

      // 清理子节点组合 Markdown 中的换行和多余空白
      const cleanedContent = childrenResult.markdown
          .replace(/[\n\r]+/g, ' ') // 将换行符替换为空格
          .replace(/\s+/g, ' ')    // 合并多个空格为一个
          .trim();                 // 移除首尾空白

      if (utils.isEmptyText(cleanedContent)) {
          return null; // 清理后为空
      }

      // 使用传入的生成器格式化
      return {
          markdown: generator(cleanedContent),
          isBlock: false // 这些都是行内元素
      };
    },

    /**
     * [原子/结构性处理函数 - 检查视口] 处理表格元素 (`<table>`)。
     * 1. 在 `scope='viewport'` 模式下，使用 `utils.isElementInViewport` 检查自身可见性。
     * 2. 查找所有行 (`<tr>` in `<thead>`, `<tbody>`, `<tfoot>`, or direct child)。
     * 3. 遍历每一行，查找所有单元格 (`<th>`, `<td>`)。
     * 4. 对每个单元格递归调用 `processNode` (通常会调用 `processParagraph`) 获取内容，并剥离 Markdown 标记。
     * 5. 构建 Markdown 表格的行字符串 (`| cell1 | cell2 |`)。
     * 6. 确定最大列数。
     * 7. 生成表头分隔符 (`|---|---|`)。
     * 8. 如果存在实际表头 (`<thead>` 或 `<th>`)，则插入分隔符；否则，添加占位表头和分隔符。
     * 9. 组合所有行和分隔符，生成最终的 Markdown 表格。
     * @param {Element} element - Table 元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
     processTable: function(element, context) {
        // 1. 视口检查 (原子结构，硬停止)
        if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
            // console.debug("Table skipped (outside viewport)", element);
            return null;
        }
        // --- 视口检查通过 ---

        const rowsMarkdown = []; // 存储每行的 Markdown 字符串
        let headerSeparator = ''; // 表头分隔符
        let columnCount = 0;      // 表格的最大列数
        let hasActualHeader = false; // 标记是否存在 thead 或 th

        // 2. 查找所有行元素 (更健壮的选择器)
        const rowElements = Array.from(element.querySelectorAll(
            ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr'
        ));
        if (rowElements.length === 0) {
            // console.debug("Table skipped (no rows found)", element);
            return null; // 没有行，无效表格
        }

        // 3. 遍历每一行
        rowElements.forEach((rowElement) => {
            const cellsContent = []; // 存储当前行各单元格的清理后内容
            // 查找当前行下的所有单元格 (th 或 td)
            const cellElements = Array.from(rowElement.querySelectorAll(':scope > th, :scope > td'));
            if (cellElements.length === 0) {
                return; // 跳过没有单元格的行
            }

            // 判断当前行是否为表头行
            const isHeaderRow = rowElement.closest('thead') !== null || cellElements.some(cell => cell.tagName === 'TH');
            if (isHeaderRow) {
                hasActualHeader = true;
            }

            // 4. 遍历当前行的每个单元格
            cellElements.forEach(cellElement => {
                const cellContext = { ...context, isInTableCell: true };
                // 递归处理单元格内容 (通常会调用 processParagraph)
                const cellResult = this.processNode(cellElement, cellContext);
                let cellContentClean = '';
                if (cellResult && !utils.isEmptyText(cellResult.markdown)) {
                    // 获取单元格 Markdown，剥离标记，转义管道符，移除换行
                    cellContentClean = utils.stripMarkdown(cellResult.markdown)
                        .replace(/\|/g, '\\|') // 转义内容中的 |
                        .replace(/[\n\r]+/g, ' ') // 替换换行为空格
                        .trim();
                }
                cellsContent.push(cellContentClean); // 添加到当前行内容数组
            }); // --- End of cell loop ---

            // 5. 构建当前行的 Markdown 字符串
            rowsMarkdown.push(`| ${cellsContent.join(' | ')} |`);
            // 更新最大列数
            columnCount = Math.max(columnCount, cellsContent.length);
        }); // --- End of row loop ---

        // 6. 后处理与有效性检查
        // 如果没有收集到任何行，或者列数为0，或者所有行内容都为空
        if (rowsMarkdown.length === 0 || columnCount === 0 || rowsMarkdown.every(row => utils.isEmptyText(row.replace(/\|/g,'').trim()))) {
            // console.debug("Table skipped (empty or invalid content)", element);
            return null;
        }

        // 7. 生成表头分隔符
        // 创建一个包含 columnCount 个 '---' 的数组，用 '|' 连接
        headerSeparator = `|${Array(columnCount).fill('---').join('|')}|`;

        // 8. 插入分隔符 (和可能的占位表头)
        if (hasActualHeader) {
            // 如果存在实际表头行，将分隔符插入到第一行之后
            // (假设第一行是表头，这在多数情况下成立，但不是绝对保证)
            rowsMarkdown.splice(1, 0, headerSeparator);
        } else {
            // 如果没有检测到表头行，则在最前面添加一个空表头行和分隔符
            const placeholderHeader = `|${Array(columnCount).fill('   ').join('|')}|`; // 用空格占位
            rowsMarkdown.unshift(placeholderHeader, headerSeparator);
        }

        // 9. 组合最终的 Markdown 表格
        // 用换行连接所有行，并在末尾添加两个换行表示块结束
        return {
            markdown: rowsMarkdown.join('\n') + '\n\n',
            isBlock: true // 表格是块级元素
        };
      },


    /**
     * [容器类处理函数 - 不检查视口] 处理通用的块级元素 (如 `<div>`, `<article>`, `<section>`)。
     * 这些元素本身没有特定的 Markdown 映射，主要作为内容的容器。
     * 直接依赖 `_processAndCombineChildren` 获取并返回子节点组合的 Markdown。
     * @param {Element} element - 通用块级元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processGenericBlock: function(element, context) {
      // 处理所有子节点
      const childrenResult = this._processAndCombineChildren(element, context);
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }
      // 直接返回子节点的组合结果，块级状态由子节点决定
      // trim() 确保返回的 markdown 不以多余空白开始或结束
      return {
          markdown: childrenResult.markdown.trim(),
          isBlock: childrenResult.isBlock // 继承子节点的块级状态
      };
    },

    /**
     * [容器类处理函数 - 不检查视口] 处理通用的行内元素 (如 `<span>`, `<mark>`)。
     * 这些元素通常用于包裹文本片段，应用某些样式，但无特定 Markdown 映射。
     * 依赖 `_processAndCombineChildren` 获取子节点内容。
     * 将子节点组合的 Markdown 清理换行和多余空白后直接返回。
     * @param {Element} element - 通用行内元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processGenericInline: function(element, context) {
      // 检查是否是CSS粗体
      if (styleAnalyzer.isBold(element)) {
        return this.processStyledInline(element, context, markdownGenerator.bold);
      }

      // 检查是否是CSS斜体
      if (styleAnalyzer.isItalic(element)) {
        return this.processStyledInline(element, context, markdownGenerator.italic);
      }

      // 处理所有子节点
      const childrenResult = this._processAndCombineChildren(element, context);
      if (!childrenResult || utils.isEmptyText(childrenResult.markdown)) {
          return null; // 没有有效子内容
      }

      // 清理子节点组合 Markdown 中的换行和多余空白
      const cleanedContent = childrenResult.markdown
          .replace(/[\n\r]+/g, ' ') // 替换换行为空格
          .replace(/\s+/g, ' ')    // 合并多个空格
          .trim();

      if (utils.isEmptyText(cleanedContent)) {
          return null; // 清理后为空
      }

      // 直接返回清理后的内容，标记为非块级
      return {
          markdown: cleanedContent,
          isBlock: false
      };
    },

    /**
     * [原子/结构性处理函数 - 检查视口] 处理水平线元素 (`<hr>`)。
     * 1. 在 `scope='viewport'` 模式下，使用 `utils.isElementInViewport` 检查自身可见性。
     * 2. 使用 `markdownGenerator.horizontalRule` 生成 Markdown 水平线。
     * @param {Element} element - HR 元素。
     * @param {object} context - 当前处理上下文。
     * @returns {ProcessResult | null} 处理结果或 null。
     */
    processHorizontalRule: function(element, context) {
       // 1. 视口检查 (原子元素，硬停止)
       if (context.scope === 'viewport' && !context.isTopLevelElement && !utils.isElementInViewport(element)) {
           // console.debug("Horizontal rule skipped (outside viewport)", element);
           return null;
       }
       // --- 视口检查通过 ---

       // 2. 生成 Markdown 水平线
       return {
           markdown: markdownGenerator.horizontalRule(),
           isBlock: true // 水平线是块级元素
       };
    },

    /**
     * [辅助函数] 提取 `<pre>` 或 `<code>` 元素内的文本内容，并尝试保留原始的换行符和空白格式。
     * 遍历目标元素的所有子节点：
     * - 如果是文本节点，直接追加其内容。
     * - 如果是 `<br>` 元素，追加一个换行符 `\n`。
     * - 如果是其他元素节点，递归调用自身处理。
     * @param {Element} element - 目标元素 (通常是 PRE 或 CODE)。
     * @returns {string | null} 提取到的包含换行的文本内容，或在无效输入时返回 null。
     */
    getCodeContentWithNewlines: function(element) {
        if (!element) {
            return null;
        }
        let content = '';
        const childNodes = element.childNodes;

        for (let i = 0; i < childNodes.length; i++) {
            const node = childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) {
                // 直接添加文本节点内容
                content += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const elementNode = /** @type {Element} */ (node);
                if (elementNode.tagName.toUpperCase() === 'BR') {
                    // BR 元素转换为空行
                    content += '\n';
                } else {
                    // 递归处理其他嵌套元素 (虽然在 PRE/CODE 中不常见，但处理以防万一)
                    const nestedContent = this.getCodeContentWithNewlines(elementNode);
                    if (nestedContent !== null) {
                        content += nestedContent;
                    }
                }
            }
            // 忽略注释节点等其他类型
        }
        return content;
    },

    /**
     * [新增辅助函数 - 遵循简单的力量] 判断一个表格元素是否可能用于布局。
     * 采用简单、明确的启发式规则。
     * @param {HTMLTableElement} tableElement - 表格元素。
     * @returns {boolean} 如果很可能是布局表格，则返回 true。
     */
    isLayoutTable: function(tableElement) {
        if (!tableElement || tableElement.tagName !== 'TABLE') {
            return false; // 非表格元素
        }

        // 规则 1: 检查 role 属性 (明确指示)
        const role = tableElement.getAttribute('role');
        if (role === 'presentation' || role === 'none') {
            // console.debug("Table identified as layout by role:", tableElement);
            return true;
        }

        // 规则 2: 检查明确的无边框设置
        const borderAttribute = tableElement.getAttribute('border');
        const style = utils.getStyle(tableElement);
        const hasZeroBorder = borderAttribute === '0' ||
                             (style && (style.borderStyle === 'none' || style.borderStyle === 'hidden' || parseFloat(style.borderWidth) === 0));
        if (hasZeroBorder) {
             // 纯粹无边框可能是布局表，也可能是无边框数据表，此规则不够强，先注释掉或降低权重
             // console.debug("Table identified as potentially layout by zero border:", tableElement);
             // return true; // 暂时不单独因为无边框就判断为布局
        }

        // 规则 3: 检查是否完全没有表头单元格 (<th>)
        // 这是比较强的指示，数据表通常至少有一个 <th>
        const hasThElement = tableElement.querySelector('th') !== null;
        if (!hasThElement) {
            // console.debug("Table identified as potentially layout due to lack of <th>:", tableElement);
            return true; // 没有 <th>，很可能是布局表格
        }

        // 如果以上明确规则都不满足，则默认视为数据表格
        return false;
    },

  }; // --- End of contentExtractor ---

  // ==========================================================================
  // § 6. 内容发现与筛选 (Content Finder)
  //    负责从指定的根元素开始，查找并筛选出可能包含主要内容的顶层元素块。
  //    目的是减少 `contentExtractor` 需要处理的节点数量，提高效率。
  // ==========================================================================
  const contentFinder = {
      /**
       * 从指定的根元素开始，查找并返回一组顶层的、相关的、可能包含内容的元素。
       * 使用 `TreeWalker` 高效遍历 DOM。
       * 应用初步的过滤规则（忽略标签、可见性、潜在内容判断）。
       * 对找到的候选元素进行后处理，移除被其他候选元素包含的元素，只保留最外层的块。
       * @param {Element} [rootElement=document.body] - 开始查找的根元素。
       * @param {'all' | 'viewport'} [scope='viewport'] - 判断范围，影响 `isEffectivelyVisible`。
       * @returns {Element[]} 一个按文档顺序排序的、顶层的、相关内容元素的数组。
       */
      findRelevantElements: function(rootElement = document.body, scope = "viewport") {
          const candidateElements = []; // 存储初步筛选出的候选元素

          // 使用 TreeWalker 高效遍历 DOM 子树
          // NodeFilter.SHOW_ELEMENT: 只访问元素节点
          const walker = document.createTreeWalker(
              rootElement,
              NodeFilter.SHOW_ELEMENT,
              { // 自定义节点过滤器
                  acceptNode: (node) => {
                      const element = /** @type {Element} */ (node);

                      // 1. 硬性忽略检查
                      if (IGNORED_TAGS.has(element.tagName.toUpperCase())) {
                          // 如果是忽略标签，则拒绝此节点及其所有子孙节点
                          return NodeFilter.FILTER_REJECT;
                      }

                      // 2. 初步可见性筛选 (包括 scope='viewport' 时的视口检查)
                      //    这是性能优化的关键：避免深入处理完全不可见的大块区域。
                      if (!utils.isEffectivelyVisible(element, scope)) {
                          // 如果元素初步判断不可见，则跳过此节点及其子孙节点
                          return NodeFilter.FILTER_SKIP; // 或 FILTER_REJECT，取决于是否想完全排除
                      }

                      // 3. 检查是否可能是内容容器或包含直接内容
                      if (utils.isPotentiallyContentElement(element, scope)) {
                          // 如果满足潜在内容元素的条件，则接受此节点
                          // TreeWalker 会继续访问此节点的子孙
                          return NodeFilter.FILTER_ACCEPT;
                      }

                      // 4. 其他情况 (非忽略、可见、但不是潜在内容元素)
                      //    跳过当前节点（不添加到结果），但继续检查其子孙节点
                      //    例如一个无直接内容的 <div>，可能其子节点是 <p>
                      return NodeFilter.FILTER_SKIP;
                  }
              }
              // false // (可选参数) 是否扩展实体引用，通常为 false
          );

          // 遍历 TreeWalker 并收集所有被接受 (FILTER_ACCEPT) 的节点
          let currentNode;
          while (currentNode = walker.nextNode()) {
              candidateElements.push(/** @type {Element} */ (currentNode));
          }

          // --- 后处理：移除被包含的元素，保留最外层 ---
          const relevantElements = []; // 最终筛选出的顶层相关元素
          candidateElements.forEach(candidate => {
              // 检查当前候选元素是否被 `relevantElements` 中已有的其他元素包含
              const isContained = relevantElements.some(selected =>
                  selected !== candidate && selected.contains(candidate)
              );

              // 如果当前候选元素没有被包含
              if (!isContained) {
                  // 反向检查：移除 `relevantElements` 中被当前候选元素包含的元素
                  const childrenToRemove = relevantElements.filter(selected =>
                      selected !== candidate && candidate.contains(selected)
                  );
                  childrenToRemove.forEach(child => {
                      const index = relevantElements.indexOf(child);
                      if (index > -1) {
                          relevantElements.splice(index, 1); // 从结果中移除被包含的子元素
                      }
                  });
                  // 将当前候选元素（作为更外层的元素）添加到结果中
                  relevantElements.push(candidate);
              }
              // 如果当前候选元素已被包含，则忽略它
          });

          // 按元素在文档中的原始顺序排序 (虽然 TreeWalker 通常按顺序，但后处理可能打乱)
          relevantElements.sort((a, b) => {
              const position = a.compareDocumentPosition(b);
              if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                  return -1; // a 在 b 之前
              } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                  return 1;  // a 在 b 之后
              } else {
                  return 0;  // 同一节点或无法比较
              }
          });

          // console.debug(`MagicLens (contentFinder): Found ${candidateElements.length} candidates, filtered to ${relevantElements.length} relevant top-level elements for scope '${scope}'.`, relevantElements); // 调试时可开启

          return relevantElements; // 返回最终筛选和排序后的顶层元素数组
      },
  }; // --- End of contentFinder ---

  // ==========================================================================
  // § 7. 主转换函数与导出 (Main Function & Export)
  // ==========================================================================
  /**
   * 执行从当前网页 DOM 到 Markdown 的转换的核心函数。
   * @param {'all' | 'viewport'} [scope='viewport'] - 指定内容提取的范围。
   *   - 'all': 提取所有满足基础可见性规则（CSS可见、有尺寸、非忽略标签）的内容。
   *   - 'viewport': (默认) 应用"最小内容单元视口过滤原则"，只提取在视口内可见的部分。
   * @returns {string} 生成的 Markdown 文本。如果在转换过程中发生严重错误，
   *                   会返回包含错误信息的注释字符串。
   */
  function readAsMarkdown(scope = "viewport") {
    // 规范化 scope 参数，确保它是 'all' 或 'viewport'
    scope = (scope === "all") ? "all" : "viewport";
    // 通常从 document.body 开始查找内容
    const rootElement = document.body;
    let elementsToProcess = []; // 存储待处理的顶层元素

    // console.log(`MagicLens: Starting Markdown conversion with scope "${scope}".`); // 调试时可开启

    try {
      // 1. 使用 contentFinder 查找顶层相关元素
      //    这一步会根据 scope 进行初步的可见性/视口过滤。
      elementsToProcess = contentFinder.findRelevantElements(rootElement, scope);
      // console.log(`MagicLens: Found ${elementsToProcess.length} top-level element(s) for processing.`); // 调试时可开启

      // 2. 使用 contentExtractor 从找到的顶层元素开始生成 Markdown
      //    这一步会应用详细的"最小单元过滤原则"。
      const markdownResult = contentExtractor.generateMarkdownFromElements(
          elementsToProcess,
          { scope: scope } // 将 scope 传递给 extractor 的全局上下文
      );
      // console.log("MagicLens: Markdown generation complete."); // 调试时可开启

      // 返回最终生成的 Markdown 结果
      return markdownResult;

    } catch (e) {
      // 捕获在主流程中未被捕获的意外顶层错误
      console.error("MagicLens: Critical error during Markdown conversion process:", e);
      // 返回一个包含错误信息的注释，方便调用方了解问题
      return `/* MagicLens Error: Conversion failed unexpectedly. ${e.message || e} */`;
    }
  }

  // --- 导出接口 ---
  // 将 MagicLens 对象挂载到 window 全局对象上，使其可以被外部脚本调用。
  // 例如： `let markdown = window.MagicLens.readAsMarkdown('viewport');`
  window.MagicLens = {
    readAsMarkdown: readAsMarkdown,
    // 如果需要，可以在此对象上暴露其他公共方法或信息
    getVersion: function() { return '1.5.1'; } // 示例：获取版本号
  };

  // 在控制台输出一条消息，表示脚本已成功加载和初始化
  console.log("MagicLens v1.5.1 initialized successfully.");

})(); // 立即调用执行函数 (IIFE) 结束
