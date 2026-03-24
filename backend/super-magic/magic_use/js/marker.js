/**
 * MagicMaker - 高级感交互元素标记工具
 * 在网页可交互元素上绘制彩色边框并在右上角添加字母+数字组合标记
 *
 * 提供两个核心方法：
 * - markElements: 标记页面上所有可交互元素
 * - unmarkElements: 移除所有标记
 *
 * 特性：
 * 1. 两个方法都支持反复调用，无副作用（多次调用效果等同于调用一次）
 * 2. 标记会随着页面滚动、窗口大小变化自动更新位置
 * 3. 动态处理DOM变化，确保新增的交互元素也能被正确标记
 * 4. 每个标记元素右上角显示字母+数字组合的标签
 * 5. 智能判断标签位置，小元素的标签显示在外部，避免遮挡
 * 6. 使用Shadow DOM避免样式污染
 *
 * z-index配置系统：
 * - 支持两种策略模式：fixed(固定值)和relative(相对元素)
 * - 当前使用模式: relative (相对元素z-index的模式)
 * - fixed模式：标记元素使用预设的固定z-index值
 * - relative模式：标记元素使用相对于被标记元素的z-index值
 * - 如需修改，可调整Z_INDEX_CONFIG对象
 *
 * 技术方案说明：
 * - 使用Shadow DOM隔离标记元素的样式，避免与页面样式互相影响
 * - 使用MutationObserver监听DOM结构变化，替代定时器，实现高效的元素检测
 * - 使用ResizeObserver监听窗口尺寸变化，实现精准的位置更新
 * - 实现防抖和批处理机制以优化性能，避免频繁更新
 * - 处理整个body内的交互元素，标记当前屏幕视窗内可见的所有可交互元素
 * - 通过requestAnimationFrame实现高效的视觉更新
 */
// @depends: touch

