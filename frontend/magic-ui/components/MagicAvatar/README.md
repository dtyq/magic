# MagicAvatar Componente Avatar Magico ✨

`MagicAvatar` è una versione migliorata del componente Avatar di Ant Design, che offre generazione automatica di colori, supporto per badge e altre funzionalità.

## Proprietà

| Nome Proprietà | Tipo                                      | Valore Predefinito | Descrizione                          |
| -------------- | ----------------------------------------- | ------------------ | ------------------------------------ |
| badgeProps     | BadgeProps                                | -                  | Proprietà del badge, per mostrare un badge sull'avatar |
| size           | number \| 'large' \| 'small' \| 'default' | 40                 | Dimensione dell'avatar               |
| shape          | 'circle' \| 'square'                      | 'square'           | Forma dell'avatar, predefinita quadrata |
| src            | string                                    | -                  | URL dell'immagine dell'avatar        |
| ...AvatarProps | -                                         | -                  | Supporta tutte le proprietà di Ant Design Avatar |

## Utilizzo Base

```tsx
import { MagicAvatar } from '@/components/base/MagicAvatar';

// Utilizzo base - Usa testo (taglia automaticamente i primi due caratteri)
<MagicAvatar>Nome Utente</MagicAvatar>

// Usa immagine
<MagicAvatar src="https://example.com/avatar.png" />

// Dimensione personalizzata
<MagicAvatar size={64}>Avatar Grande</MagicAvatar>
<MagicAvatar size={24}>Avatar Piccolo</MagicAvatar>

// Usa badge
<MagicAvatar
  badgeProps={{
    count: 5,
    dot: true,
    status: 'success'
  }}
>
  Utente
</MagicAvatar>

// Stile personalizzato
<MagicAvatar style={{ border: '2px solid red' }}>Personalizzato</MagicAvatar>
```

## Caratteristiche

1. **Generazione Automatica Colori** 🎨: Quando non viene fornita un'immagine, genera automaticamente il colore di sfondo e testo basato sul contenuto del testo.
2. **Supporto Badge** 🏷️: Puoi aggiungere un badge sull'avatar tramite `badgeProps`, per mostrare stato o numeri.
3. **Taglio Testo** ✂️: Taglia automaticamente i primi due caratteri del testo come contenuto dell'avatar.
4. **Validazione URL** 🔗: Valida automaticamente se src è un URL valido, altrimenti torna al testo.
5. **Stile Uniforme** ✨: Fornisce bordi uniformi e ombre di testo.

## Quando Usare

- Quando devi mostrare un avatar utente 👤
- Quando devi mostrare stato o numero di notifiche sull'avatar 🔔
- Quando devi generare automaticamente un avatar colorato basato sul nome utente 🌈
- Quando devi mostrare identificatori utente in liste o commenti 📝

Il componente MagicAvatar rende la presentazione degli avatar più bella e intelligente, senza bisogno di preparare immagini per ogni utente, offrendo un effetto personalizzato. 🪄

---

**Testo Originale (Cinese):**

# MagicAvatar 魔法头像组件

`MagicAvatar` 是一个基于 Ant Design Avatar 组件的增强版头像组件，提供了自动生成颜色、徽章支持等功能。

## 属性

| 属性名         | 类型                                      | 默认值   | 说明                              |
| -------------- | ----------------------------------------- | -------- | --------------------------------- |
| badgeProps     | BadgeProps                                | -        | 徽章的属性，用于在头像上显示徽章  |
| size           | number \| 'large' \| 'small' \| 'default' | 40       | 头像的大小                        |
| shape          | 'circle' \| 'square'                      | 'square' | 头像的形状，默认为方形            |
| src            | string                                    | -        | 头像图片的地址                    |
| ...AvatarProps | -                                         | -        | 支持所有 Ant Design Avatar 的属性 |

## 基础用法

```tsx
import { MagicAvatar } from '@/components/base/MagicAvatar';

// 基础用法 - 使用文字（会自动截取前两个字符）
<MagicAvatar>用户名</MagicAvatar>

// 使用图片
<MagicAvatar src="https://example.com/avatar.png" />

// 自定义大小
<MagicAvatar size={64}>大头像</MagicAvatar>
<MagicAvatar size={24}>小头像</MagicAvatar>

// 使用徽章
<MagicAvatar
  badgeProps={{
    count: 5,
    dot: true,
    status: 'success'
  }}
>
  用户
</MagicAvatar>

// 自定义样式
<MagicAvatar style={{ border: '2px solid red' }}>自定义</MagicAvatar>
```

## 特点

1. **自动生成颜色**：当没有提供图片时，会根据文本内容自动生成背景色和文本颜色
2. **徽章支持**：可以通过 `badgeProps` 在头像上添加徽章，显示状态或数字
3. **文本截取**：自动截取文本的前两个字符作为头像内容
4. **URL 验证**：自动验证 src 是否为有效的 URL，无效时回退到文本显示
5. **统一样式**：提供了统一的边框和文本阴影效果

## 何时使用

-   需要展示用户头像时
-   需要在头像上显示状态或通知数量时
-   需要根据用户名自动生成有颜色的头像时
-   需要在列表或评论中显示用户标识时

MagicAvatar 组件让你的头像展示更加美观和智能，无需为每个用户准备头像图片，也能呈现出个性化的效果。
