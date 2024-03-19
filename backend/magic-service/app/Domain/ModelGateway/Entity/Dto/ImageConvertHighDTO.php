<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class ImageConvertHighDTO extends AbstractRequestDTO
{
    protected array $images = [];

    protected ?string $size = null;

    protected ?string $prompt = null;

    public function __construct(array $requestData = [])
    {
        parent::__construct($requestData);

        // Extract data from request
        if (isset($requestData['images'])) {
            $images = $requestData['images'];
            if (is_string($images)) {
                // 兼容单个字符串格式
                $this->images = [$images];
            } elseif (is_array($images)) {
                $this->images = $images;
            }
        } elseif (isset($requestData['image_url'])) {
            // 兼容旧的 image_url 参数
            $this->images = [(string) $requestData['image_url']];
        }

        // Extract size and prompt from request
        if (isset($requestData['size'])) {
            $this->size = (string) $requestData['size'];
        }

        if (isset($requestData['prompt'])) {
            $this->prompt = (string) $requestData['prompt'];
        }
    }

    public function getImages(): array
    {
        return $this->images;
    }

    public function setImages(array $images): void
    {
        $this->images = $images;
    }

    /**
     * 获取第一张图片URL（兼容旧代码）.
     */
    public function getImageUrl(): string
    {
        return $this->images[0] ?? '';
    }

    public function getSize(): ?string
    {
        return $this->size;
    }

    public function setSize(?string $size): void
    {
        $this->size = $size;
    }

    public function getPrompt(): ?string
    {
        return $this->prompt;
    }

    public function setPrompt(?string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getType(): string
    {
        return 'image_convert_high';
    }

    public function valid(): void
    {
        // Validate images is provided
        if (empty($this->images)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'images_field']);
        }

        // Validate image count: only 1 image is allowed for convert high definition
        if (count($this->images) > 1) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'image_generate.too_many_images_limit_1');
        }

        // Validate each image URL is valid
        foreach ($this->images as $imageUrl) {
            if (! is_string($imageUrl) || empty($imageUrl)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.invalid_format', ['label' => 'images_field']);
            }
            if (! filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.invalid_format', ['label' => 'images_field']);
            }
        }
    }
}
