<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\User;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class UserByMobileResult extends AbstractResult
{
    private string $userId;

    public function buildByRawData(array $rawData): void
    {
        if (empty($rawData['userid'])) {
            throw new InvalidResultException('userid 不能为空');
        }

        $this->userId = $rawData['userid'];
    }

    public function getUserid(): string
    {
        return $this->userId;
    }
}
