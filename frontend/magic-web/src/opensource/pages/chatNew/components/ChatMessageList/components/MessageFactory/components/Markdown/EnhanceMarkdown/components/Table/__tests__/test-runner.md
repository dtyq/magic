# Table Component Test Runner Guide

## 📋 Test Commands

### Run Individual Test Files

```bash
# Test internationalization Hook
npm test -- useTableI18n.test.tsx

# Test table cell component
npm test -- TableCell.test.tsx

# Test row detail drawer component
npm test -- RowDetailDrawer.test.tsx

# Test table wrapper component
npm test -- TableWrapper.test.tsx

# Test style Hook
npm test -- styles.test.tsx

# Test integration tests
npm test -- index.test.tsx
```

### Run All Table Component Tests

```bash
# Run all tests containing "Table"
npm test -- Table

# Or run entire test directory
npm test -- __tests__
```

### Generate Coverage Report

```bash
# Generate test coverage report
npm test -- --coverage Table
```

### Run Tests in Watch Mode

```bash
# Run tests in watch mode (for development)
npm test -- --watch Table
```

## 🎯 Test Verification Checklist

Before submitting code, ensure all the following tests pass:

- [ ] ✅ useTableI18n Hook tests (3 test cases)
- [ ] ✅ TableCell component tests (9 test cases)
- [ ] ✅ RowDetailDrawer component tests (9 test cases)
- [ ] ✅ TableWrapper component tests (13 test cases)
- [ ] ✅ useTableStyles Hook tests (5 test cases)
- [ ] ✅ Integration tests (10 test cases)

**Total: 49 test cases**

## 🐛 Common Issue Solutions

### 1. Test File Not Found
```bash
Error: No test suite found in file
```
**Solution**: Ensure test file contains valid test content, check if file is empty.

### 2. Mock Dependency Issues
```bash
TypeError: Cannot read property of undefined
```
**Solution**: Check if vi.mock() configuration is correct, ensure all external dependencies are properly mocked.

### 3. Style Class Not Found
```bash
Expected element to have class 'xxx' but it didn't
```
**Solution**: Check style Mock configuration, ensure correct class names are returned.

### 4. TypeScript Type Errors
```bash
Type 'xxx' is not assignable to type 'yyy'
```
**Solution**: Check TypeScript configuration and type definitions, ensure test code types are correct.

## 🏃‍♂️ Quick Start

1. **Run Basic Tests**: `npm test -- useTableI18n.test.tsx`
2. **Verify Test Environment**: Check if any tests pass
3. **Run All Tests**: `npm test -- Table`
4. **View Coverage**: `npm test -- --coverage Table`

## 📈 Performance Metrics

- **Test Execution Time**: < 2 seconds
- **Code Coverage Target**: > 90%
- **Number of Test Files**: 6
- **Total Test Cases**: 49

## 🔍 Debugging Tests

If tests fail, you can use the following methods to debug:

```bash
# Increase verbose output
npm test -- --reporter=verbose Table

# Only run failed tests
npm test -- --run --reporter=verbose Table

# Use debug mode
npm test -- --inspect-brk Table
```

---

**Note**: Please ensure you run the complete test suite before submitting code to guarantee all functionality works properly. 