# Table Component Unit Tests

## Test Files Overview

### 📁 Test File Structure
```
__tests__/
├── useTableI18n.test.tsx       # Internationalization hook tests
├── TableCell.test.tsx          # Table cell component tests
├── RowDetailDrawer.test.tsx    # Row detail drawer component tests
├── TableWrapper.test.tsx       # Table wrapper component tests
├── styles.test.tsx             # Style hook tests
├── index.test.tsx              # Integration tests
└── README.md                   # Test documentation
```

## 🧪 Test Coverage

### useTableI18n Hook Tests
- ✅ Returns correct translation text
- ✅ Contains all required translation keys
- ✅ Returns string type translation values

### TableCell Component Tests
- ✅ Renders normal table data cells
- ✅ Renders table header cells
- ✅ Handles short text content
- ✅ Long text wrapper functionality
- ✅ Long text click to expand functionality
- ✅ Automatic text alignment (left, right, center)
- ✅ Handles array form child elements
- ✅ Preserves whitespace and special character styles
- ✅ Handles empty content

### RowDetailDrawer Component Tests
- ✅ Controls rendering based on visible state
- ✅ Uses default title
- ✅ Correctly renders form items
- ✅ Handles missing data
- ✅ onClose callback function calls
- ✅ Handles empty headers array
- ✅ Handles React nodes as values
- ✅ Prioritizes index keys for data retrieval

### TableWrapper Component Tests
- ✅ Renders basic table structure
- ✅ Column limit functionality (≤6 columns don't show more button)
- ✅ Shows "Show More" button for >6 columns
- ✅ Correctly limits displayed columns
- ✅ Clicking "Show More" opens drawer
- ✅ Drawer displays complete row data
- ✅ Different row data displays correctly
- ✅ Drawer close functionality
- ✅ Handles tables without thead
- ✅ Handles tables without tbody
- ✅ Applies correct CSS classes
- ✅ Complex table structure data extraction

### useTableStyles Hook Tests
- ✅ Returns style object
- ✅ Contains all required style classes
- ✅ cx function correctly merges class names
- ✅ Returns correct types

### Integration Tests
- ✅ Correctly exports all components and hooks
- ✅ TableWrapper and TableCell work together
- ✅ Complete table functionality flow
- ✅ TableCell long text functionality
- ✅ Internationalization hook functionality
- ✅ Style hook functionality
- ✅ RowDetailDrawer independent functionality
- ✅ Empty props support
- ✅ Complex table structure complete testing

## 🎯 Core Functionality Tests

### 1. Column Limit and Expand Functionality
Tests table automatically hiding excess columns when exceeding 6 columns, and providing "Show More" button to view complete data.

### 2. Long Text Handling
Tests TableCell component's intelligent handling of extra-long text, including automatic detection and click to expand functionality.

### 3. Smart Text Alignment
Tests automatic text alignment determination based on content (left, right, center alignment).

### 4. Internationalization Support
Tests internationalization translation functionality for all user-visible text.

### 5. Responsive Design
Tests mobile adaptation and responsive layout functionality.

### 6. Style System
Tests antd-style CSS-in-JS style system integration.

## 🚀 Running Tests

```bash
# Run all table component tests
npm test -- Table

# Run specific test file
npm test -- TableWrapper.test.tsx

# Run tests and generate coverage report
npm test -- --coverage Table
```

## 📊 Test Data

### Mock Data Examples
- **Simple Table**: 3 columns, 2 rows basic data
- **Complex Table**: 8 columns, multiple rows complete data
- **Long Text**: Test text exceeding 50 characters
- **Special Symbols**: Mathematical symbols and special characters
- **React Nodes**: JSX elements as cell content

### Mock Components
- **antd Components**: Drawer, Form.Item
- **react-i18next**: useTranslation hook
- **antd-style**: createStyles function
- **Style System**: Complete style classes and cx function

## ✨ Best Practices

### 1. Component Isolation Testing
Each component has independent test files, ensuring test independence and maintainability.

### 2. Mock External Dependencies
Properly mock external dependencies (antd, react-i18next, antd-style) to ensure test stability.

### 3. User Behavior Simulation
Simulate real user interactions through fireEvent, such as clicking and expanding operations.

### 4. Edge Case Testing
Test edge cases such as empty data, missing data, and abnormal data.

### 5. Integration Testing
Verify collaborative effects between components through integration testing.

## 🔧 Testing Tools

- **Vitest**: Modern testing framework
- **React Testing Library**: React component testing library
- **@testing-library/jest-dom**: DOM assertion extensions
- **User Event Simulation**: fireEvent and user interaction testing

This test suite covers all core functionality of the Table component, ensuring code quality and feature reliability. 