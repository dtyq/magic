<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\ChatBot;

use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class SendOneOnOneChatMessagesResult extends AbstractResult
{
    private string $processQueryKey;

    /**
     * @var array 无效的用户userId列表
     */
    private array $invalidStaffIdList = [];

    /**
     * @var array 被限流的userId列表
     */
    private array $flowControlledStaffIdList = [];

    public function getProcessQueryKey(): string
    {
        return $this->processQueryKey;
    }

    public function getInvalidStaffIdList(): array
    {
        return $this->invalidStaffIdList;
    }

    public function getFlowControlledStaffIdList(): array
    {
        return $this->flowControlledStaffIdList;
    }

    public function buildByRawData(array $rawData): void
    {
        $this->processQueryKey = $rawData['processQueryKey'] ?? '';
        $this->invalidStaffIdList = $rawData['invalidStaffIdList'] ?? [];
        $this->flowControlledStaffIdList = $rawData['flowControlledStaffIdList'] ?? [];
    }
}
