<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO;

use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Domain\KnowledgeBase\Entity\ValueObject\RetrieveConfig;
use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class KnowledgeBaseDTO extends AbstractFlowDTO
{
    public string $code = '';

    public string $icon = '';

    public string $name = '';

    public string $description = '';

    public int $type = 0;

    public bool $enabled = false;

    public string $businessId = '';

    public int $syncStatus;

    public string $syncStatusMessage = '';

    public string $model = '';

    public string $vectorDB = '';

    public string $organizationCode;

    /**
     * 片段数量.
     */
    public int $fragmentCount = 0;

    /**
     * 预期的片段数量.
     */
    public int $expectedCount = 0;

    /**
     * 已完成的片段数量.
     */
    public int $completedCount = 0;

    public int $userOperation = 0;

    /**
     * 业务维护的期望总数.
     */
    public int $expectedNum = 0;

    /**
     * 业务维护的已完成的数量.
     */
    public int $completedNum = 0;

    public int $wordCount = 0;

    public int $documentCount = 0;

    public ?RetrieveConfig $retrieveConfig;

    public ?FragmentConfig $fragmentConfig;

    public ?array $embeddingConfig = [];

    public int $sourceType;

    public function getSourceType(): int
    {
        return $this->sourceType;
    }

    public function setSourceType(int $sourceType): static
    {
        $this->sourceType = $sourceType;
        return $this;
    }

    public function getRetrieveConfig(): ?RetrieveConfig
    {
        return $this->retrieveConfig;
    }

    public function setRetrieveConfig(null|array|RetrieveConfig $retrieveConfig): static
    {
        is_array($retrieveConfig) && $retrieveConfig = RetrieveConfig::fromArray($retrieveConfig);
        $this->retrieveConfig = $retrieveConfig;
        return $this;
    }

    public function getFragmentConfig(): ?FragmentConfig
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(null|array|FragmentConfig $fragmentConfig): static
    {
        is_array($fragmentConfig) && $fragmentConfig = FragmentConfig::fromArray($fragmentConfig);
        $this->fragmentConfig = $fragmentConfig;
        return $this;
    }

    public function getEmbeddingConfig(): ?array
    {
        return $this->embeddingConfig;
    }

    public function setEmbeddingConfig(?array $embeddingConfig): static
    {
        $this->embeddingConfig = $embeddingConfig;
        return $this;
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(?int $userOperation): void
    {
        $this->userOperation = $userOperation ?? 0;
    }

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function setBusinessId(?string $businessId): void
    {
        $this->businessId = $businessId ?? '';
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description ?? '';
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type ?? 0;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled ?? false;
    }

    public function getSyncStatus(): int
    {
        return $this->syncStatus;
    }

    public function setSyncStatus(?int $syncStatus): void
    {
        $this->syncStatus = $syncStatus ?? 0;
    }

    public function getSyncStatusMessage(): string
    {
        return $this->syncStatusMessage;
    }

    public function setSyncStatusMessage(?string $syncStatusMessage): void
    {
        $this->syncStatusMessage = $syncStatusMessage ?? '';
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(?string $model): void
    {
        $this->model = $model ?? '';
    }

    public function getVectorDB(): string
    {
        return $this->vectorDB;
    }

    public function setVectorDB(?string $vectorDB): void
    {
        $this->vectorDB = $vectorDB ?? '';
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode ?? '';
    }

    public function getFragmentCount(): int
    {
        return $this->fragmentCount;
    }

    public function setFragmentCount(?int $fragmentCount): void
    {
        $this->fragmentCount = $fragmentCount ?? 0;
    }

    public function getExpectedCount(): int
    {
        return $this->expectedCount;
    }

    public function setExpectedCount(?int $expectedCount): void
    {
        $this->expectedCount = $expectedCount ?? 0;
    }

    public function getCompletedCount(): int
    {
        return $this->completedCount;
    }

    public function setCompletedCount(?int $completedCount): void
    {
        $this->completedCount = $completedCount ?? 0;
    }

    public function getExpectedNum(): int
    {
        return $this->expectedNum;
    }

    public function setExpectedNum(?int $expectedNum): void
    {
        $this->expectedNum = $expectedNum ?? 0;
    }

    public function getCompletedNum(): int
    {
        return $this->completedNum;
    }

    public function setCompletedNum(?int $completedNum): void
    {
        $this->completedNum = $completedNum ?? 0;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): KnowledgeBaseDTO
    {
        $this->code = $code;
        return $this;
    }

    public function getWordCount(): int
    {
        return $this->wordCount;
    }

    public function setWordCount(int $wordCount): KnowledgeBaseDTO
    {
        $this->wordCount = $wordCount;
        return $this;
    }

    public function getDocumentCount(): int
    {
        return $this->documentCount;
    }

    public function setDocumentCount(int $documentCount): KnowledgeBaseDTO
    {
        $this->documentCount = $documentCount;
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): KnowledgeBaseDTO
    {
        $this->icon = $icon;
        return $this;
    }

    public static function fromEntity(KnowledgeBaseEntity $entity): KnowledgeBaseDTO
    {
        $dto = new KnowledgeBaseDTO();
        $dto->setId($entity->getId());
        $dto->setCode($entity->getCode());
        $dto->setName($entity->getName());
        $dto->setDescription($entity->getDescription());
        $dto->setType($entity->getType());
        $dto->setEnabled($entity->isEnabled());
        $dto->setBusinessId($entity->getBusinessId());
        $dto->setSyncStatus($entity->getSyncStatus()->value);
        $dto->setSyncStatusMessage($entity->getSyncStatusMessage());
        $dto->setModel($entity->getModel());
        $dto->setVectorDB($entity->getVectorDB());
        $dto->setOrganizationCode($entity->getOrganizationCode());
        $dto->setCreator($entity->getCreator());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setModifier($entity->getModifier());
        $dto->setUpdatedAt($entity->getUpdatedAt());

        $dto->setFragmentCount($entity->getFragmentCount());
        $dto->setExpectedCount($entity->getExpectedCount());
        $dto->setCompletedCount($entity->getCompletedCount());
        $dto->setUserOperation($entity->getUserOperation());
        $dto->setExpectedNum($entity->getExpectedNum());
        $dto->setCompletedNum($entity->getCompletedNum());
        $dto->setDocumentCount(0);
        $dto->setWordCount($entity->getWordCount());
        $dto->setIcon($entity->getIcon());

        return $dto;
    }
}
