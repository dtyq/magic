/**
 * @file analysis_slide_webpage.js
 * @description This script is designed to be injected into a web page (specifically, a web-based slide or presentation page)
 * to analyze its layout and content. It helps identify common layout problems and extracts information about
 * potentially significant structural elements on the page.
 *
 * Background:
 * This script is part of a larger system where an AI model processes slide-like web content.
 * The AI needs structured information about the visual layout of the page to understand its content,
 * identify potential rendering issues (e.g., elements overflowing the slide canvas, broken images),
 * and get a sense of the main components of the slide (e.g., header, footer, content blocks).
 *
 * Purpose:
 * 1.  Identify Layout Issues: Detects problems such as:
 *     - Canvas Overflow: Elements extending beyond the defined slide dimensions (maxWidth, maxHeight).
 *     - Parent Overflow: Elements extending beyond their parent container's boundaries, potentially being clipped.
 *       The generic 'CLIPPED' tag is applied if an element overflows a parent with clipping enabled (e.g., overflow:hidden).
 *     - Scrollbars: Presence of horizontal or vertical scrollbars on elements, which is usually undesirable in slides.
 *     - Image Loading Failures: Detects `<img>` tags that failed to load their source.
 *     - Image Aspect Ratio Distortion: Detects if an image's rendered aspect ratio significantly deviates from its natural aspect ratio.
 *     - Significant Image Content Cut-off: For images, specifically quantifies if a large portion of the image's rendered area
 *       is made invisible due to clipping by a parent container (e.g., only 60% of the image is visible).
 *       This complements the generic 'CLIPPED' tag by providing a severity measure for images.
 * 2.  Extract Significant Layout Elements: Identifies and lists elements that are likely to be major
 *     structural components of the slide. This is done by filtering elements based on a minimum area threshold
 *     and then sorting them by size. This information helps the AI understand the page structure without being
 *     overwhelmed by trivial elements.
 * 3.  Provide Data for AI Analysis: The output is a structured text report intended for an AI model to parse.
 *     It includes details like CSS paths, XPaths, dimensions, positions, and a snippet of the content of
 *     problematic and significant elements.
 * 4.  Dedicated Image Analysis: Provides a separate section listing all non-icon images, their displayed and natural
 *     dimensions, and any image-specific issues (load failures, aspect ratio distortion, significant cut-off).
 *
 * Design Rationale:
 * -   Client-Side Execution: The script runs directly in the browser context of the target page, allowing it to
 *     access the live DOM, computed styles, and element dimensions accurately.
 * -   Comprehensive Issue Detection: Checks for a variety of common layout problems that can affect slide readability and presentation.
 * -   Focus on Significant Elements: Instead of reporting all elements, it filters for larger elements to reduce noise
 *     and provide a more focused view of the main layout components. The `MIN_SIGNIFICANT_AREA_THRESHOLD` helps in this.
 * -   Quantitative Clipping Assessment for Images: For images that are clipped by a parent (which would get a generic 'CLIPPED' tag),
 *     this script additionally calculates and reports if the *amount* of visual content lost is significant (e.g., more than 25% of the image area cut off).
 *     This is governed by `IMAGE_VISIBLE_AREA_THRESHOLD_RATIO`.
 * -   Pagination for Significant Elements: The `topElementsOffset` and `topElementsLimit` parameters allow for fetching
 *     the list of significant elements in chunks. This is useful if there are many such elements, preventing an overly
 *     large initial data dump and allowing the AI to request more data if needed.
 * -   Content Snippets: Includes a brief snippet of an element's text content, or source for images/links, to give
 *     context to the AI.
 * -   Robust Selectors: Provides both CSS Path and XPath for elements, offering flexibility for the consuming system.
 *
 * Script Constants (defined before the main IIFE):
 * -   `SMALL_ICON_AREA_THRESHOLD`: Filters out very small images (likely icons) from the dedicated "Image Analysis" section.
 * -   `IMAGE_ASPECT_RATIO_DISTORTION_THRESHOLD`: Threshold for detecting significant deviation in an image's rendered vs. natural aspect ratio.
 * -   `IMAGE_VISIBLE_AREA_THRESHOLD_RATIO`: If an image, clipped by its parent, has less than this ratio of its rendered area visible,
 *     it's flagged as "IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF".
 *
 * Parameters (passed into the IIFE at the end of the script):
 * -   `maxWidth` (Number): The maximum width of the intended slide canvas (e.g., 1920 for a 1080p slide).
 * -   `maxHeight` (Number): The maximum height of the intended slide canvas (e.g., 1080 for a 1080p slide).
 * -   `topElementsOffset` (Number, optional, default: 0): The starting index (0-based) for the list of
 *     significant layout elements to return. Used for pagination.
 * -   `topElementsLimit` (Number, optional, default: 10): The maximum number of significant layout elements
 *     to return in one call. Used for pagination.
 */

