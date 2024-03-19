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
    protected bool $addLogo = true;

    protected string $logoTextContent = '';

    protected int $position = 3;

    protected float $opacity = 0.3; // 透明度

    protected int $language = 0;

    public function __construct(string $logoTextContent, int $position, float $opacity, int $language = 0)
    {
        $this->logoTextContent = $logoTextContent;
        $this->position = $position;
        $this->opacity = $opacity;
        $this->language = $language;
    }

    public function isAddLogo(): bool
    {
        return $this->addLogo;
    }

    public function setAddLogo(bool $addLogo): void
    {
        $this->addLogo = $addLogo;
    }

    public function getLogoTextContent(): string
    {
        return $this->logoTextContent;
    }

    public function setLogoTextContent(string $logoTextContent): void
    {
        $this->logoTextContent = $logoTextContent;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): void
    {
        $this->position = $position;
    }

    public function getOpacity(): float
    {
        return $this->opacity;
    }

    public function setOpacity(float $opacity): void
    {
        $this->opacity = $opacity;
    }
}
