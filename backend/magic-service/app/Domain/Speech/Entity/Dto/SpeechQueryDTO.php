<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;

class SpeechQueryDTO extends AbstractRequestDTO
{
    protected string $taskId = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        $this->taskId = (string) ($data['task_id'] ?? $data['id'] ?? '');
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(string $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getType(): string
    {
        return 'speech_query';
    }

    public function getCallMethod(): string
    {
        return 'speech_query';
    }
}
