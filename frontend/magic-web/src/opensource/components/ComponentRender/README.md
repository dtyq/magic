# ComponentRender 组件

ComponentRender 是一个用于动态渲染组件的工厂模式实现，它允许开发者在运行时动态注册、获取和渲染组件。

## 功能特点

- 动态组件注册与管理
- 基于组件名称的组件渲染
- 支持懒加载组件
- 提供默认的 Fallback 组件处理未注册情况
- 类型安全的组件渲染

## 使用方法

### 1. 基本使用

```tsx
import ComponentRender from '@/opensource/components/ComponentRender';

function MyPage() {
  return (
    <ComponentRender 
      componentName="OrganizationList"
      // 可以传递该组件需要的任何 props
      prop1="value1"
      prop2="value2"
    />
  );
}
```

### 2. 动态注册组件

您可以使用 `ComponentFactory` 动态注册新组件：

```tsx
import ComponentFactory from '@/opensource/components/ComponentRender/ComponentFactory';

// 定义您的组件
const MyCustomComponent = ({ title, content }) => (
  <div>
    <h2>{title}</h2>
    <p>{content}</p>
  </div>
);

// 注册单个组件
ComponentFactory.registerComponent('MyCustomComponent', MyCustomComponent);

// 使用已注册的组件
function MyPage() {
  return (
    <ComponentRender 
      componentName="MyCustomComponent" 
      title="Hello"
      content="This is my custom component"
    />
  );
}
```

### 3. 批量注册组件

```tsx
import ComponentFactory from '@/opensource/components/ComponentRender/ComponentFactory';

// 准备多个组件
const components = {
  Component1: () => <div>组件 1</div>,
  Component2: () => <div>组件 2</div>,
  Component3: () => <div>组件 3</div>,
};

// 批量注册组件
ComponentFactory.registerComponents(components);
```

### 4. 注销组件

```tsx
// 注销单个组件
ComponentFactory.unregisterComponent('MyCustomComponent');

// 注销多个组件
ComponentFactory.unregisterComponents(['Component1', 'Component2']);
```

### 5. 自定义组件类型

如果需要添加新的组件类型，您需要扩展 `DefaultComponentsProps` 接口：

```tsx
// 在您的文件中扩展接口
declare module '@/opensource/components/ComponentRender/config/defaultComponents' {
  export interface DefaultComponentsProps {
    // 添加新的组件类型
    MyNewComponent: {
      title: string;
      description: string;
      onClick: () => void;
    };
  }
}

// 然后注册该组件
const MyNewComponent: React.FC<{ title: string; description: string; onClick: () => void }> = (props) => {
  // 实现
};

ComponentFactory.registerComponent('MyNewComponent', MyNewComponent);
```

### 6. 传递子组件

ComponentRender 也支持传递子组件：

```tsx
<ComponentRender componentName="ContainerComponent">
  <div>这些是子组件内容</div>
  <button>子按钮</button>
</ComponentRender>
```

## 最佳实践

1. **组件懒加载**：对于大型组件，建议使用 `React.lazy()` 包装后再注册，以优化初始加载性能

2. **类型安全**：始终扩展 `DefaultComponentsProps` 接口以保持类型安全

3. **组件注册时机**：在应用初始化阶段（如入口文件或布局组件中）注册全局组件

4. **命名约定**：使用有意义的、唯一的组件名称，避免冲突

5. **错误处理**：为重要组件提供专门的错误边界，而不仅仅依赖默认的 Fallback 组件

## 注意事项

- 所有通过 ComponentRender 渲染的组件都被 `<Suspense fallback={null}>` 包装，对于懒加载组件会显示 null，直到组件加载完成
- 未注册的组件名称将渲染默认的 Fallback 组件（显示 "Component UnRegistered"）
- 组件注册是全局性的，请确保组件名称在应用中的唯一性 