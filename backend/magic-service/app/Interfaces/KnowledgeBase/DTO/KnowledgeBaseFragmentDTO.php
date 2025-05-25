<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class KnowledgeBaseFragmentDTO extends AbstractFlowDTO
{
    public string $knowledgeCode;

    public string $knowledgeBaseCode;

    public string $documentCode;

    public string $documentName;

    public int $documentType;

    public string $content;

    public array $metadata = [];

    public string $businessId = '';

    public int $syncStatus;

    public string $syncStatusMessage = '';

    public float $score;

    public int $wordCount;

    public int $version;

    public function getKnowledgeCode(): string
    {
        return $this->knowledgeCode;
    }

    public function setKnowledgeCode(?string $knowledgeCode): static
    {
        $this->knowledgeCode = $knowledgeCode ?? '';
        return $this;
    }

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): KnowledgeBaseFragmentDTO
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(?string $content): static
    {
        $this->content = $content ?? '';
        return $this;
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    public function setMetadata(?array $metadata): static
    {
        $this->metadata = $metadata ?? [];
        return $this;
    }

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function setBusinessId(?string $businessId): static
    {
        $this->businessId = $businessId ?? '';
        return $this;
    }

    public function getSyncStatus(): int
    {
        return $this->syncStatus;
    }

    public function setSyncStatus(null|int|KnowledgeSyncStatus $syncStatus): static
    {
        $syncStatus instanceof KnowledgeSyncStatus && $syncStatus = $syncStatus->value;
        $this->syncStatus = $syncStatus ?? 0;
        return $this;
    }

    public function getSyncStatusMessage(): string
    {
        return $this->syncStatusMessage;
    }

    public function setSyncStatusMessage(?string $syncStatusMessage): static
    {
        $this->syncStatusMessage = $syncStatusMessage ?? '';
        return $this;
    }

    public function getScore(): float
    {
        return $this->score;
    }

    public function setScore(?float $score): static
    {
        $this->score = $score ?? 0.0;
        return $this;
    }

    public function getDocumentCode(): string
    {
        return $this->documentCode;
    }

    public function setDocumentCode(string $documentCode): KnowledgeBaseFragmentDTO
    {
        $this->documentCode = $documentCode;
        return $this;
    }

    public function getWordCount(): int
    {
        return $this->wordCount;
    }

    public function setWordCount(int $wordCount): static
    {
        $this->wordCount = $wordCount;
        return $this;
    }

    public function getDocumentName(): string
    {
        return $this->documentName;
    }

    public function setDocumentName(string $documentName): static
    {
        $this->documentName = $documentName;
        return $this;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $version): static
    {
        $this->version = $version;
        return $this;
    }

    public function getDocumentType(): int
    {
        return $this->documentType;
    }

    public function setDocumentType(int $documentType): static
    {
        $this->documentType = $documentType;
        return $this;
    }
}
