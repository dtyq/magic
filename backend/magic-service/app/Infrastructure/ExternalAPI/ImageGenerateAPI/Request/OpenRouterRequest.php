<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request;

class OpenRouterRequest extends ImageGenerateRequest
{
    protected array $imageConfig = [];

    /**
     * OpenRouter reasoning 配置。
     * 默认只隐藏 reasoning 文本，思考等级交给服务商默认策略。
     */
    protected array $reasoning = [
        'exclude' => true,
    ];

    protected array $referenceImages = [];

    public function __construct(
        string $model = '',
        string $prompt = '',
        array $imageConfig = []
    ) {
        parent::__construct('', '', $prompt, '', $model);
        $this->imageConfig = $imageConfig;
    }

    public function getImageConfig(): array
    {
        return $this->imageConfig;
    }

    public function setImageConfig(array $imageConfig): void
    {
        $this->imageConfig = $imageConfig;
    }

    public function getReasoning(): array
    {
        return $this->reasoning;
    }

    public function setReasoning(array $reasoning): void
    {
        $this->reasoning = $reasoning;
    }

    public function getReferenceImages(): array
    {
        return $this->referenceImages;
    }

    public function setReferenceImages(array $referenceImages): void
    {
        $this->referenceImages = $referenceImages;
    }

    /**
     * 转换为 OpenRouter API 请求格式.
     */
    public function toArray(): array
    {
        $data = [
            'model' => $this->getModel(),
            'modalities' => ['image'],
        ];

        // 构建 messages 内容
        $content = $this->buildMessageContent();

        $data['messages'] = [
            [
                'role' => 'user',
                'content' => $content,
            ],
        ];

        if (! empty($this->imageConfig)) {
            $data['image_config'] = $this->imageConfig;
        }

        if (! empty($this->reasoning)) {
            $data['reasoning'] = $this->reasoning;
        }

        return $data;
    }

    /**
     * 构建消息内容，支持图片编辑（传入参考图片）.
     *
     * @return array|string 如果有参考图片则返回数组格式，否则返回字符串
     */
    private function buildMessageContent(): array|string
    {
        // 如果没有参考图片，直接返回文本提示词
        if (empty($this->referenceImages)) {
            return $this->getPrompt();
        }

        // 如果有参考图片，构建数组格式的 content
        $content = [];

        // 添加所有参考图片
        foreach ($this->referenceImages as $imageUrl) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => $imageUrl,
                    'detail' => 'high', // 可选：high/low/auto，默认使用 high
                ],
            ];
        }

        // 添加文本提示词
        if (! empty($this->getPrompt())) {
            $content[] = [
                'type' => 'text',
                'text' => $this->getPrompt(),
            ];
        }

        return $content;
    }
}
