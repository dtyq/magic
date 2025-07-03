<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

/**
 * Project file data class.
 */
class ProjectFileData extends MentionData
{
    /**
     * File ID.
     */
    protected ?string $fileId;

    /**
     * File name.
     */
    protected ?string $fileName;

    /**
     * File extension.
     */
    protected ?string $fileExtension;

    /**
     * File size.
     */
    protected ?int $fileSize;

    public function getDataType(): string
    {
        return MentionType::PROJECT_FILE->value;
    }

    public function getFileId(): string
    {
        return $this->fileId ?? '';
    }

    public function setFileId(string $fileId): void
    {
        $this->fileId = $fileId;
    }

    public function getFileName(): string
    {
        return $this->fileName ?? '';
    }

    public function setFileName(string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function getFileExtension(): string
    {
        return $this->fileExtension ?? '';
    }

    public function setFileExtension(string $fileExtension): void
    {
        $this->fileExtension = $fileExtension;
    }

    public function getFileSize(): int
    {
        return $this->fileSize ?? 0;
    }

    public function setFileSize(int $fileSize): void
    {
        $this->fileSize = $fileSize;
    }
}
