# 📚 MultiFolderUploadToast 相关文档

这个目录包含了多文件夹上传功能的所有相关文档和说明。

## 文档列表

### 🔧 技术实现文档

#### [UPLOAD_INTEGRATION.md](./UPLOAD_INTEGRATION.md)
- **描述**: OSS上传服务集成指南
- **内容**: 
  - 现有服务集成说明
  - 使用方法和API接口
  - 技术架构设计

#### [REAL_UPLOAD_INTEGRATION.md](./REAL_UPLOAD_INTEGRATION.md)
- **描述**: 真实上传服务集成完成报告
- **内容**:
  - 从模拟实现到真实上传的迁移过程
  - 技术实现详情和性能优化
  - 测试验证和兼容性保证

#### [FOLDER_UPLOAD_FLOW.md](./FOLDER_UPLOAD_FLOW.md)
- **描述**: 用户文件夹上传流程详细说明
- **内容**:
  - 完整的上传流程图
  - 用户操作步骤
  - 系统内部处理逻辑

### 🐛 问题修复文档

#### [BUGFIXES.md](./BUGFIXES.md)
- **描述**: Bug修复报告
- **内容**:
  - UI显示问题修复
  - 任务计数警告修复
  - 调试日志和问题排查

#### [I18N_FIXES.md](./I18N_FIXES.md)
- **描述**: 国际化修复报告
- **内容**:
  - 硬编码中文消息的国际化处理
  - 类型兼容性问题修复
  - 多语言支持完善

## 📖 阅读顺序建议

如果你是第一次了解多文件夹上传功能，建议按以下顺序阅读：

1. **[FOLDER_UPLOAD_FLOW.md](./FOLDER_UPLOAD_FLOW.md)** - 了解整体流程
2. **[UPLOAD_INTEGRATION.md](./UPLOAD_INTEGRATION.md)** - 理解技术架构
3. **[REAL_UPLOAD_INTEGRATION.md](./REAL_UPLOAD_INTEGRATION.md)** - 了解实现细节
4. **[BUGFIXES.md](./BUGFIXES.md)** - 了解已解决的问题
5. **[I18N_FIXES.md](./I18N_FIXES.md)** - 了解国际化处理

## 🎯 功能概述

多文件夹上传功能支持：

- ✅ **批量上传**: 每批10个文件，支持大文件夹
- ✅ **并发控制**: 最多3个项目同时上传，每个项目最多2个任务
- ✅ **错误重试**: 自动重试机制，最多重试3次
- ✅ **全局状态**: 跨路由和项目的持久化上传状态
- ✅ **进度显示**: 实时进度更新和详细状态信息
- ✅ **国际化**: 完整的中英文支持
- ✅ **真实上传**: 集成现有的OSS上传服务

## 🔗 相关代码文件

- **核心组件**: `../index.tsx` - 主要的UI组件
- **状态管理**: `../../../../stores/folderUpload/` - MobX状态管理
- **样式文件**: `../styles.ts`, `../TaskItem.styles.ts`, `../TaskSummary.styles.ts`
- **子组件**: `../TaskItem.tsx`, `../TaskSummary.tsx`

## 📅 更新历史

- **2024-12**: 初始实现和文档编写
- **2024-12**: Bug修复和国际化完善
- **2024-12**: 真实上传服务集成
- **2024-12**: 文档整理和归档

---

💡 **提示**: 如果你在使用过程中遇到问题，请先查看相关的修复文档，或者参考流程说明进行排查。
