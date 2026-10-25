# Debug 媒体素材

本目录中的素材只用于本地模拟高成本的图片和视频生成，不用于生产生成结果。

- `ENABLE_MOCK_IMAGE_GENERATION=true`：图片 Dispatcher 使用本地 mock Handler。
- `ENABLE_MOCK_VIDEO_GENERATION=true`：视频 Dispatcher 使用本地 mock Handler。

- `mock-image.jpg`：来源于 MDN shared assets 的示例图片。
- `mock-video.mp4`：来源于 MDN interactive examples 的 CC0 视频素材。

运行时不会把源素材直接暴露给用户，而是通过本地 FFmpeg 生成符合目标尺寸、时长和格式的项目内副本。图片与视频之外的流程不使用 mock。
