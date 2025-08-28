---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

# Aggiungi script di rilevamento della lingua 🌐
head:
  - - script
    - {}
    - |
      // Rileva la lingua del browser e reindirizza
      (function() {
        var userLang = navigator.language || navigator.userLanguage;
        var path = userLang.startsWith('zh') ? '/zh/' : '/en/';
        // Reindirizza solo dalla radice per evitare reindirizzamenti ripetuti
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
          window.location.href = path;
        }
      })();

hero:
  name: "Magic"
  text: "La nuova generazione di motore di innovazione per applicazioni AI a livello enterprise"
  tagline: "Crea potenti applicazioni AI con facilità ✨🤖"
  actions:
    - theme: brand
      text: "Tutorial 📘"
      link: /en/tutorial/quick-start/quick-introduction.md
    - theme: alt
      text: "Guida allo sviluppo 🛠️"
      link: /en/development/quick-start/quick-introduction.md

# features:
#   - icon: 🚀
#     title: Veloce e Efficiente
#     details: Progettato per le prestazioni, Magic Docs offre siti di documentazione estremamente veloci.
#   - icon: 🎨
#     title: Design Accattivante
#     details: Design moderno e pulito che funziona bene su tutti i dispositivi.
#   - icon: 🔧
#     title: Facile da Usare
#     details: Configurazione semplice e funzionalità potenti per creare documentazione professionale.
---

<!-- Testo originale (sotto) -->
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