# Table Component

This folder contains all components related to enhanced Markdown tables.

## File Structure

```
Table/
├── index.ts              # Unified export file
├── TableWrapper.tsx      # Table wrapper with column limit and expand functionality
├── TableCell.tsx         # Table cell with long text handling and alignment
├── RowDetailDrawer.tsx   # Row detail drawer component
├── useTableI18n.ts       # Internationalization hook
├── styles.ts             # antd-style style definitions
└── README.md            # Documentation
```

## Features

### TableWrapper
- 🔢 **Column Limit**: Automatically hide columns beyond 6 columns
- 🔍 **Expand Feature**: Click "Show More" button to view complete data in Drawer
- 📱 **Responsive Design**: Mobile adaptive

### TableCell
- 📏 **Long Text Handling**: Automatic detection and support for long text expansion
- ⚖️ **Smart Alignment**: Automatic alignment based on content
- 🎯 **Special Symbol Support**: Center display for mathematical symbols and special characters

### RowDetailDrawer
- 🎨 **Antd Integration**: Uses antd Drawer component
- 📋 **Form Display**: Shows row data in form format
- 🚀 **Smooth Animation**: Built-in slide-in animation effects

### Internationalization Support
- 🌍 **Multi-language**: Supports Chinese and English
- 🔧 **Unified Management**: Unified translation management through `useTableI18n` hook
- 📝 **Complete Coverage**: All user-visible text supports internationalization

## Usage

```tsx
import { TableWrapper, TableCell, useTableStyles, useTableI18n } from "./Table"

// Use in markdown component configuration
const components = {
  table: TableWrapper,
  td: (props) => <TableCell {...props} />,
  th: (props) => <TableCell isHeader {...props} />
}

// Custom styling if needed
const MyComponent = () => {
  const { styles, cx } = useTableStyles()
  return <div className={styles.tableContainer}>...</div>
}

// Using internationalization
const MyTableComponent = () => {
  const i18n = useTableI18n()
  return <button>{i18n.showMore}</button>
}
```

## Style System

Uses `antd-style` CSS-in-JS solution:
- 🎨 **Theme Integration**: Automatically adapts to antd theme colors
- 🌓 **Dark Mode**: Supports light and dark theme switching
- 📱 **Responsive**: Built-in mobile adaptation
- 🔧 **Type Safety**: Complete TypeScript type support

## Configuration Options

- `MAX_VISIBLE_COLUMNS`: Maximum visible columns (default 6)
- `LONG_TEXT_THRESHOLD`: Long text threshold (default 50 characters)

## Internationalization Configuration

Add the following translations in `src/assets/locales/{locale}/interface.json`:

```json
{
  "markdownTable": {
    "showMore": "Show More",
    "rowDetails": "Row Details",
    "clickToExpand": "Click to expand full content",
    "showAllColumns": "Show All",
    "hideAllColumns": "Hide",
    "defaultColumn": "Column"
  }
}
```

Supported languages:
- 🇨🇳 Chinese (`zh_CN`)
- 🇺🇸 English (`en_US`) 