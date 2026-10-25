# magic-admin-v2 测试目录约定

## 分层

- `unit/`：纯函数、权限、API 参数和模块边界测试，不依赖 React DOM。
- `components/`：React 组件交互测试，文件名以 `.component.test.tsx` 结尾。
- `integration/`：页面、Query、Mutation 与 API mock 的组合测试。
- `e2e/`：路由级和关键业务链路测试。
- `helpers/`：渲染、权限、QueryClient、API mock 等共享辅助。
- `fixtures/`：组织、租户、审批、Provider 等稳定测试数据。

业务域目录统一放在测试层级下面，例如：

```text
tests/unit/{access,api,filters,permissions,utils,boundaries,oa-approval,organization,platform,shared}/
tests/components/{shared,oa-approval,organization,platform}/
tests/integration/{oa-approval,organization,platform,shared}/
```

## 运行

```bash
pnpm test:unit
pnpm test:components
pnpm test:integration
pnpm test:all
```

`pnpm test` 保留为单元测试的兼容入口；`pnpm test:all` 执行单元、组件和集成测试。
新增测试必须放入对应分层目录，`tests/` 根目录只保留本说明文件。
