# FunctionHub 服务

一个强大的函数管理服务，支持函数注册、执行、覆盖、中间件和作用域管理。

## 📁 项目结构

```
src/opensource/services/common/FunctionHub/
├── index.ts                    # 主入口文件，统一导出
├── core/                       # 核心模块
│   ├── types.ts               # 核心类型定义
│   ├── errors.ts              # 错误类定义
│   ├── FunctionHub.ts         # 主要的 FunctionHub 类
│   └── ScopedFunctionHub.ts   # 作用域 FunctionHub 类
├── middleware/                 # 中间件模块
│   └── index.ts               # 常用中间件函数
├── types.ts                    # 类型导出文件
├── examples.ts                 # 使用示例
└── README.md                   # 文档
```

### 模块职责

- **`core/`** - 核心功能模块
  - `types.ts` - 定义所有核心接口和类型
  - `errors.ts` - 自定义错误类
  - `FunctionHub.ts` - 主要的函数管理类
  - `ScopedFunctionHub.ts` - 作用域函数管理类

- **`middleware/`** - 中间件功能模块
  - `index.ts` - 提供常用中间件工厂函数

- **`index.ts`** - 统一入口
  - 重新导出所有核心类型和类
  - 创建默认实例

这种结构遵循了以下设计原则：
- **关注点分离** - 每个文件都有明确的职责
- **单一职责** - 每个模块只负责一个特定功能
- **模块化** - 便于维护和扩展
- **类型安全** - 完整的 TypeScript 支持

## 特性

- ✅ **函数注册与执行** - 动态注册和执行函数
- ✅ **函数注入与覆盖** - 支持运行时函数替换
- ✅ **中间件支持** - 可扩展的执行管道
- ✅ **作用域管理** - 命名空间隔离
- ✅ **性能监控** - 执行统计和元数据
- ✅ **错误处理** - 完善的错误处理机制
- ✅ **超时控制** - 防止长时间执行
- ✅ **TypeScript 支持** - 完整的类型定义

## 快速开始

### 基础用法

```typescript
import { functionHub } from './index'

// 注册函数
functionHub.register({
  name: 'greet',
  fn: (name: string) => `Hello, ${name}!`,
  description: 'Greets a person by name'
})

// 执行函数
const result = await functionHub.execute('greet', 'World')
console.log(result) // "Hello, World!"
```

### 异步函数

```typescript
// 注册异步函数
functionHub.register({
  name: 'fetchUser',
  fn: async (userId: number) => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  },
  description: 'Fetches user data'
})

// 执行异步函数
const user = await functionHub.execute('fetchUser', 123)
```

## 核心 API

### 函数管理

#### `register(definition: FunctionDefinition)`
注册新函数到 Hub 中。

```typescript
functionHub.register({
  name: 'calculate',
  fn: (a: number, b: number) => a + b,
  description: '计算两数之和',
  override: false // 默认不允许覆盖现有函数
})
```

#### `inject(name: string, fn: Function, description?: string)`
注入函数（等同于 `register` 并设置 `override: true`）。

```typescript
functionHub.inject('calculate', (a: number, b: number) => a * b, '计算两数之积')
```

#### `override(name: string, fn: Function, description?: string)`
覆盖已存在的函数。

```typescript
functionHub.override('calculate', (a: number, b: number) => a - b, '计算两数之差')
```

#### `execute(name: string, ...args: any[])`
执行指定名称的函数。

```typescript
const result = await functionHub.execute('calculate', 10, 5)
```

### 函数查询

#### `has(name: string): boolean`
检查函数是否存在。

#### `getNames(): string[]`
获取所有已注册函数名称。

#### `getMeta(name: string): FunctionMeta | undefined`
获取函数元数据。

#### `getAllMeta(): FunctionMeta[]`
获取所有函数元数据。

#### `size(): number`
获取已注册函数数量。

### 函数清理

#### `remove(name: string): boolean`
移除指定函数。

#### `clear(): this`
清除所有函数。

## 高级特性

### 中间件系统

中间件允许您在函数执行前后添加自定义逻辑。