(function() {
  'use strict';

  // 全局常量定义
  const Z_INDEX = 9999; // 标记层级
  const BORDER_WIDTH = 1; // 边框宽度 (修改为 1px)
  const BORDER_OPACITY = 0.5; // 边框透明度 (0 到 1)
  // 统一使用六种高对比度颜色
  const COLORS = ['#FF0000', '#0000FF', '#FFFF00', '#00FF00', '#FF00FF', '#800080']; // 红色、蓝色、黄色、绿色、粉色、紫色
  const DEBOUNCE_DELAY = 100; // 防抖延迟(毫秒)

  // z-index配置系统 - 灵活配置标记元素的层级
  /**
   * Z_INDEX_CONFIG - 标记元素z-index配置对象
   *
   * 支持两种策略：
   * 1. fixed: 使用固定的z-index值（全局统一值）
   *    - border: 边框z-index
   *    - mask: 遮罩z-index（比边框低1）
   *    - label: 标签z-index（比边框高1）
   *
   * 2. relative: 使用相对于元素的z-index值（当前使用此模式）
   *    - border: 与元素z-index相同(+0)
   *    - mask: 比元素z-index小1(-1)
   *    - label: 比元素z-index大1(+1)
   *
   * 如需所有标记元素显示在最顶层，修改strategy为'fixed'
   * 如需调整相对偏移值，修改relative对象中的值
   */
  const Z_INDEX_CONFIG = {
    strategy: 'relative', // 当前策略: 'fixed'(固定值) 或 'relative'(相对元素z-index)
    fixed: {
      border: Z_INDEX,
      mask: Z_INDEX - 1,
      label: Z_INDEX + 1
    },
    relative: {
      border: 0,     // 与元素z-index相同
      mask: 0,       // 与元素z-index相同
      label: 0       // 与元素z-index相同
    }
  };

  // 标记标签相关常量
  const LABEL_PADDING = 2; // 标签内边距（减小）
  const LABEL_FONT_SIZE = 10; // 标签字体大小（减小）
  const VALID_LETTERS = 'ABCDEFHJKLMNPRSTUVWXYZ'; // 排除了容易混淆的字母 G, I, O, Q
  const VALID_NUMBERS = '23456789'; // 排除了容易混淆的数字 0, 1
  const LABEL_AREA_THRESHOLD = 0.3; // 标签面积与元素面积比例阈值，超过则显示在外部
  const LABEL_OUTSIDE_HEIGHT_THRESHOLD = 30; // 元素高度小于此值时，标签也显示在外部

  // 标记状态
  let isMarking = false;
  // 存储所有创建的标记
  let markers = [];
  // 防抖处理状态
  let updateScheduled = false;
  // Observer 实例
  let mutationObserver = null;
  let resizeObserver = null;
  // Shadow DOM 相关
  let shadowHost = null;
  let shadowRoot = null;

  /**
   * 工具函数集合
   * 包含各种辅助功能，如元素位置计算、颜色生成、可见性检测等
   */
  const utils = {
    /**
     * 创建或获取Shadow DOM
     * 确保只创建一次Shadow DOM容器
     * @return {ShadowRoot} Shadow DOM根节点
     */
    getShadowRoot: () => {
      if (!shadowHost) {
        // 创建宿主元素
        shadowHost = document.createElement('div');
        shadowHost.id = 'magic-marker-host';

        // 设置基础样式，确保不影响页面布局
        Object.assign(shadowHost.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '0',
          height: '0',
          border: 'none',
          padding: '0',
          margin: '0',
          pointerEvents: 'none',
          zIndex: 'auto'
        });

        // 添加到body
        document.body.appendChild(shadowHost);

        // 创建shadow root
        shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      }

      return shadowRoot;
    },

    /**
     * 清理Shadow DOM
     * 移除所有标记元素
     */
    clearShadowRoot: () => {
      if (shadowRoot) {
        // 清空shadow root中的所有内容
        while (shadowRoot.firstChild) {
          shadowRoot.removeChild(shadowRoot.firstChild);
        }
      }
    },

    /**
     * 获取元素位置和尺寸
     * @param {HTMLElement} element - DOM元素
     * @return {Object} 包含元素位置和尺寸的对象
     */
    getElementRect: (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    },

    /**
     * 获取元素实际生效的最高z-index值，考虑所有祖先元素的堆叠上下文
     * @param {HTMLElement} element - DOM元素
     * @return {number} 元素所处层级最高的z-index值
     */
    getElementZIndex: (element) => {
      let maxZIndex = 0;
      let currentElement = element;

      while (currentElement && currentElement !== document.body) {
        const style = window.getComputedStyle(currentElement);
        const position = style.position;
        const zIndex = style.zIndex;
        let currentZIndex = 0; // 当前节点的zIndex值，默认为0

        // 检查是否创建了新的堆叠上下文
        const createsStackingContext =
          ((position !== 'static' && zIndex !== 'auto') || position === 'fixed' || position === 'sticky');

        if (createsStackingContext && zIndex !== 'auto') {
            currentZIndex = parseInt(zIndex, 10) || 0;
        }

        // 只在创建堆叠上下文的元素上比较并更新 maxZIndex
        // 这是因为元素的最终层级是由它所在的最近的堆叠上下文决定的
        // 但我们需要找到这条链上 *所有* 堆叠上下文中的最大值
        if (createsStackingContext) {
           maxZIndex = Math.max(maxZIndex, currentZIndex);
        }

        // 继续向上查找
        currentElement = currentElement.parentElement;
      }

      // 最后还要检查body本身（虽然通常不设置z-index，但以防万一）
      if (document.body) {
          const bodyStyle = window.getComputedStyle(document.body);
          const bodyPosition = bodyStyle.position;
          const bodyZIndex = bodyStyle.zIndex;
          if ((bodyPosition !== 'static' && bodyZIndex !== 'auto') || bodyPosition === 'fixed' || bodyPosition === 'sticky') {
              const parsedBodyZIndex = bodyZIndex === 'auto' ? 0 : parseInt(bodyZIndex, 10) || 0;
              maxZIndex = Math.max(maxZIndex, parsedBodyZIndex);
          }
      }

      // 返回遍历过程中找到的最高z-index值
      return maxZIndex;
    },

    /**
     * 计算标记元素的z-index
     * @param {HTMLElement} element - 要标记的DOM元素
     * @param {string} type - 标记类型('border', 'mask', 'label')
     * @return {number} 计算出的z-index值
     */
    calculateZIndex: (element, type) => {
      if (Z_INDEX_CONFIG.strategy === 'fixed') {
        return Z_INDEX_CONFIG.fixed[type];
      } else {
        const baseZIndex = utils.getElementZIndex(element);
        const offset = Z_INDEX_CONFIG.relative[type];
        return Math.max(0, baseZIndex + offset);
      }
    },

    /**
     * 创建一个唯一ID
     * @return {string} 随机生成的唯一标识符
     */
    generateUniqueId: () => {
      return 'marker-' + Math.random().toString(36).substring(2, 8);
    },

    /**
     * 添加一个X字符到页面以改变textContent
     * 用于触发某些特定场景下的重新渲染
     */
    insertXCharacter: () => {
      const xElement = document.createElement('span');
      xElement.textContent = 'X';
      xElement.style.opacity = '1';
      xElement.style.position = 'absolute';
      xElement.style.visibility = 'hidden';
      xElement.style.pointerEvents = 'none';
      xElement.id = 'magic-x-marker-' + Date.now();

      // 将X字符添加到Shadow DOM中
      const shadow = utils.getShadowRoot();
      shadow.appendChild(xElement);

      // 延迟移除以确保触发重绘
      setTimeout(() => {
        if (xElement.parentNode) {
          xElement.parentNode.removeChild(xElement);
        }
      }, 100);
    },

    /**
     * 获取循环使用的颜色
     * @param {number} index - 元素索引
     * @return {string} 颜色代码
     */
    getColor: (index) => {
      return COLORS[index % COLORS.length];
    },

    /**
     * 生成字母+数字组合标记，避开容易混淆的字符
     * @param {number} index - 元素索引
     * @return {string} 字母+数字组合的标记文本
     */
    generateLabelText: (index) => {
      const letterIndex = Math.floor(index / VALID_NUMBERS.length) % VALID_LETTERS.length;
      const numberIndex = index % VALID_NUMBERS.length;

      const letter = VALID_LETTERS.charAt(letterIndex);
      const number = VALID_NUMBERS.charAt(numberIndex);

      return letter + number;
    },

    /**
     * 估算标签的尺寸
     * @param {string} labelText - 标签文本
     * @return {Object} 包含标签宽度、高度和面积的对象
     */
    estimateLabelSize: (labelText) => {
      const width = (labelText.length * LABEL_FONT_SIZE) + (LABEL_PADDING * 2);
      const height = LABEL_FONT_SIZE + (LABEL_PADDING * 2);
      return {
        width: width,
        height: height,
        area: width * height
      };
    },

    /**
     * 判断标签是否应该放在元素外部
     * @param {Object} labelSize - 标签尺寸信息
     * @param {Object} elementRect - 元素尺寸信息
     * @return {boolean} true表示应该放在外部，false表示放在内部
     */
    shouldPlaceLabelOutside: (labelSize, elementRect) => {
      const elementArea = elementRect.width * elementRect.height;
      // 新增条件：如果元素高度小于阈值，也放在外部
      return labelSize.area > (elementArea * LABEL_AREA_THRESHOLD) || elementRect.height < LABEL_OUTSIDE_HEIGHT_THRESHOLD;
    },

    /**
     * 防抖函数
     * @param {Function} func - 需要防抖的函数
     * @param {number} delay - 延迟时间(毫秒)
     * @return {Function} 防抖处理后的函数
     */
    debounce: (func, delay) => {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
        }, delay);
      };
    },
  };

  /**
   * 创建器 - 负责创建标记元素
   * 包含创建边框、遮罩和标签的函数
   */
  const creator = {
    /**
     * 创建边框元素
     * @param {HTMLElement} element - 要标记的DOM元素
     * @param {Object} rect - 元素位置和尺寸
     * @param {string} color - 边框颜色
     * @return {HTMLElement} 创建的边框元素
     */
    createBorder: (element, rect, color) => {
      const border = document.createElement('div');
      border.className = 'magic-marker-border';

      // 计算z-index
      const borderZIndex = utils.calculateZIndex(element, 'border');

      // 将颜色转换为 RGBA 并设置透明度
      let rgbaColor = color;
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        rgbaColor = `rgba(${r}, ${g}, ${b}, ${BORDER_OPACITY})`; // 使用配置的透明度
      }

      Object.assign(border.style, {
        position: 'absolute',
        zIndex: borderZIndex.toString(),
        top: `${rect.y}px`,
        left: `${rect.x}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: `${BORDER_WIDTH}px solid ${rgbaColor}`, // 使用转换后的颜色
        boxSizing: 'border-box',
        pointerEvents: 'none',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.5), 0 0 5px rgba(0,0,0,0.3)`
      });

      return border;
    },

    /**
     * 创建半透明遮罩
     * @param {HTMLElement} element - 要标记的DOM元素
     * @param {Object} rect - 元素位置和尺寸
     * @param {string} color - 遮罩颜色
     * @return {HTMLElement} 创建的遮罩元素
     */
    createMask: (element, rect, color) => {
      const mask = document.createElement('div');
      mask.className = 'magic-marker-mask';

      // 计算z-index
      const maskZIndex = utils.calculateZIndex(element, 'mask');

      // 提取RGB值以便设置透明度
      let rgbColor = color;
      if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        rgbColor = `rgba(${r}, ${g}, ${b}, 0.15)`; // 低透明度避免影响阅读
      }

      Object.assign(mask.style, {
        position: 'absolute',
        zIndex: maskZIndex.toString(),
        top: `${rect.y}px`,
        left: `${rect.x}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor: rgbColor,
        boxSizing: 'border-box',
        pointerEvents: 'none'
      });

      return mask;
    },

    /**
     * 创建标签元素基本样式对象
     * @param {HTMLElement} element - 要标记的DOM元素
     * @param {string} color - 标签背景颜色
     * @return {Object} 标签基本样式对象
     */
    createLabelBaseStyles: (element, color) => {
      // 计算z-index
      const labelZIndex = utils.calculateZIndex(element, 'label');

      // 为特定颜色设置对比色文字
      let textColor = '#FFFFFF'; // 默认白色文字

      // 亮色背景使用黑色文字
      if (color === '#FFFF00' || color === '#00FF00') { // 黄色和绿色背景使用黑色文字
        textColor = '#000000';
      }

      return {
        position: 'absolute',
        zIndex: labelZIndex.toString(),
        backgroundColor: color,
        color: textColor,
        fontSize: `${LABEL_FONT_SIZE}px`,
        fontWeight: 'bold',
        lineHeight: 1,
        padding: `${LABEL_PADDING}px`,
        borderRadius: '3px',
        boxShadow: '0 0 3px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        userSelect: 'none',
        minWidth: '12px',
        textAlign: 'center',
        opacity: 0.7
      };
    },

    /**
     * 计算内部标签的位置样式
     * @param {Object} rect - 元素位置和尺寸
     * @return {Object} 内部标签位置样式
     */
    createInnerLabelPositionStyles: (rect) => {
      return {
        top: `${rect.y}px`,
        left: `${rect.x + rect.width}px`,
        transform: 'translate(-100%, 0)'
      };
    },

    /**
     * 计算外部标签的位置样式
     * @param {Object} rect - 元素位置和尺寸
     * @param {Object} labelSize - 标签尺寸信息
     * @return {Object} 外部标签位置样式
     */
    createOuterLabelPositionStyles: (rect, labelSize) => {
      return {
        top: `${rect.y - labelSize.height}px`,
        left: `${rect.x + rect.width}px`,
        transform: 'translate(-100%, 0)'
      };
    },

    /**
     * 创建右上角标签
     * @param {HTMLElement} element - 要标记的DOM元素
     * @param {Object} rect - 元素位置和尺寸
     * @param {number} index - 元素索引
     * @param {string} color - 标签颜色
     * @return {HTMLElement} 创建的标签元素
     */
    createLabel: (element, rect, index, color) => {
      const label = document.createElement('div');
      label.className = 'magic-marker-label';

      // 生成标签文本 (字母+数字组合)
      const labelText = utils.generateLabelText(index);
      label.textContent = labelText;

      // 估算标签尺寸
      const labelSize = utils.estimateLabelSize(labelText);

      // 判断标签是否应该放在外部
      const shouldPlaceOutside = utils.shouldPlaceLabelOutside(labelSize, rect);

      // 创建基本样式
      const labelStyles = creator.createLabelBaseStyles(element, color);

      // 根据位置决定添加不同的位置样式
      if (shouldPlaceOutside) {
        // 放在外部右上角
        Object.assign(labelStyles, creator.createOuterLabelPositionStyles(rect, labelSize));
      } else {
        // 放在内部右上角
        Object.assign(labelStyles, creator.createInnerLabelPositionStyles(rect));
      }

      // 应用样式
      Object.assign(label.style, labelStyles);

      // 存储标签位置信息，用于更新位置
      label.dataset.placement = shouldPlaceOutside ? 'outside' : 'inside';
      label.dataset.estimatedWidth = labelSize.width;
      label.dataset.estimatedHeight = labelSize.height;

      return label;
    }
  };

  /**
   * 标记管理器 - 负责标记的创建、更新和移除
   */
  const markerManager = {
    /**
     * 创建标记并添加到Shadow DOM
     * @param {HTMLElement} element - 需要标记的DOM元素
     * @param {number} index - 元素索引
     * @return {HTMLElement} 创建的边框元素
     */
    createMarker: (element, index) => {
      // 确保已创建Shadow DOM
      const shadow = utils.getShadowRoot();

      const rect = utils.getElementRect(element);
      const color = utils.getColor(index);

      // 创建边框
      const border = creator.createBorder(element, rect, color);
      shadow.appendChild(border);

      // 创建半透明遮罩
      const mask = creator.createMask(element, rect, color);
      shadow.appendChild(mask);

      // 创建标签
      const label = creator.createLabel(element, rect, index, color);
      shadow.appendChild(label);

      // 存储DOM元素引用和边框元素的映射
      markers.push({
        element: element,
        border: border,
        mask: mask,
        label: label,
        index: index
      });

      return border;
    },

    /**
     * 清除所有标记
     * 移除Shadow DOM中的所有标记元素
     */
    clearMarkers: () => {
      // 清空所有标记元素
      utils.clearShadowRoot();

      // 清空标记数组
      markers = [];
    },

    /**
     * 更新标记边框和遮罩的位置
     * @param {Object} marker - 标记对象
     * @param {Object} rect - 元素的新位置和尺寸
     */
    updateBorderAndMask: (marker, rect) => {
      const border = marker.border;
      const mask = marker.mask;

      // 更新边框位置
      border.style.top = `${rect.y}px`;
      border.style.left = `${rect.x}px`;
      border.style.width = `${rect.width}px`;
      border.style.height = `${rect.height}px`;

      // 更新遮罩位置
      if (mask) {
        mask.style.top = `${rect.y}px`;
        mask.style.left = `${rect.x}px`;
        mask.style.width = `${rect.width}px`;
        mask.style.height = `${rect.height}px`;
      }
    },

    /**
     * 更新标签位置
     * @param {Object} marker - 标记对象
     * @param {Object} rect - 元素的新位置和尺寸
     */
    updateLabel: (marker, rect) => {
      const label = marker.label;
      if (!label) return;

      // 获取标签放置位置信息
      const placement = label.dataset.placement;
      const estimatedWidth = parseFloat(label.dataset.estimatedWidth || '0');
      const estimatedHeight = parseFloat(label.dataset.estimatedHeight || '0');

      if (placement === 'outside') {
        // 外部标签位置更新
        label.style.top = `${rect.y - estimatedHeight}px`;
        label.style.left = `${rect.x + rect.width}px`;
        label.style.transform = 'translate(-100%, 0)';
      } else {
        // 内部标签位置更新
        label.style.top = `${rect.y}px`;
        label.style.left = `${rect.x + rect.width}px`;
      }
    },

    /**
     * 更新所有标记的位置
     * 当页面滚动或元素位置变化时调用
     */
    updateMarkers: () => {
      if (!isMarking || markers.length === 0) return;

      // 使用requestAnimationFrame进行视觉更新，提高性能
      if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
          markers.forEach(marker => {
            // 获取元素的新位置
            const rect = utils.getElementRect(marker.element);

            // 更新边框和遮罩
            markerManager.updateBorderAndMask(marker, rect);

            // 更新标签
            markerManager.updateLabel(marker, rect);
          });
          updateScheduled = false;
        });
      }
    }
  };

  /**
   * Observer管理器 - 负责管理DOM变化观察
   */
  const observerManager = {
    /**
     * 初始化所有观察者
     * 创建并配置MutationObserver和ResizeObserver
     */
    initObservers: () => {
      // 创建并配置MutationObserver
      mutationObserver = new MutationObserver(utils.debounce((mutations) => {
        if (isMarking) {
          refreshMarkers();
        }
      }, DEBOUNCE_DELAY));

      // 创建并配置ResizeObserver - 监听窗口尺寸变化
      resizeObserver = new ResizeObserver(utils.debounce(() => {
        if (isMarking) {
          markerManager.updateMarkers();
        }
      }, DEBOUNCE_DELAY));
    },

    /**
     * 启动观察
     * 开始监听DOM变化和窗口尺寸变化
     */
    startObserving: () => {
      // 观察整个body的DOM变化
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: false,
        attributeFilter: ['style', 'class', 'hidden', 'display', 'visibility']
      });

      // 观察窗口尺寸变化
      resizeObserver.observe(document.documentElement);
    },

    /**
     * 停止观察
     * 断开所有Observer连接
     */
    stopObserving: () => {
      if (mutationObserver) {
        mutationObserver.disconnect();
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    }
  };

  /**
   * 事件处理器 - 负责事件监听和处理
   */
  const eventHandler = {
    /**
     * 滚动时更新标记
     * 使用防抖减少频繁更新
     */
    handleScroll: utils.debounce(() => {
      if (isMarking) {
        refreshMarkers();
      }
    }, DEBOUNCE_DELAY),

    /**
     * 初始化事件监听
     * 添加滚动事件监听器
     */
    initEvents: () => {
      window.addEventListener('scroll', eventHandler.handleScroll);
    },

    /**
     * 移除事件监听
     * 清理滚动事件监听器
     */
    removeEvents: () => {
      window.removeEventListener('scroll', eventHandler.handleScroll);
    }
  };

  /**
   * 移除消失或隐藏的元素标记
   * @param {Array} currentElements - 当前所有交互元素
   * @return {Array} 过滤后仍存在且可见的标记
   */
  function removeInvalidMarkers(currentElements) {
    return markers.filter(marker => {
      // 检查元素是否仍在DOM中且在当前可交互元素列表中
      const stillExists = document.body.contains(marker.element) &&
                          currentElements.some(el => el === marker.element);

      if (!stillExists) {
        // 从Shadow DOM中移除标记元素
        if (marker.border && marker.border.parentNode) {
          marker.border.parentNode.removeChild(marker.border);
        }
        if (marker.mask && marker.mask.parentNode) {
          marker.mask.parentNode.removeChild(marker.mask);
        }
        if (marker.label && marker.label.parentNode) {
          marker.label.parentNode.removeChild(marker.label);
        }
        return false;
      }
      return true;
    });
  }

  /**
   * 为新元素创建标记
   * @param {Array} currentElements - 当前所有交互元素
   * @param {Set} markedElements - 已标记的元素集合
   */
  function createMarkersForNewElements(currentElements, markedElements) {
    // 找出未标记的新元素，getInteractiveDomNodes('viewport')已经过滤了可见元素，不需要再次检查
    const newElements = currentElements.filter(el => !markedElements.has(el));

    // 为新元素创建标记
    newElements.forEach((element, i) => {
      const index = markers.length + i; // 保持颜色序列连续
      markerManager.createMarker(element, index);
    });
  }

  /**
   * 刷新所有标记
   * 用于DOM变化时调用，更新页面上的标记
   */
  function refreshMarkers() {
    if (!isMarking) return;

    // 获取当前所有交互元素
    const currentElements = window.MagicTouch.getInteractiveDomNodes('viewport');

    // 移除已经消失或隐藏的元素的标记
    markers = removeInvalidMarkers(currentElements);

    // 找出已标记的元素集合
    const markedElements = new Set(markers.map(m => m.element));

    // 为新元素创建标记
    createMarkersForNewElements(currentElements, markedElements);

    // 重新分配所有标记的索引和颜色
    reassignColorsAndIndices();

    // 更新所有标记位置
    markerManager.updateMarkers();
  }

  /**
   * 重新分配所有标记的索引和颜色
   * 确保颜色分配均匀
   */
  function reassignColorsAndIndices() {
    // 重新为每个标记分配索引和颜色
    markers.forEach((marker, newIndex) => {
      // 更新索引
      marker.index = newIndex;

      // 获取新颜色
      const newColor = utils.getColor(newIndex);

      // 更新边框颜色和透明度
      if (marker.border) {
          let newRgbaColor = newColor;
          if (newColor.startsWith('#')) {
            const r = parseInt(newColor.slice(1, 3), 16);
            const g = parseInt(newColor.slice(3, 5), 16);
            const b = parseInt(newColor.slice(5, 7), 16);
            newRgbaColor = `rgba(${r}, ${g}, ${b}, ${BORDER_OPACITY})`; // 使用配置的透明度
          }
        marker.border.style.border = `${BORDER_WIDTH}px solid ${newRgbaColor}`; // 更新整个 border 样式
      }

      // 更新标签文本和样式
      if (marker.label) {
        marker.label.textContent = utils.generateLabelText(newIndex);

        // 使用createLabelBaseStyles获取标签样式
        const labelStyles = creator.createLabelBaseStyles(marker.element, newColor);
        marker.label.style.backgroundColor = labelStyles.backgroundColor;
        marker.label.style.color = labelStyles.color;
      }

      // 更新遮罩颜色 - 直接计算RGBA颜色
      if (marker.mask && newColor.startsWith('#')) {
        // 提取RGB值以便设置透明度
        const r = parseInt(newColor.slice(1, 3), 16);
        const g = parseInt(newColor.slice(3, 5), 16);
        const b = parseInt(newColor.slice(5, 7), 16);
        const rgbColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
        marker.mask.style.backgroundColor = rgbColor;
      }
    });
  }

  /**
   * 标记页面上所有可交互元素
   *
   * 特性：
   * - 可以反复调用，不会重复创建标记
   * - 标记会随着页面变化自动更新位置
   * - 支持动态添加的元素的标记
   * - 每个元素右上角显示字母+数字组合的标签
   * - 使用Shadow DOM隔离样式，避免样式污染
   *
   * @returns {number} 标记的元素数量
   */
  function mark() {
    // 如果已经在标记状态，只刷新标记而不重新创建
    if (isMarking) {
      refreshMarkers();
      return markers.length;
    }

    // 设置标记状态为激活
    isMarking = true;

    // 初始化Observer（如果尚未初始化）
    if (!mutationObserver) {
      observerManager.initObservers();
    }

    // 确保已初始化Shadow DOM
    utils.getShadowRoot();

    // 清除可能存在的旧标记
    markerManager.clearMarkers();

    // 添加X字符到页面
    utils.insertXCharacter();

    // 获取所有可见的可交互元素并创建标记
    const domElements = window.MagicTouch.getInteractiveDomNodes('viewport');
    // getInteractiveDomNodes('viewport')已经返回可见元素，不需要再次过滤

    domElements.forEach((domElement, index) => {
      markerManager.createMarker(domElement, index);
    });

    // 启动观察
    observerManager.startObserving();

    // 初始化事件监听
    eventHandler.initEvents();

    return markers.length;
  }

  /**
   * 移除所有元素标记
   *
   * 特性：
   * - 可以反复调用，无副作用
   * - 会清理所有相关资源和事件监听
   * - 移除Shadow DOM中的所有标记元素
   */
  function unmark() {
    // 如果已经是未标记状态，不执行任何操作
    if (!isMarking) return;

    // 设置标记状态为未激活
    isMarking = false;

    // 停止观察
    observerManager.stopObserving();

    // 移除事件监听
    eventHandler.removeEvents();

    // 清除所有标记
    markerManager.clearMarkers();

    // 添加X字符到页面
    utils.insertXCharacter();

    // 可选：移除Shadow Host（如果不希望保留DOM节点）
    if (shadowHost && shadowHost.parentNode) {
      shadowHost.parentNode.removeChild(shadowHost);
      shadowHost = null;
      shadowRoot = null;
    }
  }

  /**
   * 通过标签文本查找对应元素的 magic-touch-id
   *
   * @param {string} labelText - 标签文本（如"A2"）
   * @returns {string|null} 找到对应元素则返回其 magic-touch-id，否则返回 null
   */
  function find(labelText) {
    // 直接将查找逻辑放在这里
    if (!isMarking || !labelText || typeof labelText !== 'string') {
      return null;
    }

    // 将标签文本标准化为大写
    const normalizedLabelText = labelText.trim().toUpperCase();

    // 使用 Array.prototype.find 查找匹配的标记
    const foundMarker = markers.find(marker =>
      marker.label && marker.label.textContent === normalizedLabelText
    );

    // 如果找到标记，返回其元素的 magic-touch-id，否则返回 null
    return foundMarker ? foundMarker.element.getAttribute('magic-touch-id') : null;
  }

  // 暴露公共接口
  window.MagicMarker = {
    mark: mark,
    unmark: unmark,
    find: find
  };
})();
