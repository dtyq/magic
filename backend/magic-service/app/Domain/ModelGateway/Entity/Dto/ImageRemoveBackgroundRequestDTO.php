<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

use function Hyperf\Translation\__;

class ImageRemoveBackgroundRequestDTO extends AbstractRequestDTO
{
    protected array $images = [];

    protected ?string $outputFormat = null;

    /**
     * 显式水印默认开启，仅允许服务内部按场景关闭，不从外部 API 请求体读取。
     */
    protected bool $enableVisibleWatermark = true;

    public function __construct(array $requestData = [])
    {
        parent::__construct($requestData);

        $images = $requestData['images'] ?? [];
        if (isset($requestData['images'])) {
            $this->images = $images;
        }

        $outputFormat = $requestData['output_format'] ?? $requestData['outputFormat'] ?? null;
        if (is_string($outputFormat) && $outputFormat !== '') {
            $this->outputFormat = strtolower(trim($outputFormat));
        }
    }

    public function getImages(): array
    {
        return $this->images;
    }

    public function setImages(array $images): void
    {
        $this->images = array_values(array_filter(array_map(
            static fn ($image) => is_string($image) ? trim($image) : '',
            $images
        )));
    }

    /**
     * 获取首张图片 URL，兼容当前单图去背景实现。
     */
    public function getImageUrl(): string
    {
        return $this->images[0] ?? '';
    }

    public function getOutputFormat(): ?string
    {
        return $this->outputFormat;
    }

    public function setOutputFormat(?string $outputFormat): void
    {
        $this->outputFormat = $outputFormat ? strtolower(trim($outputFormat)) : null;
    }

    public function isEnableVisibleWatermark(): bool
    {
        return $this->enableVisibleWatermark;
    }

    public function setEnableVisibleWatermark(bool $enableVisibleWatermark): void
    {
        $this->enableVisibleWatermark = $enableVisibleWatermark;
    }

    public function getType(): string
    {
        return 'image_remove_background';
    }

    public function valid(): void
    {
        if ($this->images === []) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, __('image_generate.remove_background_image_required'));
        }

        if (count($this->images) > 1) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, __('image_generate.too_many_images_limit_1'));
        }

        foreach ($this->images as $imageUrl) {
            if (! filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, __('image_generate.remove_background_invalid_image_url'));
            }
        }
    }
}
