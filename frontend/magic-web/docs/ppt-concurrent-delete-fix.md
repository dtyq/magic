# PPT 并发删除数据错乱问题修复文档

## 问题描述

当用户快速连续删除多个 PPT 幻灯片时，会出现以下问题：
- 删除操作失败，提示 "Slide not found" 错误
- 已删除的幻灯片被意外恢复
- 幻灯片顺序混乱
- activeIndex 指向错误的幻灯片

## 根本原因分析

### 原始实现的问题

在原代码中，`previousSlides` 快照是在 `onOk` 回调内部捕获的：

```typescript
const handleDeleteSlide = (index: number) => {
  // ... 验证逻辑 ...
  
  MagicModal.confirm({
    onOk: async () => {
      // ❌ 问题：在这里才捕获快照
      const previousSlides = [...store.slides]
      
      // 乐观更新
      store.setSlides(newSlides, true)
      
      // API 调用
      await deleteSlide({
        slidePath,
        currentSlides: previousSlides.map((s) => s.path),
        ...
      })
    }
  })
}
```

### 并发场景下的执行时序

当用户快速连续删除 3 个幻灯片时：

```
t1: 用户点击删除 slide-1
    → handleDeleteSlide(1) 被调用
    → 显示确认对话框
    → deletingSlidesRef.add("slide-1.html")

t2: 用户点击删除 slide-2（对话框还没确认）
    → handleDeleteSlide(2) 被调用
    → 显示确认对话框
    → deletingSlidesRef.add("slide-2.html")

t3: 用户确认删除 slide-1
    → onOk 执行
    → ❌ previousSlides = store.slides（20个，包含 slide-1）✅ 正确
    → 乐观更新：store.slides = 19个（移除 slide-1）
    → API 调用中...

t4: 用户确认删除 slide-2
    → onOk 执行
    → ❌ previousSlides = store.slides（19个，不包含 slide-1）❌ 错误！被污染
    → 乐观更新：store.slides = 18个
    → API 调用：currentSlides = 19个的列表 ❌ 错误参数

t5: slide-1 的 API 返回成功
    → 后端状态：19个 slides

t6: slide-2 的 API 调用
    → 传入 currentSlides = 19个（不包含 slide-1）
    → 但后端当前状态是 19个
    → 如果用户继续删除，后续操作会覆盖前面的删除结果
```

### 核心问题

**快照污染**：后续删除操作捕获的 `previousSlides` 快照，已经被前面删除操作的乐观更新所污染。

## 修复方案

### 解决思路

**在函数入口就捕获快照**，而不是在 `onOk` 回调中捕获：

```typescript
const handleDeleteSlide = useMemoizedFn((index: number) => {
  // ... 验证逻辑 ...
  
  const slidePath = slideToDelete.path
  const fileId = store.getFileIdByPath(slidePath)
  
  // ✅ 修复：在函数入口立即捕获快照
  // 这个快照代表用户点击删除按钮时的真实后端状态
  const slidesSnapshotForApi = [...store.slides]
  const activeIndexSnapshot = store.activeIndex
  
  deletingSlidesRef.current.add(slidePath)
  
  MagicModal.confirm({
    onOk: async () => {
      // ✅ 使用函数入口捕获的快照
      const previousSlides = slidesSnapshotForApi
      const previousActiveIndex = activeIndexSnapshot
      
      // ... 乐观更新和 API 调用 ...
      
      await deleteSlide({
        slidePath,
        currentSlides: previousSlides.map((s) => s.path), // ✅ 使用正确的快照
        ...
      })
    }
  })
})
```

### 修复后的执行时序

```
t1: 用户点击删除 slide-1
    → handleDeleteSlide(1) 被调用
    → ✅ slidesSnapshotForApi = store.slides（20个，包含 slide-1）
    → 显示确认对话框

t2: 用户点击删除 slide-2
    → handleDeleteSlide(2) 被调用
    → ✅ slidesSnapshotForApi = store.slides（20个，包含 slide-2）
    → 显示确认对话框

t3: 用户确认删除 slide-1
    → onOk 执行
    → ✅ previousSlides = slidesSnapshotForApi（20个，包含 slide-1）
    → 乐观更新：store.slides = 19个
    → API 调用：currentSlides = 20个的列表 ✅ 正确

t4: 用户确认删除 slide-2
    → onOk 执行
    → ✅ previousSlides = slidesSnapshotForApi（20个，包含 slide-2）
    → 乐观更新：store.slides = 18个
    → API 调用：currentSlides = 20个的列表 ✅ 正确

t5: slide-1 的 API 返回成功
    → 后端状态：19个 slides ✅

t6: slide-2 的 API 返回成功
    → 后端状态：18个 slides ✅
```

