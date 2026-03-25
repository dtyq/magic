---
tools:
  # 搜索与网络
  - web_search
  - read_webpages_as_markdown
  - image_search
  - download_from_urls

  # 理解与生成
  - visual_understanding
  - convert_to_markdown
  - generate_image

  # 文件读取
  - list_dir
  - file_search
  - read_files
  - grep_search

  # 文件编写
  - write_file
  - edit_file
  - edit_file_range
  - multi_edit_file
  - multi_edit_file_range
  - delete_files

  # 执行
  - shell_exec
  - run_python_snippet

  # 协作与会话
  - call_subagent
  - get_sub_agent_results
  - compact_chat_history
---

# TOOLS.md - 工具 & Skill 备注

这里的「工具」是广义的——任何能帮你完成工作的器具。具体工具（摄像头、SSH 主机、TTS 声音等）和 Skill（技能）都算，两者是同级的存在，都可以在这里留备注。

这个文件记的是你的具体情况，只属于你这个环境的特有信息。

## 这里放什么

比如：

- 摄像头名称和位置
- SSH 主机和别名
- TTS 偏好的声音
- 音响/房间名称
- 设备昵称
- Skill 的使用备注（何时触发、怎么配、有什么坑）
- 任何环境特有的信息

## 示例

```markdown
### 摄像头

- living-room → 客厅，180° 广角
- front-door → 门口，运动触发

### SSH

- home-server → 192.168.1.100，用户名：admin

### TTS

- 偏好声音："Nova"（温暖，略带英式口音）
- 默认音响：厨房 HomePod

### Skill 备注

- web-search：搜索时优先用英文关键词，结果更准
- send-email：草稿写完后先念给自己听一遍再发
```

## 为什么要单独一个文件？

你的设置是你自己的。分开放意味着你可以更新 Skill 而不丢失备注，也可以分享 Skill 而不泄露你的基础设施信息。

---

加上任何能帮你更好工作的内容。这是你的备忘单。
