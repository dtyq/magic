<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Entity\ValueObject\ApiKeyType;
use App\Domain\Flow\Entity\ValueObject\Code;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class MagicFlowApiKeyEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected string $code;

    protected string $flowCode;

    protected ApiKeyType $type;

    protected string $name;

    protected string $description = '';

    protected string $secretKey;

    /**
     * 会话 ID（可以是子会话，如话题），与 sk 一对一绑定.
     */
    protected string $conversationId;

    protected bool $enabled;

    protected ?DateTime $lastUsed = null;

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

    protected DateTime $updatedAt;

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareForCreate(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.organization_code']);
        }
        if (empty($this->flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.flow_code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.api_key_name']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.creator']);
        }
        if (empty($this->conversationId)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.conversation_id']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        if (empty($this->type)) {
            $this->type = ApiKeyType::Personal;
        }
        $this->code = Code::MagicFlowApiKey->gen();
        $this->secretKey = Code::ApiKeySK->gen();

        $this->enabled = true;
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
    }

    public function prepareForModification(MagicFlowApiKeyEntity $magicFlowApiKeyEntity): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.organization_code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.api_key_name']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.creator']);
        }

        $magicFlowApiKeyEntity->setName($this->name);
        $magicFlowApiKeyEntity->setDescription($this->description);
        $magicFlowApiKeyEntity->setModifier($this->creator);
        $magicFlowApiKeyEntity->setEnabled($this->enabled);
        $magicFlowApiKeyEntity->setUpdatedAt(new DateTime());
    }

    public function prepareForUpdateSecretKey(): void
    {
        if (empty($this->modifier)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.modifier']);
        }

        $this->secretKey = Code::ApiKeySK->gen();
        $this->updatedAt = new DateTime();
    }

    public function getWebhookUrl(): string
    {
        return "/api/{$this->secretKey}/chat";
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function setFlowCode(string $flowCode): void
    {
        $this->flowCode = $flowCode;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getType(): ApiKeyType
    {
        return $this->type;
    }

    public function setType(ApiKeyType|int $type): void
    {
        if (is_int($type)) {
            $type = ApiKeyType::tryFrom($type);
        }
        $this->type = $type;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getSecretKey(bool $isDesensitization = false): string
    {
        if ($isDesensitization) {
            // 只保留左右 4 位数，剩下的用 * 代替
            return substr($this->secretKey, 0, 4) . str_repeat('*', strlen($this->secretKey) - 8) . substr($this->secretKey, -4);
        }
        return $this->secretKey;
    }

    public function setSecretKey(string $secretKey): void
    {
        $this->secretKey = $secretKey;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getLastUsed(): ?DateTime
    {
        return $this->lastUsed;
    }

    public function setLastUsed(mixed $lastUsed): void
    {
        $this->lastUsed = $this->createDatetime($lastUsed);
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDatetime($createdAt);
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDatetime($updatedAt);
    }
}