### 关键改进点

1. **快照时机**：在函数入口（用户点击时）立即捕获，而不是在 onOk 回调中捕获
2. **独立快照**：每个删除操作都有独立的快照，互不影响
3. **状态一致性**：快照代表真实的后端状态，不会被其他操作的乐观更新污染
4. **API 参数正确**：传给 deleteSlide API 的 currentSlides 始终包含要删除的幻灯片

## 测试验证

### 单元测试

已添加单元测试文件：`hooks/__tests__/concurrent-delete-fix.test.ts`

测试覆盖以下场景：
- ✅ 快照污染场景模拟
- ✅ 修复后的快照捕获时机
- ✅ API 参数验证
- ✅ 时序问题验证

运行测试：
```bash
pnpm test hooks/__tests__/concurrent-delete-fix.test.ts
```

### 手动验证步骤

1. **准备测试环境**
   - 打开包含至少 5-6 张幻灯片的 PPT
   - 确保在编辑模式下

2. **执行并发删除**
   - 快速连续点击删除 3-4 张不同的幻灯片
   - 在确认对话框出现后立即点击确认
   - 不要等待前一个删除完成

3. **验证结果**
   - ✅ 所有删除操作都成功完成
   - ✅ 没有 "Slide not found" 错误
   - ✅ 没有 "删除失败" 的提示
   - ✅ 最终幻灯片列表正确（所有点击删除的幻灯片都被删除）
   - ✅ 没有已删除的幻灯片被恢复
   - ✅ activeIndex 指向正确
   - ✅ 幻灯片顺序正确

### 日志验证（开发模式）

在开发模式下，可以通过日志验证修复：

```typescript
// 在 handleDeleteSlide 函数入口
console.log('[DELETE] Snapshot captured at entry:', {
  slidePath,
  snapshotLength: slidesSnapshotForApi.length,
  snapshot: slidesSnapshotForApi.map(s => s.path)
})

// 在 onOk 回调开始
console.log('[DELETE] Using snapshot in onOk:', {
  slidePath,
  previousSlidesLength: previousSlides.length,
  previousSlides: previousSlides.map(s => s.path),
  currentStoreLength: store.slides.length
})

// 在 API 调用前
console.log('[DELETE] API call with:', {
  slidePath,
  currentSlides: previousSlides.map(s => s.path),
  containsTargetSlide: previousSlides.some(s => s.path === slidePath)
})
```

验证点：
- ✅ 快照在函数入口就被捕获
- ✅ onOk 回调使用的是函数入口捕获的快照
- ✅ currentSlides 始终包含要删除的 slidePath
- ✅ 即使 store.slides 已被乐观更新，previousSlides 仍然是正确的快照

## 性能影响

**无负面影响**：
- 快照捕获从 onOk 回调移到函数入口，只是时机的变化
- 快照操作本身是浅拷贝（`[...store.slides]`），性能消耗极小
- 不增加额外的 API 调用或网络请求
- 不增加额外的内存占用（快照在 onOk 完成后会被垃圾回收）

## 相关文件

### 修改的文件
- `src/opensource/pages/superMagic/components/Detail/components/PPTRender/hooks/usePPTSidebar.tsx`

### 新增的测试
- `src/opensource/pages/superMagic/components/Detail/components/PPTRender/hooks/__tests__/concurrent-delete-fix.test.ts`

### 相关文档
- `docs/ppt-concurrent-delete-fix.md`（本文档）

## 回归风险

**低风险**：
- 修改仅涉及快照捕获时机，不改变核心删除逻辑
- 不影响单个删除操作（非并发场景）
- 不影响其他 PPT 操作（插入、重命名等）
- 保留了所有错误处理和回滚逻辑

## 未来改进建议

1. **添加并发控制提示**
   - 当检测到并发删除时，可以显示友好提示
   - 例如："正在处理多个删除操作，请稍候..."

2. **批量删除优化**
   - 如果用户选择删除多张幻灯片，可以考虑批量 API 调用
   - 减少网络请求次数，提升性能

3. **状态机管理**
   - 考虑使用状态机来管理删除操作的生命周期
   - 更清晰地处理并发场景和异常情况

## 总结

通过将快照捕获时机从 `onOk` 回调移到 `handleDeleteSlide` 函数入口，成功解决了并发删除时的数据错乱问题。修复方案简单、有效，且没有性能负面影响。
