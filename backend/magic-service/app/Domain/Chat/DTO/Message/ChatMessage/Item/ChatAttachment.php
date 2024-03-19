<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item;

use App\Domain\Chat\Entity\AbstractEntity;
use App\Domain\Chat\Entity\ValueObject\FileType;

/**
 * 附件不是一种消息类型，而是消息的一部分.
 */
class ChatAttachment extends AbstractEntity
{
    /**
     * 聊天文件需要先上传到 chat 文件服务器，然后才能发送消息.
     * 这个 id 是 magic_chat_file 表的主键.
     */
    protected string $fileId = '';

    protected FileType $fileType = FileType::File;

    protected string $fileExtension = '';

    protected int $fileSize = 0;

    protected string $fileName = '';

    protected string $fileUrl;

    public function __construct(array $attachment = [])
    {
        parent::__construct($attachment);
    }

    public function getFileId(): string
    {
        return $this->fileId;
    }

    public function setFileId(string $fileId): void
    {
        $this->fileId = $fileId;
    }

    public function getFileType(): FileType
    {
        return $this->fileType;
    }

    public function setFileType(null|FileType|int $fileType): void
    {
        if ($fileType === null) {
            $this->fileType = FileType::File;
            return;
        }
        if (is_int($fileType)) {
            $this->fileType = FileType::from($fileType);
            return;
        }
        $this->fileType = $fileType;
    }

    public function getFileExtension(): string
    {
        return $this->fileExtension;
    }

    public function setFileExtension(string $fileExtension): void
    {
        $this->fileExtension = $fileExtension;
    }

    public function getFileSize(): int
    {
        return $this->fileSize;
    }

    public function setFileSize(int $fileSize): void
    {
        $this->fileSize = $fileSize;
    }

    public function getFileName(): string
    {
        return $this->fileName;
    }

    public function setFileName(string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function setFileUrl(string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getFileUrl(): string
    {
        return empty($this->fileUrl) ? '' : $this->fileUrl;
    }
}
