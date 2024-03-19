<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\User;

use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class UserListResult extends AbstractResult
{
    private bool $hasMore;

    private int $nextCursor;

    /**
     * @var UserResult[]
     */
    private array $userList;

    public function buildByRawData(array $rawData): void
    {
        $this->hasMore = (bool) ($rawData['has_more'] ?? false);
        $this->nextCursor = (int) ($rawData['next_cursor'] ?? 0);
        $userList = [];
        foreach ($rawData['list'] ?? [] as $item) {
            $userList[] = new UserResult($item);
        }
        $this->userList = $userList;
    }

    public function isHasMore(): bool
    {
        return $this->hasMore;
    }

    public function getNextCursor(): int
    {
        return $this->nextCursor;
    }

    public function getUserList(): array
    {
        return $this->userList;
    }
}
