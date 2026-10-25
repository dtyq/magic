# 微信聊天记录导入教程

这两张脱敏教程图是已认可的正式素材，复用现有版本，没有重新生成。生成工具为会话内置 `image_gen.imagegen`，生成时间为 2026-10-04，模型 `gpt-image-2.5-flare`。图中群聊、头像、消息均为虚构内容。

- `desktop-tutorial.webp`：1774 × 887，来源版本 desktop-v07。参考 desktop-v06，保留真实微信冷灰背景、白色和绿色气泡，展示右键消息、多选、点击复制。
- `mobile-tutorial.webp`：1024 × 1536，来源版本 mobile-v04。参考 mobile-v03，展示长按消息、多选和底部复制；不使用真人手指和变形手机外壳。

生成要求：使用现代简洁的微信教程排版；保留微信真实配色和操作结构；内容脱敏；去掉偏黄背景、红色标注横幅和非微信色彩。原参考来自用户提供的桌面微信消息菜单和多选复制截图。

资源转换：保留原分辨率，使用 `cwebp -q 95 -m 6 -sharp_yuv -metadata icc`，在 2026-10-07 转成 WebP。桌面图由 1,144,298 字节压缩至 120,756 字节，减少 89.45%；手机图由 1,095,158 字节压缩至 98,044 字节，减少 91.05%。编码器报告的 YUV PSNR 分别为 52.36 dB 和 52.88 dB。这是高质量有损压缩，不是像素完全无损。

资源通过根目录 `.gitattributes` 中本目录的 WebP 规则进入 Git LFS，普通 Git 只保存指针。源码检出与构建需要下载对应 LFS 对象；原 PNG 不保存在正式资源目录或本功能的提交历史中。

## 混合内容示例（2026-10-07）

新增两张正式教程素材，原电脑和手机复制步骤图继续保留。新图展示微信多选时可以同时勾选的内容，图中姓名、群聊、附件和分享标题均为虚构示例，不代表真实聊天或网站数据。图片可以点击打开项目现有图片查看器。

- `files-tutorial-v01.webp`：1122 × 1402，展示文字、图片、PDF、Word、Excel 消息及底部复制按钮。
- `links-tutorial-v01.webp`：1122 × 1402，展示小红书、知乎分享卡片和普通链接及底部复制按钮。

工具为会话内置 `image_gen.imagegen`，模型由工具选择，返回结果未提供模型标识。视觉参考为本目录 `desktop-tutorial.webp`；仅参考微信界面、配色和既有素材调性，不使用用户真实联系人或聊天内容。文件图初稿群聊人数与示例参与者不一致，使用同一工具只修改标题人数为 5，其余内容保持原设计；分享图一次生成完成。无工具调用失败。

两图保留原分辨率，使用 `cwebp -q 95 -m 6 -sharp_yuv -metadata icc` 高质量有损压缩，通过本目录已有 WebP 规则进入 LFS。原始 PNG 留在生图工具输出目录，不加入源码或提交历史。

### 生图提示词记录

两图共用的视觉约束：

```text
Use case: ui-mockup. Asset type: a production tutorial illustration for importing real WeChat chat history. The reference is ONLY a visual style and authentic WeChat UI reference. Create a NEW single desktop WeChat chat panel in multi-select mode, not a marketing poster, not two panels. Keep the exact reference's calm cool-gray chat background, white received bubbles, vivid authentic WeChat green sent TEXT bubbles, thin gray UI borders and monochrome line toolbar icons. Use neutral fictional names and refined understated photographic/art avatars as in the reference, no real identities. Flat front-facing screenshot with perfectly legible Simplified Chinese, crisp UI, generous normal message spacing. A white titlebar reads “项目讨论群（3）”, small search, phone and more icons at right. At left of EACH selected message row a small authentic green circle with white tick. At bottom a white toolbar showing “已选择 5 条”, “复制”, “收藏”, “删除”, “取消”; Copy uses the conventional two overlapping rectangles icon and a subtle cool-gray selected background. Ordinary Chinese sans-serif type, no display font. Nothing outside the app window except a very small neutral margin. No red arrows, numbered promotional banners, colored Tips, yellow tint, warm beige backgrounds, blue UI bubbles, large bold promotional copy, hands, crude stick avatars, phone frames, watermark, private information, invented statistics. Output ONE tall high-resolution image, approximately 1200 x 1500, with the whole copy toolbar visible; contents must stay readable when opened full screen.
```

文件图的内容要求：

```text
Primary request: show that PHOTOS AND REAL FILE ATTACHMENTS can be selected and copied together. In exact vertical order show these five selected messages: 1. white received text “资料都在下面，可以一起复制。” by “林沐”; 2. a real landscape photo thumbnail of a serene contemporary office meeting room, no text overlay, message by “陈安”; 3. a white WeChat file attachment card titled “项目方案.pdf”, smaller “2.4 MB”, authentic red PDF document icon at right; 4. a white file card “会议纪要.docx”, smaller “128 KB”, blue Word document icon at right; 5. a white file card “预算清单.xlsx”, smaller “86 KB”, green Excel document icon at right. The file cards must look like actual WeChat compact rectangular file shares, not green text bubbles, with a fine separator and muted footer “微信电脑版”. Show alternating left/right alignment naturally. Keep all five selected items and bottom Copy clearly visible. Do NOT add tutorials, large headers, or explanations inside the screenshot.
```

分享图的内容要求：

```text
Primary request: show that EXTERNAL WEBSITE SHARE CARDS AND ORDINARY LINKS can be selected and copied together. In exact vertical order show five selected messages: 1. white received text “这两篇可以一起整理。” by “林沐”; 2. a compact white WeChat share card with black headline “小空间的收纳灵感”, muted two-line description “整理思路与实用清单”, a small understated interior photo thumbnail at right, footer anchored at bottom left with small red Xiaohongshu icon and site name “小红书”; 3. a compact white WeChat share card with black headline “如何把会议记录变成行动清单？”, muted two-line description “从讨论到下一步安排”, a small neutral graphic thumbnail at right, footer anchored at bottom left with blue Zhihu “知” icon and site name “知乎”; 4. a green SENT text bubble with blue plain URL “https://example.com/project”; 5. a green SENT text bubble “也可以连同图片和文件一起选择。” by “陈安”. Website names belong only in each card's lower-left source footer; genuine UI structure, not a separate legend. Do NOT show fake authors or share-count statistics. All five selected items and bottom Copy clearly visible. Do NOT add tutorials, large headers, or explanations inside the screenshot.
```

文件图的局部修正：

```text
Edit this tutorial screenshot with ONE correction only: the white top titlebar currently says 项目讨论群（3） but there are five distinct fictional participants shown. Change ONLY the member count to read exactly “项目讨论群（5）”. Keep absolutely everything else pixel-close to the input: all names, avatars, file cards and readable filenames, photo, green selection checks, spacing, cold gray background, bottom Copy toolbar, typography, dimensions, white palette. Do not redraw or redesign. No additional text, no arrows, no extra layout, no watermark.
```
