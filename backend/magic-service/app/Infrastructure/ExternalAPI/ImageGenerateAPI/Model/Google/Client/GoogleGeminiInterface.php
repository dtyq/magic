<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client;

interface GoogleGeminiInterface
{
    /**
     * 设置模型ID.
     */
    public function setModelId(string $modelId): void;

    /**
     * 生成内容（支持文生图、图生图/多模态）.
     *
     * @param string $prompt 提示词
     * @param array $images 图片列表 (可选)
     * @param array $config 生成配置 (可选)
     */
    public function generateContent(string $prompt, array $images = [], array $config = []): array;

    /**
     * 上传文件.
     */
    public function uploadFile(string $filePath, string $mimeType): string;
}
