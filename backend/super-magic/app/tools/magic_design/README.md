# Design Project Templates

此目录包含设计项目的模板文件。

## 文件说明

### magic.project.template.js
设计项目的配置文件模板。包含以下占位符：
- `{{PROJECT_NAME}}`: 项目名称，会被实际的项目名称替换

## 使用方式

`create_design_project` 工具会：
1. 从此目录读取模板文件
2. 替换模板中的占位符
3. 将处理后的文件复制到新项目中

## 模板维护

- 修改此目录中的文件会影响所有新创建的设计项目
- 占位符使用 `{{VARIABLE_NAME}}` 格式
- 确保模板文件的语法正确性
