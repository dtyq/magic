<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Design\DTO;

use App\Infrastructure\Core\AbstractDTO;
use DateTime;

class VideoGenerationDTO extends AbstractDTO
{
    protected ?string $projectId = null;

    protected ?string $videoId = null;

    protected ?string $modelId = null;

    protected ?string $prompt = null;

    protected ?string $fileDir = null;

    protected ?string $fileName = null;

    protected ?int $type = null;

    protected ?string $status = null;

    protected ?string $errorMessage = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    protected ?string $fileId = null;

    protected ?string $fileUrl = null;

    protected ?string $posterFileId = null;

    protected ?string $posterUrl = null;

    public function setProjectId(null|int|string $projectId): void
    {
        if (is_int($projectId)) {
            $projectId = (string) $projectId;
        }
        $this->projectId = $projectId;
    }

    public function getProjectId(): ?string
    {
        return $this->projectId;
    }

    public function getVideoId(): ?string
    {
        return $this->videoId;
    }

    public function setVideoId(?string $videoId): void
    {
        $this->videoId = $videoId;
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

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getFileId(): ?string
    {
        return $this->fileId;
    }

    public function setFileId(null|int|string $fileId): void
    {
        if (is_int($fileId)) {
            $fileId = (string) $fileId;
        }
        $this->fileId = $fileId;
    }

    public function getPosterUrl(): ?string
    {
        return $this->posterUrl;
    }

    public function setPosterUrl(?string $posterUrl): void
    {
        $this->posterUrl = $posterUrl;
    }

    public function getPosterFileId(): ?string
    {
        return $this->posterFileId;
    }

    public function setPosterFileId(null|int|string $posterFileId): void
    {
        if (is_int($posterFileId)) {
            $posterFileId = (string) $posterFileId;
        }
        $this->posterFileId = $posterFileId;
    }
}
