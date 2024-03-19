# 图片处理文档

## 文档说明

### [IMAGE_PROCESSING_API.md](./IMAGE_PROCESSING_API.md) - 参数说明文档
包含所有图片处理参数的详细说明、取值范围和使用示例。

### [IMAGE_PROCESSING.md](./IMAGE_PROCESSING.md) - 技术文档
包含架构说明和扩展性说明。

---

## 常用场景

| 场景 | 参数字符串 |
|------|-----------|
| 缩略图 | `resize=w:200,h:200,m:fill&quality=80&format=webp` |
| 圆形头像 | `resize=w:150,h:150,m:fill&circle=75&format=png` |
| 商品图 | `resize=w:800,m:lfit&quality=85&roundedCorners=20&format=webp` |
| 文章配图 | `resize=w:800,m:lfit&quality=85&watermark=t:text,c:版权所有,p:se,tr:80&format=webp` |
| 大图预览 | `resize=l:1920,m:lfit&quality=90&autoOrient=1&interlace=1` |

详细说明请查看 [IMAGE_PROCESSING_API.md](./IMAGE_PROCESSING_API.md)
