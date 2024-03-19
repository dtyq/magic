<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO;

use App\Domain\Chat\Entity\AbstractEntity;

class ConversationListQueryDTO extends AbstractEntity
{
    protected array $ids = [];

    protected int $limit = 100;

    protected string $pageToken = '';

    protected ?int $status = null;

    protected ?int $isNotDisturb = null;

    protected ?int $isTop = null;

    protected ?int $isMark = null;

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getIds(): array
    {
        return $this->ids;
    }

    public function setIds(array $ids): void
    {
        $this->ids = $ids;
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function setLimit(int $limit): void
    {
        $this->limit = $limit;
    }

    public function getPageToken(): string
    {
        return $this->pageToken;
    }

    public function setPageToken(string $pageToken): void
    {
        $this->pageToken = $pageToken;
    }

    public function getIsNotDisturb(): ?int
    {
        return $this->isNotDisturb;
    }

    public function setIsNotDisturb(?int $isNotDisturb): void
    {
        $this->isNotDisturb = $isNotDisturb;
    }

    public function getIsTop(): ?int
    {
        return $this->isTop;
    }

    public function setIsTop(?int $isTop): void
    {
        $this->isTop = $isTop;
    }

    public function getIsMark(): ?int
    {
        return $this->isMark;
    }

    public function setIsMark(?int $isMark): void
    {
        $this->isMark = $isMark;
    }
}
