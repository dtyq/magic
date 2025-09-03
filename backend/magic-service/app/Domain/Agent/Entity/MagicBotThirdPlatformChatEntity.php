<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Entity;

use App\Domain\Agent\Entity\ValueObject\ThirdPlatformChat\ThirdPlatformChatType;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class MagicBotThirdPlatformChatEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $botId;

    protected string $key;

    protected ThirdPlatformChatType $type;

    protected bool $enabled;

    /**
     * 接入平台的配置信息.
     */
    protected array $options = [];

    protected string $identification;

    private bool $allUpdate = false;

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForSaving(): void
    {
        if (empty($this->botId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'bot_id']);
        }
        if (empty($this->type)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'type']);
        }
        if (! isset($this->enabled)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'enabled']);
        }
        if (empty($this->options)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'options']);
        }
        if (! isset($this->identification) || $this->identification === '') {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'identification']);
        }
        if ($this->shouldCreate()) {
            if (empty($this->key)) {
                $this->key = IdGenerator::getUniqueId32();
            }
            $this->id = null;
        }
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (int) $id : null;
    }

    public function getBotId(): string
    {
        return $this->botId;
    }

    public function setBotId(string $botId): void
    {
        $this->botId = $botId;
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function setKey(string $key): void
    {
        $this->key = $key;
    }

    public function getType(): ThirdPlatformChatType
    {
        return $this->type;
    }

    public function setType(ThirdPlatformChatType $type): void
    {
        $this->type = $type;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function setOptions(array $options): void
    {
        $this->options = $options;
    }

    public function getIdentification(): string
    {
        return $this->identification;
    }

    public function setIdentification(string $identification): void
    {
        $this->identification = $identification;
    }

    public function isAllUpdate(): bool
    {
        return $this->allUpdate;
    }

    public function setAllUpdate(bool $allUpdate): void
    {
        $this->allUpdate = $allUpdate;
    }
}
