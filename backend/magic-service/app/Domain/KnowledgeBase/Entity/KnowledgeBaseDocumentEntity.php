<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\AbstractDocumentFile;
use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces\DocumentFileInterface;
use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreDriver;
use App\Infrastructure\Core\Embeddings\VectorStores\VectorStoreInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 知识库文档实体.
 */
class KnowledgeBaseDocumentEntity extends AbstractKnowledgeBaseEntity
{
    protected ?int $id = null;

    protected string $knowledgeBaseCode = '';

    protected string $name;

    protected string $description = '';

    protected string $code = '';

    protected int $version = 1;

    protected bool $enabled = true;

    protected int $docType;

    protected array $docMetadata = [];

    protected ?DocumentFileInterface $documentFile = null;

    protected ?string $thirdPlatformType = null;

    protected ?string $thirdFileId = null;

    protected int $syncStatus = 0;

    protected int $syncTimes = 0;

    protected string $syncStatusMessage = '';

    protected string $embeddingModel;

    protected string $vectorDb;

    protected ?RetrieveConfig $retrieveConfig = null;

    protected ?FragmentConfig $fragmentConfig = null;

    protected ?array $embeddingConfig = null;

    protected ?array $vectorDbConfig = null;

    protected string $createdUid;

    protected string $updatedUid;

    protected string $createdAt;

    protected string $updatedAt;

    protected ?string $deletedAt = null;

    protected int $wordCount = 0;

    protected string $organizationCode;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getKnowledgeBaseCode(): string
    {
        return $this->knowledgeBaseCode;
    }

    public function setKnowledgeBaseCode(string $knowledgeBaseCode): self
    {
        $this->knowledgeBaseCode = $knowledgeBaseCode;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): self
    {
        $this->code = $code;
        return $this;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $version): self
    {
        $this->version = $version;
        return $this;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): self
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function getDocType(): int
    {
        return $this->docType;
    }

    public function setDocType(int $docType): self
    {
        $this->docType = $docType;
        return $this;
    }

    public function getDocMetadata(): array
    {
        return $this->docMetadata;
    }

    public function setDocMetadata(array $docMetadata): self
    {
        $this->docMetadata = $docMetadata;
        return $this;
    }

    public function getSyncStatus(): int
    {
        return $this->syncStatus;
    }

    public function setSyncStatus(int $syncStatus): self
    {
        $this->syncStatus = $syncStatus;
        return $this;
    }

    public function getSyncTimes(): int
    {
        return $this->syncTimes;
    }

    public function setSyncTimes(int $syncTimes): self
    {
        $this->syncTimes = $syncTimes;
        return $this;
    }

    public function getSyncStatusMessage(): string
    {
        return $this->syncStatusMessage;
    }

    public function setSyncStatusMessage(string $syncStatusMessage): self
    {
        $this->syncStatusMessage = $syncStatusMessage;
        return $this;
    }

    public function getEmbeddingModel(): string
    {
        return $this->embeddingModel;
    }

    public function setEmbeddingModel(string $embeddingModel): self
    {
        $this->embeddingModel = $embeddingModel;
        return $this;
    }

    public function getVectorDb(): string
    {
        return $this->vectorDb;
    }

    public function setVectorDb(string $vectorDb): self
    {
        $this->vectorDb = $vectorDb;
        return $this;
    }

    public function getRetrieveConfig(): ?RetrieveConfig
    {
        return $this->retrieveConfig;
    }

    public function setRetrieveConfig(null|array|RetrieveConfig $retrieveConfig): self
    {
        is_array($retrieveConfig) && $retrieveConfig = RetrieveConfig::fromArray($retrieveConfig);
        $this->retrieveConfig = $retrieveConfig;
        return $this;
    }

    public function getFragmentConfig(): FragmentConfig
    {
        return $this->fragmentConfig ?? $this->getDefaultFragmentConfig();
    }

    public function setFragmentConfig(null|array|FragmentConfig $fragmentConfig): self
    {
        // 默认配置
        empty($fragmentConfig) && $fragmentConfig = $this->getDefaultFragmentConfig();
        is_array($fragmentConfig) && $fragmentConfig = FragmentConfig::fromArray($fragmentConfig);
        $this->fragmentConfig = $fragmentConfig;
        return $this;
    }

    public function getEmbeddingConfig(): ?array
    {
        return $this->embeddingConfig;
    }

    public function setEmbeddingConfig(?array $embeddingConfig): self
    {
        $this->embeddingConfig = $embeddingConfig;
        return $this;
    }

    public function getVectorDbConfig(): ?array
    {
        return $this->vectorDbConfig;
    }

    public function setVectorDbConfig(?array $vectorDbConfig): self
    {
        $this->vectorDbConfig = $vectorDbConfig;
        return $this;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): self
    {
        $this->createdUid = $createdUid;
        return $this;
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(string $updatedUid): self
    {
        $this->updatedUid = $updatedUid;
        return $this;
    }

    public function issetCreatedAt(): bool
    {
        return isset($this->createdAt);
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?string $deletedAt): self
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }

    public function getWordCount(): int
    {
        return $this->wordCount;
    }

    public function setWordCount(int $wordCount): self
    {
        $this->wordCount = $wordCount;
        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): KnowledgeBaseDocumentEntity
    {
        $this->description = $description;
        return $this;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): KnowledgeBaseDocumentEntity
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }

    public function getVectorDBDriver(): VectorStoreInterface
    {
        $driver = VectorStoreDriver::tryFrom($this->vectorDb);
        if ($driver === null) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, "向量数据库 [{$this->vectorDb}] 不存在");
        }
        return $driver->get();
    }

    public function getDocumentFile(): ?DocumentFileInterface
    {
        return $this->documentFile;
    }

    public function setDocumentFile(null|array|DocumentFileInterface $documentFile): self
    {
        is_array($documentFile) && $documentFile = AbstractDocumentFile::fromArray($documentFile);
        $this->documentFile = $documentFile;
        return $this;
    }

    public function getThirdPlatformType(): ?string
    {
        return $this->thirdPlatformType;
    }

    public function setThirdPlatformType(?string $thirdPlatformType): self
    {
        $this->thirdPlatformType = $thirdPlatformType;
        return $this;
    }

    public function getThirdFileId(): ?string
    {
        return $this->thirdFileId;
    }

    public function setThirdFileId(?string $thirdFileId): self
    {
        $this->thirdFileId = $thirdFileId;
        return $this;
    }
}
