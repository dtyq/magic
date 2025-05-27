<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ExternalDocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\ThirdPlatformDocumentFileInterface;
use App\Infrastructure\Core\AbstractValueObject;

abstract class AbstractDocumentFile extends AbstractValueObject implements DocumentFileInterface
{
    public string $name = '未命名文档';

    public ?int $docType = null;

    protected DocumentFileType $type;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
        $this->type = $this->initType();
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function setType(mixed $type): static
    {
        return $this;
    }

    public function getType(): ?DocumentFileType
    {
        return $this->type;
    }

    public function getDocType(): ?int
    {
        return $this->docType;
    }

    public function setDocType(?int $docType): static
    {
        $this->docType = $docType;
        return $this;
    }

    public function getPlatformType(): ?string
    {
        return null;
    }

    public function getThirdFileId(): ?string
    {
        return null;
    }

    public static function fromArray(array $data): ?DocumentFileInterface
    {
        $documentFileType = isset($data['type']) ? DocumentFileType::tryFrom($data['type']) : DocumentFileType::EXTERNAL;
        $data['type'] = $documentFileType;
        return match ($documentFileType) {
            DocumentFileType::EXTERNAL => make(ExternalDocumentFileInterface::class, [$data]),
            DocumentFileType::THIRD_PLATFORM => make(ThirdPlatformDocumentFileInterface::class, [$data]),
            default => null,
        };
    }

    /**
     * 初始化文档类型.
     */
    abstract protected function initType(): DocumentFileType;
}
