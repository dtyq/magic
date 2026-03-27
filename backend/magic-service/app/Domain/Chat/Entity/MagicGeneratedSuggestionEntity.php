<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity;

use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionStatus;

class MagicGeneratedSuggestionEntity extends AbstractEntity
{
    protected string $id = '';

    protected int $type = 0;

    protected string $relationId = '';

    protected array $params = [];

    protected array $suggestions = [];

    protected ?GeneratedSuggestionStatus $status = null;

    protected ?string $createdUid = null;

    protected string $createdAt = '';

    protected string $updatedAt = '';

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): static
    {
        $this->id = $id === null ? '' : (string) $id;
        return $this;
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getRelationId(): string
    {
        return $this->relationId;
    }

    public function setRelationId(null|int|string $relationId): static
    {
        $this->relationId = $relationId === null ? '' : (string) $relationId;
        return $this;
    }

    public function getParams(): array
    {
        return $this->params;
    }

    public function setParams(null|array|string $params): static
    {
        $this->params = $this->transformJson($params);
        return $this;
    }

    /**
     * @return string[]
     */
    public function getSuggestions(): array
    {
        return array_values($this->suggestions);
    }

    /**
     * @param null|array|string $suggestions
     */
    public function setSuggestions($suggestions): static
    {
        $values = $this->transformJson($suggestions);
        $this->suggestions = array_values(array_map(static fn ($value) => (string) $value, $values));
        return $this;
    }

    public function getStatus(): ?GeneratedSuggestionStatus
    {
        return $this->status;
    }

    public function setStatus(null|GeneratedSuggestionStatus|int $status): static
    {
        if ($status instanceof GeneratedSuggestionStatus || $status === null) {
            $this->status = $status;
            return $this;
        }

        $this->status = GeneratedSuggestionStatus::tryFrom($status);
        return $this;
    }

    public function getCreatedUid(): ?string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(null|int|string $createdUid): static
    {
        $this->createdUid = ($createdUid === null || $createdUid === '') ? null : (string) $createdUid;
        return $this;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): static
    {
        $this->createdAt = $this->createDateTimeString($createdAt);
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): static
    {
        $this->updatedAt = $this->createDateTimeString($updatedAt);
        return $this;
    }

    public function getTopicId(): ?int
    {
        if (! isset($this->params['topic_id']) || $this->params['topic_id'] === '') {
            return null;
        }

        return (int) $this->params['topic_id'];
    }

    /**
     * 查询无记录时与历史 array 返回结构一致的占位实体.
     */
    public static function emptyForMissingQuery(int $type, string $relationId): self
    {
        $entity = new self();
        $entity->setType($type);
        $entity->setRelationId($relationId);
        $entity->setParams([]);
        $entity->setSuggestions([]);
        $entity->setStatus(null);
        $entity->setUpdatedAt('');

        return $entity;
    }
}
