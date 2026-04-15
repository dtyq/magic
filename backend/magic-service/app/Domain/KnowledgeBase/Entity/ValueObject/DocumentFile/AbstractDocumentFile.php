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
        if (isset($data['third_id']) && ! isset($data['third_file_id'])) {
            $data['third_file_id'] = (string) $data['third_id'];
        }
        if (isset($data['source_type']) && ! isset($data['platform_type'])) {
            $data['platform_type'] = (string) $data['source_type'];
        }
        if (isset($data['extension']) && ! isset($data['third_file_extension_name'])) {
            $data['third_file_extension_name'] = (string) $data['extension'];
        }
        if (isset($data['file_link']) && is_array($data['file_link']) && ! isset($data['url'])) {
            $data['url'] = (string) ($data['file_link']['url'] ?? '');
        }
        if (($data['key'] ?? '') === '' && isset($data['url'])) {
            $data['key'] = (string) $data['url'];
        }

        $typeRaw = $data['type'] ?? DocumentFileType::EXTERNAL->value;
        $documentFileType = match (true) {
            $typeRaw instanceof DocumentFileType => $typeRaw,
            is_int($typeRaw), is_numeric($typeRaw) => DocumentFileType::tryFrom((int) $typeRaw),
            is_string($typeRaw) => match (strtolower($typeRaw)) {
                'external' => DocumentFileType::EXTERNAL,
                'third_platform', 'third-platform', 'thirdplatform', 'third' => DocumentFileType::THIRD_PLATFORM,
                default => null,
            },
            default => null,
        };
        $documentFileType ??= DocumentFileType::EXTERNAL;
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
