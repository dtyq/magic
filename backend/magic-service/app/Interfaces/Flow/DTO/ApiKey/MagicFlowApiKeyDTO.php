<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\ApiKey;

use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class MagicFlowApiKeyDTO extends AbstractFlowDTO
{
    public string $flowCode;

    public int $type = 1;

    public string $name = '';

    public string $description = '';

    public string $secretKey = '';

    public string $conversationId = '';

    public bool $enabled = false;

    public ?string $lastUsed = null;

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(?string $flowCode): void
    {
        $this->flowCode = $flowCode ?? '';
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type ?? 1;
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

    public function getSecretKey(): string
    {
        return $this->secretKey;
    }

    public function setSecretKey(?string $secretKey): void
    {
        $this->secretKey = $secretKey ?? '';
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId ?? '';
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled ?? false;
    }

    public function getLastUsed(): ?string
    {
        return $this->lastUsed;
    }

    public function setLastUsed(mixed $lastUsed): void
    {
        $this->lastUsed = $this->createDateTimeString($lastUsed);
    }
}
