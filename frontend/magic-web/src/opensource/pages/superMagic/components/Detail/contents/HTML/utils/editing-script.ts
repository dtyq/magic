/* eslint-disable no-useless-escape */
/**
 * @deprecated This editing script (V1) is deprecated and no longer maintained.
 * The new V2 editing mechanism uses MessageBridge and HTMLEditorV2Ref instead.
 * This file is kept for backward compatibility only.
 *
 * Note: Z-index values in this script are hardcoded and not managed by the centralized
 * z-index system in constants/z-index.ts
 */

// 编辑功能相关工具函数
export function getEditingScript(): string {
	return `
		// 编辑功能脚本 - 基于test.html中的逻辑
		(function() {
			'use strict';

			// 消息类型枚举
			const MessageType = {
				EDIT_START: "EDIT_START",
				EDIT_EXIT: "EDIT_EXIT",
				SAVE_START: "SAVE_START",
				SAVE_SUCCESS: "SAVE_SUCCESS",
				SAVE_EXIT: "SAVE_EXIT"
			};

			// 防抖函数
			function throttle(func, delay, options = {}) {
				let timeoutId = null;
				let lastCallTime = 0;
				let result;
				const { leading = true, trailing = true } = options;

				return function(...args) {
					const now = Date.now();
					if (!lastCallTime && leading === false) {
						lastCallTime = now;
					}

					const remaining = delay - (now - lastCallTime);

					if (remaining <= 0 || remaining > delay) {
						if (timeoutId) {
							clearTimeout(timeoutId);
							timeoutId = null;
						}
						lastCallTime = now;
						result = func.apply(this, args);
					} else if (trailing && !timeoutId) {
						timeoutId = setTimeout(() => {
							lastCallTime = leading ? Date.now() : 0;
							timeoutId = null;
							result = func.apply(this, args);
						}, remaining);
					}
					return result;
				};
			}

			// 悬停工具栏类
			class HoverToolbar {
				constructor() {
					this.toolbarElement = null;
					this.currentTarget = null;
					this.dragButton = null;
					this.copyButton = null;
					this.deleteButton = null;
					this.resizeHandles = null;
					this.isResizing = false;
					this.resizeStartData = null;
					this.isDragging = false;
					this.dragStartData = null;
					// 文本样式按钮
					this.textStyleButtons = {};
					this.insertToolbarToHtml();
				}

				insertToolbarToHtml() {
					// 加载 html2canvas 库
					this.loadHtml2Canvas();

					const toolbar = document.createElement('div');
					toolbar.setAttribute('data-hover-toolbar', 'true');
					toolbar.setAttribute('data-injected', 'true');
					
					// 使用 !important 确保样式不被外部影响
					toolbar.style.setProperty('position', 'fixed', 'important');
					toolbar.style.setProperty('display', 'none', 'important');
					toolbar.style.setProperty('z-index', '1000', 'important');
					// toolbar.style.setProperty('padding-bottom', '10px', 'important');
					toolbar.style.setProperty('margin', '0', 'important');
					toolbar.style.setProperty('box-sizing', 'border-box', 'important');
					toolbar.addEventListener('mousedown', (e) => {
						e.preventDefault();
						e.stopPropagation();
					});

					const container = document.createElement('div');
					container.setAttribute('data-injected', 'true');
					// 使用白色背景和 !important 确保样式稳定
					container.style.setProperty('display', 'flex', 'important');
					container.style.setProperty('gap', '2px', 'important');
					container.style.setProperty('padding', '4px', 'important');
					container.style.setProperty('background', '#FFFFFF', 'important'); // 白色背景
					container.style.setProperty('border', '1px solid rgba(148, 163, 184, 0.2)', 'important');
					container.style.setProperty('border-radius', '12px', 'important');
					container.style.setProperty('box-shadow', '0px 4px 24px 0px rgba(0, 0, 0, 0.08), 0px 2px 8px 0px rgba(0, 0, 0, 0.04)', 'important');
					container.style.setProperty('backdrop-filter', 'blur(20px)', 'important');
					container.style.setProperty('max-width', 'calc(100vw - 20px)', 'important');
					container.style.setProperty('flex-wrap', 'nowrap', 'important');
					container.style.setProperty('align-items', 'center', 'important');
					container.style.setProperty('overflow-x', 'auto', 'important');
					container.style.setProperty('overflow-y', 'hidden', 'important');
					container.style.setProperty('margin', '0', 'important');
					container.style.setProperty('box-sizing', 'border-box', 'important');

					// 文本样式按钮组（只在文本元素时显示）
					const textGroup = this.createTextStyleGroup();
					container.appendChild(textGroup);



					// 图片工具栏（只在图片元素时显示）
					const imageGroup = this.createImageToolGroup();
					container.appendChild(imageGroup);

					// AI优化按钮组
					const aiOptimizationGroup = this.createAIOptimizationGroup();
					container.appendChild(aiOptimizationGroup);

					// 基础操作按钮（直接添加到容器，不用额外包裹）
					this.copyButton = this.createCopyButton();
					this.downloadButton = this.createDownloadButton();
					this.deleteButton = this.createDeleteButton();
					
					container.appendChild(this.copyButton);
					container.appendChild(this.downloadButton);
					container.appendChild(this.deleteButton);

					toolbar.appendChild(container);
					document.body.appendChild(toolbar);
					this.toolbarElement = toolbar;

					// 创建调整大小的控制点
					this.createResizeHandles();

					// 创建边框拖拽手柄
					console.log('创建边框拖拽手柄', this);
					this.createDragHandle();

					document.addEventListener('click', this.handleOutsideClick);
					document.addEventListener('scroll', this.updateOnScroll);
					window.addEventListener('resize', this.hideToolbar);
				}

				createButtonGroup(buttons) {
					const group = document.createElement('div');
					group.setAttribute('data-injected', 'true');
					// 使用 !important 确保样式不被外部影响
					group.style.setProperty('display', 'flex', 'important');
					group.style.setProperty('gap', '1px', 'important');
					group.style.setProperty('align-items', 'center', 'important');
					group.style.setProperty('padding', '0', 'important');
					group.style.setProperty('margin', '0', 'important');
					group.style.setProperty('box-sizing', 'border-box', 'important');
					
					buttons.forEach(({ element, name }) => {
						if (name) {
							this.textStyleButtons[name] = element;
						}
						group.appendChild(element);
					});
					
					return group;
				}

				createTextStyleGroup() {
					const group = document.createElement('div');
					group.setAttribute('data-injected', 'true');
					group.setAttribute('data-text-toolbar', 'true');
					// 使用 !important 确保样式不被外部影响
					group.style.setProperty('display', 'none', 'important'); // 默认隐藏，只在文本元素时显示
					group.style.setProperty('gap', '1px', 'important');
					group.style.setProperty('align-items', 'center', 'important');
					group.style.setProperty('padding-left', '0px', 'important');
					group.style.setProperty('margin-left', '0px', 'important');
					group.style.setProperty('margin', '0', 'important');
					group.style.setProperty('box-sizing', 'border-box', 'important');

					const buttons = [
						{ element: this.createBoldButton(), name: 'bold' },
						{ element: this.createItalicButton(), name: 'italic' },
						{ element: this.createUnderlineButton(), name: 'underline' },
						{ element: this.createDivider(), name: null },
						{ element: this.createFontSizeDecreaseButton(), name: 'fontSizeDecrease' },
						{ element: this.createFontSizeIncreaseButton(), name: 'fontSizeIncrease' },
						{ element: this.createDivider(), name: null },
						{ element: this.createTextColorButton(), name: 'textColor' },
						{ element: this.createBackgroundColorButton(), name: 'backgroundColor' },
						{ element: this.createDivider(), name: null },
						{ element: this.createAlignLeftButton(), name: 'alignLeft' },
						{ element: this.createAlignCenterButton(), name: 'alignCenter' },
						{ element: this.createAlignRightButton(), name: 'alignRight' }
					];

					buttons.forEach(({ element, name }) => {
						if (name) {
							this.textStyleButtons[name] = element;
						}
						group.appendChild(element);
					});

					group.style.setProperty('display', 'flex', 'important');
					return group;
				}

				createImageToolGroup() {
					const group = document.createElement('div');
					group.setAttribute('data-injected', 'true');
					group.setAttribute('data-image-toolbar', 'true');
					// 使用 !important 确保样式不被外部影响
					group.style.setProperty('display', 'none', 'important'); // 默认隐藏，只在图片元素时显示
					group.style.setProperty('gap', '2px', 'important');
					group.style.setProperty('align-items', 'center', 'important');
					group.style.setProperty('padding-right', '8px', 'important');
					group.style.setProperty('margin-right', '8px', 'important');
					group.style.setProperty('margin', '0', 'important');
					group.style.setProperty('box-sizing', 'border-box', 'important');
					group.style.setProperty('border-right', '1px solid rgba(148, 163, 184, 0.2)', 'important');

					const buttons = [
						{ element: this.createImageUploadButton(), name: 'imageUpload' }
					];

					buttons.forEach(({ element, name }) => {
						group.appendChild(element);
					});

					return group;
				}

				createAIOptimizationGroup() {
					const group = document.createElement('div');
					group.setAttribute('data-injected', 'true');
					group.setAttribute('data-ai-optimization-toolbar', 'true');
					// 使用 !important 确保样式不被外部影响
					group.style.setProperty('display', 'flex', 'important');
					group.style.setProperty('gap', '2px', 'important');
					group.style.setProperty('align-items', 'center', 'important');
					group.style.setProperty('padding-right', '8px', 'important');
					group.style.setProperty('margin-right', '8px', 'important');
					group.style.setProperty('margin', '0', 'important');
					group.style.setProperty('box-sizing', 'border-box', 'important');
					group.style.setProperty('border-right', '1px solid rgba(148, 163, 184, 0.2)', 'important');

					// 创建AI优化按钮
					const aiButton = this.createAIOptimizationButton();
					group.appendChild(aiButton);

					return group;
				}

				createResizeHandles() {
					this.resizeHandles = document.createElement('div');
					this.resizeHandles.setAttribute('data-resize-handles', 'true');
					this.resizeHandles.setAttribute('data-injected', 'true');
					this.resizeHandles.style.position = 'fixed';
					this.resizeHandles.style.display = 'none';
					this.resizeHandles.style.pointerEvents = 'none';
					this.resizeHandles.style.zIndex = '999';
					this.resizeHandles.style.top = '0';
					this.resizeHandles.style.left = '0';
					this.resizeHandles.style.width = '100%';
					this.resizeHandles.style.height = '100%';
					
					console.log('创建控制点容器');

					// 获取缩放比例
					const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
					const inverseScale = 1 / scaleRatio;

					// 创建8个控制点：四个角 + 四个边的中点
					const handles = [
						{ cursor: 'nw-resize', position: 'top-left' },
						{ cursor: 'n-resize', position: 'top-center' },
						{ cursor: 'ne-resize', position: 'top-right' },
						{ cursor: 'e-resize', position: 'middle-right' },
						{ cursor: 'se-resize', position: 'bottom-right' },
						{ cursor: 's-resize', position: 'bottom-center' },
						{ cursor: 'sw-resize', position: 'bottom-left' },
						{ cursor: 'w-resize', position: 'middle-left' }
					];

                    handles.forEach(handle => {
                        const handleElement = document.createElement('div');
                        handleElement.setAttribute('data-injected', 'true');
                        handleElement.setAttribute('data-resize-handle', handle.position);
                        handleElement.style.position = 'absolute';
                        handleElement.style.width = '10px';
                        handleElement.style.height = '10px';
                        handleElement.style.backgroundColor = '#0081f2';
                        handleElement.style.border = '2px solid #fff';
                        handleElement.style.borderRadius = '50%';
                        handleElement.style.cursor = handle.cursor;
                        handleElement.style.pointerEvents = 'all';
                        // 只应用反向缩放，不使用 translate，居中偏移在 updateResizeHandles 中手动计算
                        handleElement.style.transform = \`scale(\${inverseScale})\`;
                        handleElement.style.transformOrigin = 'top left';
                        handleElement.style.zIndex = '1001';
                        handleElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                        
                        handleElement.addEventListener('mousedown', (e) => this.startResize(e, handle.position));
                        this.resizeHandles.appendChild(handleElement);
                    });

					document.body.appendChild(this.resizeHandles);
					console.log('控制点创建完成，总数：', this.resizeHandles.children.length);
				}

				createDragHandle() {
					this.dragHandle = document.createElement('div');
					this.dragHandle.setAttribute('data-drag-handle', 'true');
					this.dragHandle.setAttribute('data-injected', 'true');
					
					// 获取缩放比例
					const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
					const inverseScale = 1 / scaleRatio;
					
					this.dragHandle.style.position = 'fixed';
					this.dragHandle.style.display = 'none';
					this.dragHandle.style.width = '24px';
					this.dragHandle.style.height = '24px';
					this.dragHandle.style.backgroundColor = '#0081f2';
					this.dragHandle.style.border = '2px solid #fff';
					this.dragHandle.style.borderRadius = '6px';
					this.dragHandle.style.cursor = 'grab';
					this.dragHandle.style.pointerEvents = 'all';
					this.dragHandle.style.zIndex = '1002';
					this.dragHandle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                    this.dragHandle.style.alignItems = 'center';
                    this.dragHandle.style.justifyContent = 'center';
                    this.dragHandle.style.transition = 'all 0.2s ease';
                    // 应用反向缩放
                    this.dragHandle.style.transform = \`scale(\${inverseScale})\`;
                    this.dragHandle.style.transformOrigin = 'top left';
                    
                    // 添加拖拽图标
					this.dragHandle.innerHTML = \`
						<svg width="20" height="20" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="3" cy="3" r="1" fill="white"/>
							<circle cx="6" cy="3" r="1" fill="white"/>
							<circle cx="9" cy="3" r="1" fill="white"/>
							<circle cx="3" cy="6" r="1" fill="white"/>
							<circle cx="6" cy="6" r="1" fill="white"/>
							<circle cx="9" cy="6" r="1" fill="white"/>
							<circle cx="3" cy="9" r="1" fill="white"/>
							<circle cx="6" cy="9" r="1" fill="white"/>
							<circle cx="9" cy="9" r="1" fill="white"/>
						</svg>
					\`;
					
					this.dragHandle.addEventListener('mousedown', (e) => this.startDrag(e));
					this.dragHandle.addEventListener('mouseenter', () => {
						this.dragHandle.style.transform = \`scale(\${inverseScale * 1.1})\`;
						this.dragHandle.style.backgroundColor = '#005bb5';
					});
					this.dragHandle.addEventListener('mouseleave', () => {
						if (!this.isDragging) {
							this.dragHandle.style.transform = \`scale(\${inverseScale})\`;
							this.dragHandle.style.backgroundColor = '#0081f2';
						}
					});

					document.body.appendChild(this.dragHandle);
				}

				startResize(e, position) {
					e.preventDefault();
					e.stopPropagation();

					if (!this.currentTarget) return;

					this.isResizing = true;
					const rect = this.currentTarget.getBoundingClientRect();
					const computedStyle = window.getComputedStyle(this.currentTarget);
					
					this.resizeStartData = {
						startX: e.clientX,
						startY: e.clientY,
						startWidth: rect.width,
						startHeight: rect.height,
						startLeft: rect.left,
						startTop: rect.top,
						position: position,
						element: this.currentTarget,
						minWidth: 20,
						minHeight: 20
					};

					document.addEventListener('mousemove', this.onResize);
					document.addEventListener('mouseup', this.stopResize);
					document.body.style.cursor = e.target.style.cursor;
					document.body.style.userSelect = 'none';
				}

				onResize = (e) => {
					if (!this.isResizing || !this.resizeStartData) return;

					const { startX, startY, startWidth, startHeight, startLeft, startTop, position, element, minWidth, minHeight } = this.resizeStartData;
					const deltaX = e.clientX - startX;
					const deltaY = e.clientY - startY;

					let newWidth = startWidth;
					let newHeight = startHeight;
					let newLeft = startLeft;
					let newTop = startTop;

					// 根据拖动位置计算新的尺寸
					switch (position) {
						case 'top-left':
							newWidth = Math.max(minWidth, startWidth - deltaX);
							newHeight = Math.max(minHeight, startHeight - deltaY);
							break;
						case 'top-center':
							newHeight = Math.max(minHeight, startHeight - deltaY);
							break;
						case 'top-right':
							newWidth = Math.max(minWidth, startWidth + deltaX);
							newHeight = Math.max(minHeight, startHeight - deltaY);
							break;
						case 'middle-right':
							newWidth = Math.max(minWidth, startWidth + deltaX);
							break;
						case 'bottom-right':
							newWidth = Math.max(minWidth, startWidth + deltaX);
							newHeight = Math.max(minHeight, startHeight + deltaY);
							break;
						case 'bottom-center':
							newHeight = Math.max(minHeight, startHeight + deltaY);
							break;
						case 'bottom-left':
							newWidth = Math.max(minWidth, startWidth - deltaX);
							newHeight = Math.max(minHeight, startHeight + deltaY);
							break;
						case 'middle-left':
							newWidth = Math.max(minWidth, startWidth - deltaX);
							break;
					}

					// 应用新的尺寸
					element.style.width = newWidth + 'px';
					element.style.height = newHeight + 'px';

					// 更新控制点位置和工具栏位置
					this.updateToolbarPosition();

					// 标记内容已变化
					if (window.slideEditor) {
						window.slideEditor.isChanged = true;
					}
				}

				stopResize = () => {
					this.isResizing = false;
					this.resizeStartData = null;
					document.removeEventListener('mousemove', this.onResize);
					document.removeEventListener('mouseup', this.stopResize);
					document.body.style.cursor = '';
					document.body.style.userSelect = '';
					
					// 延迟一帧更新工具栏位置，确保元素尺寸已经稳定
					requestAnimationFrame(() => {
						this.updateToolbarPosition();
						
						// 🔥 重新给当前元素添加选中边框样式
						if (this.currentTarget && window.slideSelector) {
							window.slideSelector.addSolidOutline(this.currentTarget);
						}
						
						// 🔥 确保调整大小控制点位置正确更新
						this.updateResizeHandles();
					});
				}

			    updateResizeHandles() {
                    if (!this.currentTarget || !this.resizeHandles) return;

                        const rect = this.currentTarget.getBoundingClientRect();
                        const handles = this.resizeHandles.querySelectorAll('[data-resize-handle]');
                        
                        // 获取缩放比例并计算偏移量
                        const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
                        const inverseScale = 1 / scaleRatio;
                        // 控制点原始尺寸是 10px，缩放后的实际尺寸
                        const scaledHandleSize = 10 * inverseScale;
                        // 居中偏移量：缩放后尺寸的一半
                        const centerOffset = scaledHandleSize / 2;

                        console.log('更新控制点位置：', rect, '控制点数量：', handles.length, 'inverseScale:', inverseScale, 'centerOffset:', centerOffset);

                        handles.forEach(handle => {
                            const position = handle.getAttribute('data-resize-handle');
                            let left, top;

                            switch (position) {
                                case 'top-left':
                                    left = rect.left - centerOffset;
                                    top = rect.top - centerOffset;
                                    break;
                                case 'top-center':
                                    left = rect.left + rect.width / 2 - centerOffset;
                                    top = rect.top - centerOffset;
                                    break;
                                case 'top-right':
                                    left = rect.right - centerOffset;
                                    top = rect.top - centerOffset;
                                    break;
                                case 'middle-right':
                                    left = rect.right - centerOffset;
                                    top = rect.top + rect.height / 2 - centerOffset;
                                    break;
                                case 'bottom-right':
                                    left = rect.right - centerOffset;
                                    top = rect.bottom - centerOffset;
                                    break;
                                case 'bottom-center':
                                    left = rect.left + rect.width / 2 - centerOffset;
                                    top = rect.bottom - centerOffset;
                                    break;
                                case 'bottom-left':
                                    left = rect.left - centerOffset;
                                    top = rect.bottom - centerOffset;
                                    break;
                                case 'middle-left':
                                    left = rect.left - centerOffset;
                                    top = rect.top + rect.height / 2 - centerOffset;
                                    break;
                            }

                            handle.style.left = left + 'px';
                            handle.style.top = top + 'px';
                            console.log('控制点位置：', position, left, top);
                        });
                }

				// 文本样式功能实现
				toggleBold() {
					if (!this.currentTarget) return;
					const currentWeight = window.getComputedStyle(this.currentTarget).fontWeight;
					const isBold = currentWeight === 'bold' || parseInt(currentWeight) >= 600;
					this.currentTarget.style.fontWeight = isBold ? 'normal' : 'bold';
					this.refreshButtonStates();
					this.markAsChanged();
				}

				toggleItalic() {
					if (!this.currentTarget) return;
					const currentStyle = window.getComputedStyle(this.currentTarget).fontStyle;
					const isItalic = currentStyle === 'italic';
					this.currentTarget.style.fontStyle = isItalic ? 'normal' : 'italic';
					this.refreshButtonStates();
					this.markAsChanged();
				}

				toggleUnderline() {
					if (!this.currentTarget) return;
					const currentDecoration = window.getComputedStyle(this.currentTarget).textDecoration;
					const hasUnderline = currentDecoration.includes('underline');
					this.currentTarget.style.textDecoration = hasUnderline ? 'none' : 'underline';
					this.refreshButtonStates();
					this.markAsChanged();
				}

				increaseFontSize() {
					if (!this.currentTarget) return;
					const computedStyle = window.getComputedStyle(this.currentTarget);
					const currentSize = parseFloat(computedStyle.fontSize);
					const newSize = Math.min(currentSize * 1.2, 72); // 最大72px
					this.currentTarget.style.fontSize = newSize + 'px';
					this.markAsChanged();
				}

				decreaseFontSize() {
					if (!this.currentTarget) return;
					const computedStyle = window.getComputedStyle(this.currentTarget);
					const currentSize = parseFloat(computedStyle.fontSize);
					const newSize = Math.max(currentSize * 0.8, 8); // 最小8px
					this.currentTarget.style.fontSize = newSize + 'px';
					this.markAsChanged();
				}

				setTextAlign(align) {
					if (!this.currentTarget) return;
					this.currentTarget.style.textAlign = align;
					this.refreshButtonStates();
					this.markAsChanged();
				}

				// 刷新所有按钮状态的统一方法
				refreshButtonStates() {
					// 使用 setTimeout 确保样式已经应用
					setTimeout(() => {
						this.updateTextStyleButtonStates();
					}, 0);
				}

                showColorPicker(type) {
                    if (!this.currentTarget) return;
                    
                    // 获取缩放比例
                    const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
                    const inverseScale = 1 / scaleRatio;
                    
                    // 创建简单的颜色选择器
                    const colors = [
                        '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
                        '#ff0000', '#ff6600', '#ffcc00', '#00ff00', '#00ccff', '#0066ff',
                        '#6600ff', '#cc00ff', '#ff0066', '#8B4513', '#FF69B4', '#32CD32'
                    ];
                    
                    const colorPicker = document.createElement('div');
                    colorPicker.setAttribute('data-injected', 'true');
                    colorPicker.style.position = 'fixed';
                    colorPicker.style.background = 'white';
                    colorPicker.style.border = '1px solid #ccc';
                    colorPicker.style.borderRadius = '8px';
                    colorPicker.style.padding = '8px';
                    colorPicker.style.display = 'grid';
                    colorPicker.style.gridTemplateColumns = 'repeat(6, 24px)';
                    colorPicker.style.gap = '4px';
                    colorPicker.style.zIndex = '1001';
                    colorPicker.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    colorPicker.style.transition = 'none';
                    // 应用反向缩放
                    colorPicker.style.transform = \`scale(\${inverseScale})\`;
                    colorPicker.style.transformOrigin = 'top left';
                    
                    colors.forEach(color => {
                        const colorBtn = document.createElement('div');
                        colorBtn.setAttribute('data-injected', 'true');
                        colorBtn.style.width = '24px';
                        colorBtn.style.height = '24px';
                        colorBtn.style.backgroundColor = color;
                        colorBtn.style.border = '1px solid #ddd';
                        colorBtn.style.borderRadius = '4px';
                        colorBtn.style.cursor = 'pointer';
                        colorBtn.addEventListener('click', () => {
                            if (type === 'text') {
                                this.currentTarget.style.color = color;
                            } else {
                                this.currentTarget.style.backgroundColor = color;
                            }
                            // 刷新所有按钮状态，包括颜色指示器
                            this.refreshButtonStates();
                            this.markAsChanged();
                            document.body.removeChild(colorPicker);
                        });
                        colorPicker.appendChild(colorBtn);
                    });
                    
                    // 位置计算 - 使用工具栏的实际布局尺寸
                    const toolbarWidth = this.toolbarElement.offsetWidth;
                    const toolbarHeight = this.toolbarElement.offsetHeight;
                    const scaledToolbarHeight = toolbarHeight * inverseScale;
                    
                    // 获取工具栏位置
                    const toolbarRect = this.toolbarElement.getBoundingClientRect();
                    colorPicker.style.left = toolbarRect.left + 'px';
                    colorPicker.style.top = (toolbarRect.top + scaledToolbarHeight + 8) + 'px';
					
					document.body.appendChild(colorPicker);
					
					// 点击外部关闭
					setTimeout(() => {
						const closeHandler = (e) => {
							if (!colorPicker?.contains(e.target)) {
								document.body.removeChild(colorPicker);
								document.removeEventListener('click', closeHandler);
							}
						};
						document.addEventListener('click', closeHandler);
					}, 100);
				}

				updateButtonState(buttonName, isActive) {
					const button = this.textStyleButtons[buttonName];
					if (button) {
						if (isActive) {
							// 激活状态：5%透明度背景，灰色图标
							button.setAttribute('data-active', 'true');
							button.style.setProperty('background-color', '#2E2F380D', 'important');
							button.style.setProperty('color', '#64748B', 'important');
						} else {
							// 非激活状态：透明背景，灰色图标
							button.removeAttribute('data-active');
							button.style.setProperty('background-color', 'transparent', 'important');
							button.style.setProperty('color', '#64748B', 'important');
						}
					}
				}

				updateAlignButtonState(activeAlign) {
					['alignLeft', 'alignCenter', 'alignRight'].forEach(align => {
						const button = this.textStyleButtons[align];
						if (button) {
							const isActive = align === 'align' + activeAlign.charAt(0).toUpperCase() + activeAlign.slice(1);
							if (isActive) {
								// 激活状态：5%透明度背景，灰色图标
								button.setAttribute('data-active', 'true');
								button.style.setProperty('background-color', '#2E2F380D', 'important');
								button.style.setProperty('color', '#64748B', 'important');
							} else {
								// 非激活状态：透明背景，灰色图标
								button.removeAttribute('data-active');
								button.style.setProperty('background-color', 'transparent', 'important');
								button.style.setProperty('color', '#64748B', 'important');
							}
						}
					});
				}

				updateColorIndicators(computedStyle) {
					// 更新文本颜色指示器
					const textColorButton = this.textStyleButtons['textColor'];
					if (textColorButton) {
						const textColorIndicator = textColorButton.querySelector('[data-color-indicator="text"]');
						if (textColorIndicator) {
							const textColor = computedStyle.color || '#000000';
							textColorIndicator.setAttribute('fill', textColor);
						}
					}

					// 更新背景颜色指示器
					const backgroundColorButton = this.textStyleButtons['backgroundColor'];
					if (backgroundColorButton) {
						const bgColorIndicator = backgroundColorButton.querySelector('[data-bg-indicator="background"]');
						if (bgColorIndicator) {
							const backgroundColor = computedStyle.backgroundColor || '#ffffff';
							// 如果背景颜色是透明的，使用白色作为默认值
							const finalBgColor = backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent' ? '#ffffff' : backgroundColor;
							bgColorIndicator.setAttribute('fill', finalBgColor);
						}
					}
				}

				markAsChanged() {
					if (window.slideEditor) {
						window.slideEditor.isChanged = true;
					}
				}

				isTextElement(element) {
					if (!element) return false;
					
					const textTags = ['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'label', 'td', 'th', 'li'];
					const tagName = element.tagName.toLowerCase();
					
					// 检查是否是文本标签
					if (textTags.includes(tagName)) return true;
					
					// 检查是否包含文本内容
					if (element.textContent && element.textContent.trim().length > 0) return true;
					
					// 检查是否可编辑
					if (element.contentEditable === 'true') return true;
					
					return false;
				}

				isImageElement(element) {
					if (!element) return false;
					const tagName = element.tagName.toLowerCase();
					return tagName === 'img';
				}

				updateTextStyleButtonStates() {
					if (!this.currentTarget || !this.isTextElement(this.currentTarget)) return;
					
					const computedStyle = window.getComputedStyle(this.currentTarget);
					
					// 更新加粗状态
					const fontWeight = computedStyle.fontWeight;
					const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 600;
					this.updateButtonState('bold', isBold);
					
					// 更新斜体状态
					const isItalic = computedStyle.fontStyle === 'italic';
					this.updateButtonState('italic', isItalic);
					
					// 更新下划线状态
					const hasUnderline = computedStyle.textDecoration.includes('underline');
					this.updateButtonState('underline', hasUnderline);
					
					// 更新对齐状态
					const textAlign = computedStyle.textAlign || 'left';
					this.updateAlignButtonState(textAlign);
					
					// 更新颜色指示器
					this.updateColorIndicators(computedStyle);
				}

				showToolbar = (event) => {
					if (!this.toolbarElement) return;
					const target = event.target;
					if (!target || target.closest('[data-hover-toolbar]') || target.closest('[data-resize-handles]') || target.tagName === 'BODY' || target.tagName === 'HTML') {
						return;
					}

					this.currentTarget = target;
					this.toolbarElement.style.setProperty('display', 'flex', 'important');
					this.toolbarElement.style.setProperty('z-index', '1000', 'important');

					// 根据元素类型显示或隐藏文本工具栏
					const textToolbar = this.toolbarElement.querySelector('[data-text-toolbar]');
					if (textToolbar) {
						if (this.isTextElement(target)) {
							textToolbar.style.setProperty('display', 'flex', 'important');
							this.updateTextStyleButtonStates();
						} else {
							textToolbar.style.setProperty('display', 'none', 'important');
						}
					}

					// 根据元素类型显示或隐藏图片工具栏
					const imageToolbar = this.toolbarElement.querySelector('[data-image-toolbar]');
					if (imageToolbar) {
						if (this.isImageElement(target)) {
							imageToolbar.style.setProperty('display', 'flex', 'important');
						} else {
							imageToolbar.style.setProperty('display', 'none', 'important');
						}
					}

                    const rect = target.getBoundingClientRect();
                    // 使用 offsetWidth/offsetHeight 获取工具栏的实际布局尺寸（不受 transform 影响）
                    const toolbarWidth = this.toolbarElement.offsetWidth;
                    const toolbarHeight = this.toolbarElement.offsetHeight;
                    const windowHeight = window.innerHeight;
                    const windowWidth = window.innerWidth;
                    const offset = 8;
                    // 根据元素高度动态计算安全间距，确保工具栏不会与元素重叠
                    const dynamicOffset = Math.max(40, rect.height * 0.1 + 12); // 至少16px，或元素高度的10%加12px
                    
                    // 获取缩放比例
                    const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
                    const inverseScale = 1 / scaleRatio;
                    
                    // 计算工具栏缩放后的实际宽度（基于原始宽度）
                    const scaledToolbarWidth = toolbarWidth * inverseScale;
                    const scaledToolbarHeight = toolbarHeight * inverseScale;
                    
                    // 计算居中位置：元素中心 - 缩放后工具栏宽度的一半
                    let left = rect.left + rect.width / 2 - scaledToolbarWidth / 2;
                    let top = rect.top - scaledToolbarHeight + offset;

                    console.log('showToolbar - left:', left, 'top:', top, 'scaledToolbarWidth:', scaledToolbarWidth, 'inverseScale:', inverseScale, 'toolbarWidth:', toolbarWidth);

                    // 处理垂直方向边界
                    if (top < 0) {
                        // 当工具栏会超出顶部时，放在元素下方，使用动态计算的间距避免遮挡
                        top = rect.bottom + dynamicOffset;
                    } else if (top + scaledToolbarHeight > windowHeight) {
                        top = rect.top - scaledToolbarHeight - offset;
                    }

                    // 处理水平方向边界
                    if (left < offset) {
                        // 当工具栏会超出左侧边缘时，对齐到左侧并保持安全间距
                        left = offset;
                    } else if (left + scaledToolbarWidth > windowWidth - offset) {
                        // 当工具栏会超出右侧边缘时，对齐到右侧并保持安全间距
                        left = windowWidth - scaledToolbarWidth - offset;
                    }

                    this.toolbarElement.style.left = left + 'px';
                    this.toolbarElement.style.top = top - 36 * inverseScale + 'px';
                    // 设置 transform-origin 为左上角，只应用 scale
                    this.toolbarElement.style.setProperty('transform-origin', 'top left', 'important');
                    this.toolbarElement.style.transform = \`scale(\${inverseScale})\`;

					// 显示调整大小的控制点
					this.showResizeHandles();
				}

				hideToolbar = () => {
					if (this.toolbarElement) {
						this.toolbarElement.style.setProperty('display', 'none', 'important');
						this.toolbarElement.style.setProperty('z-index', '-1', 'important');
						this.currentTarget = null;
					}
					// 隐藏所有相关的UI元素
					this.hideResizeHandles();
					this.hideDragHandle();
					this.hideAllColorPickers();
				}

				showResizeHandles() {
					if (!this.resizeHandles || !this.currentTarget) {
						console.log('控制点未显示：', !this.resizeHandles ? '未创建控制点' : '没有目标元素');
						return;
					}

					// 检查元素是否可以调整大小
					if (!this.isResizable(this.currentTarget)) {
						console.log('元素不可调整大小：', this.currentTarget.tagName, this.currentTarget);
						return;
					}

					this.resizeHandles.style.display = 'block';
					this.updateResizeHandles();
					
					// 同时显示拖拽手柄
					this.showDragHandle();
				}

				showDragHandle() {
					if (!this.dragHandle || !this.currentTarget) return;
					
					this.dragHandle.style.display = 'flex';
					this.updateDragHandlePosition();
				}

                updateDragHandlePosition() {
                    if (!this.currentTarget || !this.dragHandle) return;

                    const rect = this.currentTarget.getBoundingClientRect();
                    
                    // 获取缩放比例
                    const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
                    const inverseScale = 1 / scaleRatio;
                    
                    // 拖拽手柄的原始宽度是 24px，计算缩放后的实际宽度
                    const scaledHandleWidth = 24 * inverseScale;
                    const scaledHandleHeight = 24 * inverseScale;
                    
                    // 将拖拽手柄放在元素的上方中央位置：元素中心 - 缩放后手柄宽度的一半
                    const left = rect.left + rect.width / 2 - scaledHandleWidth / 2;
                    const top = rect.top - scaledHandleHeight - 6 * inverseScale; // 手柄放在元素上方，留出 6px 间距

                    this.dragHandle.style.left = left + 'px';
                    this.dragHandle.style.top = top + 'px';
                }

				isResizable(element) {
					if (!element) return false;
					
					const tagName = element.tagName.toLowerCase();
					const computedStyle = window.getComputedStyle(element);
					
					// 只排除一些明显不应该调整大小的元素
					const nonResizableElements = ['html', 'body', 'head', 'title', 'meta', 'link', 'script', 'style', 'br', 'hr'];
					if (nonResizableElements.includes(tagName)) {
						console.log('元素类型不可调整：', tagName);
						return false;
					}
					
					// 不允许调整纯行内元素，但允许inline-block
					if (computedStyle.display === 'inline') {
						console.log('行内元素不可调整：', tagName, computedStyle.display);
						return false;
					}
					
					console.log('元素可调整大小：', tagName, computedStyle.display);
					return true;
				}

				hideResizeHandles() {
					if (this.resizeHandles) {
						this.resizeHandles.style.display = 'none';
					}
					// 同时隐藏拖拽手柄
					this.hideDragHandle();
				}

				hideDragHandle() {
					if (this.dragHandle) {
						this.dragHandle.style.display = 'none';
					}
				}

				hideAllColorPickers() {
					// 移除页面上所有的颜色选择器
					const colorPickers = document.querySelectorAll('div[data-injected="true"]');
					colorPickers.forEach(picker => {
						// 检查是否是颜色选择器（通过样式特征判断）
						const computedStyle = window.getComputedStyle(picker);
						if (computedStyle.display === 'grid' &&
							computedStyle.gridTemplateColumns.includes('24px') &&
							computedStyle.position === 'fixed' &&
							computedStyle.zIndex === '1001') {
							try {
								if (picker.parentNode) {
									picker.parentNode.removeChild(picker);
								}
							} catch (error) {
								console.warn('移除颜色选择器时出错:', error);
							}
						}
					});
				}

                updateToolbarPosition() {
                    if (!this.currentTarget || !this.toolbarElement) return;
                    
                    const rect = this.currentTarget.getBoundingClientRect();
                    // 使用 offsetWidth/offsetHeight 获取工具栏的实际布局尺寸（不受 transform 影响）
                    const toolbarWidth = this.toolbarElement.offsetWidth;
                    const toolbarHeight = this.toolbarElement.offsetHeight;
                    const windowHeight = window.innerHeight;
                    const windowWidth = window.innerWidth;
                    const offset = 8;
                    // 根据元素高度动态计算安全间距，确保工具栏不会与元素重叠
                    const dynamicOffset = Math.max(16, rect.height * 0.1 + 12); // 至少16px，或元素高度的10%加12px
                    
                    // 获取缩放比例
                    const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
                    const inverseScale = 1 / scaleRatio;
                    
                    // 计算工具栏缩放后的实际宽度（基于原始宽度）
                    const scaledToolbarWidth = toolbarWidth * inverseScale;
                    const scaledToolbarHeight = toolbarHeight * inverseScale;
                    
                    // 计算居中位置：元素中心 - 缩放后工具栏宽度的一半
                    let left = rect.left + rect.width / 2 - scaledToolbarWidth / 2;
                    let top = rect.top - scaledToolbarHeight + offset;

                    // 处理垂直方向边界
                    if (top < 0) {
                        // 当工具栏会超出顶部时，放在元素下方，使用动态计算的间距避免遮挡
                        top = rect.bottom + dynamicOffset;
                    } else if (top + scaledToolbarHeight > windowHeight) {
                        top = rect.top - scaledToolbarHeight - offset;
                    }

                    // 处理水平方向边界
                    if (left < offset) {
                        // 当工具栏会超出左侧边缘时，对齐到左侧并保持安全间距
                        left = offset;
                    } else if (left + scaledToolbarWidth > windowWidth - offset) {
                        // 当工具栏会超出右侧边缘时，对齐到右侧并保持安全间距
                        left = windowWidth - scaledToolbarWidth - offset;
                    }

                    this.toolbarElement.style.left = left + 'px';
                    this.toolbarElement.style.top = top - 36 * inverseScale + 'px';
                    // 设置 transform-origin 为左上角，只应用 scale
                    this.toolbarElement.style.setProperty('transform-origin', 'top left', 'important');
                    this.toolbarElement.style.transform = \`scale(\${inverseScale})\`;
                    
                    console.log('updateToolbarPosition - left:', left, 'top:', top, 'scaledToolbarWidth:', scaledToolbarWidth, 'inverseScale:', inverseScale, "rect:", rect, 'toolbarWidth:', toolbarWidth);

                    // 同时更新调整大小控制点和拖拽手柄
                    this.updateResizeHandles();
                    this.updateDragHandlePosition();
                }

				// 禁用工具栏及相关UI元素的动画
				disableToolbarAnimations() {
					// 禁用工具栏容器的动画
					if (this.toolbarElement) {
						this.toolbarElement.style.transition = 'none';
						// 禁用工具栏按钮的动画
						const buttons = this.toolbarElement.querySelectorAll('button');
						buttons.forEach(button => {
							button.style.transition = 'none';
						});
						// 禁用文本工具栏的动画
						const textToolbar = this.toolbarElement.querySelector('[data-text-toolbar]');
						if (textToolbar) {
							textToolbar.style.animation = 'none';
						}
					}
					
					// 禁用调整大小控制点的动画
					if (this.resizeHandles) {
						const handles = this.resizeHandles.querySelectorAll('[data-resize-handle]');
						handles.forEach(handle => {
							handle.style.transition = 'none';
						});
					}
				}

				// 恢复工具栏及相关UI元素的动画
				enableToolbarAnimations() {
					// 恢复工具栏容器的动画
					if (this.toolbarElement) {
						this.toolbarElement.style.transition = '';
						// 恢复工具栏按钮的动画
						const buttons = this.toolbarElement.querySelectorAll('button');
						buttons.forEach(button => {
							button.style.transition = 'all 0.2s ease';
						});
						// 恢复文本工具栏的动画
						const textToolbar = this.toolbarElement.querySelector('[data-text-toolbar]');
						if (textToolbar) {
							textToolbar.style.animation = '';
						}
					}
					
					// 恢复调整大小控制点的动画
					if (this.resizeHandles) {
						const handles = this.resizeHandles.querySelectorAll('[data-resize-handle]');
						handles.forEach(handle => {
							handle.style.transition = 'all 0.2s ease';
						});
					}
				}

				updateOnScroll = () => {
					if (this.currentTarget && this.toolbarElement.style.display !== 'none') {
						this.updateToolbarPosition();
					}
				}

				createCopyButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M10 12.667C10 11.9597 10.281 11.2813 10.7811 10.7811C11.2813 10.281 11.9597 10 12.667 10H21.333C21.6832 10 22.03 10.069 22.3536 10.203C22.6772 10.337 22.9712 10.5335 23.2189 10.7811C23.4665 11.0288 23.663 11.3228 23.797 11.6464C23.931 11.97 24 12.3168 24 12.667V21.333C24 21.6832 23.931 22.03 23.797 22.3536C23.663 22.6772 23.4665 22.9712 23.2189 23.2189C22.9712 23.4665 22.6772 23.663 22.3536 23.797C22.03 23.931 21.6832 24 21.333 24H12.667C12.3168 24 11.97 23.931 11.6464 23.797C11.3228 23.663 11.0288 23.4665 10.7811 23.2189C10.5335 22.9712 10.337 22.6772 10.203 22.3536C10.069 22.03 10 21.6832 10 21.333V12.667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M7.012 19.737C6.70534 19.5622 6.45027 19.3095 6.27258 19.0045C6.09488 18.6995 6.00085 18.353 6 18V8C6 6.9 6.9 6 8 6H18C18.75 6 19.158 6.385 19.5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '复制';
					
					button.addEventListener('click', (e) => this.menuCopy(e));
					return button;
				}

				createDeleteButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 10H23" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M13 14V20" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M17 14V20" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M8 10L9 22C9 22.5304 9.21071 23.0391 9.58579 23.4142C9.96086 23.7893 10.4696 24 11 24H19C19.5304 24 20.0391 23.7893 20.4142 23.4142C20.7893 23.0391 21 22.5304 21 22L22 10" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M12 10V7C12 6.73478 12.1054 6.48043 12.2929 6.29289C12.4804 6.10536 12.7348 6 13 6H17C17.2652 6 17.5196 6.10536 17.7071 6.29289C17.8946 6.48043 18 6.73478 18 7V10" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '删除';
					
					button.addEventListener('click', (e) => this.menuDelete(e));
					return button;
				}

				createDownloadButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M15 3V17M15 17L11 13M15 17L19 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M21 21V22C21 22.5304 20.7893 23.0391 20.4142 23.4142C20.0391 23.7893 19.5304 24 19 24H11C10.4696 24 9.96086 23.7893 9.58579 23.4142C9.21071 23.0391 9 22.5304 9 22V21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '下载图片';
					
					button.addEventListener('click', (e) => this.downloadElementAsImage(e));
					return button;
				}

				loadHtml2Canvas() {
					// 检查是否已经加载
					if (window.html2canvas || document.querySelector('script[src*="html2canvas"]')) {
						return;
					}
					
					const script = document.createElement('script');
					script.setAttribute('data-injected', 'true');
					script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
					script.onload = () => {
						console.log('html2canvas 库加载完成');
					};
					script.onerror = () => {
						console.error('html2canvas 库加载失败');
					};
					document.head.appendChild(script);
				}

				downloadElementAsImage = async (event) => {
					event.preventDefault();
					event.stopPropagation();
					
					if (!this.currentTarget) {
						console.error('没有选中的元素');
						return;
					}

					// 检查 html2canvas 是否已加载
					if (!window.html2canvas) {
						console.log('图片生成库正在加载中，请稍后再试...');
						return;
					}

					try {
						// 临时隐藏工具栏和控制点，避免被截图
						const toolbarDisplay = this.toolbarElement.style.display;
						const resizeHandlesDisplay = this.resizeHandles?.style.display;
						const dragHandleDisplay = this.dragHandle?.style.display;
						
						this.toolbarElement.style.display = 'none';
						if (this.resizeHandles) this.resizeHandles.style.display = 'none';
						if (this.dragHandle) this.dragHandle.style.display = 'none';

						// 获取元素的位置和尺寸
						const rect = this.currentTarget.getBoundingClientRect();
						
						// 使用 html2canvas 截图
						const originalCanvas = await window.html2canvas(this.currentTarget, {
							backgroundColor: null, // 透明背景
							useCORS: true,
							allowTaint: true,
							scale: 2, // 提高图片质量
							logging: false
						});

						// 创建新的canvas，支持透明背景
						const finalCanvas = document.createElement('canvas');
						finalCanvas.width = originalCanvas.width;
						finalCanvas.height = originalCanvas.height;
						
						const ctx = finalCanvas.getContext('2d', { alpha: true });
						if (ctx) {
							// 保持透明背景，不填充任何颜色
							// 直接绘制原始截图，保持透明度
							ctx.drawImage(originalCanvas, 0, 0);
						}

						// 恢复工具栏和控制点显示
						this.toolbarElement.style.display = toolbarDisplay;
						if (this.resizeHandles) this.resizeHandles.style.display = resizeHandlesDisplay;
						if (this.dragHandle) this.dragHandle.style.display = dragHandleDisplay;

						// 从最终的canvas获取图片数据
						const imageDataUrl = finalCanvas.toDataURL('image/png', 1.0);
						const fileName = \`\${Date.now()}.png\`;

						// 检查是否在 iframe 中
							// 在 iframe 中，通过 postMessage 发送给父窗口
							window.parent.postMessage({
								type: 'DOWNLOAD_IMAGE',
								data: {
									dataUrl: imageDataUrl,
									fileName: fileName
								}
							}, '*');
							console.log('图片数据已发送给父窗口处理下载');
					} catch (error) {
						console.error('生成图片失败:', error);
						console.log('生成图片失败，请重试');
						
						// 确保恢复工具栏显示
						this.toolbarElement.style.display = toolbarDisplay;
						if (this.resizeHandles) this.resizeHandles.style.display = resizeHandlesDisplay;
						if (this.dragHandle) this.dragHandle.style.display = dragHandleDisplay;
					}
				}

				createImageUploadButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML =
\`<svg width="20" height="20" viewBox="64 64 896 896" focusable="false" data-icon="picture" fill="currentColor" aria-hidden="true">
						<path d="M928 160H96c-17.7 0-32 14.3-32 32v640c0 17.7 14.3 32 32 32h832c17.7 0 32-14.3 32-32V192c0-17.7-14.3-32-32-32zm-40 632H136v-39.9l138.5-164.3 150.1 178L658.1 489 888 761.6V792zm0-129.8L664.2 396.8c-3.2-3.8-9-3.8-12.2 0L424.6 666.4l-144-170.7c-3.2-3.8-9-3.8-12.2 0L136 652.7V232h752v430.2zM304 456a88 88 0 100-176 88 88 0 000 176zm0-116c15.5 0 28 12.5 28 28s-12.5 28-28 28-28-12.5-28-28 12.5-28 28-28z"></path>
					</svg>\`;
					this.styleButton(button);
					button.title = '上传图片';
					
					button.addEventListener('click', (e) => this.uploadImageToReplace(e));
					return button;
				}

				createAIOptimizationButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.setAttribute('data-ai-optimization', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AI">
					<title>AI</title>
					<rect x="0" y="0" width="30" height="30" rx="6" fill="#111827"/>
					<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
					font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
					font-size="14" font-weight="700" fill="#ffffff">AI</text>
					</svg>\`;
					this.styleButton(button);
					button.title = 'AI优化选项';
					
					// 设置下拉菜单功能
					this.createAIOptimizationDropdown(button);
					
					return button;
				}

				createAIOptimizationDropdown(button) {
					let dropdown = null;
					let isDropdownVisible = false;
					let hoverTimeout = null;

					const showDropdown = (e) => {
						e.preventDefault();
						e.stopPropagation();

						// 清除隐藏定时器
						if (hoverTimeout) {
							clearTimeout(hoverTimeout);
							hoverTimeout = null;
						}

						// 如果已经显示，则不重复创建
						if (isDropdownVisible && dropdown) {
							return;
						}

					// 获取缩放比例
					const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
					const inverseScale = 1 / scaleRatio;

					// 创建下拉菜单
					dropdown = document.createElement('div');
					dropdown.setAttribute('data-injected', 'true');
					dropdown.setAttribute('data-ai-dropdown', 'true');
					dropdown.style.setProperty('position', 'fixed', 'important');
					dropdown.style.setProperty('background', 'white', 'important');
					dropdown.style.setProperty('border', '1px solid rgba(63, 143, 255, 0.2)', 'important');
					dropdown.style.setProperty('border-radius', '8px', 'important');
					dropdown.style.setProperty('box-shadow', '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)', 'important');
					dropdown.style.setProperty('padding', '10px', 'important');
					dropdown.style.setProperty('min-width', '240px', 'important');
					dropdown.style.setProperty('z-index', '1001', 'important');
					dropdown.style.setProperty('user-select', 'none', 'important');
					// 应用反向缩放
					dropdown.style.setProperty('transform', \`scale(\${inverseScale})\`, 'important');
					dropdown.style.setProperty('transform-origin', 'top left', 'important');

						// 创建菜单项
						const items = [
							{
								key: 'factCheck',
								label: '事实核查',
								description: 'AI 帮我核查内容里的信息是否真实',
								icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.33325 4.16671C3.33325 3.94569 3.42105 3.73373 3.57733 3.57745C3.73361 3.42117 3.94557 3.33337 4.16659 3.33337H15.8333C16.0543 3.33337 16.2662 3.42117 16.4225 3.57745C16.5788 3.73373 16.6666 3.94569 16.6666 4.16671V15.8334C16.6666 16.0544 16.5788 16.2663 16.4225 16.4226C16.2662 16.5789 16.0543 16.6667 15.8333 16.6667H4.16659C3.94557 16.6667 3.73361 16.5789 3.57733 16.4226C3.42105 16.2663 3.33325 16.0544 3.33325 15.8334V4.16671Z" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.33325 6.66663H16.6666" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.66675 3.33337V6.66671" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.91675 12.0834L9.16675 13.3334L11.6667 10.8334" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
								action: 'factCheck'
							},
							{
								key: 'contentTranslation',
								label: '内容翻译',
								description: 'AI 将内容转换为我需要的语言',
								icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.33325 4.16663H9.16659" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.49992 2.5V4.16667C7.49992 7.84833 5.63409 10.8333 3.33325 10.8333" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.16675 7.5C4.16675 9.28667 6.62675 10.7567 9.75008 10.8333" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16.6666L13.3333 9.16663L16.6667 16.6666" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.9167 15H10.75" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
								action: 'contentTranslation'
							},
							{
								key: 'dataCorrection',
								label: '数据纠正',
								description: 'AI 检查表格、数据里的错误，并进行纠正',
								icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.6666 10.8334V7.50004C16.6666 7.05801 16.491 6.63409 16.1784 6.32153C15.8659 6.00897 15.4419 5.83337 14.9999 5.83337H4.99992C4.55789 5.83337 4.13397 6.00897 3.82141 6.32153C3.50885 6.63409 3.33325 7.05801 3.33325 7.50004V11.6667C3.33325 12.1087 3.50885 12.5327 3.82141 12.8452C4.13397 13.1578 4.55789 13.3334 4.99992 13.3334H9.99992" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 15.8333L14.1667 17.5L17.5 14.1666" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
								action: 'dataCorrection'
							},
							{
								key: 'layoutCorrection',
								label: '修正布局',
								description: 'AI 检测并修正页面中的布局问题',
								icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.33325 5.00004C3.33325 4.55801 3.50885 4.13409 3.82141 3.82153C4.13397 3.50897 4.55789 3.33337 4.99992 3.33337H14.9999C15.4419 3.33337 15.8659 3.50897 16.1784 3.82153C16.491 4.13409 16.6666 4.55801 16.6666 5.00004V15C16.6666 15.4421 16.491 15.866 16.1784 16.1786C15.8659 16.4911 15.4419 16.6667 14.9999 16.6667H4.99992C4.55789 16.6667 4.13397 16.4911 3.82141 16.1786C3.50885 15.866 3.33325 15.4421 3.33325 15V5.00004Z" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.33325 10H16.6666" stroke="#1C1D23" stroke-opacity="0.8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
								action: 'layoutCorrection'
							},
							{
								key: 'custom',
								label: '自定义',
								description: '根据我的需求让AI进行处理',
								icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 16l0 -4" /><path d="M12 8l.01 0" /></svg>',
								action: 'custom'
							}
						];

						// 创建菜单内容
						const content = document.createElement('div');
						content.setAttribute('data-injected', 'true');

						items.forEach(item => {
							const menuItem = document.createElement('div');
							menuItem.setAttribute('data-injected', 'true');
							menuItem.style.setProperty('display', 'flex', 'important');
							menuItem.style.setProperty('align-items', 'start', 'important');
							menuItem.style.setProperty('gap', '4px', 'important');
							menuItem.style.setProperty('padding', '6px 10px', 'important');
							menuItem.style.setProperty('cursor', 'pointer', 'important');
							menuItem.style.setProperty('transition', 'all 0.2s ease', 'important');

							menuItem.innerHTML = \`
								<div style="margin-top: 2px;">\${item.icon}</div>
								<div style="display: flex; flex-direction: column; align-items: start; justify-content: start;">
									<div style="color: #1F2937; font-weight: 500; font-size: 14px; line-height: 20px;">\${item.label}</div>
									<div style="color: #6B7280; font-weight: 400; font-size: 12px; line-height: 16px;">\${item.description}</div>
								</div>
							\`;

							// 悬停效果
							menuItem.addEventListener('mouseenter', () => {
								menuItem.style.setProperty('background-color', 'rgba(63, 143, 255, 0.06)', 'important');
								menuItem.style.setProperty('transform', 'translateX(2px)', 'important');
							});

							menuItem.addEventListener('mouseleave', () => {
								menuItem.style.setProperty('background-color', 'transparent', 'important');
								menuItem.style.setProperty('transform', 'translateX(0)', 'important');
							});

							// 点击事件
							menuItem.addEventListener('click', (e) => {
								e.preventDefault();
								e.stopPropagation();
								this.handleAIOptimizationAction(item.action);
								this.hideAIOptimizationDropdown(dropdown);
								dropdown = null;
								isDropdownVisible = false;
							});

							content.appendChild(menuItem);
						});

					dropdown.appendChild(content);

					// 计算位置
					const buttonRect = button.getBoundingClientRect();
					const viewportHeight = window.innerHeight;
					const dropdownHeight = 240; // 预估高度
					
					// 计算缩放后的实际高度
					const scaledDropdownHeight = dropdownHeight * inverseScale;

					let top = buttonRect.bottom + 8;
					if (top + scaledDropdownHeight > viewportHeight) {
						top = buttonRect.top - scaledDropdownHeight - 8;
					}

					dropdown.style.left = buttonRect.left + 'px';
					dropdown.style.top = top + 'px';

					document.body.appendChild(dropdown);
					isDropdownVisible = true;

						// 点击外部关闭
						setTimeout(() => {
							const closeHandler = (e) => {
								if (!dropdown?.contains(e.target) && !button?.contains(e.target)) {
									this.hideAIOptimizationDropdown(dropdown);
									dropdown = null;
									isDropdownVisible = false;
									document.removeEventListener('click', closeHandler);
								}
							};
							document.addEventListener('click', closeHandler);
						}, 100);
					};

					const hideDropdown = () => {
						if (hoverTimeout) {
							clearTimeout(hoverTimeout);
						}
						hoverTimeout = setTimeout(() => {
							if (isDropdownVisible && dropdown) {
								this.hideAIOptimizationDropdown(dropdown);
								dropdown = null;
								isDropdownVisible = false;
							}
						}, 200); // 200ms 延迟，避免鼠标快速移动时意外关闭
					};

					// 添加点击事件
					button.addEventListener('click', showDropdown);
					
					// 添加鼠标悬停事件
					button.addEventListener('mouseenter', showDropdown);
					button.addEventListener('mouseleave', hideDropdown);

					// 为下拉菜单添加悬停事件（需要在菜单创建后添加）
					const originalShowDropdown = showDropdown;
					const enhancedShowDropdown = (e) => {
						originalShowDropdown(e);
						// 确保下拉菜单创建后再添加事件
						setTimeout(() => {
							if (dropdown) {
								dropdown.addEventListener('mouseenter', () => {
									if (hoverTimeout) {
										clearTimeout(hoverTimeout);
										hoverTimeout = null;
									}
								});
								dropdown.addEventListener('mouseleave', hideDropdown);
							}
						}, 10);
					};

					// 重新绑定增强后的显示函数
					button.removeEventListener('click', showDropdown);
					button.removeEventListener('mouseenter', showDropdown);
					button.addEventListener('click', enhancedShowDropdown);
					button.addEventListener('mouseenter', enhancedShowDropdown);
				}

				hideAIOptimizationDropdown(dropdown) {
					if (dropdown && dropdown.parentNode) {
						dropdown.parentNode.removeChild(dropdown);
					}
				}

				handleAIOptimizationAction(action) {
					// 通过postMessage通知主站
					const pathsssss = this.getElementJSPath(this.currentTarget)
					console.log("pathsssss", pathsssss)
					const selector = this.getElementJSPath(this.currentTarget);
					const foundElement = document.querySelector(selector);
					const message = {
						type: 'AI_OPTIMIZATION_ACTION',
						action: action,
						elementInfo: this.currentTarget ? {
							tagName: this.currentTarget.tagName,
							textContent: this.currentTarget.textContent,
							innerText: this.currentTarget.innerText || this.currentTarget.textContent,
							className: this.currentTarget.className,
							jsPath: this.getElementJSPath(this.currentTarget)
						} : null
					};

					try {
						window.parent.postMessage(message, '*');
						console.log('AI优化操作已发送:', action, '元素路径:', message.elementInfo?.jsPath);
					} catch (error) {
						console.error('发送AI优化操作失败:', error);
					}
				}

				uploadImageToReplace = async (event) => {
					event.preventDefault();
					event.stopPropagation();
					
					if (!this.currentTarget || this.currentTarget.tagName.toLowerCase() !== 'img') {
						console.error('当前选中的不是图片元素');
						return;
					}

					// 检查是否在iframe中
					if (window.parent && window.parent !== window) {
						// 在iframe中，通过postMessage请求父窗口处理文件上传
						console.log('在iframe中，请求父窗口处理图片上传');
						
						// 保存当前选中的图片元素的唯一标识
						this.currentTarget.setAttribute('data-upload-target', 'true');
						
						window.parent.postMessage({
							type: 'REQUEST_IMAGE_UPLOAD',
							data: {
								targetSelector: this.getElementSelector(this.currentTarget)
							}
						}, '*');
						
						// 监听来自父窗口的图片数据
						const messageHandler = (event) => {
							if (event.data && event.data.type === 'IMAGE_UPLOAD_RESULT') {
								try {
									// 找到目标图片元素
									const targetImg = document.querySelector('[data-upload-target="true"]');
									if (targetImg && event.data.src) {
										// 替换图片的 src 属性
										targetImg.src = event.data.src;
										targetImg.setAttribute('data-src', event.data.dataSrc);
										// 清除标识
										targetImg.removeAttribute('data-upload-target');
										
										// 标记内容已变化
										if (window.slideEditor) {
											window.slideEditor.isChanged = true;
										}
										
										console.log('图片已成功替换为新上传的图片');
									}
								} catch (error) {
									console.error('处理上传结果失败:', error);
								}
								
								// 移除监听器
								window.removeEventListener('message', messageHandler);
							}
						};
						
						window.addEventListener('message', messageHandler);
						
						// // 5秒后自动清理监听器
						// setTimeout(() => {
						// 	window.removeEventListener('message', messageHandler);
						// 	const targetImg = document.querySelector('[data-upload-target="true"]');
						// 	if (targetImg) {
						// 		targetImg.removeAttribute('data-upload-target');
						// 	}
						// }, 5000);
						
					} else {
						// 不在iframe中，直接处理文件选择
						this.handleDirectFileUpload();
					}
				}

				handleDirectFileUpload() {
					// 创建文件输入元素
					const fileInput = document.createElement('input');
					fileInput.setAttribute('data-injected', 'true');
					fileInput.type = 'file';
					fileInput.accept = 'image/*';
					fileInput.style.position = 'absolute';
					fileInput.style.left = '-9999px';
					fileInput.style.top = '-9999px';
					fileInput.style.opacity = '0';
					
					// 添加到文档中
					document.body.appendChild(fileInput);

					// 监听文件选择
					fileInput.addEventListener('change', async (e) => {
						const file = e.target.files[0];
						if (!file) {
							document.body.removeChild(fileInput);
							return;
						}

						try {
							// 将文件转换为 base64
							const base64 = await this.fileToBase64(file);
							
							// 替换图片的 src 属性
							this.currentTarget.src = base64;
							
							// 标记内容已变化
							if (window.slideEditor) {
								window.slideEditor.isChanged = true;
							}
							
							console.log('图片已成功替换为新上传的图片');
						} catch (error) {
							console.error('上传图片失败:', error);
						} finally {
							// 清理文件输入元素
							document.body.removeChild(fileInput);
						}
					});

					// 使用用户手势触发文件选择
					try {
						fileInput.focus();
						fileInput.click();
					} catch (error) {
						console.error('触发文件选择失败:', error);
						document.body.removeChild(fileInput);
					}
				}

				getElementSelector(element) {
					// 生成元素的唯一选择器
					let selector = element.tagName.toLowerCase();
					
					// 添加ID
					if (element.id) {
						selector += '#' + element.id;
					}
					
					// 添加类名
					if (element.className) {
						const classes = element.className.split(' ').filter(cls => cls.trim()).join('.');
						if (classes) {
							selector += '.' + classes;
						}
					}
					
					// 添加src属性作为额外标识（截取前50个字符）
					if (element.src) {
						const srcPrefix = element.src.substring(0, 50);
						selector += '[src^="' + srcPrefix + '"]';
					}
					
					return selector;
				}

				getElementJSPath(element) {
					// 生成可以用于 document.querySelector 的 CSS 选择器字符串
					if (!element || element.nodeType !== Node.ELEMENT_NODE) {
						return '';
					}

					const path = [];
					let current = element;

					while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
						let selector = current.tagName.toLowerCase();
						
						// 如果有 id，直接使用 id 选择器
						if (current.id) {
							selector += '#' + CSS.escape(current.id);
							path.unshift(selector);
							break; // 有 id 的话就不需要再往上找了
						}
						
						// 如果有 class，添加第一个 class
						if (current.className && typeof current.className === 'string') {
							const classes = current.className.trim().split(' ').filter(cls => cls);
							if (classes.length > 0 && classes[0]) {
								selector += '.' + CSS.escape(classes[0]);
							}
						}
						
						// 计算同级元素中的索引（使用 :nth-child）
						const parent = current.parentElement;
						if (parent) {
							const siblings = Array.from(parent.children);
							const index = siblings.indexOf(current) + 1; // nth-child 从 1 开始
							
							// 检查是否需要添加 nth-child
							const sameTagSiblings = siblings.filter(child =>
								child.tagName.toLowerCase() === current.tagName.toLowerCase()
							);
							
							if (sameTagSiblings.length > 1) {
								selector += ':nth-child(' + index + ')';
							}
						}
						
						path.unshift(selector);
						current = parent;
					}

					// 生成最终的 CSS 选择器（使用空格分隔，表示后代选择器）
					return path.join(' ');
				}

				fileToBase64(file) {
					return new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result);
						reader.onerror = () => reject(new Error('文件读取失败'));
						reader.readAsDataURL(file);
					});
				}



				createBoldButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M10 8H16C16.9283 8 17.8185 8.36875 18.4749 9.02513C19.1313 9.6815 19.5 10.5717 19.5 11.5C19.5 12.4283 19.1313 13.3185 18.4749 13.9749C17.8185 14.6313 16.9283 15 16 15H10V8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M16 15H17C17.9283 15 18.8185 15.3687 19.4749 16.0251C20.1313 16.6815 20.5 17.5717 20.5 18.5C20.5 19.4283 20.1313 20.3185 19.4749 20.9749C18.8185 21.6313 17.9283 22 17 22H10V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '加粗';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.toggleBold();
					});
					return button;
				}

				createItalicButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M14 8H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M10 22H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M17 8L13 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '斜体';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.toggleItalic();
					});
					return button;
				}

				createUnderlineButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M10 8V13C10 14.3261 10.5268 15.5979 11.4645 16.5355C12.4021 17.4732 13.6739 18 15 18C16.3261 18 17.5979 17.4732 18.5355 16.5355C19.4732 15.5979 20 14.3261 20 13V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M8 22H22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '下划线';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.toggleUnderline();
					});
					return button;
				}

				createFontSizeDecreaseButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 22V11.5C7 10.5717 7.36875 9.6815 8.02513 9.02513C8.6815 8.36875 9.57174 8 10.5 8C11.4283 8 12.3185 8.36875 12.9749 9.02513C13.6313 9.6815 14 10.5717 14 11.5V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M7 16H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M24 15H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '减小字体';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.decreaseFontSize();
					});
					return button;
				}

				createFontSizeIncreaseButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 22V11.5C7 10.5717 7.36875 9.6815 8.02513 9.02513C8.6815 8.36875 9.57174 8 10.5 8C11.4283 8 12.3185 8.36875 12.9749 9.02513C13.6313 9.6815 14 10.5717 14 11.5V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M7 16H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M21 12V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M24 15H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '增大字体';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.increaseFontSize();
					});
					return button;
				}

				createTextColorButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12 18V11C12 10.2044 12.3161 9.44129 12.8787 8.87868C13.4413 8.31607 14.2044 8 15 8C15.7956 8 16.5587 8.31607 17.1213 8.87868C17.6839 9.44129 18 10.2044 18 11V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M12 14H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<rect x="3" y="23" width="24" height="4" fill="#000000" data-color-indicator="text"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '文字颜色';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.showColorPicker('text');
					});
					return button;
				}

				createBackgroundColorButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M22.5996 5.40039C23.7042 5.40039 24.5996 6.29582 24.5996 7.40039V22.5996C24.5996 23.7042 23.7042 24.5996 22.5996 24.5996H7.40039C6.29582 24.5996 5.40039 23.7042 5.40039 22.5996V7.40039C5.40039 6.29582 6.29582 5.40039 7.40039 5.40039H22.5996Z" fill="#ffffff" stroke="currentColor" stroke-width="1" data-bg-indicator="background"/>
						<path d="M15 9.4502C14.0054 9.4502 13.0519 9.84557 12.3486 10.5488C11.6454 11.2521 11.25 12.2057 11.25 13.2002V20.2002C11.2501 20.6143 11.5859 20.9502 12 20.9502C12.4141 20.9502 12.7499 20.6143 12.75 20.2002V16.9502H17.25V20.2002C17.2501 20.6143 17.5859 20.9502 18 20.9502C18.4141 20.9502 18.7499 20.6143 18.75 20.2002V13.2002C18.75 12.2057 18.3546 11.2521 17.6514 10.5488C16.9481 9.84557 15.9946 9.4502 15 9.4502ZM15 10.9502C15.5967 10.9502 16.1689 11.1874 16.5908 11.6094C17.0127 12.0313 17.25 12.6035 17.25 13.2002V15.4502H12.75V13.2002C12.75 12.6035 12.9873 12.0313 13.4092 11.6094C13.8311 11.1874 14.4033 10.9502 15 10.9502Z" fill="currentColor"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '背景颜色';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.showColorPicker('background');
					});
					return button;
				}

				createAlignLeftButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 9H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M7 15H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M7 21H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '左对齐';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.setTextAlign('left');
					});
					return button;
				}

				createAlignCenterButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 9H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M11 15H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M9 21H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '居中对齐';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.setTextAlign('center');
					});
					return button;
				}

				createAlignRightButton() {
					const button = document.createElement('button');
					button.setAttribute('data-injected', 'true');
					button.innerHTML = \`<svg width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M7 9H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M13 15H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M9 21H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>\`;
					this.styleButton(button);
					button.title = '右对齐';
					
					button.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this.setTextAlign('right');
					});
					return button;
				}

				createDivider() {
					const divider = document.createElement('div');
					divider.setAttribute('data-injected', 'true');
					// 使用 !important 确保样式不被外部影响
					divider.style.setProperty('width', '1px', 'important');
					divider.style.setProperty('height', '16px', 'important');
					divider.style.setProperty('background-color', 'rgba(148, 163, 184, 0.2)', 'important');
					divider.style.setProperty('margin', '0 6px', 'important');
					divider.style.setProperty('flex-shrink', '0', 'important');
					divider.style.setProperty('padding', '0', 'important');
					divider.style.setProperty('border', 'none', 'important');
					divider.style.setProperty('box-sizing', 'border-box', 'important');
					return divider;
				}

				styleButtonBase(button) {
					// 确保样式不被外部影响，使用 !important
					button.style.setProperty('background', 'transparent', 'important');
					button.style.setProperty('border', 'none', 'important');
					button.style.setProperty('cursor', 'pointer', 'important');
					button.style.setProperty('display', 'flex', 'important');
					button.style.setProperty('justify-content', 'center', 'important');
					button.style.setProperty('align-items', 'center', 'important');
					button.style.setProperty('padding', '6px', 'important');
					button.style.setProperty('border-radius', '6px', 'important');
					button.style.setProperty('min-width', '32px', 'important');
					button.style.setProperty('min-height', '32px', 'important');
					button.style.setProperty('transition', 'all 0.15s ease', 'important');
					button.style.setProperty('color', '#64748B', 'important'); // 默认灰色图标
					button.style.setProperty('outline', 'none', 'important');
					button.style.setProperty('box-shadow', 'none', 'important');
					
					// 悬停效果
					button.addEventListener('mouseenter', () => {
						// 检查是否是激活状态，如果是则不改变样式
						if (!button.hasAttribute('data-active')) {
							button.style.setProperty('background-color', 'rgba(100, 116, 139, 0.1)', 'important');
							button.style.setProperty('color', '#0F172A', 'important');
						}
					});
					
					button.addEventListener('mouseleave', () => {
						// 检查是否是激活状态，如果不是则恢复默认样式
						if (!button.hasAttribute('data-active')) {
							button.style.setProperty('background-color', 'transparent', 'important');
							button.style.setProperty('color', '#64748B', 'important');
						}
					});
				}

				styleButton(button) {
					this.styleButtonBase(button);
					
					// 为所有按钮添加默认的mousedown处理，防止事件冒泡
					button.addEventListener('mousedown', (e) => {
						e.preventDefault();
						e.stopPropagation();
					});
				}

				startDrag(e) {
					e.preventDefault();
					e.stopPropagation();

					if (!this.currentTarget) return;

					this.isDragging = true;
					const computedStyle = window.getComputedStyle(this.currentTarget);
					
					// 保存并禁用 transition 以避免动画干扰
					const originalTransition = this.currentTarget.style.transition || '';
					this.currentTarget.style.transition = 'none';
					
					// 禁用工具栏及相关UI元素的动画
					this.disableToolbarAnimations();
					
					// 获取当前的transform位移值
					let currentX = 0;
					let currentY = 0;
					
					// 检查元素的 style.transform 属性（优先级更高）
					const styleTransform = this.currentTarget.style.transform;
					if (styleTransform && styleTransform !== 'none') {
						const translateMatch = styleTransform.match(/translate\\(([^,)]+)(?:,\\s*([^)]+))?\\)/);
						if (translateMatch) {
							currentX = parseFloat(translateMatch[1]) || 0;
							currentY = parseFloat(translateMatch[2]) || 0;
						}
					} else {
						// 如果没有内联样式，检查计算样式
						const currentTransform = computedStyle.transform;
						if (currentTransform && currentTransform !== 'none') {
							const matrix = currentTransform.match(/matrix\\(([^)]+)\\)/);
							if (matrix) {
								const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
								currentX = values[4] || 0; // translateX
								currentY = values[5] || 0; // translateY
							}
						}
					}
					
					this.dragStartData = {
						startX: e.clientX,
						startY: e.clientY,
						initialX: currentX,
						initialY: currentY,
						element: this.currentTarget,
						originalTransition: originalTransition
					};

				// 获取缩放比例
				const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
				const inverseScale = 1 / scaleRatio;

				// 更新光标样式（禁用拖拽手柄的动画）
				this.dragHandle.style.transition = 'none';
				this.dragHandle.style.cursor = 'grabbing';
				this.dragHandle.style.transform = \`scale(\${inverseScale * 1.1})\`;
				this.dragHandle.style.backgroundColor = '#005bb5';
				document.body.style.cursor = 'grabbing';
				document.body.style.userSelect = 'none';

					// 禁用鼠标事件避免干扰拖拽
					this.currentTarget.style.pointerEvents = 'none';

					document.addEventListener('mousemove', this.onDrag);
					document.addEventListener('mouseup', this.stopDrag);
				}

				onDrag = (e) => {
					if (!this.isDragging || !this.dragStartData) return;

					const { startX, startY, initialX, initialY, element } = this.dragStartData;
					const deltaX = e.clientX - startX;
					const deltaY = e.clientY - startY;

					const newX = initialX + deltaX;
					const newY = initialY + deltaY;

					// 直接设置 transform，使用简单的 translate
					element.style.transform = \`translate(\${newX}px, \${newY}px)\`;

					// 更新工具栏和控制点位置
					this.updateToolbarPosition();

					// 标记内容已变化
					if (window.slideEditor) {
						window.slideEditor.isChanged = true;
					}
				}

			stopDrag = () => {
				if (!this.isDragging || !this.dragStartData) return;

				const { originalTransition } = this.dragStartData;
				
				this.isDragging = false;
				this.dragStartData = null;

				// 获取缩放比例
				const scaleRatio = window.__MAGIC_SCALE_RATIO__ || 1;
				const inverseScale = 1 / scaleRatio;

				// 恢复光标样式和拖拽手柄动画
				this.dragHandle.style.transition = 'all 0.2s ease';
				this.dragHandle.style.cursor = 'grab';
				this.dragHandle.style.transform = \`scale(\${inverseScale})\`;
				this.dragHandle.style.backgroundColor = '#0081f2';
				document.body.style.cursor = '';
				document.body.style.userSelect = '';

					// 恢复元素状态
					if (this.currentTarget) {
						this.currentTarget.style.pointerEvents = '';
						// 恢复原来的 transition 属性
						this.currentTarget.style.transition = originalTransition;
						// 设置 position: relative 样式
						this.currentTarget.style.position = 'relative';
					}

					// 恢复工具栏及相关UI元素的动画
					this.enableToolbarAnimations();

					document.removeEventListener('mousemove', this.onDrag);
					document.removeEventListener('mouseup', this.stopDrag);
					
					// 延迟一帧更新工具栏位置，确保元素位置已经稳定
					requestAnimationFrame(() => {
						this.updateToolbarPosition();
						
						// 🔥 重新给当前元素添加选中边框样式
						if (this.currentTarget && window.slideSelector) {
							window.slideSelector.addSolidOutline(this.currentTarget);
						}
					});
				}

				menuCopy = (event) => {
					if (this.currentTarget) {
						try {
							const clonedElement = this.currentTarget.cloneNode(true);
							// 给复制的元素添加注入标识
							// if (clonedElement.setAttribute) {
							// 	clonedElement.setAttribute('data-injected', 'true');
							// }
							this.currentTarget.parentNode?.insertBefore(clonedElement, this.currentTarget.nextSibling);
							// 移除自动保存，只标记内容已变化
							if (window.slideEditor) {
								console.log('复制元素，标记为已修改');
								window.slideEditor.isChanged = true;
							}
						} catch (error) {
							console.error('复制元素失败:', error);
						}
						// 复制后保持当前选中状态，不隐藏工具栏
					}
				}

				menuDelete = (event) => {
					if (this.currentTarget) {
						try {
							this.currentTarget.parentNode?.removeChild(this.currentTarget);
							// 移除自动保存，只标记内容已变化
							if (window.slideEditor) {
								console.log('删除元素，标记为已修改');
								window.slideEditor.isChanged = true;
							}
						} catch (error) {
							console.error('删除元素失败:', error);
						}
						// 🔥 删除后强制清除所有状态
						window.slideSelector?.clearAllStates();
					}
				}

				handleOutsideClick = (event) => {
					if (!this.toolbarElement) return;
					
					// 如果正在拖拽或调整大小，不处理外部点击
					if (this.isDragging || this.isResizing) return;
					
					const target = event.target;
					
					// 如果点击的是工具栏或调整大小控制点，不处理
					if (this.toolbarElement.contains(target) ||
						(this.resizeHandles && this.resizeHandles.contains(target))) {
						return;
					}
					
					// 如果点击的是当前选中的元素，不处理
					if (this.currentTarget && this.currentTarget.contains(target)) {
						return;
					}
					
					// 🔥 点击其他地方，只有当点击空白区域时才清除选中状态
					// 如果点击的是body或html，才清除选中状态
					if (target.tagName === 'BODY' || target.tagName === 'HTML') {
						window.slideSelector?.clearAllStates();
					}
				}
			}

			// 幻灯片编辑器类
			class SlideEditor {
				constructor() {
					this.editingDom = null;
					this.isChanged = false;
					this.selectorData = null;
					this.hoverToolbar = new HoverToolbar();
				}

				startEdit(data) {
					const target = data.selector;
					if (target) {
						// 🔥 修复元素切换问题：使用元素引用比较而不是outerHTML比较
						if (this.editingDom === target) return;
						
						this.clearEffects();
						this.editingDom = target;
						this.selectorData = data;
						
						if (this.editingDom) {
							this.editingDom.setAttribute('spellcheck', 'false');
							this.editingDom.setAttribute('contenteditable', 'true');
							this.editingDom.addEventListener('input', this.onInput);
							this.editingDom.addEventListener('blur', this.onBlur);
						}
						
						if ('focus' in this.editingDom && typeof this.editingDom.focus === 'function') {
							this.editingDom.focus();
						}
					}
				}

				clearEffects() {
					console.log('清理编辑状态，当前编辑元素:', this.editingDom?.tagName || 'null');
					this.clearContentEditor();
					// 不要在清理时重置 isChanged，保持变化状态直到保存
					this.editingDom?.removeEventListener('input', this.onInput);
					this.editingDom?.removeEventListener('blur', this.onBlur);
					this.editingDom = null;
					this.selectorData = null; // 也清理选择器数据
					// 不在这里隐藏工具栏，让选择器控制
				}

				clearContentEditor = () => {
					this.editingDom?.removeAttribute('contenteditable');
					this.editingDom?.removeAttribute('spellcheck');
				}

				onInput = () => {
					if (!this.selectorData || !this.editingDom) return;
					console.log('检测到内容输入变化，标记为已修改');
					this.isChanged = true;
					// 移除实时保存，只标记内容已变化
				}

				onBlur = () => {
					const wasDeleted = this.deleteFocusDom();
					// 如果元素被删除，标记为已变化
					if (wasDeleted) {
						this.isChanged = true;
						// 🔥 如果元素被删除，强制清除所有状态
						window.slideSelector?.clearAllStates();
					} else {
						// 如果元素没有被删除，只清理编辑状态，但保持选中状态和工具栏
						this.clearContentEditor();
					}
				}

				deleteFocusDom() {
					if (!this.editingDom) return false;
					
					// 对于某些元素类型，不应该因为textContent为空而删除
					const tagName = this.editingDom.tagName.toLowerCase();
					const noTextContentElements = ['img', 'input', 'video', 'audio', 'source', 'embed', 'object', 'iframe', 'canvas', 'svg', 'br', 'hr', 'area', 'base', 'col', 'track', 'wbr'];
					
					// 如果是这些元素类型，不进行删除
					if (noTextContentElements.includes(tagName)) {
						return false;
					}
					
					// 对于有src、href或value属性的元素，也不应该删除
					if (this.editingDom.hasAttribute('src') ||
						this.editingDom.hasAttribute('href') ||
						this.editingDom.hasAttribute('value')) {
						return false;
					}
					
					// 检查是否有子元素（除了纯文本节点）
					const hasChildElements = this.editingDom.children.length > 0;
					if (hasChildElements) {
						return false;
					}
					
					// 只有对于真正的文本容器且内容为空时，才进行删除
					if (!(this.editingDom.textContent?.trim() || '')) {
						const parent = this.editingDom.parentNode;
						if (parent) {
							parent.removeChild(this.editingDom);
							this.editingDom = null;
							this.selectorData = null;
						}
						return true;
					}
					return false;
				}

				// 只有在接收到父窗口保存指令时才执行保存
				saveToServer = () => {
					try {
						const htmlContent = this.getCleanDocumentStringOnFocus(document.documentElement.outerHTML);
						// 通知父窗口保存内容
						window.parent?.postMessage({
							type: 'saveContent',
							content: htmlContent
						}, '*');
						
						// 重置变化标记
						this.isChanged = false;
						console.log('内容已保存');
					} catch (error) {
						console.error('保存内容失败:', error);
					}
				}

				getCleanDocumentStringOnFocus(html) {
					const parser = new DOMParser();
					const doc = parser.parseFromString(html, 'text/html');
					window.slideSelector?.clearOutlineFocusByDocObject(doc);
					
					// 清理所有带有 data-injected 属性的元素（不管值是什么）
					const injectedElements = doc.querySelectorAll('[data-injected]');
					injectedElements.forEach((element) => {
						// 移除整个元素（script、style、link等注入的元素）
						if (
							element.tagName === 'SCRIPT' ||
							element.tagName === 'STYLE' ||
							element.tagName === 'LINK' ||
							element.tagName === 'META'
						) {
							element.parentNode?.removeChild(element);
						} else {
							// 对于其他元素，只移除 data-injected 属性
							element.removeAttribute('data-injected');
						}
					});
					
					// 清理编辑相关的UI元素和属性
					// 移除编辑工具栏相关的元素
					const toolbarElements = doc.querySelectorAll('[data-hover-toolbar], [data-resize-handles], [data-resize-handle], [data-drag-handle], [data-ai-dropdown]');
					toolbarElements.forEach((element) => {
						element.parentNode?.removeChild(element);
					});
					
					// 清理编辑相关的属性
					const allElements = doc.querySelectorAll('*');
					allElements.forEach((element) => {
						// 移除编辑相关的 data 属性
						element.removeAttribute('data-hover-toolbar');
						element.removeAttribute('data-resize-handles');
						element.removeAttribute('data-resize-handle');
						element.removeAttribute('data-drag-handle');
						element.removeAttribute('data-ai-dropdown');
						element.removeAttribute('data-ppt-editable');
						
						// 移除编辑相关的类名
						element.classList.remove('magic-ppt-tip-focus');
						element.classList.remove('magic-ppt-tip-hover');
					});
					
					// 清理ECharts动态添加的内容
					// 如果元素有 _echarts_instance_ 属性，说明是ECharts容器，直接清空其内容
					const echartsContainers = doc.querySelectorAll('[_echarts_instance_]');
					echartsContainers.forEach((container) => {
						// 移除 _echarts_instance_ 属性
						container.removeAttribute('_echarts_instance_');
						// 清空ECharts添加的所有子元素
						container.innerHTML = '';
						// 清理ECharts添加的内联样式
						const styleAttr = container.getAttribute('style');
						if (styleAttr) {
							// 移除ECharts添加的样式属性
							const echartsStyles = [
								'user-select:\\s*none',
								'-webkit-tap-highlight-color:\\s*rgba\\(0,\\s*0,\\s*0,\\s*0\\)',
								'position:\\s*relative'
							];
							let cleanedStyle = styleAttr;
							echartsStyles.forEach((pattern) => {
								const regex = new RegExp(pattern + '[;\\s]*', 'gi');
								cleanedStyle = cleanedStyle.replace(regex, '');
							});
							// 清理多余的分号和空格
							cleanedStyle = cleanedStyle.replace(/^[;\s]+|[;\s]+$/g, '').replace(/[;\s]{2,}/g, '; ');
							if (cleanedStyle.trim()) {
								container.setAttribute('style', cleanedStyle.trim());
							} else {
								container.removeAttribute('style');
							}
						}
					});
					
				// 检查是否需要恢复slide-bridge.js（PPT场景）
				const hasSlideBridgeMarker = doc.body?.hasAttribute('data-has-slide-bridge');
				
				// 清理 html 和 body 标签上的 data-injected 和标记属性
				if (doc.documentElement.hasAttribute('data-injected')) {
					doc.documentElement.removeAttribute('data-injected');
				}
				if (doc.body?.hasAttribute('data-injected')) {
					doc.body.removeAttribute('data-injected');
				}
				if (doc.body?.hasAttribute('data-has-slide-bridge')) {
					doc.body.removeAttribute('data-has-slide-bridge');
				}
				
				// 如果原始HTML有slide-bridge.js，在保存时恢复它
				if (hasSlideBridgeMarker) {
					// 检查是否已经存在slide-bridge.js（避免重复添加）
					const existingSlideBridge = doc.querySelector('script[src*="slide-bridge.js"]');
					if (!existingSlideBridge && doc.body) {
						const slideBridgeScript = doc.createElement('script');
						slideBridgeScript.setAttribute('src', 'slide-bridge.js');
						doc.body.appendChild(slideBridgeScript);
					}
				}
				
				// 恢复原始CDN URL（script标签）
				const scriptsWithOriginalSrc = doc.querySelectorAll('script[data-original-src]');
				scriptsWithOriginalSrc.forEach((script) => {
					const originalSrc = script.getAttribute('data-original-src');
					if (originalSrc) {
						script.setAttribute('src', originalSrc);
						script.removeAttribute('data-original-src');
					}
				});
				
				// 恢复原始CDN URL（link标签）
				const linksWithOriginalHref = doc.querySelectorAll('link[data-original-href]');
				linksWithOriginalHref.forEach((link) => {
					const originalHref = link.getAttribute('data-original-href');
					if (originalHref) {
						link.setAttribute('href', originalHref);
						link.removeAttribute('data-original-href');
					}
				});
				
				// 恢复相对路径
				const elementsWithOriginalPath = doc.querySelectorAll('[data-original-path]');
				elementsWithOriginalPath.forEach((element) => {
					const originalPath = element.getAttribute('data-original-path');
					if (originalPath) {
						const tagName = element.tagName.toLowerCase();
						// 恢复 src 或 href
						if (element.hasAttribute('src')) {
							element.setAttribute('src', originalPath);
						}
						if (element.hasAttribute('href')) {
							element.setAttribute('href', originalPath);
						}
						// object/embed 场景使用 data 属性承载资源地址
						if (element.hasAttribute('data')) {
							element.setAttribute('data', originalPath);
						}
						// 嵌套 iframe 在运行时可能被改成 srcdoc，保存时需还原为 src
						if (tagName === 'iframe') {
							element.setAttribute('src', originalPath);
							element.removeAttribute('srcdoc');
							element.removeAttribute('data-magic-iframe-loading');
							element.removeAttribute('data-magic-iframe-skipped');
							element.removeAttribute('data-magic-iframe-skipped-path');
						}
						// 清理标记
						element.removeAttribute('data-original-path');
					}
				});
				
				// 恢复CSS中的url()路径
				const styleElements = doc.querySelectorAll('style');
				styleElements.forEach((style) => {
					if (style.textContent && style.textContent.includes('/*__ORIGINAL_URL__:')) {
						style.textContent = style.textContent.replace(
							/\/\*__ORIGINAL_URL__:(.*?)__\*\/url\(['"].*?['"]\)/g,
							'url(\\'$1\\')'
						);
					}
				});
				
				// 恢复内联样式中的url()路径
				const elementsWithStyle = doc.querySelectorAll('[style]');
				elementsWithStyle.forEach((element) => {
					const styleAttr = element.getAttribute('style');
					if (styleAttr && styleAttr.includes('/*__ORIGINAL_URL__:')) {
						const restoredStyle = styleAttr.replace(
							/\/\*__ORIGINAL_URL__:(.*?)__\*\/url\(['"].*?['"]\)/g,
							'url(\\'$1\\')'
						);
						element.setAttribute('style', restoredStyle);
					}
				});
				
				// 恢复 window.location.reload()
				const scriptElements = doc.querySelectorAll('script:not([src])');
				scriptElements.forEach((script) => {
					if (script.textContent && script.textContent.includes('/*__ORIGINAL_RELOAD__:')) {
						script.textContent = script.textContent.replace(
							/\/\*__ORIGINAL_RELOAD__:(.*?)__\*\/window\\.Magic\\.reload\\(\\)/g,
							'$1'
						);
					}
				});
				
				// 获取DOCTYPE并保留
				const doctype = doc.doctype;
				let doctypeString = '<!DOCTYPE html>';
				if (doctype) {
					doctypeString = \`<!DOCTYPE \${doctype.name}\`;
					if (doctype.publicId) {
						doctypeString += \` PUBLIC "\${doctype.publicId}"\`;
					}
					if (doctype.systemId) {
						doctypeString += \` "\${doctype.systemId}"\`;
					}
					doctypeString += '>\\n';
				}
				
				return doctypeString + doc.documentElement.outerHTML;
			}
			}

			// 选择器类
			class SlideSelector {
				constructor() {
					this.isEditMode = false;
					this.currentElement = null;
					this.selectedElement = null; // 当前选中的元素
				}

				init() {
					document.addEventListener('click', this.handleDomClick, false);
					document.addEventListener('mouseover', this.onHoverDOM, false);
					document.addEventListener('mouseout', this.onMouseOutDOM, true);
				}

				setEditMode(editMode) {
					this.isEditMode = editMode;
					if (!editMode) this.resetAll();
				}

				handleDomClick = (event) => {
					if (!this.isEditMode) return;
					console.log('handleDomClick', event);
					// 阻止事件冒泡和默认行为
					event.preventDefault();
					event.stopPropagation();
					
					const target = event.target;
					
					// 如果点击的是工具栏，不处理
					if (this.isToolbarElement(target)) return;
					
					const data = this.onSelectDOM(event);
					if (data) {
						// selectedElement 已在 onSelectDOM 中设置
						// 开始编辑
						window.slideEditor?.startEdit(data);
						// 显示工具栏和选中框
						this.showElementUI(target, event);
					}
				}

				onSelectDOM(event) {
					if (!event) return null;
					const target = event.target;
					
					console.log('尝试选择元素:', target.tagName, target.className || '(无类名)');
					
					if (this.shouldSkipElement(target, event)) {
						console.log('元素被跳过，原因: shouldSkipElement返回true');
						return null;
					}
					
					// 🔥 修复蓝色实线框重复问题：强制清除所有选中状态
					this.clearAllFocusOutlines();
					
					// 清除悬停效果
					this.clearOutlineHover();
					
					// 添加选中状态的实线框
					this.addSolidOutline(target);
					
					// 更新当前选中的元素
					this.selectedElement = target;
					
					console.log('成功选择元素:', target.tagName, target.className || '(无类名)');
					return { selector: target };
				}

				onHoverDOM = throttle((event) => {
					if (!this.isEditMode) return;
					const target = event.target;
					
					// 如果是工具栏元素，不处理
					if (this.isToolbarElement(target)) return;
					
					// 如果已经有选中的元素且是同一个元素，不重复处理
					if (this.selectedElement && this.selectedElement === target) return;
					
					// 如果不应该跳过这个元素，显示悬停效果
					if (!this.shouldSkipElement(target, event)) {
						// 先清除之前的悬停效果
						this.clearOutlineHover();
						// 如果不是当前选中的元素，添加悬停边框
						if (this.selectedElement !== target) {
							this.addDashedOutline(target);
							this.currentElement = target;
						}
					}
				}, 50, { leading: true })

				onMouseOutDOM = (event) => {
					if (!this.isEditMode) return;
					const target = event.target;
					
					// 如果是工具栏元素，不处理
					if (this.isToolbarElement(target)) return;
					
					const relatedTarget = event.relatedTarget;
					// 如果移动到工具栏，不隐藏
					if (relatedTarget && this.isToolbarElement(relatedTarget)) return;
					
					// 如果正在调整大小或拖拽，不隐藏
					if (window.slideEditor?.hoverToolbar.isResizing || window.slideEditor?.hoverToolbar.isDragging) return;
					
					// 清除悬停效果（但保留选中效果）
					if (this.currentElement === target && target !== this.selectedElement) {
						this.clearOutlineHover();
						this.currentElement = null;
					}
				}

				// 显示元素的UI（框和工具栏）
				showElementUI(element, event) {
					if (!element) return;
					
					// 显示工具栏
					window.slideEditor?.hoverToolbar.showToolbar(event || { target: element });
				}

				// 清除所有状态
				clearAllStates() {
					this.clearOutlineHover();
					this.clearAllFocusOutlines(); // 🔥 使用强制清除方法
					this.currentElement = null;
					// 停止任何正在进行的拖拽或调整大小操作
					if (window.slideEditor?.hoverToolbar.isDragging) {
						window.slideEditor.hoverToolbar.stopDrag();
					}
					if (window.slideEditor?.hoverToolbar.isResizing) {
						window.slideEditor.hoverToolbar.stopResize();
					}
					window.slideEditor?.hoverToolbar.hideToolbar();
				}

				addSolidOutline(element) {
					if (document.activeElement !== element) {
						element.classList.add('magic-ppt-tip-focus');
						element.setAttribute('data-ppt-editable', 'focus');
					}
				}

				addDashedOutline(element) {
					if (document.activeElement !== element) {
						element.classList.add('magic-ppt-tip-hover');
						element.setAttribute('data-ppt-editable', 'hover');
					}
				}

				removeOutline = (element, type) => {
					if (document.activeElement !== element) {
						if (type === 'focus') {
							element.classList.remove('magic-ppt-tip-focus');
						} else {
							element.classList.remove('magic-ppt-tip-hover');
						}
						element.removeAttribute('data-ppt-editable');
					}
				}

				clearOutlineHover = () => {
					const hoverElements = document.querySelectorAll('[data-ppt-editable="hover"]');
					hoverElements?.forEach((element) => {
						this.removeOutline(element, 'hover');
					});
					
					const hoverClasses = document.querySelectorAll('.magic-ppt-tip-hover');
					hoverClasses?.forEach((element) => {
						this.removeOutline(element, 'hover');
					});
				}

				clearOutlineFocus = () => {
					this.clearOutlineFocusByDocObject(document);
					window.slideEditor?.clearEffects();
				}

				// 🔥 新增方法：强制清除所有选中状态，不受activeElement限制
				clearAllFocusOutlines = () => {
					// 强制清除所有带有 magic-ppt-tip-focus 类的元素
					const focusElements = document.querySelectorAll('.magic-ppt-tip-focus');
					focusElements?.forEach((element) => {
						element.classList.remove('magic-ppt-tip-focus');
						element.removeAttribute('data-ppt-editable');
					});
					
					// 强制清除所有可编辑元素的状态
					const editableElements = document.querySelectorAll('[contenteditable="true"]');
					editableElements?.forEach((element) => {
						element.classList.remove('magic-ppt-tip-focus');
						element.removeAttribute('data-ppt-editable');
						element.removeAttribute('contenteditable');
					});
					
					// 清除当前记录的选中元素
					this.selectedElement = null;
				}

				clearOutlineFocusByDocObject = (doc) => {
					const focusElements = doc.querySelectorAll('.magic-ppt-tip-focus');
					focusElements?.forEach((element) => {
						this.removeOutline(element, 'focus');
					});
					
					const editableElements = doc.querySelectorAll('[contenteditable="true"]');
					editableElements?.forEach((element) => {
						if (element) {
							this.removeOutline(element, 'focus');
							element.removeAttribute('contenteditable');
						}
					});
				}

				resetAll = () => {
					this.clearAllStates();
				}

				shouldSkipElement(element, event) {
					// 🔥 修复子元素选择问题：只有当点击的是完全相同的元素时才跳过，允许选择子元素
					if (window.slideEditor?.editingDom && window.slideEditor.editingDom === element) {
						return true; // 只跳过相同的元素，允许选择子元素
					}

					// 🔥 核心逻辑：处理嵌套容器问题
					const shouldBubbleUp = this.bubbleUpClickBlock(element, event);
					if (shouldBubbleUp) return true;

					const customNodes = document.querySelectorAll('[custom-node=true]');
					for (let i = 0; i < customNodes.length; i++) {
						const node = customNodes[i];
						if (node.contains(element) || node === element) return true;
					}

					if (element.closest('.slide-editor-ui')) return true;

					const tagName = element.tagName.toLowerCase();
					if (['html', 'body', 'script', 'style', 'link', 'meta', 'audio', 'video', 'source', 'picture', 'area'].includes(tagName)) {
						return true;
					}
					if (tagName === 'img' || tagName === 'canvas') {
						return false;
					}
					const svgTags = ['svg'];
					for (let tag of svgTags) {
						if (element.closest(tag) && element.namespaceURI === 'http://www.w3.org/2000/svg') {
							return true;
						}
					}

					// 🎯 放开块元素编辑：允许空内容的容器元素被编辑
					// 只有完全没有子元素且没有文本内容的元素才跳过
					const hasChildren = element.children && element.children.length > 0;
					const hasTextContent = element.textContent?.trim() !== '';
					
					// 如果有子元素或有文本内容，就允许编辑
					return !hasChildren && !hasTextContent;
				}

				// 核心逻辑：放开块元素编辑限制的冒泡逻辑
				bubbleUpClickBlock(element, event) {
					// 🎯 放开块元素编辑：移除了对"所有子元素都是块级元素"的限制
					// 现在所有块级元素都可以被直接编辑
					
					// 1️⃣ 如果当前元素不是内联元素 -> 可以选择（放开限制）
					if (!this.checkIsInlineElement(element)) {
						return false; // 允许编辑块级元素
					}
					
					// 2️⃣ 如果是内联元素，向上冒泡到块级父元素
					let current = element;
					while (current && current !== document.body) {
						if (current.parentElement && !this.checkIsInlineElement(current.parentElement)) {
							this.bubbleUpClick(current, event);
							return true; // 触发父元素的点击
						}
						current = current.parentElement;
					}
					return false;
				}



				// 检查是否是内联元素
				checkIsInlineElement(element) {
					return this.isElement(element) ? window.getComputedStyle(element).display === 'inline' : true;
				}

				// 冒泡点击事件到父元素
				bubbleUpClick(element, event) {
					const parent = element.parentElement;
					if (parent && event && event.constructor && event.type) {
						const bubbledEvent = new Event(event.type, { bubbles: true, cancelable: true });
						parent.dispatchEvent(bubbledEvent);
					}
				}

				// 检查是否是元素节点
				isElement(element) {
					return element.nodeType === Node.ELEMENT_NODE;
				}

				isToolbarElement(element) {
					return !!(element.closest('[data-hover-toolbar]') || element.hasAttribute('data-hover-toolbar') ||
						element.closest('[data-resize-handles]') || element.hasAttribute('data-resize-handles') ||
						element.hasAttribute('data-resize-handle') || element.hasAttribute('data-drag-handle') ||
						element.closest('[data-ai-dropdown]') || element.hasAttribute('data-ai-dropdown'));
				}
			}

			// 初始化编辑功能
			function initEditingSystem() {
				// 添加编辑样式
				const style = document.createElement('style');
				style.setAttribute('data-injected', 'true');
				style.textContent = \`
					.magic-ppt-tip-hover {
						outline: 1px dashed var(--icon-blue, #0081f2);
						outline-offset: 2px;
						border-radius: 6px;
						cursor: pointer;
						transition: outline 0.2s ease;
					}
					.magic-ppt-tip-focus {
						outline: 2px solid var(--icon-blue, #0081f2);
						border-radius: 6px;
						box-shadow: 0 0 0 1px rgba(0, 129, 242, 0.1);
						transition: outline 0.2s ease;
					}
					/* 当元素同时具有选中和悬停状态时，显示双重边框效果 */
					.magic-ppt-tip-focus.magic-ppt-tip-hover {
						outline: 2px solid var(--icon-blue, #0081f2);
						box-shadow: 0 0 0 1px rgba(0, 129, 242, 0.1), 0 0 0 4px rgba(0, 129, 242, 0.2);
					}
					.magic-ppt-tip-focus[contenteditable="true"] {
						outline: 2px solid var(--icon-blue, #0081f2);
						cursor: text;
					}

					[data-resize-handles] {
						pointer-events: none;
					}
					[data-resize-handle] {
						pointer-events: all;
						box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
						transition: all 0.2s ease;
					}
					[data-resize-handle]:hover {
						background-color: #005bb5;
						transform: translate(-50%, -50%) scale(1.2);
						box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
					}

					/* 拖拽手柄样式 */
					[data-drag-handle] {
						pointer-events: all;
						user-select: none;
					}
					
					[data-drag-handle]:hover {
						box-shadow: 0 4px 12px rgba(0, 129, 242, 0.4) !important;
					}
					
					[data-drag-handle]:active {
						box-shadow: 0 2px 8px rgba(0, 129, 242, 0.6) !important;
					}

					/* 工具栏样式 */
					[data-hover-toolbar] {
						box-shadow: 0px 4px 20px 0px rgba(0, 0, 0, 0.15);
						backdrop-filter: blur(20px);
					}
					
					[data-hover-toolbar] button {
						transition: all 0.2s ease;
						position: relative;
					}
					
					[data-hover-toolbar] button:hover {
						background-color: rgba(0, 129, 242, 0.1) !important;
						border-radius: 4px;
						transform: scale(1.05);
					}
					
					[data-hover-toolbar] button:active {
						transform: scale(0.95);
					}
					
					/* 文本工具栏特定样式 */
					[data-text-toolbar] {
						animation: slideIn 0.2s ease-out;
					}
					
					@keyframes slideIn {
						from {
							opacity: 0;
							transform: translateY(-8px);
						}
						to {
							opacity: 1;
							transform: translateY(0);
						}
					}
					
					/* 按钮激活状态 */
					[data-hover-toolbar] button[data-active="true"] {
						background-color: #2E2F380D !important;
						color: #64748B !important;
					}
					
					/* 颜色选择器样式 */
					[data-injected][style*="grid-template-columns"] {
						animation: fadeIn 0.15s ease-out;
					}
					
					@keyframes fadeIn {
						from {
							opacity: 0;
							transform: scale(0.9);
						}
						to {
							opacity: 1;
							transform: scale(1);
						}
					}
					
					/* 分隔符样式 */
					[data-hover-toolbar] div[style*="width: 1px"] {
						opacity: 0.3;
					}
					
					/* 响应式设计 */
					@media (max-width: 768px) {
						[data-hover-toolbar] {
							max-width: calc(100vw - 40px) !important;
						}
						
						[data-hover-toolbar] button {
							min-width: 28px !important;
							min-height: 28px !important;
							padding: 6px !important;
						}
					}
				\`;
				document.head.appendChild(style);

				// 创建全局实例
				window.slideEditor = new SlideEditor();
				window.slideSelector = new SlideSelector();
				window.slideSelector.init();

				// 监听父窗口消息
				window.addEventListener('message', function(event) {
					const { type } = event.data;
					switch (type) {
						case MessageType.EDIT_START:
							window.slideSelector.setEditMode(true);
							break;
						case MessageType.EDIT_EXIT:
							window.slideSelector.setEditMode(false);
							break;
						case MessageType.SAVE_START:
							// 接收到保存指令，执行保存
							console.log('收到保存指令，当前状态:', {
								hasSlideEditor: !!window.slideEditor,
								isChanged: window.slideEditor?.isChanged,
								editingDom: !!window.slideEditor?.editingDom
							});
							console.log(window.slideEditor, "window.slideEditor")
							if(window.slideEditor){
								window.slideEditor.saveToServer();
							}
							// if (window.slideEditor && window.slideEditor.isChanged) {
							// 	window.slideEditor.saveToServer();
							// } else {
							// 	console.log('没有内容变化，无需保存');
							// 	// 即使没有变化，也给用户一个反馈
							// }
							break;
					}
				});
			}

			// 启动编辑系统
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', initEditingSystem);
			} else {
				initEditingSystem();
			}
		})();
	`
}
