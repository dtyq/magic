<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Knowledge\Structure;

readonly class Knowledge
{
    public function __construct(
        private string $knowledgeCode,
        private int $knowledgeType,
        private string $businessId,
        private string $name,
        private string $description
    ) {
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getKnowledgeCode(): string
    {
        return $this->knowledgeCode;
    }

    public function getKnowledgeType(): int
    {
        return $this->knowledgeType;
    }

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function toArray(): array
    {
        return [
            'knowledge_code' => $this->knowledgeCode,
            'knowledge_type' => $this->knowledgeType,
            'business_id' => $this->businessId,
            'name' => $this->name,
            'description' => $this->description,
        ];
    }
}
