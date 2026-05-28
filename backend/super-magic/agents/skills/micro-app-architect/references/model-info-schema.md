# Model Info Schema

Detailed structure of the `info` field returned by `window.Magic.llm.getModels()`.

Each model object includes an `info` field containing the full metadata from the model gateway. This reference documents all available fields.

---

## Top-Level Structure

```typescript
interface ModelInfo {
  attributes: ModelAttributes
  options: ModelOptions
}
```

---

## `info.attributes`

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Display name for the model (may be empty) |
| `icon` | `string` | Icon URL for the model |
| `model_type` | `number` | Model type code (internal classification) |
| `description` | `string` | Model description text (may be empty) |
| `resolved_model_id` | `string` | The actual model ID resolved by the gateway |

---

## `info.options`

| Field | Type | Description |
|-------|------|-------------|
| `chat` | `boolean` | Whether the model supports chat completions |
| `embedding` | `boolean` | Whether the model supports text embedding |
| `multi_modal` | `boolean` | Whether the model accepts multi-modal input (images, etc.) |
| `function_call` | `boolean` | Whether the model supports function/tool calling |
| `vector_size` | `number \| null` | Embedding vector dimensions (only for embedding models) |
| `fixed_temperature` | `number \| null` | If set, temperature is fixed and cannot be overridden |
| `default_temperature` | `number \| null` | Default temperature when not specified by user |
| `max_tokens` | `number \| null` | Maximum input token limit |
| `max_output_tokens` | `number \| null` | Maximum output token limit |
| `thinking_budget_levels` | `object \| null` | Thinking budget tiers (for reasoning models) |

### `thinking_budget_levels` Structure

```typescript
{
  low: number     // e.g. 4096
  medium: number  // e.g. 16384
  high: number    // e.g. 32768
}
```

---

## Example Response

```json
{
  "id": "gpt-4o",
  "object": "model",
  "owned_by": "MagicAI",
  "icon": "https://example.com/gpt4o-icon.png",
  "label": "GPT-4o",
  "info": {
    "attributes": {
      "label": "GPT-4o",
      "icon": "https://example.com/gpt4o-icon.png",
      "model_type": 4,
      "description": "",
      "resolved_model_id": "gpt-4o"
    },
    "options": {
      "chat": true,
      "embedding": false,
      "multi_modal": true,
      "function_call": true,
      "vector_size": null,
      "fixed_temperature": null,
      "default_temperature": null,
      "max_tokens": null,
      "max_output_tokens": 128000,
      "thinking_budget_levels": {
        "low": 4096,
        "medium": 16384,
        "high": 32768
      }
    }
  }
}
```

---

## Common Filtering Patterns

```javascript
const models = await window.Magic.llm.getModels();

// 1. Only chat-capable models (exclude embedding-only)
const chatModels = models.filter(m => m.info?.options?.chat !== false);

// 2. Multi-modal models (accept images)
const multiModalModels = models.filter(m => m.info?.options?.multi_modal === true);

// 3. Models with function calling support
const fcModels = models.filter(m => m.info?.options?.function_call === true);

// 4. Embedding models only
const embeddingModels = models.filter(m => m.info?.options?.embedding === true);

// 5. Models with high output token limits (> 32k)
const highOutputModels = models.filter(m => {
  const max = m.info?.options?.max_output_tokens;
  return max && max > 32000;
});

// 6. Models where temperature can be adjusted (not fixed)
const adjustableTempModels = models.filter(m => m.info?.options?.fixed_temperature == null);
```

---

## Model Selection UI with Capabilities

```javascript
// Render model list with capability badges
function renderModelItem(model) {
  const opts = model.info?.options || {};
  const badges = [];
  if (opts.multi_modal) badges.push("🖼️ Vision");
  if (opts.function_call) badges.push("🔧 Tools");
  if (opts.max_output_tokens > 64000) badges.push("📝 Long Output");

  return `
    <div class="model-item" data-id="${model.id}">
      ${model.icon ? `<img src="${model.icon}" width="20" height="20" />` : ""}
      <span class="model-name">${model.label || model.id}</span>
      <span class="model-badges">${badges.join(" ")}</span>
    </div>
  `;
}
```
