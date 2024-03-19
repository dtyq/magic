<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO;

use App\Domain\Chat\Entity\AbstractEntity;
use App\Infrastructure\Core\Constants\Order;
use Carbon\Carbon;

class MessagesQueryDTO extends AbstractEntity
{
    protected string $conversationId = '';

    protected array $conversationIds = [];

    protected ?Carbon $timeStart = null;

    protected ?Carbon $timeEnd = null;

    protected ?string $topicId = null;

    protected ?string $pageToken = null;

    protected int $limit = 100;

    protected Order $order = Order::Desc;

    public function getConversationIds(): array
    {
        return $this->conversationIds;
    }

    public function setConversationIds(array $conversationIds): self
    {
        $this->conversationIds = $conversationIds;
        return $this;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): self
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getTimeStart(): ?Carbon
    {
        return $this->timeStart;
    }

    public function setTimeStart(?Carbon $timeStart): self
    {
        $this->timeStart = $timeStart;
        return $this;
    }

    public function getTimeEnd(): ?Carbon
    {
        return $this->timeEnd;
    }

    public function setTimeEnd(?Carbon $timeEnd): self
    {
        $this->timeEnd = $timeEnd;
        return $this;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getPageToken(): ?string
    {
        return $this->pageToken;
    }

    public function setPageToken(?string $pageToken): self
    {
        $this->pageToken = $pageToken;
        return $this;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function setLimit(int $limit): self
    {
        $this->limit = $limit;
        return $this;
    }

    public function getOrder(): Order
    {
        return $this->order;
    }

    public function setOrder(Order $order): self
    {
        $this->order = $order;
        return $this;
    }
}
