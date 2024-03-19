<!--zh
# AI 图片生成指南
-->
# AI Image Generation Guide

<!--zh
> 本文档提供 `generate_images_to_canvas` 工具的详细使用指南。基础参数和用法请参考 [SKILL.md](../SKILL.md)。
-->
> This document provides detailed usage guide for `generate_images_to_canvas` tool. For basic parameters and usage, see [SKILL.md](../SKILL.md).

<!--zh
## 批量生成技巧
-->
## Batch Generation Tips

<!--zh
### 超过 4 张图片的处理

单次调用最多生成 4 张图片。需要更多时分批调用：
-->
### Handling More Than 4 Images

A single call can generate at most 4 images. For more, make multiple calls:

```python
# <!--zh: 第一批：4 张-->First batch: 4 images
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
  "project_path": "animals",
  "name": "狗狗",
  "prompts": ["金毛犬", "哈士奇", "柯基犬", "德牧"],
  "size": "2048x2048"
})

# <!--zh: 第二批：剩余数量-->Second batch: remaining count
from sdk.tool import tool

result = tool.call('generate_images_to_canvas', {
  "project_path": "animals",
  "name": "狗狗续",
  "prompts": ["萨摩耶", "边牧"],
  "size": "2048x2048"
})
```

---

<!--zh
## 图生图规范（4个重要原则）
-->
## Image-to-Image Guidelines (4 Important Principles)

<!--zh
当用户提供了参考图片（产品原图、设计稿等）时，必须遵循以下原则：

### 1. 参考图强制使用原则

- 只要用户提供了产品原图或参考图，必须包含 `image_paths` 参数
- 在 prompts 中必须明确说明："严格遵循参考图中的视觉特征，保持产品颜色、纹理、品牌标识的一致性"
- 禁止脱离参考图进行虚构或自由发挥

### 2. 商品完整性原则

- 严禁在画面中添加原图中不存在的商品、部件或装饰品（除非用户明确要求添加）
- 如果原图包含多个商品（SKU），必须在 Prompt 中明确要求："同时清晰展示参考图中的所有产品"
- 保持商品数量、种类与原图一致

### 3. 主体与风格分离原则

- 清晰区分"主体内容（What）"和"风格表现（How）"
- 主体描述：必须基于参考图的确切特征（如：粉色手柄、白色刷毛），不能随意改变
- 风格描述：可以改变拍摄风格、背景、光影等，但不得改变主体本身的属性
- 示例：用户要求"用 Apple 风格重新设计这个产品"→ 保持产品本身不变，只改变拍摄风格、背景、光影等

### 4. 用户需求精确传达原则

- 禁止对用户需求进行模糊化或简化处理
- 用户提到的每一个关键词（如"扇形展开"、"烟花爆炸"、"极简悬浮"等）必须作为重要修饰词写入 Prompt
- 明确告诉工具如何使用参考图：
  * 如果是重新排列：在 Prompt 中说明"基于参考图中的对象进行重新排列"
  * 如果是风格化：在 Prompt 中说明"将参考图的风格应用到当前主体上"
-->
When user provides reference images (product photos, design drafts, etc.), must follow these principles:

### 1. Mandatory Reference Image Usage

- Whenever user provides product photos or reference images, MUST include `image_paths` parameter
- Must explicitly state in prompts: "Strictly adhere to the visual identity in reference images. Maintain consistency in product color, texture, and branding."
- DO NOT deviate from reference images or freely invent content

### 2. Product Integrity Principle

- DO NOT add products, components, or decorations that don't exist in original images (unless user explicitly requests)
- If original image contains multiple products (SKUs), MUST explicitly require in Prompt: "Show all products from reference image simultaneously and clearly"
- Keep product count and types consistent with original image

### 3. Subject-Style Separation Principle

- Clearly distinguish "subject content (What)" and "style expression (How)"
- Subject description: Must be based on exact features from reference image (e.g., pink handle, white bristles), cannot arbitrarily change
- Style description: Can change photography style, background, lighting, etc., but must not change subject's own attributes
- Example: User requests "redesign this product in Apple style" → Keep product itself unchanged, only change photography style, background, lighting, etc.

### 4. User Requirement Precision Principle

- DO NOT blur or simplify user requirements
- Every keyword mentioned by user (e.g., "fan-shaped spread", "firework explosion", "minimalist floating") MUST be written into Prompt as important modifiers
- Clearly tell tool how to use reference image:
  * If rearranging: State in Prompt "rearrange objects from reference image"
  * If stylizing: State in Prompt "apply reference image's style to current subject"
