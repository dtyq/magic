<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\ValueObject;

/**
 * 水印配置值对象
 */
class WatermarkConfig
{
    private bool $addLogo = true;

    public function __construct(
        private string $logoTextContent,
        private int $position = 3,
        private float $opacity = 0.3,
        private int $language = 0,
    ) {
    }

    public function getLogotextContent(): string
    {
        return $this->logoTextContent;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getOpacity(): float
    {
        return $this->opacity;
    }

    public function getLanguage(): int
    {
        return $this->language;
    }

    /**
     * 转换为火山引擎提交任务API所需的数组格式.
     */
    public function toVolcengineSubmitArray(): array
    {
        return [
            'content' => $this->logoTextContent,
            'position' => $this->position,
            'opacity' => $this->opacity,
            'language' => $this->language,
        ];
    }

    /**
     * 转换为火山引擎查询任务API所需的数组格式.
     */
    public function toArray(): array
    {
        return [
            'add_logo' => $this->addLogo,
            'logo_text_content' => $this->logoTextContent,
            'position' => $this->position,
            'language' => $this->language,
        ];
    }
}
