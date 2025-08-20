<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\NormalizePathTrait;
use App\Infrastructure\Core\AbstractDTO;

final class FileData extends AbstractDTO implements MentionDataInterface
{
    use NormalizePathTrait;

    protected string $fileId;

    protected string $fileKey;

    protected string $filePath;

    protected string $fileName;

    protected string $fileExtension;

    protected int $fileSize;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /* Getters */
    public function getFileId(): ?string
    {
        return $this->fileId ?? null;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey ?? null;
    }

    public function getFilePath(): ?string
    {
        $filePath = $this->filePath ?? null;

        if ($filePath === null) {
            return null;
        }

        return $this->normalizePath($filePath);
    }

    public function getFileName(): ?string
    {
        return $this->fileName ?? null;
    }

    public function getFileExtension(): ?string
    {
        return $this->fileExtension ?? null;
    }

    public function getFileSize(): ?int
    {
        return $this->fileSize ?? null;
    }

    /* Setters */
    public function setFileId(string $fileId): void
    {
        $this->fileId = $fileId;
    }

    public function setFileKey(string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    public function setFilePath(string $filePath): void
    {
        $this->filePath = $filePath;
    }

    public function setFileName(string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function setFileExtension(string $fileExtension): void
    {
        $this->fileExtension = $fileExtension;
    }

    public function setFileSize(int $fileSize): void
    {
        $this->fileSize = $fileSize;
    }
}
