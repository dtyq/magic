<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\User;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class AdminResult extends AbstractResult
{
    private string $userId;

    private int $sysLevel;

    public function buildByRawData(array $rawData): void
    {
        if (empty($rawData['userid'])) {
            throw new InvalidResultException('userid 不能为空');
        }
        if (empty($rawData['sys_level'])) {
            throw new InvalidResultException('sys_level 不能为空');
        }
        $this->userId = $rawData['userid'];
        $this->sysLevel = $rawData['sys_level'];
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getSysLevel(): int
    {
        return $this->sysLevel;
    }
}
