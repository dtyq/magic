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

    /**
     * @var string 默认显示的分辨率档位
     */
    protected string $defaultScale = '';

    /**
     * @var array<array<string, mixed>> 模型专属图片设置定义
     */
    protected array $imageSettings = [];

    public function __construct(?array $data = null)
    {
        if ($data !== null) {
            $this->sizes = $data['sizes'] ?? [];
            $this->maxReferenceImages = $data['max_reference_images'] ?? 0;
            $this->defaultScale = is_string($data['default_scale'] ?? null) ? $data['default_scale'] : '';
            $this->imageSettings = is_array($data['image_settings'] ?? null) ? $data['image_settings'] : [];
        }
    }

    /**
     * 从原始配置数组创建值对象。
     *
     * @param null|array<string, mixed> $config
     */
    public static function fromConfig(?array $config): ?self
    {
        if (empty($config)) {
            return null;
        }

        return new self([
            'sizes' => $config['sizes'] ?? [],
            'max_reference_images' => $config['max_reference_images'] ?? 0,
            'default_scale' => $config['default_scale'] ?? '',
            'image_settings' => $config['image_settings'] ?? [],
        ]);
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

    public function getDefaultScale(): string
    {
        return $this->defaultScale;
    }

    public function setDefaultScale(string $defaultScale): void
    {
        $this->defaultScale = $defaultScale;
    }

    /**
     * @return array<array<string, mixed>>
     */
    public function getImageSettings(): array
    {
        return $this->imageSettings;
    }

    /**
     * @param array<array<string, mixed>> $imageSettings
     */
    public function setImageSettings(array $imageSettings): void
    {
        $this->imageSettings = $imageSettings;
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
            'default_scale' => $this->defaultScale,
            'image_settings' => $this->imageSettings,
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
