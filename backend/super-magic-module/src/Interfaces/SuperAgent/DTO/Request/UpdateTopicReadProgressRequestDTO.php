<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class UpdateTopicReadProgressRequestDTO extends AbstractDTO
{
    protected int $topicId = 0;

    protected ?string $lastReadAt = null;

    protected ?int $lastReadMessageId = null;

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->setTopicId((int) $request->route('id', 0));

        $lastReadAt = $request->input('last_read_at');
        $dto->setLastReadAt($lastReadAt === null || $lastReadAt === '' ? null : (string) $lastReadAt);

        $lastReadMessageId = $request->input('last_read_message_id');
        $dto->setLastReadMessageId($lastReadMessageId === null || $lastReadMessageId === '' ? null : (int) $lastReadMessageId);
        return $dto;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function setTopicId(int $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getLastReadAt(): ?string
    {
        return $this->lastReadAt;
    }

    public function setLastReadAt(?string $lastReadAt): self
    {
        $this->lastReadAt = $lastReadAt;
        return $this;
    }

    public function getLastReadMessageId(): ?int
    {
        return $this->lastReadMessageId;
    }

    public function setLastReadMessageId(?int $lastReadMessageId): self
    {
        $this->lastReadMessageId = $lastReadMessageId;
        return $this;
    }
}
