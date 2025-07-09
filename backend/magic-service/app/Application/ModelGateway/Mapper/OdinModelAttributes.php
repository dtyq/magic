<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

use DateTime;

readonly class OdinModelAttributes
{
    public function __construct(
        private string $key,
        private string $name,
        private string $label,
        private string $icon,
        private array $tags,
        private DateTime $createdAt,
        private string $owner,
        private string $providerAlias = '',
        private string $providerModelId = '',
        private string $providerId = '',
    ) {
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function getOwner(): string
    {
        return $this->owner;
    }

    public function getProviderAlias(): string
    {
        return $this->providerAlias;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function getProviderId(): string
    {
        return $this->providerId;
    }

    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'name' => $this->name,
            'label' => $this->label,
            'icon' => $this->icon,
            'tags' => $this->tags,
            'created_at' => $this->createdAt->getTimestamp(),
            'owner' => $this->owner,
            'provider_alias' => $this->providerAlias,
            'provider_model_id' => $this->providerModelId,
            'provider_id' => $this->providerId,
        ];
    }
}
