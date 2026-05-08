<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI;

use App\Infrastructure\Core\AbstractValueObject;

use function Hyperf\Translation\__;

/**
 * 图片模型配置值对象。
 */
class ImageModelConfig extends AbstractValueObject
{
    /**
     * @var array<int, array<string, mixed>>
     */
    protected array $sizes = [];

    protected int $maxReferenceImages = 0;

    protected string $defaultScale = '';

    /**
     * @var array<int, array<string, mixed>>
     */
    protected array $imageSettings = [];

    /**
     * 通过模型标识匹配图片配置。
     */
    public static function fromModel(string $modelVersion, ?string $modelId): ?self
    {
        return self::fromConfig(SizeManager::matchConfig($modelVersion, $modelId));
    }

    /**
     * 通过原始配置数组构建图片配置。
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

    public function toArray(): array
    {
        return [
            'sizes' => $this->sizes,
            'max_reference_images' => $this->maxReferenceImages,
            'default_scale' => $this->defaultScale,
            'image_settings' => $this->localizeImageSettings($this->imageSettings),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $settings
     * @return array<int, array<string, mixed>>
     */
    private function localizeImageSettings(array $settings): array
    {
        return array_map(function (array $setting): array {
            $setting = $this->resolveI18nField($setting, 'label');
            $setting = $this->resolveI18nField($setting, 'description');

            $options = $setting['options'] ?? [];
            if (is_array($options)) {
                $setting['options'] = array_map(function (array $option): array {
                    return $this->resolveI18nField($option, 'label');
                }, $options);
            }

            return $setting;
        }, $settings);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function resolveI18nField(array $payload, string $field): array
    {
        $value = $payload[$field] ?? null;
        if (! is_string($value) || ! str_starts_with($value, 'i18n:')) {
            return $payload;
        }

        $payload[$field] = __(substr($value, 5));
        return $payload;
    }
}
