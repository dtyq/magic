<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\DocumentFile;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\DocumentFileType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

abstract class AbstractDocumentFileDTO extends AbstractDTO implements DocumentFileDTOInterface
{
    public string $name;

    protected DocumentFileType $type;

    public function __construct(array $data)
    {
        parent::__construct($data);
        $this->type = $this->initType();
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public static function fromArray(array $data): DocumentFileDTOInterface
    {
        if (isset($data['third_id']) && ! isset($data['third_file_id'])) {
            $data['third_file_id'] = (string) $data['third_id'];
        }
        if (isset($data['source_type']) && ! isset($data['platform_type'])) {
            $data['platform_type'] = (string) $data['source_type'];
        }
        if (isset($data['file_link']) && is_array($data['file_link']) && ! isset($data['url'])) {
            $data['url'] = (string) ($data['file_link']['url'] ?? '');
        }
        if (($data['key'] ?? '') === '' && isset($data['url'])) {
            $data['key'] = (string) $data['url'];
        }

        $documentFileType = isset($data['type']) ? DocumentFileType::tryFrom($data['type']) : DocumentFileType::EXTERNAL;
        return match ($documentFileType) {
            DocumentFileType::EXTERNAL => new ExternalDocumentFileDTO($data),
            DocumentFileType::THIRD_PLATFORM => new ThirdPlatformDocumentFileDTO($data),
            default => ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed),
        };
    }

    public function getType(): DocumentFileType
    {
        return $this->type;
    }

    public function setType(null|DocumentFileType|int $type): static
    {
        is_int($type) && $type = DocumentFileType::tryFrom($type);
        $this->type = $type;
        return $this;
    }

    /**
     * 初始化文档类型.
     */
    abstract protected function initType(): DocumentFileType;
}
