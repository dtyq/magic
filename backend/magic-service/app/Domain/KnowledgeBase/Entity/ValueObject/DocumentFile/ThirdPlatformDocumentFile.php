<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocType;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;

class ThirdPlatformDocumentFile extends AbstractDocumentFile implements ThirdPlatformDocumentFileInterface
{
    public string $thirdFileId;

    public string $platformType;

    // 第三方文件类型，自定义字段，由第三方平台设置
    public ?string $thirdFileType = null;

    // 第三方文件扩展名，自定义字段，由第三方平台设置
    public ?string $thirdFileExtensionName = null;

    public function getThirdFileId(): string
    {
        return $this->thirdFileId;
    }

    public function setThirdFileId(string $thirdFileId): static
    {
        $this->thirdFileId = $thirdFileId;
        return $this;
    }

    public function getPlatformType(): string
    {
        return $this->platformType;
    }

    public function setPlatformType(string $platformType): static
    {
        $this->platformType = $platformType;
        return $this;
    }

    public function getDocType(): int
    {
        return $this->docType ?? DocType::TXT->value;
    }

    public function getThirdFileType(): ?string
    {
        return $this->thirdFileType;
    }

    public function setThirdFileType(?string $thirdFileType): static
    {
        $this->thirdFileType = $thirdFileType;
        return $this;
    }

    public function getThirdFileExtensionName(): ?string
    {
        return $this->thirdFileExtensionName;
    }

    public function setThirdFileExtensionName(?string $thirdFileExtensionName): static
    {
        $this->thirdFileExtensionName = $thirdFileExtensionName;
        return $this;
    }

    protected function initType(): DocumentFileType
    {
        return DocumentFileType::THIRD_PLATFORM;
    }
}
