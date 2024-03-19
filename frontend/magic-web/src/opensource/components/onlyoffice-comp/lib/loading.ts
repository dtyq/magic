// 简化的加载提示，不使用 ranui
export const showLoading = (): { removeLoading: () => void } => {
	const mask = document.createElement("div")
	mask.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `

	// 创建简单的加载动画
	const spinner = document.createElement("div")
	spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 4px solid rgba(24, 144, 255, 0.2);
    border-top-color: #1890ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  `

	// 添加旋转动画
	const style = document.createElement("style")
	style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
	document.head.appendChild(style)

	mask.appendChild(spinner)
	document.body.appendChild(mask)

	return {
		removeLoading: () => {
			if (document.body?.contains(mask)) {
				document.body.removeChild(mask)
			}
			if (document.head?.contains(style)) {
				document.head.removeChild(style)
			}
		},
	}
}
