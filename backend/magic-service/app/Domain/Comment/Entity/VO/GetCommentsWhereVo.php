<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Entity\VO;

class GetCommentsWhereVo
{
    protected ?int $id = null;

    protected ?array $ids = null;

    protected ?bool $queryAttachment = null;

    protected ?bool $useOrganizationCode = true;

    protected ?string $organizationCode = null;

    protected ?int $page = null;

    protected ?int $pageSize = null;

    protected ?int $resourceId = null;

    protected ?string $lastId = null;

    protected ?string $lastDirection = null;

    protected ?array $sorts = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getIds(): ?array
    {
        return $this->ids;
    }

    public function setIds(?array $ids): void
    {
        $this->ids = $ids;
    }

    public function getQueryAttachment(): ?bool
    {
        return $this->queryAttachment;
    }

    public function setQueryAttachment(?bool $queryAttachment): void
    {
        $this->queryAttachment = $queryAttachment;
    }

    public function getUseOrganizationCode(): ?bool
    {
        return $this->useOrganizationCode;
    }

    public function setUseOrganizationCode(?bool $useOrganizationCode): void
    {
        $this->useOrganizationCode = $useOrganizationCode;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getPage(): ?int
    {
        return $this->page;
    }

    public function setPage(?int $page): void
    {
        $this->page = $page;
    }

    public function getPageSize(): ?int
    {
        return $this->pageSize;
    }

    public function setPageSize(?int $pageSize): void
    {
        $this->pageSize = $pageSize;
    }

    public function getResourceId(): ?int
    {
        return $this->resourceId;
    }

    public function setResourceId(?int $resourceId): void
    {
        $this->resourceId = $resourceId;
    }

    public function getLastId(): ?string
    {
        return $this->lastId;
    }

    public function setLastId(?string $lastId): void
    {
        $this->lastId = $lastId;
    }

    public function getLastDirection(): ?string
    {
        return $this->lastDirection;
    }

    public function setLastDirection(?string $lastDirection): void
    {
        $this->lastDirection = $lastDirection;
    }

    public function getSorts(): ?array
    {
        return $this->sorts;
    }

    public function setSorts(?array $sorts): void
    {
        $this->sorts = $sorts;
    }
}
