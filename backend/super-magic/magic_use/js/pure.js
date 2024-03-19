/**
 * MagicPure - 让你的网页变得纯净，自动关闭干扰元素
 *
 * 功能说明：
 * 此脚本用于自动检测并关闭网页中的各类弹窗、横幅、通知和Cookie提示等干扰元素。
 * 适用于绝大多数网站的常见弹窗类型，包括但不限于：
 * - Cookie 同意提示
 * - 广告弹窗
 * - 登录提示
 * - 新闻通知
 * - 各类模态窗口
 *
 * 工作原理：
 * 1. 在DOM加载完成后，脚本会定期扫描页面元素
 * 2. 通过多种标识符（文本内容、类名、属性值等）识别可能的关闭按钮
 * 3. 对符合条件的元素执行点击操作
 * 4. 包含两次扫描检查，确保处理延迟加载的弹窗
 *
 * 配置与扩展：
 * - 所有检测规则都在 config 对象中定义，可根据需要扩展
 * - 可以调整关键词列表、类名匹配、属性检查等配置项
 * - 检查间隔时间可通过 checkIntervalMs 修改
 * - 支持自定义规则集，针对特定网站设置特殊处理规则
 *
 * 使用方法：
 * 1. 将此脚本添加到网页中
 * 2. 脚本会自动运行并处理弹窗
 * 3. 无需用户干预
 *
 * 注意事项：
 * - 脚本使用自执行函数包装，不会污染全局命名空间
 * - 所有操作都在控制台中记录，便于调试
 * - 设计时考虑了性能和兼容性，避免过度查询DOM
 */