```typescript
import { FunctionHub, type MiddlewareFunction } from './index'

const hub = new FunctionHub({ enableMiddleware: true })

// 日志中间件
const loggingMiddleware: MiddlewareFunction = async (context, next) => {
  console.log(`执行函数: ${context.name}`, context.args)
  const startTime = Date.now()
  
  try {
    const result = await next()
    const duration = Date.now() - startTime
    console.log(`函数 ${context.name} 执行完成，耗时: ${duration}ms`)
    return result
  } catch (error) {
    console.error(`函数 ${context.name} 执行失败:`, error)
    throw error
  }
}

// 验证中间件
const validationMiddleware: MiddlewareFunction = async (context, next) => {
  if (context.name === 'divide' && context.args[1] === 0) {
    throw new Error('除零错误')
  }
  return next()
}

hub.use(loggingMiddleware)
   .use(validationMiddleware)
```

### 作用域管理

作用域允许您将函数组织到不同的命名空间中。

```typescript
// 创建作用域
const mathScope = functionHub.scope('math')
const stringScope = functionHub.scope('string')

// 在作用域中注册函数
mathScope.register({
  name: 'add',
  fn: (a: number, b: number) => a + b
})

stringScope.register({
  name: 'capitalize',
  fn: (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
})

// 执行作用域函数
await mathScope.execute('add', 5, 3)          // 等同于 functionHub.execute('math.add', 5, 3)
await stringScope.execute('capitalize', 'hello') // 等同于 functionHub.execute('string.capitalize', 'hello')
```

### 批量注册

```typescript
const mathFunctions = [
  {
    name: 'square',
    fn: (x: number) => x * x,
    description: '计算平方'
  },
  {
    name: 'cube',
    fn: (x: number) => x * x * x,
    description: '计算立方'
  }
]

functionHub.batch(mathFunctions)
```

### 性能监控

```typescript
// 启用性能监控
const hub = new FunctionHub({ 
  enableMetrics: true,
  maxExecutionTime: 5000 // 5秒超时
})

hub.register({
  name: 'heavyTask',
  fn: async (data: any[]) => {
    // 执行重任务
    return processData(data)
  }
})

// 执行后查看统计
await hub.execute('heavyTask', largeDataSet)

const meta = hub.getMeta('heavyTask')
console.log('执行次数:', meta?.executionCount)
console.log('最后执行时间:', meta?.lastExecuted)
```

## 配置选项

```typescript
const hub = new FunctionHub({
  enableMetrics: true,        // 启用性能统计
  enableMiddleware: true,     // 启用中间件
  maxExecutionTime: 30000    // 执行超时时间（毫秒）
})
```

## 错误处理

FunctionHub 提供了专门的错误类型：

- `FunctionNotFoundError` - 函数不存在
- `FunctionAlreadyExistsError` - 函数已存在（注册时）
- `FunctionExecutionError` - 函数执行错误

```typescript
try {
  await functionHub.execute('nonExistentFunction')
} catch (error) {
  if (error instanceof FunctionNotFoundError) {
    console.log('函数不存在')
  }
}
```

## 最佳实践

### 1. 函数命名

使用清晰、描述性的函数名：

```typescript
// ✅ 好的命名
functionHub.register({
  name: 'calculateMonthlyInterest',
  fn: (principal: number, rate: number) => principal * rate / 12
})

// ❌ 不好的命名
functionHub.register({
  name: 'calc',
  fn: (a: number, b: number) => a * b / 12
})
```

### 2. 使用作用域组织函数

```typescript
const userScope = functionHub.scope('user')
const orderScope = functionHub.scope('order')

userScope.register({
  name: 'create',
  fn: createUser
})

orderScope.register({
  name: 'create',
  fn: createOrder
})
```

### 3. 添加适当的错误处理

```typescript
functionHub.register({
  name: 'processPayment',
  fn: async (paymentData) => {
    try {
      // 处理支付逻辑
      return await paymentService.process(paymentData)
    } catch (error) {
      // 记录错误
      logger.error('Payment processing failed:', error)
      throw new Error('支付处理失败')
    }
  }
})
```

### 4. 使用中间件进行横切关注点

```typescript
// 认证中间件
const authMiddleware: MiddlewareFunction = async (context, next) => {
  if (protectedFunctions.includes(context.name)) {
    const token = context.args[0]
    if (!isValidToken(token)) {
      throw new Error('认证失败')
    }
  }
  return next()
}

hub.use(authMiddleware)
```

## 示例

查看 `examples.ts` 文件获取更多详细的使用示例，包括：

- 基础用法示例
- 函数注入和覆盖
- 中间件使用
- 作用域管理
- 批量注册
- 性能监控
- 错误处理
- 函数管理

## 类型定义

查看 `types.ts` 文件获取完整的 TypeScript 类型定义。

## License

MIT 