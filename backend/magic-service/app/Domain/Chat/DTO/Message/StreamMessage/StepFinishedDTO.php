<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

use App\Infrastructure\Core\AbstractObject;

class StepFinishedDTO extends AbstractObject
{
    /**
     * 大 json 的 key.
     */
    protected string $key;

    /**
     * 结束原因：
     * 0:流程结束
     * 1.发生异常.
     */
    protected FinishedReasonEnum $finishedReason;

    public function getKey(): string
    {
        return $this->key;
    }

    public function setKey(int|string $key): self
    {
        $this->key = (string) $key;
        return $this;
    }

    public function getFinishedReason(): FinishedReasonEnum
    {
        return $this->finishedReason;
    }

    public function setFinishedReason(FinishedReasonEnum $finishedReason): self
    {
        $this->finishedReason = $finishedReason;
        return $this;
    }
}
