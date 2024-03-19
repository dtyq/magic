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
use App\Interfaces\Kernel\Assembler\OperatorAssembler;

class KnowledgeBaseListDTO extends AbstractFlowDTO
{
    public string $code = '';

    public string $name = '';

    public string $icon = '';

    public string $description = '';

    public int $type;

    public bool $enabled = false;

    public string $businessId = '';

    public int $syncStatus;

    public string $syncStatusMessage = '';

    public string $model = '';

    public string $vectorDB = 'qdrant';

    public string $organizationCode;

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

    public ?RetrieveConfig $retrieveConfig = null;

    public ?FragmentConfig $fragmentConfig = null;

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
        $this->vectorDB = $vectorDB ?? 'qdrant';
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode ?? '';
    }

    public function getWordCount(): int
    {
        return $this->wordCount;
    }

    public function setWordCount(int $wordCount): KnowledgeBaseListDTO
    {
        $this->wordCount = $wordCount;
        return $this;
    }

    public function getDocumentCount(): int
    {
        return $this->documentCount;
    }

    public function setDocumentCount(int $documentCount): KnowledgeBaseListDTO
    {
        $this->documentCount = $documentCount;
        return $this;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): KnowledgeBaseListDTO
    {
        $this->code = $code;
        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public static function fromEntity(KnowledgeBaseEntity $entity, array $users = [], array $knowledgeBaseDocumentCountMap = []): KnowledgeBaseListDTO
    {
        $listDTO = new KnowledgeBaseListDTO($entity->toArray());
        // 兼容旧知识库逻辑，旧知识库逻辑id为code
        $listDTO->setId($entity->getCode());
        $listDTO->setCode($entity->getCode());
        $listDTO->setCreator($entity->getCreator());
        $listDTO->setCreatedAt($entity->getCreatedAt());
        $listDTO->setModifier($entity->getModifier());
        $listDTO->setUpdatedAt($entity->getUpdatedAt());
        $listDTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$entity->getCreator()] ?? null, $entity->getCreatedAt()));
        $listDTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$entity->getModifier()] ?? null, $entity->getUpdatedAt()));
        $listDTO->setUserOperation($entity->getUserOperation());
        $listDTO->setExpectedNum($entity->getExpectedNum());
        $listDTO->setCompletedNum($entity->getCompletedNum());
        $listDTO->setWordCount($entity->getWordCount());
        $listDTO->setRetrieveConfig($entity->getRetrieveConfig());
        $listDTO->setEmbeddingConfig($entity->getEmbeddingConfig());
        $listDTO->setFragmentConfig($entity->getFragmentConfig());
        $listDTO->setDocumentCount($knowledgeBaseDocumentCountMap[$entity->getCode()] ?? 0);
        return $listDTO;
    }
}
