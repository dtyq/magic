<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;
use DateTime;

/**
 * 图片生成DTO.
 */
class ImageGenerationDTO extends AbstractDTO
{
    use StringIdDTOTrait;

    protected ?string $projectId = null;

    protected ?string $imageId = null;

    protected ?string $modelId = null;

    protected ?string $prompt = null;

    protected ?string $size = null;

    protected ?string $resolution = null;

    protected ?string $fileDir = null;

    protected ?string $fileName = null;

    protected ?array $referenceImages = null;

    /**
     * 参考图选项，key 为图片路径，value 为该图对应的处理选项，例如 crop 参数.
     * 仅在图生图（generate-image）场景由前端直传；其余接口由后端从顶层 crop 字段组装.
     */
    protected ?array $referenceImageOptions = null;

    protected ?int $type = null;

    protected ?string $status = null;

    protected ?string $errorMessage = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected ?string $fileUrl = null;

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getProjectId(): ?string
    {
        return $this->projectId;
    }

    public function setProjectId(null|int|string $projectId): void
    {
        if (is_int($projectId)) {
            $projectId = (string) $projectId;
        }
        $this->projectId = $projectId;
    }

    public function getImageId(): ?string
    {
        return $this->imageId;
    }

    public function setImageId(?string $imageId): void
    {
        $this->imageId = $imageId;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function setModelId(?string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getPrompt(): ?string
    {
        return $this->prompt;
    }

    public function setPrompt(?string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getSize(): ?string
    {
        return $this->size;
    }

    public function setSize(?string $size): void
    {
        $this->size = $size;
    }

    public function getResolution(): ?string
    {
        return $this->resolution;
    }

    public function setResolution(?string $resolution): void
    {
        $this->resolution = $resolution;
    }

    public function getFileDir(): ?string
    {
        return $this->fileDir;
    }

    public function setFileDir(?string $fileDir): void
    {
        $this->fileDir = $fileDir;
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function setFileName(?string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function getReferenceImages(): ?array
    {
        return $this->referenceImages;
    }

    public function setReferenceImages(?array $referenceImages): void
    {
        $this->referenceImages = $referenceImages;
    }

    public function getReferenceImageOptions(): ?array
    {
        return $this->referenceImageOptions;
    }

    public function setReferenceImageOptions(?array $referenceImageOptions): void
    {
        $this->referenceImageOptions = $referenceImageOptions;
    }

    public function getType(): ?int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(?string $status): void
    {
        $this->status = $status;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }
}