(function () {
    /**
     * 配置项：定义用于查找元素的关键词和属性
     */
    const config = {
        // 两次检查之间的延迟时间（毫秒）
        checkIntervalMs: 200,

        // 文本内容或属性值中表示"关闭"或"跳过"意图的关键词 (小写)
        closeKeywords: ['skip', '跳过', 'close', '关闭', 'dismiss'],
        // 文本内容或属性值中表示"接受"或"同意"意图的关键词 (小写)
        acceptKeywords: ['accept', 'agree', '同意', 'got it', '我知道了'],
        // 与 acceptKeywords 结合使用的关键词 (例如 "accept cookie", "accept all")
        acceptModifiers: ['cookie', 'all'],
        // 需要检查的属性列表及其对应的关键词
        attributesToCheck: {
            'value': ['关闭'], // value 属性通常是精确匹配
            'aria-label': ['关闭', 'close', 'dismiss', '×', 'x'],
            'title': ['关闭', 'close', 'dismiss', '×', 'x']
        },
        // class 名称中可能包含的指示性关键词 (小写)
        classKeywords: ['close', 'dismiss', 'accept', 'cookie', 'modal', '__close', '-close', 'overlay-dismiss', 'popup-close', 'popup__close'],
        // 排除的类名关键词，包含这些关键词的元素会被忽略（避免误点击普通内容）
        excludeClassKeywords: ['banner-left', 'banner-item', 'banner-info', 'info', 'content', 'navigation', 'menu', 'nav-item', 'article', 'popup-login', 'login', 'register', '登录', '注册'],
        // 排除的文本内容关键词，包含这些文本的元素会被忽略
        excludeTextKeywords: ['登录', '注册', 'login', 'register', 'sign in', 'sign up'],

        // 自定义规则集：针对特定网站的专用规则
        customRules: [
            {
                // CSDN博客规则 - 关闭登录弹窗
                domain: 'blog.csdn.net',
                selectors: [
                    '#passportbox > img',
                    'body > div.passport-login-tip-container.false > span'
                ],
                description: 'CSDN博客登录弹窗关闭按钮'
            }
            // 可以继续添加更多网站的规则
        ]
    };

    // 执行控制变量
    const maxClicks = 2;            // 最多允许的点击次数
    const totalDurationMs = 5000;   // 总检查时长 (毫秒)

    /**
     * 获取当前网站的域名
     * @returns {string} 当前网站的域名
     */
    function getCurrentDomain() {
        return window.location.hostname;
    }

    /**
     * 检查并应用自定义规则
     * @returns {boolean} 如果成功触发了自定义规则点击，返回true，否则返回false
     */
    function applyCustomRules() {
        const currentDomain = getCurrentDomain();

        // 查找匹配当前域名的自定义规则
        for (const rule of config.customRules) {
            if (currentDomain.includes(rule.domain)) {
                console.log(`找到匹配当前域名(${currentDomain})的自定义规则:`, rule.description);

                // 使用自定义选择器查找元素
                const elements = rule.selectors.map(selector => {
                    const element = document.querySelector(selector);
                    if (!element) {
                        console.log(`自定义规则选择器未找到元素:`, selector);
                    }
                    return element;
                }).filter(element => element !== null); // 过滤掉未找到的元素

                if (elements.length === 0) {
                    console.log(`自定义规则的所有选择器都未找到可用元素`);
                    continue; // 继续检查下一条规则
                }

                // 遍历找到的元素，尝试点击第一个可见的元素
                for (const element of elements) {
                    if (typeof element.click === 'function' && isElementVisible(element)) {
                        console.log(`应用自定义规则，点击元素:`, element);
                        try {
                            // 创建并分发 mousedown 事件
                            const mouseDownEvent = new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            element.dispatchEvent(mouseDownEvent);

                            // 创建并分发 mouseup 事件
                            const mouseUpEvent = new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            element.dispatchEvent(mouseUpEvent);

                            // 创建并分发 click 事件
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            element.dispatchEvent(clickEvent);

                            console.log(`自定义规则元素点击成功。`);
                            return true; // 点击成功，返回true
                        } catch (clickError) {
                            console.error(`应用自定义规则点击元素时出错:`, element, clickError);
                        }
                    } else {
                        console.log(`元素找到但不可见或不可点击`);
                    }
                }

                console.log(`已尝试所有选择器，但没有找到可见且可点击的元素`);
            }
        }

        return false; // 没有找到匹配的规则或没有成功点击任何元素
    }

    /**
     * 检查单个元素是否符合自动关闭/接受的条件
     * @param {Element} element 要检查的元素
     * @returns {boolean} 如果元素符合条件则返回 true
     */
    function elementMatchesCriteria(element) {
        const text = (element.textContent || '').trim().toLowerCase();
        const classListStr = Array.from(element.classList).join(' ').toLowerCase();

        // 0. 首先检查是否包含排除类名，如果有则直接排除
        if (config.excludeClassKeywords.some(kw => classListStr.includes(kw))) {
            return false;
        }

        // 0.1 检查是否包含排除文本内容，如果有则直接排除
        if (config.excludeTextKeywords && config.excludeTextKeywords.some(kw => text.includes(kw))) {
            return false;
        }

        // 1. 检查文本内容
        if (config.closeKeywords.some(kw => text.includes(kw))) return true;
        const isAcceptKeywordMatch = config.acceptKeywords.some(kw => text.includes(kw));
        if (isAcceptKeywordMatch) {
            // 检查是否包含修饰词 (cookie/all) 或只是单独的接受词
            if (config.acceptModifiers.some(mod => text.includes(mod)) || !text.includes(' ')) {
                return true;
            }
            // 精确匹配单个接受词 (如按钮只有 "Accept")
            if (config.acceptKeywords.some(akw => text === akw)) return true;
        }

        // 2. 检查指定属性
        for (const attrName in config.attributesToCheck) {
            const attrValue = (element.getAttribute(attrName) || '');
            const keywords = config.attributesToCheck[attrName];
            const checkValue = (attrName === 'value') ? attrValue : attrValue.toLowerCase(); // value 精确匹配，其他小写比较
            if (keywords.some(kw => checkValue.includes(kw))) {
                return true;
            }
        }

        // 3. 检查 Class 列表 - 更精确的匹配以避免误判
        if (config.classKeywords.some(kw => {
            // 只匹配完整的类名部分，例如 "close" 匹配 "btn-close" 和 "close-btn"，但不匹配 "closeable"
            const parts = classListStr.split(' ');
            return parts.some(part =>
                part === kw ||
                part.startsWith(kw + '-') ||
                part.endsWith('-' + kw) ||
                part.includes('-' + kw + '-')
            );
        })) return true;

        return false;
    }

    /**
     * 检查元素及其所有祖先元素在DOM中是否实际可见并且尺寸大于0。
     * 关键点：一个元素只有在其所有祖先元素也都可见（未被CSS隐藏）时，才算真正可见。
     * @param {Element | null} el 要检查的元素
     * @returns {boolean} 如果元素及其所有祖先都被认为是可见的，则返回 true
     */
    function isElementVisible(el) {
        if (!el) {
            return false; // 无效元素
        }

        // 检查元素自身及其祖先
        let elementToCheck = el;
        // 向上遍历DOM树，直到document.body或没有父元素为止
        while (elementToCheck && elementToCheck !== document.body) {
            const style = window.getComputedStyle(elementToCheck);

            // 检查 CSS 可见性属性：display, visibility, opacity
            // 任何一级祖先的这些属性为隐藏状态，则目标元素实际不可见
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
                // 无需在此处打印日志，调用者可以根据需要打印
                return false; // 元素或其祖先被 CSS 隐藏
            }

            // 检查尺寸和offsetParent：只对原始目标元素进行此检查
            // 原因：父元素的尺寸为0（例如height: 0）不一定意味着子元素不可见（如 overflow: visible）
            // 但目标元素自身必须有实际尺寸且在布局流中（offsetParent !== null）才算可见
            if (elementToCheck === el) {
                const rect = el.getBoundingClientRect();
                // 检查宽度、高度是否大于0，以及元素是否在渲染树中 (offsetParent不为null)
                if (!(rect.width > 0 && rect.height > 0 && el.offsetParent !== null)) {
                    // console.log("元素自身不可见 (尺寸/offsetParent):", el, rect); // 调试时可取消注释
                    return false;
                }
            }

            // 移动到父元素继续检查
            elementToCheck = elementToCheck.parentElement;
        }

        // 如果循环完成，说明从元素到body的路径上所有元素CSS可见性OK，且元素自身尺寸OK
        return true;
    }

    /**
     * 单次检查并尝试关闭干扰元素。
     * 查找页面上第一个可见且符合条件的关闭/接受按钮/链接，并尝试点击。
     * @returns {boolean} 如果成功触发了一次点击，则返回 true，否则返回 false。
     */
    function autoCloseAnnoyances() {
        // console.log("执行单次检查..."); // 减少日志量

        try {
            // 首先尝试应用自定义规则
            if (applyCustomRules()) {
                return true; // 如果自定义规则成功应用，直接返回成功
            }

            // 1. 选择候选元素 - 更精确的选择器，避免选择登录按钮等
            const candidateSelector = 'button, [role="button"], a[class*="close"], a[class*="dismiss"], a[class*="cookie"], a[class*="popup-close"], a[class*="popup__close"], span[class*="close"], span[title*="close"], span[aria-label*="close"], div[class*="close"], div[title*="close"], [class*="close-icon"], [class*="closeButton"]';
            const candidateElements = document.querySelectorAll(candidateSelector);

            // console.log(`找到 ${candidateElements.length} 个候选元素。`); // 减少日志量

            // 2. 遍历并查找第一个可见且符合条件的元素
            for (const element of candidateElements) {
                // 检查元素是否有效、可见且符合条件
                if (element && typeof element.click === 'function' && isElementVisible(element) && elementMatchesCriteria(element)) {
                    // 直接打印找到的 DOM 节点
                    console.log("找到第一个可见且符合条件的元素:", element);
                    // 3. 模拟鼠标事件点击找到的第一个元素
                    try {
                        console.log(`正在模拟点击该元素:`, element);
                        // 创建并分发 mousedown 事件
                        const mouseDownEvent = new MouseEvent('mousedown', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        element.dispatchEvent(mouseDownEvent);

                        // 创建并分发 mouseup 事件
                        const mouseUpEvent = new MouseEvent('mouseup', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        element.dispatchEvent(mouseUpEvent);

                        // （可选）再分发一个 click 事件以确保兼容性
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        element.dispatchEvent(clickEvent);

                        console.log(`元素模拟点击成功。`);
                    } catch (clickError) {
                        console.error(`模拟点击元素时出错:`, element, clickError);
                    }
                    // 点击成功后立即返回 true
                    // console.log("本轮检查成功点击一个元素。"); // 日志已在上层处理
                    return true; // 表示本次检查执行了点击
                }
            }

            // 如果循环结束都没有找到符合条件的可见元素
            // console.log("本轮检查未找到符合条件且可见的可点击元素。");
            return false; // 表示本次检查未执行点击

        } catch (error) {
            console.error("执行查询或处理元素时出错:", error);
            return false; // 出错也视为未点击
        }
    }

    // === 执行 ===
    /**
     * 启动周期性检查流程
     */
    function startPeriodicChecks() {
        console.log(`DOM 已加载，开始周期性检查干扰元素... (每 ${config.checkIntervalMs}ms 检查一次, 最多持续 ${totalDurationMs / 1000}s, 最多点击 ${maxClicks} 次)`);

        let clickCounter = 0;
        const startTime = Date.now();
        let intervalId = null; // 用于存储 setInterval 返回的 ID

        /**
         * 执行单次检查，并根据结果更新状态或停止检查
         */
        function performCheck() {
            const elapsedTime = Date.now() - startTime;

            // console.log(`执行检查 #${Math.floor(elapsedTime / config.checkIntervalMs) + 1} (已耗时 ${elapsedTime}ms, 已点击 ${clickCounter} 次)`);

            // 尝试关闭干扰元素
            const clickedThisTime = autoCloseAnnoyances();

            if (clickedThisTime) {
                clickCounter++;
                console.log(`点击计数增加: ${clickCounter}/${maxClicks}`);
            }

            // 检查停止条件
            const timeLimitReached = elapsedTime >= totalDurationMs;
            const clickLimitReached = clickCounter >= maxClicks;

            if (timeLimitReached || clickLimitReached) {
                clearInterval(intervalId); // 使用 intervalId 停止定时器
                if (clickLimitReached) {
                    console.log(`已达到最大点击次数 (${maxClicks}), 停止检查。`);
                }
                if (timeLimitReached) {
                    console.log(`已达到最大检查时长 (${totalDurationMs / 1000}s), 停止检查。`);
                }
                console.log(`总耗时: ${Date.now() - startTime}ms, 总点击次数: ${clickCounter}`);
            }
        }

        // 立即执行第一次检查，避免初始延迟
        // 并且只有在第一次检查未满足停止条件时才设置定时器
        performCheck();
        if (clickCounter < maxClicks && (Date.now() - startTime) < totalDurationMs) {
            intervalId = setInterval(performCheck, config.checkIntervalMs);
        } else {
             // 如果第一次检查就满足了停止条件，也打印最终状态
             console.log(`首次检查后即停止。总耗时: ${Date.now() - startTime}ms, 总点击次数: ${clickCounter}`);
        }
    }

    // 检查 DOM 加载状态并安排执行
    if (document.readyState === 'loading') {
        // 如果 DOM 还在加载，则等待 DOMContentLoaded
        document.addEventListener('DOMContentLoaded', startPeriodicChecks);
    } else {
        // 如果 DOM 已经加载完成或交互状态，则直接安排执行
        startPeriodicChecks();
    }
})();
