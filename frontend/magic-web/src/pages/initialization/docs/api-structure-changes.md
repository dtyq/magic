# 初始化API数据结构调整说明

## 修改日期
2026-03-17

## 变更概述
根据后端API要求,将初始化流程的数据结构从嵌套的 `step1/step2/step3` 格式调整为扁平化的业务语义格式。

## 新的数据结构

```typescript
{
  "admin_account": {
     "phone": "13800000000",
     "password": "ChangeMe123!"
  },
  "agent_info": {
     "name": "智能客服助手",
     "icon": "base64_image_string",
     "description": "描述信息"
  },
  "service_provider_model": {
     "provider_code": "MicrosoftAzure",
     "model_version": "gpt-4-turbo",
     "service_provider_config": {
        "url": "https://api.example.com/v1",
        "api_key": "sk-xxx",
        // 动态字段,如 Azure 的 api_version, AWS 的 ak/sk/region 等
     }
  },
  "select_official_agents_codes": ["general", "data_analysis"]
}
```

## 修改文件清单

### 1. 类型定义
- `src/opensource/apis/types.ts` - 定义后端API数据结构
- `src/opensource/pages/initialization/types.ts` - 定义前端表单数据结构

### 2. 组件修改
- `src/opensource/pages/initialization/components/Step1Account.tsx`
  - 字段重命名: `agent_name` → `name`, `agent_logo` → `icon`, `agent_description` → `description`
  - 字段重命名: `admin_phone` → `phone`, `admin_password` → `password`
  
- `src/opensource/pages/initialization/components/Step2Provider.tsx`
  - 字段重命名: `provider` → `provider_code`
  - 字段重命名: `deployment_name` → `model_version`
  - 配置字段嵌套: `api_url/api_key` → `service_provider_config.{url,api_key}`
  - Azure字段: `api_version` → `service_provider_config.api_version`
  - AWS字段: `ak/sk/region` → `service_provider_config.{ak,sk,region}`

- `src/opensource/pages/initialization/components/Step3Workers.tsx`
  - 字段重命名: `selected_workers` → `select_official_agents_codes`

### 3. 主页面
- `src/opensource/pages/initialization/index.tsx`
  - 更新 `handleFinish` 函数,将前端表单数据转换为后端要求的扁平格式
  - 数据转换逻辑:
    ```typescript
    {
      admin_account: { phone, password },
      agent_info: { name, icon, description },
      service_provider_model: step2Data, // 直接使用
      select_official_agents_codes: step3Data.select_official_agents_codes
    }
    ```

## 注意事项

1. **向后兼容性**: 此修改完全改变了数据结构,与旧版本不兼容
2. **SessionStorage**: 旧的缓存数据可能需要清除
3. **动态配置字段**: `service_provider_config` 支持动态字段,不同的服务商可能有不同的额外配置项
4. **表单验证**: 所有表单验证规则已相应更新

## 测试建议

1. 测试所有三个步骤的表单填写和验证
2. 测试步骤间的数据持久化(sessionStorage)
3. 测试不同服务商的特殊字段显示和提交
4. 测试最终数据提交到后端的格式是否正确
5. 测试错误处理和用户提示

## 相关API端点

- `POST /api/v1/initialization/submit` - 提交初始化配置
