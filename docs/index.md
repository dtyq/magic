---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

# 添加语言自动检测脚本
head:
  - - script
    - {}
    - |
      // 检测浏览器语言并重定向
      (function() {
        var userLang = navigator.language || navigator.userLanguage;
        var path = userLang.startsWith('zh') ? '/zh/' : '/en/';
        // 仅在根路径时进行重定向，避免重复重定向
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
          window.location.href = path;
        }
      })();

hero:
  name: "Magic"
  text: "The New Generation Enterprise-level AI Application Innovation Engine"
  tagline: Build powerful AI applications with ease
  actions:
    - theme: brand
      text: Tutorial
      link: /en/tutorial/quick-start/quick-introduction.md
    - theme: alt
      text: Development Guide
      link: /en/development/quick-start/quick-introduction.md

# features:
#   - icon: 🚀
#     title: Fast & Efficient 
#     details: Built with performance in mind, Magic Docs provides lightning-fast documentation sites.
#   - icon: 🎨
#     title: Beautiful Design
#     details: Modern and clean design that works well on all devices.
#   - icon: 🔧
#     title: Easy to Use
#     details: Simple configuration and powerful features make it easy to create professional documentation.
# --- 