<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity;

use App\Domain\Design\Entity\ValueObject\ImageGenerationStatus;
use App\Domain\Design\Entity\ValueObject\ImageGenerationType;
use App\Domain\Design\Factory\PathFactory;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

/**
 * 图片生成任务实体.
 */
class ImageGenerationEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected string $userId;

    protected int $projectId;

    protected string $imageId;

    protected string $modelId;

    protected ?string $prompt = null;

    protected ?string $size = null;

    protected ?string $resolution = null;

    protected string $fileDir;

    protected string $fileName = ''; // 含扩展名，如: image.png

    protected ?array $referenceImages = null;

    /**
     * 每张参考图的图片处理选项，key 为参考图索引（从 0 开始）.
     * 目前用于去背景场景传入 crop 参数，例如：[0 => ['crop' => ['width' => 596, 'height' => 1024, 'x' => 194, 'y' => 0]]].
     * 该字段不持久化到数据库，仅在事件流转期间使用.
     */
    protected ?array $referenceImageOptions = null;

    protected ImageGenerationType $type;

    protected ImageGenerationStatus $status;

    protected ?string $errorMessage = null;

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    private ?int $fileDirId = null;

    private ?string $fileUrl = null;

    public function getFileDirId(): int
    {
        return $this->fileDirId ?? 0;
    }

    public function setFileDirId(?int $fileDirId): void
    {
        $this->fileDirId = $fileDirId;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_string($id)) {
            $id = (int) $id;
        }
        $this->id = $id;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getImageId(): string
    {
        return $this->imageId;
    }

    public function setImageId(string $imageId): void
    {
        $this->imageId = $imageId;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
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

    public function getFileDir(): string
    {
        return $this->fileDir;
    }

    public function setFileDir(string $fileDir): void
    {
        $this->fileDir = $fileDir;
    }

    public function getFileName(): string
    {
        return $this->fileName;
    }

    public function setFileName(string $fileName): void
    {
        $this->fileName = $fileName;
    }

    /**
     * 获取完整的文件目录路径（带前缀）.
     * 用于文件操作和获取链接.
     *
     * @param string $filePrefix 组织前缀，如: /org
     * @return string 完整目录路径，如: /org/project_123/workspace/some/dir
     */
    public function getFullFileDir(string $filePrefix): string
    {
        return PathFactory::buildFullDirPath($filePrefix, $this->projectId, $this->fileDir);
    }

    /**
     * 获取完整文件路径（带前缀）.
     * 生成完成后返回完整路径，如: /org/project_123/workspace/some/dir/image.png.
     *
     * @param string $filePrefix 组织前缀，如: /org
     * @return string 完整文件路径
     */
    public function getFullFilePath(string $filePrefix): string
    {
        return PathFactory::buildFullFilePath($filePrefix, $this->projectId, $this->fileDir, $this->fileName);
    }

    /**
     * 获取相对文件路径（不带前缀）.
     * 仅用于显示，如: /some/dir/image.png 或 /image.png.
     *
     * @return string 相对文件路径
     */
    public function getFilePath(): string
    {
        if ($this->fileName === '') {
            return $this->fileDir;
        }
        return rtrim($this->fileDir, '/') . '/' . $this->fileName;
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

    public function getType(): ImageGenerationType
    {
        return $this->type;
    }

    public function setType(ImageGenerationType|int $type): void
    {
        if (is_int($type)) {
            $type = ImageGenerationType::make($type);
        }
        $this->type = $type;
    }

    public function getStatus(): ImageGenerationStatus
    {
        return $this->status;
    }

    public function setStatus(ImageGenerationStatus $status): void
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

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    /**
     * 判断是否为图生图模式.
     */
    public function isImageToImage(): bool
    {
        return ! empty($this->referenceImages);
    }

    /**
     * 获取参考图数量.
     */
    public function getReferenceImageCount(): int
    {
        return $this->referenceImages ? count($this->referenceImages) : 0;
    }

    /**
     * 获取文件扩展名（不含点号）.
     * 如: image.png 返回 png.
     */
    public function getFileExtension(): ?string
    {
        $parts = explode('.', $this->fileName);
        if (count($parts) < 2) {
            return null;
        }
        return strtolower(end($parts));
    }

    public function prepareForCreate(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->userId)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => 'user_id']);
        }
        if (empty($this->projectId)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => 'project_id']);
        }
        if (empty($this->imageId)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => 'image_id']);
        }
        if (empty($this->modelId)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => 'model_id']);
        }
        if (empty($this->fileDir)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => 'file_dir']);
        }
        $this->fileName = '';

        $this->createdAt = new DateTime();
        $this->updatedAt = new DateTime();
        $this->status = ImageGenerationStatus::PENDING;
        $this->id = null;
    }

    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }
}