// Constants for image analysis
const SMALL_ICON_AREA_THRESHOLD = 1024; // Area threshold to filter out small icons (e.g., 32x32 = 1024)
// const IMAGE_CLIPPING_THRESHOLD_RATIO = 0.90; // Removed: Scaling is not an issue, actual clipping is handled by generic CLIPPED flag if parent has overflow:hidden
const IMAGE_ASPECT_RATIO_DISTORTION_THRESHOLD = 0.15; // 15% difference in aspect ratio is considered distortion
const IMAGE_VISIBLE_AREA_THRESHOLD_RATIO = 0.75; // If less than 75% of an image's rendered area is visible due to parent clipping, it's an issue.

(function(maxWidth, maxHeight, topElementsOffset, topElementsLimit) {
    'use strict';

    // Default values for pagination
    topElementsOffset = typeof topElementsOffset === 'number' && topElementsOffset >= 0 ? topElementsOffset : 0;
    topElementsLimit = typeof topElementsLimit === 'number' && topElementsLimit > 0 ? topElementsLimit : 10;

    // Minimum area threshold to be considered a significant layout element (e.g., 0.05% of canvas area, or a fixed small value)
    // const MIN_SIGNIFICANT_AREA_THRESHOLD = Math.max(500, (maxWidth * maxHeight) * 0.0005);
    // For simplicity and to ensure smaller but potentially distinct layout blocks are captured, let's use a fixed smallish threshold initially.
    // This can be tuned. For a 1920x1080 screen, 500px is very small. Let's aim for something like 50x50 = 2500
    const MIN_SIGNIFICANT_AREA_THRESHOLD = 2500;

    // 获取元素的XPath
    function getXPath(element) {
        if (element.id !== '') {
            return `//*[@id="${element.id}"]`;
        }

        if (element === document.body) {
            return '/html/body';
        }

        let path = '';
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 0;
            let siblings = current.parentNode ? Array.from(current.parentNode.children) : [];

            for (let i = 0; i < siblings.length; i++) {
                if (siblings[i].nodeName === current.nodeName) {
                    index++;
                    if (siblings[i] === current) {
                        break;
                    }
                }
            }

            let tagName = current.nodeName.toLowerCase();
            let xpathIndex = index > 1 ? `[${index}]` : '';
            path = `/${tagName}${xpathIndex}${path}`;
            current = current.parentNode;
        }

        return path;
    }

    // 获取CSS选择器路径
    function getCSSPath(element) {
        const path = [];
        let current = element;

        while (current && current !== document.body) {
            let selector = current.nodeName.toLowerCase();

            if (current.id) {
                selector = `#${current.id}`;
                path.unshift(selector);
                break;
            } else if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\s+/).filter(c => c);
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }

            // 添加nth-child信息
            const parent = current.parentElement;
            if (parent) {
                const children = Array.from(parent.children);
                const index = children.indexOf(current) + 1;
                if (children.length > 1) {
                    selector += `:nth-child(${index})`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    // 获取元素内容
    function getElementContent(element) {
        let content = '';

        if (element.tagName === 'IMG') {
            content = element.src || element.getAttribute('src') || '[empty src]';
        } else if (element.tagName === 'A') {
            content = element.href || element.getAttribute('href') || element.textContent?.trim() || '[empty link]';
        } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            content = element.value || element.placeholder || '[empty input]';
        } else if (element.tagName === 'SELECT') {
            const selectedOption = element.options[element.selectedIndex];
            content = selectedOption ? selectedOption.text : '[no selection]';
        } else {
            // Prioritize innerText as it reflects rendered text and typically excludes script/style content.
            let text = element.innerText;

            if (typeof text === 'string' && text.trim() !== '') {
                // Process innerText
                text = text.replace(/[\s\t]+/g, ' '); // Replace multiple spaces/tabs (but not newlines) with a single space
                text = text.replace(/\n/g, '\\n');    // Escape newlines for string representation
                content = text.trim();
            } else {
                // Fallback to textContent if innerText is empty or not useful
                // Clone the element to remove script and style tags before getting textContent
                const clone = element.cloneNode(true);
                const scripts = clone.querySelectorAll('script, style');
                scripts.forEach(s => s.remove());
                text = clone.textContent || '';

                // Process textContent
                text = text.replace(/[\s\t]+/g, ' '); // Replace multiple spaces/tabs (but not newlines) with a single space
                text = text.replace(/\n/g, '\\n');    // Escape newlines for string representation
                content = text.trim();
            }

            if (!content) {
                content = '[empty]';
            }
        }

        // 限制内容长度：首尾各50个字符
        if (content.length > 100) {
            const start = content.substring(0, 50);
            const end = content.substring(content.length - 50);
            content = `${start}...${end}`;
        }

        return content;
    }

    // 检查元素是否有滚动条（更精确的检测）
    function hasScrollbarAdvanced(element) {
        const style = window.getComputedStyle(element);
        const result = {
            hasHorizontalScrollbar: false,
            hasVerticalScrollbar: false,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight
        };

        // 检查是否有内容溢出
        const hasHorizontalOverflow = element.scrollWidth > element.clientWidth;
        const hasVerticalOverflow = element.scrollHeight > element.clientHeight;

        // 检查overflow属性是否允许滚动
        const allowsHorizontalScroll = style.overflowX === 'scroll' || style.overflowX === 'auto';
        const allowsVerticalScroll = style.overflowY === 'scroll' || style.overflowY === 'auto';

        // 只有当内容溢出且允许滚动时，才会出现滚动条
        result.hasHorizontalScrollbar = hasHorizontalOverflow && allowsHorizontalScroll;
        result.hasVerticalScrollbar = hasVerticalOverflow && allowsVerticalScroll;

        return result;
    }

    // 检查图片加载状态（同步检查）
    function checkImageLoadStatus(img) {
        // 图片已经加载完成，直接检查状态
        return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    }

    // 主分析函数
    function analyzeAllElements() {
        const canvasWidth = maxWidth;
        const canvasHeight = maxHeight;

        // 获取所有元素，不做任何过滤
        const allElements = document.querySelectorAll('*');
        const problemElements = [];
        const potentiallySignificantLayoutElements = [];
        const allImagesInfo = []; // For the new Image Analysis section

        // 分析每个元素
        for (const element of allElements) {
            // Skip body and html elements for significant layout analysis, but still check for issues
            const tagName = element.tagName.toLowerCase();
            const isBodyOrHtml = tagName === 'body' || tagName === 'html';

            const rect = element.getBoundingClientRect();
            const issues = [];

            // 检查滚动条
            const scrollInfo = hasScrollbarAdvanced(element);
            if (scrollInfo.hasHorizontalScrollbar) {
                issues.push('HAS_HORIZONTAL_SCROLLBAR');
            }
            if (scrollInfo.hasVerticalScrollbar) {
                issues.push('HAS_VERTICAL_SCROLLBAR');
            }

            // 检查画布溢出
            const position = {
                left: Math.round(rect.left + window.scrollX),
                top: Math.round(rect.top + window.scrollY),
                right: Math.round(rect.right + window.scrollX),
                bottom: Math.round(rect.bottom + window.scrollY)
            };

            if (position.right > canvasWidth) {
                issues.push('CANVAS_OVERFLOW:right');
            }
            if (position.bottom > canvasHeight) {
                issues.push('CANVAS_OVERFLOW:bottom');
            }
            if (position.left < 0) {
                issues.push('CANVAS_OVERFLOW:left');
            }
            if (position.top < 0) {
                issues.push('CANVAS_OVERFLOW:top');
            }

            // 检查父容器溢出
            const parent = element.parentElement;
            if (parent && parent !== document.body && parent !== document.documentElement) {
                const parentRect = parent.getBoundingClientRect();
                const parentStyle = window.getComputedStyle(parent);

                const parentOverflow = parentStyle.overflow + parentStyle.overflowX + parentStyle.overflowY;
                const hasOverflowHidden = parentOverflow.includes('hidden');

                let overflow = false;
                let overflowDir = [];

                if (rect.left < parentRect.left) {
                    overflow = true;
                    overflowDir.push('left');
                }
                if (rect.right > parentRect.right) {
                    overflow = true;
                    overflowDir.push('right');
                }
                if (rect.top < parentRect.top) {
                    overflow = true;
                    overflowDir.push('top');
                }
                if (rect.bottom > parentRect.bottom) {
                    overflow = true;
                    overflowDir.push('bottom');
                }

                if (overflow) {
                    const parentSelector = getCSSPath(parent).split(' > ').pop();
                    issues.push(`PARENT_OVERFLOW:${overflowDir.join(',')}→${parentSelector}`);

                    if (hasOverflowHidden) {
                        issues.push('CLIPPED');
                    }
                }
            }

            // 检查图片加载状态, 以及新增的图片内容分析
            if (element.tagName === 'IMG') {
                const imageSpecificIssues = []; // Issues specific to this image for the "Image Analysis" section
                const naturalWidth = element.naturalWidth;
                const naturalHeight = element.naturalHeight;
                const renderedWidth = Math.round(rect.width);
                const renderedHeight = Math.round(rect.height);

                // 1. Load Status (re-check here for imageSpecificIssues, and add to main issues if not already by other means)
                const loaded = checkImageLoadStatus(element); // Checks complete && naturalWidth/Height > 0
                if (!loaded) {
                    imageSpecificIssues.push('IMG_FAILED');
                    if (!issues.includes('IMG_FAILED')) { // Add to main issues if not already present
                        issues.push('IMG_FAILED');
                    }
                }

                // 2. Content Clipping Check - REMOVED
                // Scaling down is not considered an issue by this script directly.
                // Actual visual cropping (content loss due to parent container with overflow:hidden)
                // will be indicated if the image element receives a generic 'CLIPPED' issue from the PARENT_OVERFLOW check.
                // The AI model will compare displayedSize and naturalSize to understand scaling, and combine with a CLIPPED tag if present.

                // 3. Aspect Ratio Distortion Check (only if loaded, natural dimensions known, and rendered dimensions are positive)
                if (loaded && naturalWidth > 0 && naturalHeight > 0 && renderedWidth > 0 && renderedHeight > 0) {
                    const naturalAR = naturalWidth / naturalHeight;
                    const renderedAR = renderedWidth / renderedHeight;

                    if (Math.abs(renderedAR - naturalAR) / naturalAR > IMAGE_ASPECT_RATIO_DISTORTION_THRESHOLD) {
                        let orientationMismatch = "";
                        const isNaturalLandscape = naturalWidth > naturalHeight;
                        const isNaturalPortrait = naturalHeight > naturalWidth;
                        const isRenderedLandscape = renderedWidth > renderedHeight;
                        const isRenderedPortrait = renderedHeight > renderedWidth;

                        if (isNaturalLandscape && isRenderedPortrait) {
                            orientationMismatch = "_natural_landscape_in_rendered_portrait";
                        } else if (isNaturalPortrait && isRenderedLandscape) {
                            orientationMismatch = "_natural_portrait_in_rendered_landscape";
                        }
                        const aspectRatioIssue = `ASPECT_RATIO_DISTORTED${orientationMismatch}:natural_AR=${naturalAR.toFixed(2)}_displayed_AR=${renderedAR.toFixed(2)}`;
                        if (!imageSpecificIssues.includes(aspectRatioIssue)) imageSpecificIssues.push(aspectRatioIssue);
                        // This specific issue will also be pushed to main issues later if it starts with ASPECT_RATIO_DISTORTED
                    }
                }

                // Significant Clipping Check (IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF)
                // This checks if an image is visually cut off by its parent by a significant amount.
                // It relies on the parent having overflow:hidden (or similar) and the image overflowing the parent.
                if (parent && parent !== document.body && parent !== document.documentElement) {
                    const parentRect = parent.getBoundingClientRect();
                    const parentStyle = window.getComputedStyle(parent);
                    // Check if parent has a style that would cause clipping
                    const parentClipsContent = parentStyle.overflow === 'hidden' || parentStyle.overflowX === 'hidden' || parentStyle.overflowY === 'hidden' ||
                                           parentStyle.overflow === 'clip' || parentStyle.overflowX === 'clip' || parentStyle.overflowY === 'clip';

                    // Check if the image actually overflows its parent's clientRect boundaries
                    let overflowsParent = false;
                    if (rect.left < parentRect.left || rect.right > parentRect.right || rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
                        overflowsParent = true;
                    }

                    if (parentClipsContent && overflowsParent) {
                        // Calculate the visible portion of the image within the parent
                        const visibleLeft = Math.max(rect.left, parentRect.left);
                        const visibleTop = Math.max(rect.top, parentRect.top);
                        const visibleRight = Math.min(rect.right, parentRect.right);
                        const visibleBottom = Math.min(rect.bottom, parentRect.bottom);

                        const visibleRenderedWidth = Math.max(0, visibleRight - visibleLeft);
                        const visibleRenderedHeight = Math.max(0, visibleBottom - visibleTop);

                        const imageRenderedArea = renderedWidth * renderedHeight;
                        const visibleAreaInParent = visibleRenderedWidth * visibleRenderedHeight;

                        if (imageRenderedArea > 0) { // Avoid division by zero
                            const visibleRatio = visibleAreaInParent / imageRenderedArea;
                            if (visibleRatio < IMAGE_VISIBLE_AREA_THRESHOLD_RATIO) {
                                const percentageVisible = Math.round(visibleRatio * 100);
                                const cutOffIssue = `IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF:only_${percentageVisible}%_visible_due_to_parent_clipping`;
                                if (!imageSpecificIssues.includes(cutOffIssue)) imageSpecificIssues.push(cutOffIssue);
                                // This specific issue will also be pushed to main issues later
                            }
                        }
                    }
                }

                // Add to allImagesInfo for the dedicated section if not a small icon
                const imageArea = renderedWidth * renderedHeight;
                if (imageArea > SMALL_ICON_AREA_THRESHOLD) {
                    allImagesInfo.push({
                        cssPath: getCSSPath(element),
                        xpath: getXPath(element),
                        src: getElementContent(element), // Gets src for IMG
                        displayedSize: `${renderedWidth}x${renderedHeight}`,
                        naturalSize: (naturalWidth > 0 || naturalHeight > 0) ? `${naturalWidth}x${naturalHeight}` : 'unknown_or_not_loaded',
                        imageSpecificIssues: imageSpecificIssues
                    });
                }

                // Add significant image-specific issues to the main `issues` array for general reporting
                imageSpecificIssues.forEach(imgIssue => {
                    // IMG_FAILED is already added directly to issues.
                    // ASPECT_RATIO_DISTORTED and IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF are added here to main issues.
                    if (imgIssue.startsWith('ASPECT_RATIO_DISTORTED') || imgIssue.startsWith('IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF')) {
                        if (!issues.includes(imgIssue)) { // Avoid duplicates
                            issues.push(imgIssue);
                        }
                    }
                });
            }

            // Collect potentially significant layout elements (not body/html, and above area threshold)
            if (!isBodyOrHtml) {
                const area = rect.width * rect.height;
                if (area >= MIN_SIGNIFICANT_AREA_THRESHOLD) {
                    const position = {
                        left: Math.round(rect.left + window.scrollX),
                        top: Math.round(rect.top + window.scrollY),
                        right: Math.round(rect.right + window.scrollX),
                        bottom: Math.round(rect.bottom + window.scrollY)
                    };
                    potentiallySignificantLayoutElements.push({
                        cssPath: getCSSPath(element),
                        xpath: getXPath(element),
                        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                        area: area, // Store area for sorting
                        positionStr: `${position.left},${position.top} to ${position.right},${position.bottom}`,
                        content: getElementContent(element)
                        // Issues will be listed separately if this element also has problems
                    });
                }
            }

            // 如果有问题，添加到结果中
            if (issues.length > 0) {
                const position = { // Recalculate position if not already done for significant elements
                    left: Math.round(rect.left + window.scrollX),
                    top: Math.round(rect.top + window.scrollY),
                    right: Math.round(rect.right + window.scrollX),
                    bottom: Math.round(rect.bottom + window.scrollY)
                };
                problemElements.push({
                    cssPath: getCSSPath(element),
                    xpath: getXPath(element),
                    size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
                    positionStr: `${position.left},${position.top} to ${position.right},${position.bottom}`,
                    issues: issues,
                    content: getElementContent(element)
                });
            }
        }

        // Sort potentially significant layout elements by area, descending
        potentiallySignificantLayoutElements.sort((a, b) => b.area - a.area);
        const totalSignificantFound = potentiallySignificantLayoutElements.length;
        const paginatedSignificantElements = potentiallySignificantLayoutElements.slice(topElementsOffset, topElementsOffset + topElementsLimit);

        // Create sets of CSSPaths for quick lookups for problem and image elements
        const problemElementPaths = new Set(problemElements.map(p => p.cssPath));
        const imageElementPaths = new Set(allImagesInfo.map(i => i.cssPath));

        // 统计问题
        const stats = {
            canvasOverflow: problemElements.filter(r => r.issues.some(i => i.startsWith('CANVAS_OVERFLOW'))).length,
            parentOverflow: problemElements.filter(r => r.issues.some(i => i.startsWith('PARENT_OVERFLOW'))).length,
            clipped: problemElements.filter(r => r.issues.includes('CLIPPED')).length,
            imgFailed: problemElements.filter(r => r.issues.includes('IMG_FAILED')).length,
            hasScrollbar: problemElements.filter(r => r.issues.some(i => i.includes('SCROLLBAR'))).length,
            imgAspectRatioDistorted: problemElements.filter(r => r.issues.some(i => i.startsWith('ASPECT_RATIO_DISTORTED'))).length,
            imgSignificantlyCutOff: problemElements.filter(r => r.issues.some(i => i.startsWith('IMAGE_CONTENT_SIGNIFICANTLY_CUT_OFF'))).length
        };

        // 构建输出
        let output = `Page Analysis (canvas ${canvasWidth}x${canvasHeight}):\n\n`;

        // 添加调试信息
        const displayedStartNum = totalSignificantFound > 0 ? Math.min(topElementsOffset + 1, totalSignificantFound) : 0;
        const displayedEndNum = Math.min(topElementsOffset + paginatedSignificantElements.length, totalSignificantFound);
        const displayedRange = totalSignificantFound > 0 && paginatedSignificantElements.length > 0 ? `${displayedStartNum}-${displayedEndNum}` : "none";

        output += `Debug: Total elements processed: ${allElements.length}, Problem elements: ${problemElements.length}, Total significant layout elements found (area >= ${MIN_SIGNIFICANT_AREA_THRESHOLD}px²): ${totalSignificantFound}, Displaying significant elements ${displayedRange} of ${totalSignificantFound}\n\n`;

        // 输出问题元素
        if (problemElements.length > 0) {
            output += 'Elements with Issues:\n';
            problemElements.forEach(elem => {
                output += `Element ${elem.cssPath}, size ${elem.size}, position ${elem.positionStr}, issues ${elem.issues.join(',')}, content "${elem.content}"\n`;
            });
            output += '\n'; // Add a newline if there were issues, before the next section
        }

        // 输出潜在的主要布局元素 (分页)
        if (totalSignificantFound > 0) {
            if (paginatedSignificantElements.length > 0) {
                output += `Significant Layout Elements (Displaying ${displayedRange} of ${totalSignificantFound}, sorted by area):\n`;
                paginatedSignificantElements.forEach((elem, index) => {
                    const overallRank = topElementsOffset + index + 1;
                    let elemOutput = `${overallRank}. Element ${elem.cssPath}`;

                    const inProblems = problemElementPaths.has(elem.cssPath);
                    const inImages = imageElementPaths.has(elem.cssPath);
                    let seeAlso = [];
                    if (inProblems) seeAlso.push("'Elements with Issues'");
                    if (inImages) seeAlso.push("'Image Analysis'");

                    if (seeAlso.length > 0) {
                        elemOutput += ` (see also: ${seeAlso.join(' and ')} section(s))`;
                    } else {
                        // Only print full details if not detailed elsewhere
                        elemOutput += `, size ${elem.size}, position ${elem.positionStr}, content "${elem.content}"`;
                    }
                    output += elemOutput + '\n';
                });
            } else {
                output += `Significant Layout Elements: No elements found in the requested range (${displayedStartNum}-${topElementsOffset + topElementsLimit}) of ${totalSignificantFound} total.\n`;
            }
             output += '\n';
        } else {
            output += `No significant layout elements found (area >= ${MIN_SIGNIFICANT_AREA_THRESHOLD}px²).\n\n`;
        }

        // 输出图片分析 (排除小图标)
        if (allImagesInfo.length > 0) {
            output += 'Image Analysis (excluding small icons - area > ' + SMALL_ICON_AREA_THRESHOLD + 'px²):\n';
            allImagesInfo.forEach(img => {
                output += `Image ${img.cssPath}, src "${img.src}", displayed ${img.displayedSize}, natural ${img.naturalSize}`;
                if (img.imageSpecificIssues.length > 0) {
                    output += `, issues: [${img.imageSpecificIssues.join(', ')}]`;
                }
                output += '\n';
            });
            output += '\n';
        } else {
            output += 'No non-icon images found for analysis.\n\n';
        }

        // 输出统计 (问题总结)
        if (problemElements.length > 0) {
            output += 'Summary of Issues:\n';
            if (stats.canvasOverflow > 0) output += `Canvas overflow: ${stats.canvasOverflow} elements\n`;
            if (stats.parentOverflow > 0) output += `Parent overflow: ${stats.parentOverflow} elements\n`;
            if (stats.clipped > 0) output += `Clipped by parent: ${stats.clipped} elements\n`;
            if (stats.imgFailed > 0) output += `Image load failed: ${stats.imgFailed} elements\n`;
            if (stats.hasScrollbar > 0) output += `Has scrollbar: ${stats.hasScrollbar} elements\n`;
            if (stats.imgAspectRatioDistorted > 0) output += `Image aspect ratio distorted: ${stats.imgAspectRatioDistorted} elements\n`;
            if (stats.imgSignificantlyCutOff > 0) output += `Image content significantly cut off: ${stats.imgSignificantlyCutOff} elements\n`;
        } else if (paginatedSignificantElements.length === 0 && totalSignificantFound === 0 && allImagesInfo.length === 0) {
            // No problems AND no significant elements AND no images
            output += 'No layout issues or significant elements found.';
        } else if (problemElements.length === 0) {
            // No problems, but there were significant elements or images (already listed)
            output += 'No layout issues found.';
        }

        return output;
    }

    // 执行分析并返回结果
    return analyzeAllElements();

})({MAX_WIDTH}, {MAX_HEIGHT}, {TOP_ELEMENTS_OFFSET}, {TOP_ELEMENTS_LIMIT});
