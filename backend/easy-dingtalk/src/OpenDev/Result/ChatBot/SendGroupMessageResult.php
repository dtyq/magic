<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\ChatBot;

use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class SendGroupMessageResult extends AbstractResult
{
    private string $processQueryKey;

    public function getProcessQueryKey(): string
    {
        return $this->processQueryKey;
    }

    public function buildByRawData(array $rawData): void
    {
        $this->processQueryKey = $rawData['processQueryKey'] ?? '';
    }
}
