<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\KnowledgeBase\DTO\DocumentFile\DocumentFileDTOInterface;

class KnowledgeBaseDocumentDTO extends AbstractDTO
{
    public ?int $id = null;

    public string $knowledgeBaseCode;

    public string $name;

    public string $description;

    public string $code;

    public int $version = 1;

    public bool $enabled = true;

    public int $docType;

    public array $docMetadata = [];

    public int $syncStatus = 0;

    public int $syncTimes = 0;

    public string $syncStatusMessage = '';

    public string $embeddingModel = '';

    public string $vectorDb = '';

    public ?array $retrieveConfig = [];

    public ?array $fragmentConfig = [];

    public ?array $embeddingConfig = [];

    public ?array $vectorDbConfig = [];

    public string $createdUid = '';

    public string $updatedUid = '';

    public array $creatorInfo = [];

    public array $modifierInfo = [];

    public int $wordCount = 0;

    public ?string $createdAt = null;

    public ?string $updatedAt = null;

    public ?string $deletedAt = null;

    public string $organizationCode;

    public ?DocumentFileDTOInterface $documentFile = null;

    public ?string $thirdPlatformType = null;

    public ?string $thirdFileId = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): KnowledgeBaseDocumentDTO
    {
        $this->id = $id;
        return $this;
    }

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): KnowledgeBaseDocumentDTO
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): KnowledgeBaseDocumentDTO
    {
        $this->name = $name;
        return $this;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): KnowledgeBaseDocumentDTO
    {
        $this->code = $code;
        return $this;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $version): KnowledgeBaseDocumentDTO
    {
        $this->version = $version;
        return $this;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): KnowledgeBaseDocumentDTO
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function getDocType(): int
    {
        return $this->docType;
    }

    public function setDocType(int $docType): KnowledgeBaseDocumentDTO
    {
        $this->docType = $docType;
        return $this;
    }

    public function getDocMetadata(): array
    {
        return $this->docMetadata;
    }

    public function setDocMetadata(array $docMetadata): KnowledgeBaseDocumentDTO
    {
        $this->docMetadata = $docMetadata;
        return $this;
    }

    public function getSyncStatus(): int
    {
        return $this->syncStatus;
    }

    public function setSyncStatus(int $syncStatus): KnowledgeBaseDocumentDTO
    {
        $this->syncStatus = $syncStatus;
        return $this;
    }

    public function getSyncTimes(): int
    {
        return $this->syncTimes;
    }

    public function setSyncTimes(int $syncTimes): KnowledgeBaseDocumentDTO
    {
        $this->syncTimes = $syncTimes;
        return $this;
    }

    public function getSyncStatusMessage(): string
    {
        return $this->syncStatusMessage;
    }

    public function setSyncStatusMessage(string $syncStatusMessage): KnowledgeBaseDocumentDTO
    {
        $this->syncStatusMessage = $syncStatusMessage;
        return $this;
    }

    public function getEmbeddingModel(): string
    {
        return $this->embeddingModel;
    }

    public function setEmbeddingModel(string $embeddingModel): KnowledgeBaseDocumentDTO
    {
        $this->embeddingModel = $embeddingModel;
        return $this;
    }

    public function getVectorDb(): string
    {
        return $this->vectorDb;
    }

    public function setVectorDb(string $vectorDb): KnowledgeBaseDocumentDTO
    {
        $this->vectorDb = $vectorDb;
        return $this;
    }

    public function getRetrieveConfig(): array
    {
        return $this->retrieveConfig;
    }

    public function setRetrieveConfig(?array $retrieveConfig): KnowledgeBaseDocumentDTO
    {
        $this->retrieveConfig = $retrieveConfig;
        return $this;
    }

    public function getFragmentConfig(): array
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(?array $fragmentConfig): KnowledgeBaseDocumentDTO
    {
        $this->fragmentConfig = $fragmentConfig;
        return $this;
    }

    public function getEmbeddingConfig(): array
    {
        return $this->embeddingConfig;
    }

    public function setEmbeddingConfig(?array $embeddingConfig): KnowledgeBaseDocumentDTO
    {
        $this->embeddingConfig = $embeddingConfig;
        return $this;
    }

    public function getVectorDbConfig(): array
    {
        return $this->vectorDbConfig;
    }

    public function setVectorDbConfig(?array $vectorDbConfig): KnowledgeBaseDocumentDTO
    {
        $this->vectorDbConfig = $vectorDbConfig;
        return $this;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): KnowledgeBaseDocumentDTO
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(string $updatedUid): KnowledgeBaseDocumentDTO
    {
        $this->updatedUid = $updatedUid;
        return $this;
    }

    public function getWordCount(): int
    {
        return $this->wordCount;
    }

    public function setWordCount(int $wordCount): KnowledgeBaseDocumentDTO
    {
        $this->wordCount = $wordCount;
        return $this;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): KnowledgeBaseDocumentDTO
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?string $updatedAt): KnowledgeBaseDocumentDTO
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): KnowledgeBaseDocumentDTO
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): KnowledgeBaseDocumentDTO
    {
        $this->description = $description;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): KnowledgeBaseDocumentDTO
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getCreatorInfo(): array
    {
        return $this->creatorInfo;
    }

    public function setCreatorInfo(array $creatorInfo): KnowledgeBaseDocumentDTO
    {
        $this->creatorInfo = $creatorInfo;
        return $this;
    }

    public function getModifierInfo(): array
    {
        return $this->modifierInfo;
    }

    public function setModifierInfo(array $modifierInfo): KnowledgeBaseDocumentDTO
    {
        $this->modifierInfo = $modifierInfo;
        return $this;
    }

    public function getDocumentFile(): ?DocumentFileDTOInterface
    {
        return $this->documentFile;
    }

    public function setDocumentFile(?DocumentFileDTOInterface $documentFile): static
    {
        $this->documentFile = $documentFile;
        return $this;
    }

    public function getThirdPlatformType(): ?string
    {
        return $this->thirdPlatformType;
    }

    public function setThirdPlatformType(?string $thirdPlatformType): static
    {
        $this->thirdPlatformType = $thirdPlatformType;
        return $this;
    }

    public function getThirdFileId(): ?string
    {
        return $this->thirdFileId;
    }

    public function setThirdFileId(?string $thirdFileId): static
    {
        $this->thirdFileId = $thirdFileId;
        return $this;
    }
}
