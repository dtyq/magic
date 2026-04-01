# /models 接口 info 字段使用情况分析报告

接口路由：`GET /v1/models`（附带 `with_info=1` 参数）

分析范围：`info.attributes` 和 `info.options` 两个子对象的所有字段

分析时间：2026-04-01

---

## 分析的消费方

| 编号 | 消费方 | 文件路径 |
|------|--------|----------|
| 1 | super-magic Python 模型配置富化 | `backend/super-magic/agentlang/agentlang/config/model_info_enricher.py` |
| 2 | magic-service PHP 服务商模型同步 | `backend/magic-service/app/Application/Provider/Service/ProviderModelSyncAppService.php` |

---

## info.attributes 字段使用情况

接口返回的完整字段集合：`key`, `name`, `label`, `icon`, `tags`, `created_at`, `owner`, `provider_alias`, `provider_model_id`, `provider_id`, `model_type`, `description`, `resolved_model_id`

| 字段 | super-magic (Python) | magic-service (PHP) | 使用情况 |
|------|----------------------|---------------------|----------|
| `key` | 未使用 | 未使用 | **完全未使用** |
| `name` | 未使用 | 未使用 | **完全未使用** |
| `label` | 使用（映射为 metadata.label） | 使用（作为模型显示名称，fallback 为 model id） | 两方均使用 |
| `icon` | 使用（映射为 metadata.icon，非空时生效） | 使用（上传到 CDN 后存储 key） | 两方均使用 |
| `tags` | 未使用 | 未使用 | **完全未使用** |
| `created_at` | 未使用 | 未使用 | **完全未使用** |
| `owner` | 未使用 | 未使用 | **完全未使用** |
| `provider_alias` | 使用（映射为 metadata.provider_alias，非空时生效） | 未使用 | 仅 Python 使用 |
| `provider_model_id` | 使用（映射为 metadata.provider_model_id，非空时生效） | 未使用 | 仅 Python 使用 |
| `provider_id` | 使用（映射为 metadata.provider_id，非空时生效） | 未使用 | 仅 Python 使用 |
| `model_type` | 未使用 | 使用（设置模型类型分类） | 仅 PHP 使用 |
| `description` | 未使用 | 使用（设置模型描述，写入多语言翻译）| 仅 PHP 使用 |
| `resolved_model_id` | 未使用 | 未使用 | **完全未使用** |

**attributes 中完全未使用的字段（共 5 个）：** `key`, `name`, `tags`, `created_at`, `owner`, `resolved_model_id`

---

## info.options 字段使用情况

接口返回的完整字段集合：`chat`, `embedding`, `multi_modal`, `function_call`, `vector_size`, `fixed_temperature`, `default_temperature`, `max_tokens`, `max_output_tokens`

| 字段 | super-magic (Python) | magic-service (PHP) | 使用情况 |
|------|----------------------|---------------------|----------|
| `chat` | 未使用 | 未使用 | **完全未使用** |
| `embedding` | 未使用 | 使用（support_embedding 配置项） | 仅 PHP 使用 |
| `multi_modal` | 未使用 | 使用（support_multi_modal 配置项） | 仅 PHP 使用 |
| `function_call` | 使用（映射为 supports_tool_use） | 使用（support_function 配置项） | 两方均使用 |
| `vector_size` | 未使用 | 未使用 | **完全未使用** |
| `fixed_temperature` | 使用（temperature 最高优先级，非 null 时生效） | 未使用 | 仅 Python 使用 |
| `default_temperature` | 使用（temperature 次优先级，fixed_temperature 为 null 时生效） | 使用（creativity 配置项） | 两方均使用 |
| `max_tokens` | 使用（映射为 max_context_tokens，非空时生效） | 使用（max_tokens 配置项） | 两方均使用 |
| `max_output_tokens` | 使用（映射为 max_output_tokens，非空时生效） | 使用（max_output_tokens 配置项） | 两方均使用 |

**options 中完全未使用的字段（共 2 个）：** `chat`, `vector_size`

---

## 汇总

### 完全未使用的字段

**info.attributes：**
- `key`
- `name`
- `tags`
- `created_at`
- `owner`
- `resolved_model_id`

**info.options：**
- `chat`
- `vector_size`

### 各消费方特有的字段

**仅 super-magic (Python) 使用：**
- `attributes.provider_alias`
- `attributes.provider_model_id`
- `attributes.provider_id`
- `options.fixed_temperature`

**仅 magic-service (PHP) 使用：**
- `attributes.model_type`
- `attributes.description`
- `options.embedding`
- `options.multi_modal`

### 两方均使用的字段

- `attributes.label`
- `attributes.icon`
- `options.function_call`
- `options.default_temperature`
- `options.max_tokens`
- `options.max_output_tokens`
