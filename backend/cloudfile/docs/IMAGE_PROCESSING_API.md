# 图片处理参数说明

## 字符串格式

前端通过 URL Query 格式传递参数：

```
resize=w:300,h:200,m:lfit&quality=90&format=webp
```

### 格式规则

- **简单参数：** `quality=90&format=webp`
- **对象参数：** `resize=w:300,h:200,m:lfit` (用逗号分隔多个键值对)
- **多个参数：** 用 `&` 连接

## 参数列表

### 1. resize - 图片缩放

```
resize=w:300,h:200,m:lfit
```

| 缩写 | 完整名称 | 类型 | 范围 | 必填 | 说明 |
|------|----------|------|------|------|------|
| w | width | number | 1-16384 | 条件 | 目标宽度 |
| h | height | number | 1-16384 | 条件 | 目标高度 |
| m | mode | string | lfit/mfit/fill/pad/fixed | 否 | 缩放模式 |
| l | limit | number | 1-16384 | 条件 | 长边限制 |
| s | short | number | 1-16384 | 条件 | 短边限制 |
| p | percentage | number | 1-1000 | 条件 | 百分比缩放 |
| color | color | string | 6位hex | 条件 | 填充颜色（m=pad时必填） |

**缩放模式：**
- `lfit`: 等比缩放，限制在宽高内（默认）
- `mfit`: 等比缩放，延伸出宽高外
- `fill`: 固定宽高，裁剪居中
- `pad`: 固定宽高，填充留白（需要color参数）
- `fixed`: 强制固定宽高

**⚠️ 缩放矩形框计算方式及参数优先级：**

**方式1：指定 w 和/或 h**
```
# 同时指定 w 和 h
resize=w:800,h:600                  # 使用 w 和 h 构造缩放矩形框

# 只指定 w 或 h（配合 mode）
resize=w:800,m:lfit                 # lfit/mfit/fixed：根据原图比例计算 h
resize=w:800,m:fill                 # fill/pad：构造 800x800 正方形
resize=h:600,m:lfit                 # lfit/mfit/fixed：根据原图比例计算 w
resize=h:600,m:pad,color:FFFFFF     # fill/pad：构造 600x600 正方形
```

**方式2：指定 l 和/或 s（不含 w 和 h）**
```
# 同时指定 l 和 s
resize=l:1200,s:800                 # 长边1200，短边800

# 只指定 l 或 s（配合 mode）
resize=l:1200,m:lfit                # lfit/mfit/fixed：根据原图比例计算短边
resize=l:1200,m:fill                # fill/pad：构造 1200x1200 正方形
resize=s:800,m:lfit                 # lfit/mfit/fixed：根据原图比例计算长边
```

**方式3：百分比缩放（不含 w/h/l/s）**
```
resize=p:50                         # 缩小到50%
```

**参数优先级：** `w/h` > `l/s` > `p`

**完整示例：**
```
# 等比缩放
resize=w:800                        # 宽度800，高度自动计算
resize=h:600                        # 高度600，宽度自动计算
resize=w:800,h:600                  # 等比缩放到接近800x600

# 模式缩放
resize=w:800,h:600,m:lfit           # 等比缩放，限制在800x600内
resize=w:200,h:200,m:fill           # 裁剪为200x200正方形
resize=w:300,m:fill                 # 裁剪为300x300正方形
resize=w:300,h:300,m:pad,color:F5F5F5  # 填充为300x300，灰色背景

# 长短边限制
resize=l:1200                       # 长边1200，短边自动计算
resize=l:1200,s:800                 # 长边1200，短边800
resize=l:1200,m:fill                # 裁剪为1200x1200正方形

# 百分比
resize=p:50                         # 缩小到50%
```

---

### 2. quality - 图片质量

```
quality=90
```

| 类型 | 范围 | 说明 |
|------|------|------|
| number | 1-100 | 质量值，100最高 |

**建议值：** 85-90（高质量）、75-85（普通）、60-75（缩略图）

---

### 3. format - 格式转换

```
format=webp
```

| 类型 | 可选值 | 必填 |
|------|--------|------|
| string | jpg, png, webp, bmp, gif, tiff | ✅ 是 |

**推荐：** `webp`（最佳压缩）、`png`（需要透明背景）

**⚠️ 注意：** format 参数是必填的，必须指定目标格式

---

### 4. rotate - 旋转

```
rotate=90
```

| 类型 | 范围 | 必填 | 说明 |
|------|------|------|------|
| number | 0-360 | ✅ 是 | 顺时针旋转角度 |

