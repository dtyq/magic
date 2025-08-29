# MagicMenu Componente Menu Magico 🪄

`MagicMenu` è una versione migliorata del componente Menu di Ant Design, che offre uno stile più pulito e una migliore esperienza utente.

## Proprietà

| Nome Proprietà | Tipo | Valore Predefinito | Descrizione                          |
| -------------- | ---- | ------------------ | ------------------------------------ |
| ...MenuProps   | -    | -                  | Supporta tutte le proprietà del Menu di Ant Design |

## Uso Base

```tsx
import { MagicMenu } from '@/components/base/MagicMenu';
import { IconHome, IconUser, IconSettings } from '@tabler/icons-react';

// Uso base
<MagicMenu
  items={[
    {
      key: 'home',
      label: 'Homepage',
      icon: <IconHome size={16} />,
    },
    {
      key: 'profile',
      label: 'Centro Personale',
      icon: <IconUser size={16} />,
    },
    {
      key: 'settings',
      label: 'Impostazioni',
      icon: <IconSettings size={16} />,
    },
  ]}
/>

// Elemento selezionato predefinito
<MagicMenu
  defaultSelectedKeys={['home']}
  items={[
    {
      key: 'home',
      label: 'Homepage',
    },
    {
      key: 'profile',
      label: 'Centro Personale',
    },
  ]}
/>

// Menu verticale
<MagicMenu
  mode="vertical"
  items={[
    {
      key: 'home',
      label: 'Homepage',
    },
    {
      key: 'profile',
      label: 'Centro Personale',
    },
  ]}
/>

// Con sottomenu
<MagicMenu
  mode="vertical"
  items={[
    {
      key: 'home',
      label: 'Homepage',
    },
    {
      key: 'settings',
      label: 'Impostazioni',
      children: [
        {
          key: 'general',
          label: 'Impostazioni Generali',
        },
        {
          key: 'account',
          label: 'Impostazioni Account',
        },
      ],
    },
  ]}
/>

// Operazione pericolosa
<MagicMenu
  items={[
    {
      key: 'profile',
      label: 'Centro Personale',
    },
    {
      key: 'logout',
      label: 'Esci',
      danger: true,
    },
  ]}
/>

// Ascolta evento di selezione
<MagicMenu
  onClick={({ key }) => console.log('Cliccato:', key)}
  items={[
    {
      key: 'home',
      label: 'Homepage',
    },
    {
      key: 'profile',
      label: 'Centro Personale',
    },
  ]}
/>
```

## Caratteristiche ✨

1. **Design Pulito** 🧹: Rimuove il colore di sfondo e il bordo degli elementi selezionati, per un effetto visivo più pulito
2. **Sfondo Trasparente** 🔍: Sfondo del menu trasparente, per integrarsi meglio in varie interfacce
3. **Spaziatura Ottimizzata** 📏: Spaziatura ragionevole tra gli elementi del menu, per migliorare la leggibilità
4. **Ottimizzazione Operazioni Pericolose** ⚠️: Gli elementi di operazioni pericolose hanno un effetto hover speciale, per renderli più evidenti

## Quando Usare 🕒

- Quando hai bisogno di fornire funzionalità di navigazione nella pagina
- Quando devi mostrare un gruppo di operazioni o funzionalità correlate
- Quando devi mostrare opzioni in un menu a discesa
- Quando devi creare un menu contestuale (menu destro)

Il componente MagicMenu rende i tuoi menu più puliti e user-friendly, mantenendo tutte le funzionalità del Menu di Ant Design.

## Testo Originale
# MagicMenu 魔法菜单组件

`MagicMenu` 是一个基于 Ant Design Menu 组件的增强版菜单，提供了更简洁的样式和更好的用户体验。

## 属性

| 属性名       | 类型 | 默认值 | 说明                            |
| ------------ | ---- | ------ | ------------------------------- |
| ...MenuProps | -    | -      | 支持所有 Ant Design Menu 的属性 |

## 基础用法

```tsx
import { MagicMenu } from '@/components/base/MagicMenu';
import { IconHome, IconUser, IconSettings } from '@tabler/icons-react';

// 基础用法
<MagicMenu
  items={[
    {
      key: 'home',
      label: '首页',
      icon: <IconHome size={16} />,
    },
    {
      key: 'profile',
      label: '个人中心',
      icon: <IconUser size={16} />,
    },
    {
      key: 'settings',
      label: '设置',
      icon: <IconSettings size={16} />,
    },
  ]}
/>

// 默认选中项
<MagicMenu
  defaultSelectedKeys={['home']}
  items={[
    {
      key: 'home',
      label: '首页',
    },
    {
      key: 'profile',
      label: '个人中心',
    },
  ]}
/>

// 垂直菜单
<MagicMenu
  mode="vertical"
  items={[
    {
      key: 'home',
      label: '首页',
    },
    {
      key: 'profile',
      label: '个人中心',
    },
  ]}
/>

// 带子菜单
<MagicMenu
  mode="vertical"
  items={[
    {
      key: 'home',
      label: '首页',
    },
    {
      key: 'settings',
      label: '设置',
      children: [
        {
          key: 'general',
          label: '常规设置',
        },
        {
          key: 'account',
          label: '账号设置',
        },
      ],
    },
  ]}
/>

// 危险操作
<MagicMenu
  items={[
    {
      key: 'profile',
      label: '个人中心',
    },
    {
      key: 'logout',
      label: '退出登录',
      danger: true,
    },
  ]}
/>

// 监听选择事件
<MagicMenu
  onClick={({ key }) => console.log('点击了:', key)}
  items={[
    {
      key: 'home',
      label: '首页',
    },
    {
      key: 'profile',
      label: '个人中心',
    },
  ]}
/>
```

## 特点

1. **简洁设计**：移除了选中项的背景色和边框，提供更干净的视觉效果
2. **透明背景**：菜单背景透明，可以更好地融入各种界面
3. **优化的间距**：菜单项之间有合理的间距，提高可读性
4. **危险操作优化**：危险操作项有特殊的悬停效果，更加醒目

## 何时使用

-   需要在页面中提供导航功能时
-   需要展示一组相关操作或功能时
-   需要在下拉菜单中展示选项时
-   需要创建上下文菜单（右键菜单）时

MagicMenu 组件让你的菜单更加简洁和用户友好，同时保持了 Ant Design Menu 的所有功能特性。
