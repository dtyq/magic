# MagicIcon Componente Icona Magica ✨

`MagicIcon` è un componente wrapper per icone basato su Tabler Icons, che fornisce adattamento al tema e controllo uniforme degli stili.

## Proprietà

| Nome Proprietà | Tipo                                                                    | Valore Predefinito | Descrizione                     |
| -------------- | ----------------------------------------------------------------------- | ------------------ | ------------------------------- |
| component      | ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>> | -                  | Il componente icona Tabler da renderizzare |
| active         | boolean                                                                 | false              | Se è in stato attivo            |
| animation      | boolean                                                                 | false              | Se abilitare effetti di animazione |
| ...IconProps   | -                                                                       | -                  | Supporta tutte le proprietà di Tabler Icons |

## Utilizzo Base

```tsx
import { MagicIcon } from '@/components/base/MagicIcon';
import { IconHome, IconStar, IconSettings } from '@tabler/icons-react';

// Icona base
<MagicIcon component={IconHome} />

// Dimensione personalizzata
<MagicIcon component={IconStar} size={24} />

// Colore personalizzato (sovrascrive il colore del tema)
<MagicIcon component={IconSettings} color="blue" />

// Spessore linea personalizzato
<MagicIcon component={IconHome} stroke={2} />

// Stato attivo
<MagicIcon component={IconStar} active />

// Con effetto animazione (se implementato)
<MagicIcon component={IconSettings} animation />
```

## Caratteristiche 🌟

1. **Adattamento al Tema** 🎨: Regola automaticamente il colore dell'icona in base al tema corrente (chiaro/scuro)
2. **Stile Uniforme** 📏: Fornisce spessore linea e colore uniformi per default
3. **Sicurezza dei Tipi** 🔒: Supporto completo per TypeScript con definizioni di tipo complete
4. **Estensione Flessibile** 🔧: Facilita la personalizzazione delle caratteristiche dell'icona tramite proprietà

## Quando Usare ❓

- Quando hai bisogno di usare icone Tabler nella tua app
- Quando le icone devono adattarsi automaticamente ai cambiamenti di tema
- Quando devi gestire uniformemente gli stili delle icone
- Quando devi aggiungere stati interattivi alle icone (come stato attivo)

Il componente MagicIcon rende l'uso delle icone più semplice e uniforme, assicurando che si adattino alle impostazioni del tema della tua app. 🚀

---

**Testo Originale (Cinese):**

# MagicIcon 魔法图标组件

`MagicIcon` 是一个基于 Tabler Icons 的图标包装组件，提供了主题适配和统一的样式控制。

## 属性

| 属性名       | 类型                                                                    | 默认值 | 说明                         |
| ------------ | ----------------------------------------------------------------------- | ------ | ---------------------------- |
| component    | ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>> | -      | 要渲染的 Tabler 图标组件     |
| active       | boolean                                                                 | false  | 是否处于激活状态             |
| animation    | boolean                                                                 | false  | 是否启用动画效果             |
| ...IconProps | -                                                                       | -      | 支持所有 Tabler Icons 的属性 |

## 基础用法

```tsx
import { MagicIcon } from '@/components/base/MagicIcon';
import { IconHome, IconStar, IconSettings } from '@tabler/icons-react';

// 基础图标
<MagicIcon component={IconHome} />

// 自定义大小
<MagicIcon component={IconStar} size={24} />

// 自定义颜色（会覆盖主题颜色）
<MagicIcon component={IconSettings} color="blue" />

// 自定义线条粗细
<MagicIcon component={IconHome} stroke={2} />

// 激活状态
<MagicIcon component={IconStar} active />

// 带动画效果（如果实现了动画）
<MagicIcon component={IconSettings} animation />
```

## 特点

1. **主题适配**：自动根据当前主题（亮色/暗色）调整图标颜色
2. **统一样式**：默认提供了统一的线条粗细和颜色
3. **类型安全**：完全支持 TypeScript，提供了完整的类型定义
4. **灵活扩展**：可以通过属性轻松自定义图标的各种特性

## 何时使用

-   需要在应用中使用 Tabler 图标时
-   需要图标自动适应主题变化时
-   需要统一管理图标样式时
-   需要为图标添加交互状态（如激活状态）时

MagicIcon 组件让你的图标使用更加简单和统一，同时确保它们能够适应应用的主题设置。