**⚠️ 注意：** rotate 参数是必填的，必须指定旋转角度

---

### 5. crop - 裁剪

```
crop=x:10,y:10,w:100,h:100,g:center
```

| 缩写 | 完整名称 | 类型 | 范围 | 说明 |
|------|----------|------|------|------|
| x | x | number | ≥0 | 起始X坐标 |
| y | y | number | ≥0 | 起始Y坐标 |
| w | width | number | 1-30000 | 裁剪宽度 |
| h | height | number | 1-30000 | 裁剪高度 |
| g | gravity | string | nw/north/ne/west/center/east/sw/south/se | 重心位置 |

**示例：**
```
crop=w:300,h:300,g:center    # 从中心裁剪300x300
crop=x:100,y:100,w:500,h:500 # 从(100,100)裁剪500x500
```

---

### 6. circle - 圆形裁剪

```
circle=75
```

| 类型 | 范围 | 必填 | 说明 |
|------|------|------|------|
| number | 1-4096 | ✅ 是 | 圆形半径 |

**用途：** 圆形头像  
**建议：** 配合 `format=png` 使用（透明背景）

**⚠️ 注意：** circle 参数是必填的，必须指定半径

**示例：**
```
resize=w:150,h:150,m:fill&circle=75&format=png
```

---

### 7. roundedCorners - 圆角

```
roundedCorners=20
```

| 类型 | 范围 | 必填 | 说明 |
|------|------|------|------|
| number | 1-4096 | ✅ 是 | 圆角半径 |

**⚠️ 注意：** roundedCorners 参数是必填的，必须指定圆角半径

---

### 8. indexcrop - 索引切割

```
indexcrop=a:x,l:200,i:1
```

| 缩写 | 完整名称 | 类型 | 范围 | 必填 | 说明 |
|------|----------|------|------|------|------|
| a | axis | string | x, y | ⚠️ x或y之一 | 切割方向 |
| l | length | number | ≥1 | - | 每块长度 |
| i | index | number | ≥0 | - | 选取第几块 |

**⚠️ 参数规则：** `a` 参数必须是 `x` 或 `y` 之一（至少提供一个切割方向）

---

### 9. watermark - 水印

```
watermark=t:text,c:Logo,p:se,tr:80
```

| 缩写 | 完整名称 | 类型 | 范围 | 说明 |
|------|----------|------|------|------|
| t | type | string | text, image | 水印类型 |
| c | content | string | - | 文字内容或图片路径 |
| p | position | string | nw/north/ne/west/center/east/sw/south/se | 水印位置 |
| x | x | number | 0-4096 | 水平偏移 |
| y | y | number | 0-4096 | 垂直偏移 |
| tr | transparency | number | 0-100 | 透明度 |
| s | size | number | 1-1000 | 字体大小（文字） |
| co | color | string | - | 字体颜色（文字） |
| f | font | string | - | 字体名称（文字） |

**文字水印示例：**
```
watermark=t:text,c:版权所有,p:se,s:24,co:FFFFFF,tr:80
```

**图片水印示例：**
```
watermark=t:image,c:logo.png,p:se,tr:70
```

---

### 10. blur - 模糊

```
blur=r:10,s:5
```

| 缩写 | 完整名称 | 类型 | 范围 | 必填 | 说明 |
|------|----------|------|------|------|------|
| r | radius | number | 1-50 | ✅ 是 | 模糊半径 |
| s | sigma | number | 1-50 | ✅ 是 | 标准差 |

**⚠️ 注意：** radius 和 sigma 参数都是必填的

**建议值：** 轻度 `r:3,s:2` / 中度 `r:10,s:5` / 重度 `r:30,s:20`

---

### 11. sharpen - 锐化

```
sharpen=100
```

| 类型 | 范围 | 必填 | 说明 |
|------|------|------|------|
| number | 50-399 | ✅ 是 | 锐化强度 |

**⚠️ 注意：** sharpen 参数是必填的，取值范围为 50-399（注意不是从0开始）

---

### 12. bright - 亮度

```
bright=30
```

| 类型 | 范围 | 必填 | 说明 |
|------|------|------|------|
| number | -100 ~ 100 | ✅ 是 | 负数变暗，正数变亮 |

**⚠️ 注意：** bright 参数是必填的，必须指定亮度值

---

### 13. contrast - 对比度

```
contrast=20
```

