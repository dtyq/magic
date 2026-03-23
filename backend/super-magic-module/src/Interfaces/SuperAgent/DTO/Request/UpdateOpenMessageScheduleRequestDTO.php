<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;

class UpdateOpenMessageScheduleRequestDTO extends AbstractDTO
{
    public ?string $taskName = null;

    public ?string $messageContentText = null;

    public ?array $timeConfig = null;

    public ?string $modelId = null;

    public ?int $enabled = null;

    public ?string $deadline = null;

    private bool $hasTaskName = false;

    private bool $hasMessageContentText = false;

    private bool $hasTimeConfig = false;

    private bool $hasModelId = false;

    private bool $hasEnabled = false;

    private bool $hasDeadline = false;

    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->initProperty($data);
        $dto->hasTaskName = array_key_exists('task_name', $data) && $data['task_name'] !== null;
        $dto->hasTimeConfig = array_key_exists('time_config', $data) && $data['time_config'] !== null;
        $dto->hasModelId = array_key_exists('model_id', $data) && $data['model_id'] !== null;
        $dto->hasEnabled = array_key_exists('enabled', $data) && $data['enabled'] !== null;
        $dto->hasDeadline = array_key_exists('deadline', $data);
        if (array_key_exists('message_content', $data) && $data['message_content'] !== null) {
            $v = $data['message_content'];
            $dto->messageContentText = is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE);
            $dto->hasMessageContentText = true;
        }
        return $dto;
    }

    public function getTaskName(): ?string
    {
        return $this->taskName;
    }

    public function getMessageContentText(): ?string
    {
        return $this->messageContentText;
    }

    public function getTimeConfig(): ?array
    {
        return $this->timeConfig;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function getEnabled(): ?int
    {
        return $this->enabled;
    }

    public function hasTaskName(): bool
    {
        return $this->hasTaskName;
    }

    public function hasMessageContentText(): bool
    {
        return $this->hasMessageContentText;
    }

    public function hasTimeConfig(): bool
    {
        return $this->hasTimeConfig;
    }

    public function hasModelId(): bool
    {
        return $this->hasModelId;
    }

    public function hasEnabled(): bool
    {
        return $this->hasEnabled;
    }

    public function getDeadline(): ?string
    {
        return $this->deadline === '' ? null : $this->deadline;
    }

    public function hasDeadline(): bool
    {
        return $this->hasDeadline;
    }
}
