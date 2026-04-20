// Package sourcebinding 定义知识库来源绑定领域模型与项目文件绑定辅助逻辑。
package sourcebinding

import (
	"strconv"
	"strings"

	"magic/internal/pkg/projectfile"
)

// BindingUserID 返回绑定当前有效的操作者 ID。
func BindingUserID(binding Binding) string {
	if userID := strings.TrimSpace(binding.UpdatedUID); userID != "" {
		return userID
	}
	return strings.TrimSpace(binding.CreatedUID)
}

// FormatProjectFileRef 将项目文件 ID 转成绑定层统一引用格式。
func FormatProjectFileRef(projectFileID int64) string {
	if projectFileID <= 0 {
		return ""
	}
	return strconv.FormatInt(projectFileID, 10)
}

// ResolveProjectFileDocumentName 为项目文件解析结果推导文档名。
func ResolveProjectFileDocumentName(resolved *projectfile.ResolveResult) string {
	if resolved == nil {
		return ""
	}
	if name := strings.TrimSpace(resolved.FileName); name != "" {
		return name
	}
	if path := strings.TrimSpace(resolved.RelativeFilePath); path != "" {
		return path
	}
	return FormatProjectFileRef(resolved.ProjectFileID)
}