| 类型 | 范围 | 必填 | 说明 |
|------|------|------|------|
| number | -100 ~ 100 | ✅ 是 | 负数降低，正数增强 |

**⚠️ 注意：** contrast 参数是必填的，必须指定对比度值

---

### 14. info - 获取图片信息

```
info=1
```

| 类型 | 可选值 | 说明 |
|------|--------|------|
| number | 0, 1 | 是否获取图片信息 |

**返回：** 格式、宽高、文件大小、EXIF信息

---

### 15. averageHue - 主色调

```
averageHue=1
```

| 类型 | 可选值 | 说明 |
|------|--------|------|
| number | 0, 1 | 是否获取主色调 |

---

### 16. autoOrient - 自适应方向

```
autoOrient=1
```

| 类型 | 可选值 | 必填 | 说明 |
|------|--------|------|------|
| number | 0, 1 | ✅ 是 | 根据EXIF自动旋转 |

**⚠️ 注意：** autoOrient 参数是必填的，必须指定 0 或 1

**推荐：** 处理用户上传的照片时启用（设为1）

---

### 17. interlace - 渐进显示

```
interlace=1
```

| 类型 | 可选值 | 必填 | 说明 |
|------|--------|------|------|
| number | 0, 1 | ✅ 是 | 是否启用渐进加载 |

**⚠️ 注意：** interlace 参数是必填的，必须指定 0 或 1

**用途：** 大图片由模糊到清晰显示

---

### 18. raw - 原始字符串

```
raw=image/resize,w_300/quality,q_90
```

| 类型 | 说明 |
|------|------|
| string | 云服务商原始处理字符串 |

**注意：** 设置后其他参数会被忽略

---

## 常用场景

### 缩略图（固定尺寸）
```
resize=w:200,h:200,m:fill&quality=80&format=webp
```

### 缩略图（等比缩放）
```
resize=w:200,h:200,m:lfit&quality=80&format=webp
```

### 圆形头像
```
resize=w:150,h:150,m:fill&circle=75&format=png
```

### 商品图（长边限制）
```
resize=w:800,h:800,m:lfit&quality=85&roundedCorners=20&format=webp
```

### 商品图（带长边约束）
```
resize=w:1000,h:1000,m:lfit,l:800&quality=85&format=webp
```

### 文章配图（带水印）
```
resize=w:800,h:600,m:lfit&quality=85&watermark=t:text,c:版权所有,p:se,tr:80&format=webp
```

### 大图预览（渐进加载）
```
resize=w:1920,h:1920,m:lfit&quality=90&autoOrient=1&interlace=1
```

### 移动端自适应
```
resize=w:750,h:750,m:lfit&quality=85&format=webp
```

### 百分比缩放
```
resize=p:50&quality=85&format=webp
```

---

## 使用限制

### 原图要求
- **格式：** JPG、PNG、BMP、GIF、WebP、TIFF
- **大小：** ≤ 20 MB
- **尺寸：** 宽或高 ≤ 16,384 px（文件服务）

### 参数必填规则

使用图片处理操作时，请注意以下参数的必填要求：

**必须提供参数值的操作：**
- `format`: 必须指定目标格式
- `rotate`: 必须指定旋转角度（0-360）
- `bright`: 必须指定亮度值（-100~100）
- `contrast`: 必须指定对比度值（-100~100）
- `sharpen`: 必须指定锐化强度（50-399）
- `circle`: 必须指定圆形半径（1-4096）
- `roundedCorners`: 必须指定圆角半径（1-4096）
- `autoOrient`: 必须指定 0 或 1
- `interlace`: 必须指定 0 或 1

**条件必填的操作：**
- `resize`:
  - 使用 `mode` 时必须同时提供 `width` 和 `height`
  - 使用 `mode=pad` 时必须提供 `color` 参数
  - 使用 `percentage` 时不需要其他参数
- `blur`: 必须同时提供 `radius` 和 `sigma`
- `indexcrop`: 必须提供 `axis`（x 或 y）

### 错误处理

参数不符合要求时会返回错误：

```json
{
  "success": false,
  "error": "resize.param.h 字段是必须的当 resize.param.m 是存在的"
}
```

**常见错误：**
- 未提供必填参数
- 参数值超出范围
- 参数组合不正确（如 resize 有 mode 但缺少 width/height）


## 参考文档

- [阿里云 OSS 图片处理文档](https://help.aliyun.com/zh/oss/user-guide/overview-17/)
- [火山引擎 TOS 图片处理文档](https://www.volcengine.com/docs/6349/153623)