<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\Items;

use App\Infrastructure\Core\UnderlineObjectJsonSerializable;

class ReceiveList extends UnderlineObjectJsonSerializable
{
    /**
     * 未读列表.
     */
    protected array $unreadList = [];

    /**
     * 已读列表.
     */
    protected array $seenList = [];

    /**
     * 已查看详情列表.
     */
    protected array $readList = [];

    public function getUnreadList(): array
    {
        return $this->unreadList;
    }

    public function setUnreadList(array $unreadList): void
    {
        $this->unreadList = $unreadList;
    }

    public function getSeenList(): array
    {
        return $this->seenList;
    }

    public function setSeenList(array $seenList): void
    {
        $this->seenList = $seenList;
    }

    public function getReadList(): array
    {
        return $this->readList;
    }

    public function setReadList(array $readList): void
    {
        $this->readList = $readList;
    }
}
