<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Open API create message schedule request DTO.
 */
class CreateOpenMessageScheduleRequestDTO extends AbstractDTO
{
    public string $taskName = '';

    /** LLM 传的纯文本，fromArray 会将 message_content 归一为 string */
    public string $messageContentText = '';

    public array $timeConfig = [];

    public int $specifyTopic = 0;

    public string $topicId = '';

    public string $modelId = '';

    public string $remark = '';

    public ?string $deadline = null;

    public static function fromArray(array $data): CreateOpenMessageScheduleRequestDTO
    {
        $dto = new self();
        $dto->initProperty($data);
        if (array_key_exists('message_content', $data)) {
            $v = $data['message_content'];
            $dto->messageContentText = is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE);
        }
        return $dto;
    }

    public function getTaskName(): string
    {
        return $this->taskName;
    }

    public function getMessageContentText(): string
    {
        return $this->messageContentText;
    }

    public function getTimeConfig(): array
    {
        return $this->timeConfig;
    }

    public function getSpecifyTopic(): int
    {
        return $this->specifyTopic;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getRemark(): string
    {
        return $this->remark;
    }

    public function getDeadline(): ?string
    {
        return $this->deadline === '' ? null : $this->deadline;
    }
}
