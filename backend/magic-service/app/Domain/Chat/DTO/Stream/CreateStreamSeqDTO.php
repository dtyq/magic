<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Stream;

use App\Infrastructure\Core\BaseObject;

class CreateStreamSeqDTO extends BaseObject
{
    // app message id
    protected string $appMessageId;

    // topic id
    protected string $topicId;

    public function getAppMessageId(): string
    {
        return $this->appMessageId;
    }

    public function setAppMessageId(string $appMessageId): self
    {
        $this->appMessageId = $appMessageId;
        return $this;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }
}
