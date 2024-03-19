<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\User;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class UserByCodeResult extends AbstractResult
{
    private string $userId;

    private string $unionid;

    private string $name;

    private int $sysLevel = 0;

    public function getSysLevel(): int
    {
        return $this->sysLevel;
    }

    public function setSysLevel(int $sysLevel): void
    {
        $this->sysLevel = $sysLevel;
    }

    public function buildByRawData(array $rawData): void
    {
        if (empty($rawData['userid'])) {
            throw new InvalidResultException('userid 不能为空');
        }
        if (empty($rawData['unionid'])) {
            throw new InvalidResultException('unionid 不能为空');
        }
        $this->userId = $rawData['userid'];
        $this->unionid = $rawData['unionid'];
        $this->name = $rawData['name'] ?? '';
        $this->sysLevel = $rawData['sys_level'] ?? 0;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getUnionid(): string
    {
        return $this->unionid;
    }

    public function getName(): string
    {
        return $this->name;
    }
}
