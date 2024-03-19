# `getElementSelector()` 关键修复摘录

## 修复前

```ts
const siblings = Array.from(parentElement.children)
const matchingSiblings = siblings.filter((child) => {
  if (child.tagName.toLowerCase() !== currentElement.tagName.toLowerCase()) {
    return false
  }

  const childClasses =
    child.className
      ?.trim()
      .split(" ")
      .filter((cls: string) => cls && !cls.startsWith("__editor-"))
      .sort() || []
  const sortedClasses = [...classes].sort()

  return JSON.stringify(childClasses) === JSON.stringify(sortedClasses)
})

if (matchingSiblings.length > 1) {
  const index = siblings.indexOf(currentElement) + 1
  selector = `${baseSelector}:nth-child(${index})`
}
```

问题在于：唯一性判断基于 class 全等，但浏览器的 `.a.b.c` 选择器只要求目标节点包含这些 class，不要求 class 集合完全相等。

## 修复后

```ts
const sameTagSiblings = Array.from(parentElement.children).filter(
  (child) => child.tagName.toLowerCase() === currentElement.tagName.toLowerCase(),
)

if (sameTagSiblings.length > 1) {
  const index = sameTagSiblings.indexOf(currentElement) + 1
  selector = `${baseSelector}:nth-of-type(${index})`
} else {
  selector = baseSelector
}
```

修复点是让 selector 生成规则和浏览器真实匹配语义对齐：只要存在同 tag 兄弟节点，就显式补上 `:nth-of-type()`，避免 class 子集冲突。
