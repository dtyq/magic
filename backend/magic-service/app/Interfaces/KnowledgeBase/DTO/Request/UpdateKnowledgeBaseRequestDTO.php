<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class UpdateKnowledgeBaseRequestDTO extends AbstractRequestDTO
{
    public string $code;

    public string $name;

    public string $icon;

    public string $description;

    public bool $enabled;

    public array $fragmentConfig;

    public array $embeddingConfig;

    public array $retrieveConfig;

    protected string $businessId = '';

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): UpdateKnowledgeBaseRequestDTO
    {
        $this->code = $code;
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

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): self
    {
        $this->description = $description;
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

    public function getFragmentConfig(): ?array
    {
        return $this->fragmentConfig;
    }

    public function setFragmentConfig(?array $fragmentConfig): self
    {
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

    public function getRetrieveConfig(): ?array
    {
        return $this->retrieveConfig;
    }

    public function setRetrieveConfig(?array $retrieveConfig): self
    {
        $this->retrieveConfig = $retrieveConfig;
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

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function setBusinessId(string $businessId): void
    {
        $this->businessId = $businessId;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'code' => 'required|string',
            'name' => 'required|string|max:255',
            'description' => 'string|max:255',
            'enabled' => 'required|boolean',
            'fragment_config' => 'array',
            'embedding_config' => 'array',
            'retrieve_config' => 'array',
            'icon' => 'nullable|string',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [];
    }
}
