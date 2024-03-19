<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

/**
 * 图像模型尺寸配置值对象.
 */
class ImageSizeConfig extends AbstractValueObject
{
    /**
     * @var array 支持的尺寸列表，格式: [['label' => '1:1', 'value' => '1024x1024', 'scale' => null], ...]
     */
    protected array $sizes = [];

    /**
     * @var int 最大参考图片数量
     */
    protected int $maxReferenceImages = 0;

    public function __construct(?array $data = null)
    {
        if ($data !== null) {
            $this->sizes = $data['sizes'] ?? [];
            $this->maxReferenceImages = $data['max_reference_images'] ?? 0;
        }
    }

    public function getSizes(): array
    {
        return $this->sizes;
    }

    public function setSizes(array $sizes): void
    {
        $this->sizes = $sizes;
    }

    public function getMaxReferenceImages(): int
    {
        return $this->maxReferenceImages;
    }

    public function setMaxReferenceImages(int $maxReferenceImages): void
    {
        $this->maxReferenceImages = $maxReferenceImages;
    }

    /**
     * 检查是否有尺寸配置.
     */
    public function hasConfig(): bool
    {
        return ! empty($this->sizes);
    }

    /**
     * 转换为数组格式.
     */
    public function toArray(): array
    {
        return [
            'sizes' => $this->sizes,
            'max_reference_images' => $this->maxReferenceImages,
        ];
    }

    /**
     * JSON 序列化，确保返回数组格式.
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
