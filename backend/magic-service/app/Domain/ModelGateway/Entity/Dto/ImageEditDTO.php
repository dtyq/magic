<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\ErrorCode\ImageGenerateErrorCode;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;

class ImageEditDTO extends AbstractRequestDTO
{
    protected string $prompt = '';

    protected array $images = [];

    protected string $size = '1024x1024';

    public function __construct(array $requestData = [])
    {
        parent::__construct($requestData);

        // Extract data from request
        if (isset($requestData['prompt'])) {
            $this->prompt = (string) $requestData['prompt'];
        }
        if (isset($requestData['model'])) {
            $this->model = (string) $requestData['model'];
        }
        if (isset($requestData['images']) && is_array($requestData['images'])) {
            $this->images = $requestData['images'];
        }
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getImages(): array
    {
        return $this->images;
    }

    public function setImages(array $images): void
    {
        $this->images = $images;
    }

    public function getType(): string
    {
        return 'image_edit';
    }

    public function valid(): void
    {
        // Validate model is provided
        if ($this->model === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'model_field']);
        }

        // Validate model is supported for image editing
        $this->validateSupportedImageEditModel();

        // Validate prompt is provided
        if ($this->prompt === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'prompt_field']);
        }

        // Check if images array exists and is not empty
        if (empty($this->images)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'images_field']);
        }
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }

    /**
     * Validate that the model supports image editing functionality.
     */
    private function validateSupportedImageEditModel(): void
    {
        $supportedModels = array_merge(
            ImageGenerateModelType::getVolcengineModes(),
            ImageGenerateModelType::getAzureOpenAIEditModes(),
            ImageGenerateModelType::getQwenImageEditModes(),
            ImageGenerateModelType::getGoogleGeminiModes(),
            ImageGenerateModelType::getVolcengineArkModes()
        );

        if (! in_array($this->model, $supportedModels)) {
            ExceptionBuilder::throw(
                ImageGenerateErrorCode::MODEL_NOT_SUPPORT_EDIT
            );
        }
    }
}
