# 项目基础颜色管理

## 区分 scales 和 usages

usages 是基于 scales 业务层面的业务层变量

## 类型

详细见 `src/utils/palettes.ts` 文件

## 如何获取全局基础颜色变量

### createStyles 中获取

```tsx
const useStyles = createStyles(({ token }) => {
	return {
		main: {
			color: token.magicColorUsages.white,
		},
	}
})
```

### hook 获取

```tsx
import { useBaseColor } from "@/components/providers/BaseColorProvider/hooks"

export default function Comp() {
	// ...

	const { colorScales, colorUsages } = useBaseColor()

	// ...
}
```
