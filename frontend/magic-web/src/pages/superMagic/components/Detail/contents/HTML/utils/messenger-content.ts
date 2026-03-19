// HTML Messenger 内容模板
export const getHTMLMessengerContent = () => {
	const baseContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HTML Messenger</title>
  <script>
    // 定义事件处理函数，方便重用
    function setupMessageListener() {
      window.addEventListener("message", handleMessage);
    }

    // Report iframe errors to parent for logging
    function sendErrorToParent(payload) {
      try {
        window.parent.postMessage({
          type: "iframeError",
          payload: payload
        }, "*");
      } catch (e) {
        console.error("Failed to send iframe error to parent:", e);
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
        return false; // allow default error handling
      };
      window.addEventListener("unhandledrejection", function(event) {
        var reason = event.reason;
        var message = typeof reason === "string" ? reason : (reason && reason.message) || "Unknown promise rejection";
        var stack = reason && reason.stack ? reason.stack : "";
        sendErrorToParent({
          errorType: "unhandledrejection",
          message: message,
          stack: stack
        });
      });
    }

    var isAnimationPaused = false;

    function applyAnimationState() {
      var styleId = "magic-animation-pause";
      var existingStyle = document.getElementById(styleId);
      
      if (isAnimationPaused) {
        // 1. 暂停CSS动画
        if (!existingStyle) {
          var style = document.createElement("style");
          style.id = styleId;
          style.textContent = "*{animation:none!important}*::before,*::after{animation:none!important}";
          if (document.head) {
            document.head.appendChild(style);
          } else if (document.documentElement) {
            document.documentElement.appendChild(style);
          }
        }
        
        // 2. 暂停所有视频和音频，并重置播放位置（解决预加载页面的音频问题）
        try {
          var videos = document.querySelectorAll("video");
          var audios = document.querySelectorAll("audio");
          
          videos.forEach(function(video) {
            if (!video.paused) {
              // 标记该媒体之前正在播放，以便恢复时使用
              video.setAttribute("data-was-playing", "true");
            }
            // 暂停播放
            video.pause();
            // 重置播放位置到开始
            video.currentTime = 0;
          });
          
          audios.forEach(function(audio) {
            if (!audio.paused) {
              audio.setAttribute("data-was-playing", "true");
            }
            // 暂停播放
            audio.pause();
            // 重置播放位置到开始
            audio.currentTime = 0;
          });
        } catch (error) {
          console.warn("暂停媒体时出错:", error);
        }
        
        return;
      }
      
      // 恢复状态
      if (existingStyle) {
        existingStyle.remove();
      }
      
      // 3. 恢复之前正在播放的视频和音频
      try {
        var videos = document.querySelectorAll("video[data-was-playing='true']");
        var audios = document.querySelectorAll("audio[data-was-playing='true']");
        
        videos.forEach(function(video) {
          video.removeAttribute("data-was-playing");
          // 使用 catch 处理自动播放策略限制
          video.play().catch(function(err) {
            console.log("视频自动播放被限制:", err.message);
          });
        });
        
        audios.forEach(function(audio) {
          audio.removeAttribute("data-was-playing");
          audio.play().catch(function(err) {
            console.log("音频自动播放被限制:", err.message);
          });
        });
      } catch (error) {
        console.warn("恢复媒体播放时出错:", error);
      }
    }

    function handleMessage(event) {
      try {
        if (event.data && event.data.type === "setContent") {
          // 初始加载：使用 document.write()
          document.open();
          document.write(event.data.content);
          document.close();
          setupMessageListener();
          setupClickListener();
          setupKeyboardListener();
          setupErrorHandler();
          setupDOMLoadListeners();
          applyAnimationState();
          
          // 通知父窗口内容已加载
          window.parent.postMessage({ type: "contentLoaded" }, "*");
        } else if (event.data && event.data.type === "setAnimationState") {
          isAnimationPaused = !!event.data.paused;
          applyAnimationState();
        } else if (event.data && event.data.type === "editModeChange") {
          // 处理编辑模式变化（旧协议，向后兼容）
          isEditMode = event.data.isEditMode;

          // 如果退出编辑模式，发送退出消息给编辑系统
          if (!event.data.isEditMode && window.slideSelector) {
            window.slideSelector.setEditMode(false);
          }
        } else if (event.data && event.data.version === "1.0.0" && event.data.category === "event" && event.data.type === "EDIT_MODE_CHANGED") {
          // 处理编辑模式变化（V2 协议）
          if (event.data.payload && typeof event.data.payload.isEditMode === 'boolean') {
            isEditMode = event.data.payload.isEditMode;

            // 如果退出编辑模式，发送退出消息给编辑系统
            if (!isEditMode && window.slideSelector) {
              window.slideSelector.setEditMode(false);
            }
          }
        } else if (event.data && event.data.type === "injectEditScript") {
          // 动态注入编辑脚本（V1 版本）
          try {
            // 存储 scaleRatio 到全局变量
            window.__MAGIC_SCALE_RATIO__ = event.data.scaleRatio || 1;
            
            const script = document.createElement('script');
            script.setAttribute("data-injected", "true");
            script.textContent = event.data.scriptContent;
            document.head.appendChild(script);
            
            // 延迟一点时间确保脚本加载完成后再启用编辑模式
            // setTimeout(() => {
              if (window.slideSelector) {
                window.slideSelector.setEditMode(true);
                isEditMode = true;
              }
            // }, 100);
          } catch (error) {
            console.error("注入编辑脚本失败:", error);
          }
        } else if (event.data && event.data.type === "injectEditScriptV2") {
          // 动态注入 V2 编辑脚本
          try {
            // 存储 scaleRatio 到全局变量
            window.__MAGIC_SCALE_RATIO__ = event.data.scaleRatio || 1;
            
            // ALWAYS clean up old instances before re-injection (unconditional cleanup)
            console.log("[Messenger] 清理旧的编辑器实例（无条件清理）");
            
            // 清理旧的 EditorRuntime（完整清理）
            if (window.__iframeEditorRuntime__) {
              try {
                console.log("[Messenger] 销毁旧的 EditorRuntime 实例");
                window.__iframeEditorRuntime__.destroy();
              } catch (e) {
                console.warn("[Messenger] 清理旧的 EditorRuntime 失败:", e);
              }
              delete window.__iframeEditorRuntime__;
            }
            
            // 清理之前的实例
            if (window.__elementSelectorV2__) {
              try {
                window.__elementSelectorV2__.destroy();
              } catch (e) {
                console.warn("[Messenger] 清理旧的 ElementSelector 失败:", e);
              }
              delete window.__elementSelectorV2__;
            }
            
            if (window.__editingAPIV2__) {
              delete window.__editingAPIV2__;
            }
            
            // 清理旧的 EditorBridge（如果存在且是简化版本）
            if (window.__editorBridge__ && window.__editorBridge__.constructor.name === 'SimpleEditorBridge') {
              try {
                window.__editorBridge__.destroy();
              } catch (e) {
                console.warn("[Messenger] 清理旧的 EditorBridge 失败:", e);
              }
              delete window.__editorBridge__;
            }
            
            // 清除注入标记
            if (window.__EDITING_FEATURES_V2_INJECTED__) {
              delete window.__EDITING_FEATURES_V2_INJECTED__;
            }
            
            const script = document.createElement('script');
            script.setAttribute("data-injected", "true");
            script.textContent = event.data.scriptContent;
            document.head.appendChild(script);
            
            // V2 脚本会自动初始化，延迟启用选择模式
            setTimeout(() => {
              if (window.__editingAPIV2__) {
                console.log("[Messenger] 启用 V2 选择模式");
                window.__editingAPIV2__.enable();
              } else {
                console.warn("[Messenger] V2 编辑 API 未找到");
              }
            }, 100);
            
            console.log("[Messenger] V2 编辑脚本已注入");
          } catch (error) {
            console.error("注入 V2 编辑脚本失败:", error);
          }
        }
      } catch (error) {
        console.error("处理消息时出错:", error);
      }
    }

    // 设置点击事件监听器
    function setupClickListener() {
      document.addEventListener("click", function(event) {
        try {
          // 如果 V2 编辑功能已启用，不发送旧协议的点击消息
          // V2 编辑脚本会通过 EditorBridge 发送 ELEMENT_SELECTED 事件
          if (window.__editingAPIV2__ && window.__elementSelectorV2__ && window.__elementSelectorV2__.enabled) {
            // V2 编辑模式下，点击事件由 editing-script-v2 处理
            return;
          }
          
          // 通知父窗口发生了点击事件（旧协议，用于非编辑模式）
          window.parent.postMessage({
            type: "documentClicked",
            target: event.target.tagName,
            x: event.clientX,
            y: event.clientY
          }, "*");
        } catch (error) {
          console.error("发送点击事件消息时出错:", error);
        }
      });
    }

    // 全局变量来跟踪编辑模式状态
    var isEditMode = false;

    // 设置键盘事件监听器
    function setupKeyboardListener() {
      document.addEventListener("keydown", function(event) {
        try {
          // 如果在编辑模式或目标是可编辑元素，不处理PPT翻页相关的键盘事件，允许正常冒泡和默认行为
          const isTargetEditable = event.target instanceof HTMLElement && 
                                    (event.target.isContentEditable || 
                                     event.target.tagName === 'INPUT' || 
                                     event.target.tagName === 'TEXTAREA');
          
          if (isEditMode || isTargetEditable) {
            return;
          }
          
          // 监听方向键和空格键，通知父窗口进行PPT翻页
          const key = event.key;
          let direction = null;
          
          switch (key) {
            case "ArrowLeft":
            case "ArrowUp":
            case "PageUp":
              direction = "prev";
              break;
            case "ArrowRight":
            case "ArrowDown":
            case " ": // 空格键
            case "PageDown":
              direction = "next";
              break;
            case "Home":
              direction = "first";
              break;
            case "End":
              direction = "last";
              break;
            case "F11":
              direction = "fullscreen";
              break;
            case "Escape":
              direction = "escape";
              break;
          }
          
          if (direction) {
            event.preventDefault();
            window.parent.postMessage({
              type: "keyboardEvent",
              direction: direction,
              originalKey: key
            }, "*");
          }
        } catch (error) {
          console.error("发送键盘事件消息时出错:", error);
        }
      });
    }


    // 设置DOM加载监听器
    function setupDOMLoadListeners() {
      // 检查DOM是否已经准备就绪
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function() {
          window.parent.postMessage({ type: "domReady" }, "*");
          // 等待下一帧确保渲染完成
          waitForRenderComplete();
        });
      } else {
        // DOM已经准备好了，立即通知
        window.parent.postMessage({ type: "domReady" }, "*");
        waitForRenderComplete();
      }
      
      // 检查页面是否完全加载
      if (document.readyState === "complete") {
        window.parent.postMessage({ type: "pageFullyLoaded" }, "*");
      } else {
        window.addEventListener("load", function() {
          window.parent.postMessage({ type: "pageFullyLoaded" }, "*");
        });
      }
    }

    // 等待渲染完成
    function waitForRenderComplete() {
      // 使用requestAnimationFrame确保浏览器完成了一帧渲染
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          // 通知父窗口渲染已完成
          window.parent.postMessage({ type: "renderComplete" }, "*");
        });
      });
    }

    setupMessageListener();
    setupKeyboardListener();
    setupErrorHandler();

    // 页面加载完成后通知父窗口
    window.addEventListener("DOMContentLoaded", function() {
      try {
        // 通知父窗口iframe已准备好接收内容
        window.parent.postMessage({ type: "iframeReady" }, "*");
      } catch (error) {
        console.error("发送iframeReady消息时出错:", error);
      }
    });

    // 页面完全加载完成后通知父窗口
    window.addEventListener("load", function() {
      try {
        // 通知父窗口页面已完全加载（包括图片、样式表等）
        window.parent.postMessage({ type: "pageLoaded" }, "*");
      } catch (error) {
        console.error("发送pageLoaded消息时出错:", error);
      }
    });
  </script>
  <style>
    html,body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .loading {
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="loading">
  </div>
</body>
</html>`

	return baseContent
}
