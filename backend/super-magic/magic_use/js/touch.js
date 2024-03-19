/**
 * MagicTouch，给 AI 提供先进的网页触觉
 * 用于获取页面中所有交互式元素并进行分类
 */
(function() {
  'use strict';

  /**
   * 配置项
   * excludeClassPrefixes: 排除包含指定 CSS 类名前缀的元素
   * filterTinyElements: 控制过滤微小元素的阈值
   * maxTextLength: 交互元素 text 字段的最大长度
   */
  const config = {
    excludeClassPrefixes: ['magic-marker-'], // 例如, 排除所有 class 以 'magic-maker-' 开头的元素
    filterTinyElements: {
      // 绝对最小面积 (像素平方)，低于此值的元素会被过滤。
      absoluteMinArea: 16,
      // 最小可交互尺寸 (像素)，宽度或高度低于此值的元素会被过滤 (特定类型元素除外)。
      minInteractableDimension: 5,
      // 细长元素的最小边尺寸 (像素)，宽高比异常但短边小于此值的元素会被过滤。
      minDimensionForLongElements: 3
    },
    maxTextLength: 256 // 交互元素 text 字段的最大长度
  };

  /**
   * 获取页面中的交互式元素
   * @param {string} scope - 'viewport'仅获取可见元素，'all'获取所有元素
   * @param {string} type - 指定要获取的元素大类，如'button'、'link'、'input'、'select'、'other'，'all'表示获取所有类型
   * @returns {Object} - 按固定大类分类的交互式元素对象
   * @example
   * // 返回值示例:
   * {
   *   "button": [
   *     {
   *       "name": "提交",
   *       "name_en": "submit-btn",
   *       "type": "button",
   *       "selector": "#a1b2c3",
   *       "text": "提交表单"
   *     },
   *     // ... 其他按钮元素
   *   ],
   *   "link": [
   *     {
   *       "name": "关于我们",
   *       "name_en": "about-link",
   *       "type": "a",
   *       "selector": "#g7h8i9",
   *       "text": "关于我们",
   *       "href": "https://example.com/about"
   *     },
   *     // ... 其他链接元素
   *   ],
   *   "input_and_select": [ // 注意: 'input' 和 'select' 合并到了 'input_and_select' 分类
   *     {
   *       "name": "用户名",
   *       "name_en": "username",
   *       "type": "text",
   *       "selector": "#j0k1l2",
   *       "value": ""
   *     },
   *     {
   *       "name": "选择城市",
   *       "name_en": "city",
   *       "type": "select",
   *       "selector": "#m3n4o5",
   *       "value": "beijing"
   *     },
   *     // ... 其他输入和选择元素
   *   ],
   *   "other": [
   *     {
   *       "name": "视频播放器",
   *       "name_en": "intro-video",
   *       "type": "video",
   *       "selector": "#p6q7r8"
   *     },
   *     // ... 其他交互式元素
   *   ]
   * }
   *
   * 支持的元素类型包括：
   * - 常见HTML交互元素: 'a', 'button', 'select', 'textarea', 'summary', 'details', 'video', 'audio'
   * - 输入框类型: 'text', 'password', 'checkbox', 'radio', 'file', 'submit', 'reset', 'button',
   *   'color', 'date', 'datetime-local', 'email', 'month', 'number', 'range', 'search', 'tel',
   *   'time', 'url', 'week'
   * - 带有交互式role属性的元素: 'button', 'link', 'checkbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
   *   'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox'
   * - 其他带有点击事件或cursor:pointer样式的元素
   */

  // 获取视口的尺寸
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  /**
   * 计算字符串的哈希值
   * @param {string} str - 输入字符串
   * @returns {string} - 8位十六进制哈希值
   */
  function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(16).padStart(8, '0');

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }

    // 转换为8位十六进制字符串
    const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
    return hashHex.slice(-8); // 确保只取8位
  }

  /**
   * 获取元素的 XPath
   * @param {Element} element - DOM元素
   * @returns {string} - 元素的 XPath
   */
  function getElementXPath(element) {
    if (!element) return '';
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
      return '/html/body';
    }

    if (!element.parentNode) {
      return '';
    }

    let siblings = Array.from(element.parentNode.children).filter(
      child => child.tagName === element.tagName
    );

    let index = siblings.indexOf(element) + 1;

    // 构建有序的标识符组合
    let tag = element.tagName.toLowerCase();
    // 显式转换为字符串，兼容 SVGAnimatedString 等非字符串类型
    let attributes = '';

    // 添加常用的属性作为标识符
    const importantAttrs = ['type', 'name', 'role', 'data-testid'];
    for (const attr of importantAttrs) {
      if (element.hasAttribute(attr)) {
        attributes += `[@${attr}="${element.getAttribute(attr)}"]`;
      }
    }

    // 返回带有标签、索引和属性的路径
    return `${getElementXPath(element.parentNode)}/${tag}${attributes}[${index}]`;
  }

  /**
   * 生成基于元素特征的稳定ID
   * 结合 XPath 路径和元素特征，生成相对稳定的标识符
   * @param {Element} element - DOM元素
   * @returns {string} - 生成的魔法ID
   */
  function generateMagicId(element) {
    if (!element) {
      return 'unknown';
    }

    // 获取元素的XPath
    const xpath = getElementXPath(element);

    // 计算XPath的哈希值
    return hashString(xpath);
  }

  // 检查元素是否在视口内且可见
  function isNodeVisible(node) {
    // 只处理元素节点的可见性
    if (node.nodeType === Node.ELEMENT_NODE) {
      // 获取元素的位置信息
      const rect = node.getBoundingClientRect();

      // 检查元素是否在视口内（至少部分可见）
      const isInViewport = !(rect.right < 0 ||
                           rect.bottom < 0 ||
                           rect.left > viewportWidth ||
                           rect.top > viewportHeight);

      // 检查CSS样式是否使元素可见
      const computedStyle = window.getComputedStyle(node);
      const hasVisibleStyle = computedStyle.display !== 'none' &&
                             computedStyle.visibility !== 'hidden' &&
                             parseFloat(computedStyle.opacity) > 0;

      return isInViewport && hasVisibleStyle;
    }

    // 非元素节点默认返回false
    return false;
  }

  /**
   * 检查两个元素之间的重叠情况
   *
   * 重叠规则：
   * 1. 计算两个元素的真实可视重叠面积
   * 2. 如果重叠面积占较小元素面积的比例大于80%，则视为重叠
   * 3. 对于重叠的元素：
   *    - 如果存在父子关系，保留父元素，移除子元素
   *    - 如果不存在父子关系，保留大元素，移除小元素
   *
   * @param {Element} element1 - 第一个元素
   * @param {Element} element2 - 第二个元素
   * @returns {Object} 包含是否应该移除元素的决定和原因
   */
  function checkElementsOverlap(element1, element2) {
    // 获取元素的可见边界
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();

    // 计算元素面积
    const area1 = rect1.width * rect1.height;
    const area2 = rect2.width * rect2.height;

    // 检查是否为父子关系
    const isParentChild = element1.contains(element2) || element2.contains(element1);

    // 如果两个元素没有重叠，直接返回不移除
    if (rect1.right <= rect2.left || rect1.left >= rect2.right ||
        rect1.bottom <= rect2.top || rect1.top >= rect2.bottom) {
      return { shouldRemove: false, reason: "no-overlap" };
    }

    // 计算真实可视重叠区域
    const overlapLeft = Math.max(rect1.left, rect2.left);
    const overlapRight = Math.min(rect1.right, rect2.right);
    const overlapTop = Math.max(rect1.top, rect2.top);
    const overlapBottom = Math.min(rect1.bottom, rect2.bottom);

    const overlapWidth = overlapRight - overlapLeft;
    const overlapHeight = overlapBottom - overlapTop;
    const overlapArea = overlapWidth * overlapHeight;

    // 计算重叠比例 (占较小元素的百分比)
    const smallerArea = Math.min(area1, area2);
    // 避免除以零
    if (smallerArea === 0) {
      return { shouldRemove: false, reason: "zero-area-element" };
    }
    const overlapRatio = overlapArea / smallerArea;

    // 如果重叠面积比例大于80%，判断哪个元素应该被移除
    if (overlapRatio > 0.8) {
      // 如果是父子关系，移除子元素
      if (isParentChild) {
        if (element1.contains(element2)) {
          return { shouldRemove: true, element: element2, reason: "child-element" };
        } else {
          return { shouldRemove: true, element: element1, reason: "child-element" };
        }
      }

      // 否则移除较小的元素
      if (area1 > area2) {
        return { shouldRemove: true, element: element2, reason: "smaller-element" };
      } else {
        // 如果面积相等或area2更大，移除element1
        return { shouldRemove: true, element: element1, reason: "smaller-element" };
      }
    }

    return { shouldRemove: false, reason: "overlap-ratio-too-small" };
  }

  /**
   * 过滤掉被其他元素覆盖的元素
   *
   * 过滤规则：
   * 1. 对每对元素应用重叠检测规则
   * 2. 移除所有被判定为应该移除的元素（小元素或子元素）
   * 3. 优化：避免重复比较和检查已被标记为移除的元素
   *
   * @param {Array<Element>} nodes - 待过滤的元素数组
   * @returns {Array<Element>} 过滤后的元素数组
   */
  function filterOverlappingElements(nodes) {
    if (nodes.length < 2) {
      return nodes;
    }

    const nodesToRemove = new Set();

    for (let i = 0; i < nodes.length; i++) {
      if (nodesToRemove.has(nodes[i])) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        if (nodesToRemove.has(nodes[j])) continue;

        // 检查重叠情况
        const result = checkElementsOverlap(nodes[i], nodes[j]);

        if (result.shouldRemove) {
          nodesToRemove.add(result.element);
        }
      }
    }

    return nodes.filter(node => !nodesToRemove.has(node));
  }

  /**
   * 过滤掉body元素和大面积元素
   *
   * 过滤规则：
   * 1. 排除页面body元素（通常包含整个页面内容）
   * 2. 排除面积大于视窗20%的元素（大面积容器和背景元素）
   *
   * 目的：移除不太可能是具体交互元素的大型容器元素
   *
   * @param {Array<Element>} nodes - 待过滤的元素数组
   * @returns {Array<Element>} 过滤后的元素数组
   */
  function filterLargeElements(nodes) {
    // 计算视窗面积
    const viewportArea = viewportWidth * viewportHeight;
    // 避免除以零
    if (viewportArea === 0) return nodes;

    // 排除body元素和面积大于视窗20%的元素
    return nodes.filter(node => {
      // 排除body元素
      if (node.tagName.toLowerCase() === 'body') {
        return false;
      }

      // 计算元素面积
      const rect = node.getBoundingClientRect();
      const nodeArea = rect.width * rect.height;

      // 如果元素面积大于视窗面积的20%，则排除
      return nodeArea <= (viewportArea * 0.2);
    });
  }

  /**
   * 过滤掉面积极小或尺寸异常的元素
   *
   * 过滤规则：
   * 1. 排除面积小于16平方像素的元素（比如4x4像素大小）
   * 2. 排除宽度或高度小于最小人类可交互尺寸的元素（如宽度或高度小于5像素）
   * 3. 排除宽度或高度超出合理范围但另一维度极小的元素（如1x500像素的线条）
   *
   * 目的：移除过小而难以进行有效交互的元素，或可能是装饰性元素
   *
   * @param {Array<Element>} nodes - 待过滤的元素数组
   * @returns {Array<Element>} 过滤后的元素数组
   */
  function filterTinyElements(nodes) {
    // 计算视窗面积
    const viewportArea = viewportWidth * viewportHeight;
    // 避免除以零
    if (viewportArea === 0) return nodes;

    // 设置绝对最小面积 (16平方像素，相当于4x4)
    const absoluteMinArea = config.filterTinyElements.absoluteMinArea;

    // 设置最小人类可交互尺寸（像素）
    const minInteractableDimension = config.filterTinyElements.minInteractableDimension;

    // 对于特殊情况，一个维度可以较大但另一维度不能过小的阈值
    const minDimensionForLongElements = config.filterTinyElements.minDimensionForLongElements;

    // 设置面积阈值
    const minAreaThreshold = absoluteMinArea;

    return nodes.filter(node => {
      // 获取元素尺寸信息
      const rect = node.getBoundingClientRect();
      const nodeWidth = rect.width;
      const nodeHeight = rect.height;
      const nodeArea = nodeWidth * nodeHeight;

      // 检查标签和角色，某些元素可以例外
      const tagName = node.tagName.toLowerCase();
      const role = node.getAttribute('role');

      // 对于特定类型的元素允许例外（如水平分隔线、进度条等）
      if ((tagName === 'hr' && nodeHeight < minInteractableDimension) ||
          (role === 'separator' && nodeHeight < minInteractableDimension) ||
          (tagName === 'progress' || role === 'progressbar') ||
          (tagName === 'input' && node.type === 'range') ||
          (role === 'slider' || role === 'scrollbar')) {
        return true;
      }

      // 如果是可输入元素，通常需要保留
      if (isInputable(node)) {
        return true;
      }

      // 常规检查：
      // 1. 面积检查
      const areaCheck = nodeArea >= minAreaThreshold;

      // 2. 最小尺寸检查 - 两个维度都不能太小
      const minDimensionCheck = nodeWidth >= minInteractableDimension && nodeHeight >= minInteractableDimension;

      // 3. 特殊检查 - 长条形元素的较小边不能过小
      const specialShapeCheck = !(
        (nodeWidth > nodeHeight * 5 && nodeHeight < minDimensionForLongElements) ||
        (nodeHeight > nodeWidth * 5 && nodeWidth < minDimensionForLongElements)
      );

      // 只有通过所有检查的元素才会被保留
      return areaCheck && minDimensionCheck && specialShapeCheck;
    });
  }

  /**
   * 过滤掉异常宽高比的元素
   *
   * 过滤规则：
   * 1. 排除宽高比超过阈值的极细长元素（如分隔线、边框）
   * 2. 默认阈值设为8:1，即高度超过宽度8倍的元素
   * 3. 特例：对于已知的有意设计成细长形状的交互元素，会通过特殊检测保留
   *
   * 目的：移除可能是装饰性或非主要交互目的的异常形状元素
   *
   * @param {Array<Element>} nodes - 待过滤的元素数组
   * @param {number} [aspectRatioThreshold=8] - 宽高比阈值，超过此阈值的元素将被过滤
   * @returns {Array<Element>} 过滤后的元素数组
   */
  function filterAbnormalAspectRatioElements(nodes, aspectRatioThreshold = 8) {
    return nodes.filter(node => {
      // 获取元素尺寸
      const rect = node.getBoundingClientRect();
      // 避免除以零错误
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }
      // 计算高度与宽度的比例
      const heightToWidthRatio = rect.height / rect.width;
      // 只过滤高度相对于宽度过高的元素，不过滤宽度相对于高度过宽的
      return heightToWidthRatio <= aspectRatioThreshold;
    });
  }

  /**
   * 获取元素的可读名称，优先顺序：
   * aria-label > title > alt > name > id > placeholder > 按钮/链接文本 > label文本 > 标签名
   * @param {Element} element - DOM元素
   * @returns {string} - 可读名称
   */
  function getReadableName(element) {
    // 尝试获取各种可能作为名称的属性
    const nameAttributes = ['aria-label', 'title', 'alt', 'name', 'id', 'placeholder'];
    for (const attr of nameAttributes) {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr)?.trim();
        if (value) return value;
      }
    }

    // 获取按钮上的文本
    if (element.tagName.toLowerCase() === 'button' || element.getAttribute('role') === 'button') {
      const text = element.innerText?.trim();
      if (text) return text;
    }

    // 获取链接文本
    if (element.tagName.toLowerCase() === 'a') {
      const text = element.innerText?.trim();
      if (text) return text;
    }

    // 获取表单元素的label
    if (['input', 'select', 'textarea'].includes(element.tagName.toLowerCase())) {
      // 通过for属性查找关联的label
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        const text = label?.innerText?.trim();
        if (text) return text;
      }

      // 查找父元素中的label
      let parent = element.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === 'label') {
           const text = parent.innerText?.trim();
           if (text) return text;
        }
        // 避免无限循环，向上查找最多5层
        let depth = 0;
        if (parent.parentElement && depth < 5) {
            parent = parent.parentElement;
            depth++;
        } else {
            break;
        }
      }
    }

    // 如果没有找到名称，返回元素类型
    return element.tagName.toLowerCase();
  }

  // 检查元素是否是交互式元素
  function isInteractive(element) {
    if (element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    const computedStyle = window.getComputedStyle(element);

    // 常见的交互式元素标签
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'summary', 'details', 'video', 'audio'];

    // 检查元素是否为常见交互式标签
    if (interactiveTags.includes(tagName)) {
      return true;
    }

    // 检查是否有tabindex属性 (非-1)
    if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1') {
      return true;
    }

    // 检查是否有常见的交互式role属性
    const interactiveRoles = [
      'button', 'link', 'checkbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox'
    ];
    if (element.hasAttribute('role') && interactiveRoles.includes(element.getAttribute('role'))) {
      return true;
    }

    // 检查指针样式是否为可点击 (pointer)
    if (computedStyle.cursor === 'pointer') {
      return true;
    }

    // 检查是否有点击事件监听器 (注意: 这种检查不完全可靠，只能检查内联和属性形式的监听器)
    // 检查内联onclick
    if (element.hasAttribute('onclick')) {
        return true;
    }
    // 尝试检查通过 addEventListener 添加的事件 (存在限制，可能无法检测所有情况)
    // 在真实的浏览器环境中，没有标准方法可以直接检查所有通过 addEventListener 添加的监听器。
    // 这种检查是启发式的，可能不全面。
    // 如果依赖于动态添加的事件，此检查可能不够。
    const events = window.getEventListeners?.(element); // 非标准 API，可能不存在
    if (events && events.click && events.click.length > 0) {
        return true;
    }

    return false;
  }

  /**
   * 判断元素是否可输入内容
   *
   * 判断依据：
   * 1. textarea元素（非禁用和只读状态）
   * 2. 可输入类型的input元素（文本、数字、日期等，非禁用和只读状态）
   * 3. 带有contenteditable="true"属性的元素
   * 4. 具有编辑相关ARIA角色的元素
   * 5. 设计模式为"on"的iframe
   *
   * @param {HTMLElement} element - 需要检查的DOM元素
   * @returns {boolean} - 如果元素可输入内容则返回true，否则返回false
   */
  function isInputable(element) {
    // 检查元素是否为null或undefined
    if (!element) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();

    // 检查是否被禁用或只读
    if (element.disabled || element.readOnly) {
        return false;
    }

    // 1. 检查是否为textarea
    if (tagName === 'textarea') {
      return true;
    }

    // 2. 检查是否为可输入类型的input
    if (tagName === 'input') {
      const inputableTypes = [
        'text', 'password', 'email', 'number', 'search',
        'tel', 'url', 'date', 'datetime-local', 'time',
        'week', 'month', 'color'
      ];
      return inputableTypes.includes(element.type);
    }

    // 3. 检查是否具有contenteditable属性且值为true
    if (element.isContentEditable) {
      return true;
    }

    // 4. 检查是否有编辑相关的ARIA角色，并且不是只读
    const editableRoles = ['textbox', 'searchbox', 'spinbutton'];
    const role = element.getAttribute('role');
    if (role && editableRoles.includes(role)) {
      const ariaReadOnly = element.getAttribute('aria-readonly');
      return ariaReadOnly !== 'true';
    }

    // 5. 检查是否为iframe中的设计模式
    if (tagName === 'iframe' && element.contentDocument) {
      try {
        // 必须在 try-catch 中，以防跨域错误
        return element.contentDocument.designMode === 'on';
      } catch (e) {
        // 忽略跨域错误
        return false;
      }
    }

    return false;
  }

  /**
   * 确定元素所属的分类和具体类型
   * 分类: 'button', 'link', 'input_and_select', 'other'
   * 类型: 基于 tagName, role, input type 等
   *
   * @param {Element} element - DOM元素
   * @returns {{category: string, type: string}} - 元素的分类和类型
   */
  function getCategoryAndType(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    let category = 'other'; // 默认分类
    let type = role || tagName; // 优先使用role作为类型，否则使用标签名

    // ---- 核心分类逻辑 ----

    // 1. 基于角色 (Role) 确定分类
    if (role) {
      if (['button', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'switch'].includes(role)) {
        category = 'button';
      } else if (['link'].includes(role)) {
        category = 'link';
      } else if ([
        'checkbox', 'combobox', 'listbox', 'menu', 'menubar', 'navigation',
        'option', 'progressbar', 'radio', 'radiogroup', 'scrollbar',
        'searchbox', 'separator', 'slider', 'spinbutton', 'tablist',
        'textbox', 'timer', 'toolbar', 'tree', 'treegrid', 'treeitem'
      ].includes(role)) {
        // 这些通常是输入、选择或复合组件
        category = 'input_and_select';
      }
      // 其他 role 默认归为 'other'
    } else {
      // 2. 基于标签名 (TagName) 确定分类 (仅在没有 role 时)
      if (['button', 'summary', 'details'].includes(tagName)) {
        category = 'button';
      } else if (['a'].includes(tagName)) {
        category = 'link';
      } else if ([
        'input', 'textarea', 'select', 'option', 'optgroup', 'datalist',
        'progress', 'meter', 'output', 'canvas', 'audio', 'video', // 这些与输入、选择或展示有关
        'form', 'fieldset', 'legend', 'label', // 表单相关结构
        'table', 'th', 'tr', 'td', 'tbody', 'thead', 'tfoot', 'col', 'colgroup', // 表格相关
        'ul', 'ol', 'li', 'dl', 'dt', 'dd', // 列表相关
        'nav', 'menuitem', 'menu' // 导航和菜单相关
      ].includes(tagName)) {
        category = 'input_and_select';
      }
      // 其他 tagName 默认归为 'other'
    }

    // ---- 类型细化和特殊处理 ----

    // 3. 细化 input 类型
    if (tagName === 'input') {
      const inputType = element.type?.toLowerCase() || 'text';
      type = inputType; // 将 input 的 type 作为元素类型

      // 特殊：提交、重置、按钮类型的 input 应归类为 'button'
      if (['submit', 'reset', 'button', 'image'].includes(inputType)) {
        category = 'button';
      }
    }

    // 4. 可输入元素强制归类为 'input_and_select'
    if (isInputable(element)) {
      category = 'input_and_select';
      // 如果类型还是默认的 tagName 且不是 textarea 或 input, 细化为 'textbox'
      if (type === tagName && !['textarea', 'input'].includes(tagName)) {
        type = 'textbox';
      }
    }

    // 5. 特殊 ARIA 属性处理 (可能覆盖之前的分类)
    //    仅当元素尚未被明确识别为输入/选择类时，才因 ARIA 属性将其归类为按钮
    const hasPopup = element.getAttribute('aria-haspopup') && element.getAttribute('aria-haspopup') !== 'false';
    const hasControls = element.hasAttribute('aria-controls');
    const hasExpanded = element.hasAttribute('aria-expanded');

    if ((hasPopup || hasControls || hasExpanded) && category !== 'input_and_select') {
      // 只有当它不是输入/选择框 (例如之前判断为 'other' 或 'link' 等) 时，
      // 才因为这些 ARIA 属性将其视为按钮
      category = 'button';
    }

    // 6. 媒体元素和控件强制归类 'input_and_select'
    if (['audio', 'video'].includes(tagName) || element.classList.contains('media-control')) {
      category = 'input_and_select';
    }

    // 7. 与表单关联的元素 (如果之前不是按钮，归为 input_and_select)
    if (element.form && category !== 'button') {
       category = 'input_and_select';
    }

    return { category, type };
  }

  /**
   * 获取页面中的交互式DOM节点
   *
   * 过滤流程：
   * 1. 遍历DOM，找出所有基础交互式节点 (isInteractive)
   * 2. 排除配置中指定的 CSS 类名前缀的元素
   * 3. 白名单机制：保留重要的输入框 (isInputable 且尺寸较大或特殊类型)
   * 4. 对非白名单元素执行过滤：
   *    a. 过滤掉 body 和 大面积元素 (filterLargeElements)
   *    b. 过滤掉 面积极小元素 (filterTinyElements)
   *    c. 过滤掉 异常高宽比元素 (filterAbnormalAspectRatioElements)
   *    d. 过滤掉 被覆盖的元素 (filterOverlappingElements)
   * 5. 合并白名单和过滤后的元素
   *
   * @param {string} scope - 'viewport'仅获取可见元素，'all'获取所有元素
   * @returns {Array<Element>} - 过滤后的交互式DOM节点数组
   */
  function getInteractiveDomNodes(scope = 'viewport') {
    const initialNodes = [];

    // 深度优先遍历DOM树
    function traverse(node) {
      // 检查是否为元素节点
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      // 1. 检查是否为基础交互式节点
      if (isInteractive(node)) {
        // 2. 检查是否需要根据类名前缀排除
        let excludedByClass = false;
        if (config.excludeClassPrefixes && config.excludeClassPrefixes.length > 0 && node.classList) {
          for (const className of node.classList) {
            for (const prefix of config.excludeClassPrefixes) {
              if (className.startsWith(prefix)) {
                excludedByClass = true;
                break; // 找到匹配的前缀，无需再检查其他前缀
              }
            }
            if (excludedByClass) break; // 找到匹配的类名，无需再检查其他类名
          }
        }

        // 只有未被类名排除，且满足 scope 条件的才加入初始列表
        if (!excludedByClass && (scope === 'all' || (scope === 'viewport' && isNodeVisible(node)))) {
          initialNodes.push(node);
        }
      }

      // 递归遍历子节点
      for (const child of node.children) {
        traverse(child);
      }
    }

    // 从document.body开始遍历
    if (document.body) {
      traverse(document.body);
    }

    // 3. 白名单机制
    /**
     * 检查元素是否应该加入白名单 (跳过大部分过滤)
     * 白名单条件:
     * - 可输入的 textarea
     * - 可输入的 contenteditable 元素
     * - 可输入的 input 且尺寸足够大 (宽>50px 且 高>30px)
     *
     * @param {HTMLElement} element - 要检查的元素
     * @returns {boolean} - 是否应该加入白名单
     */
    function shouldWhitelist(element) {
      if (isInputable(element)) {
        const tagName = element.tagName.toLowerCase();
        // 特殊处理多行文本框和富文本编辑器
        if (tagName === 'textarea' || element.isContentEditable) {
          return true;
        }
        // 检查 input 尺寸
        if (tagName === 'input') {
          const rect = element.getBoundingClientRect();
          // 宽度大于50px且高度大于30px的输入框视为有价值
          if (rect.width > 50 && rect.height > 30) {
            return true;
          }
        }
      }
      return false;
    }

    // 将元素分为白名单和需要过滤的两组
    const whitelisted = initialNodes.filter(shouldWhitelist);
    const toFilter = initialNodes.filter(element => !shouldWhitelist(element));

    // 4. 对需要过滤的元素执行完整的过滤流程
    const filteredBySize = filterLargeElements(toFilter);
    const filteredByMinSize = filterTinyElements(filteredBySize);
    const filteredByAspectRatio = filterAbnormalAspectRatioElements(filteredByMinSize);
    const filteredByOverlap = filterOverlappingElements(filteredByAspectRatio); // 最后处理重叠

    // 5. 最终结果是白名单元素加上过滤后的元素
    const finalNodes = [...whitelisted, ...filteredByOverlap];

    // 在返回前为所有最终确定的节点添加 magic-touch-id
    finalNodes.forEach(element => {
      const magicId = generateMagicId(element);
      element.setAttribute('magic-touch-id', magicId);
    });

    return finalNodes;
  }

  /**
   * 获取页面中的交互式元素，并按类别组织
   * @param {string} [scope='viewport'] - 'viewport'仅获取可见元素，'all'获取所有元素
   * @param {string} [categoryFilter='all'] - 指定要获取的元素大类，如'button', 'link', 'input_and_select', 'other', 或 'all' 获取所有
   * @returns {Object} - 按固定大类 ('button', 'link', 'input_and_select', 'other') 分类的交互式元素对象
   */
  function getInteractiveElements(scope = 'viewport', categoryFilter = 'all') {
    // 初始化结果对象，包含所有固定分类
    const result = {
      button: [],
      link: [],
      input_and_select: [],
      other: []
    };

    // 获取过滤后的交互式DOM节点
    const nodes = getInteractiveDomNodes(scope);

    // 处理每个DOM节点，转换为结构化信息并分类
    for (const element of nodes) {
      // 确定元素的分类和类型
      const { category, type: elementType } = getCategoryAndType(element);

      // 获取已设置的 magic-touch-id
      const magicId = element.getAttribute('magic-touch-id');
      // 如果没有 magicId，则跳过此元素或记录错误
      if (!magicId) {
        console.warn("MagicTouch: Element missing magic-touch-id.", element);
        continue; // 跳过这个没有 ID 的元素
      }

      // 构建元素信息对象
      const elementInfo = {
        name: getReadableName(element), // 获取可读名称
        name_en: element.id || null,     // 使用元素ID作为英文名，若无则为null
        type: elementType,              // 元素的具体类型
        selector: `[magic-touch-id="${magicId}"]` // 直接使用属性选择器
      };

      // 添加文本内容（截断，适用于按钮、链接等）
      const innerText = element.innerText?.trim();
      if (innerText) {
        elementInfo.text = innerText.substring(0, config.maxTextLength); // 使用配置值截断长文本
      }

      // 添加值（适用于输入框、选择框等）
      // 检查 value 属性是否存在且不为 null/undefined
      if (element.value !== undefined && element.value !== null) {
        // 对于密码框，不记录具体值
        if (element.type?.toLowerCase() === 'password') {
            elementInfo.value = '********';
        } else {
            elementInfo.value = String(element.value).substring(0, 200); // 转为字符串并截断
        }
      }

      // 对于链接元素，添加href（过滤掉 data: 和 javascript: 协议）
      if (category === 'link' && element.hasAttribute('href')) {
        const href = element.getAttribute('href');
        if (href && !href.startsWith('data:') && !href.startsWith('javascript:')) {
          elementInfo.href = href;
        }
      }

      // 添加到对应分类的数组中 (确保分类存在)
      if (result[category]) {
        result[category].push(elementInfo);
      } else {
        // 如果出现意外的分类（理论上不应发生），放入 'other'
        result.other.push(elementInfo);
        console.warn(`MagicTouch: Element with unexpected category '${category}' found. Added to 'other'.`, element);
      }
    }

    // 如果指定了 categoryFilter 且不是 'all'，只返回该类别的元素
    const validCategories = ['button', 'link', 'input_and_select', 'other'];
    if (categoryFilter !== 'all' && validCategories.includes(categoryFilter)) {
      // 返回一个只包含指定类别键值对的对象
      return { [categoryFilter]: result[categoryFilter] };
    }

    // 否则返回包含所有类别的完整结果对象
    return result;
  }

  // 将核心功能暴露到 window 对象上
  window.MagicTouch = {
    getInteractiveDomNodes: getInteractiveDomNodes,     // 获取原始DOM节点 (主要供内部或调试使用)
    getInteractiveElements: getInteractiveElements, // 获取结构化的元素信息 (主要API)
  };

  // 可以在控制台调用 MagicTouch.getInteractiveElements() 或 MagicTouch.getInteractiveElements('all') 查看结果
  // console.log("MagicTouch initialized. Call MagicTouch.getInteractiveElements() to get elements.");

})();
