# Canvas 共享素材

`prompts.json` 是正式 `search_canvas_image_prompts` 工具使用的共享提示词库。

画布项目由 `initialize_canvas` 初始化；图像生成通过 `canvas-manager` Skill，在 Code Mode 调用 `add_canvas_elements` 或 `add_canvas_contents`，并用 `wait_canvas_generation` 等待结果。项目配置由正式 Canvas 工具管理，不从此目录复制旧项目模板。
