<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\DTO;

use App\Domain\Provider\Entity\ValueObject\Query\ModelIdentifierMappingQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\ValueObject\Page;

class QueryModelIdentifierMappingGroupsDTO extends AbstractDTO
{
    public string $keyword = '';

    public ?int $status = null;

    public int $page = 1;

    public int $pageSize = 20;

    /**
     * 将接口入参转换为分页查询 DTO。
     */
    public static function fromArray(array $input): self
    {
        $dto = new self();
        $dto->keyword = trim((string) ($input['keyword'] ?? ''));
        $dto->status = array_key_exists('status', $input) && $input['status'] !== '' && $input['status'] !== null
            ? (int) $input['status']
            : null;
        $dto->page = max(1, (int) ($input['page'] ?? 1));
        $dto->pageSize = min(100, max(1, (int) ($input['page_size'] ?? 20)));
        return $dto;
    }

    /**
     * 将接口筛选参数转换为 Provider 领域查询对象。
     */
    public function toQuery(): ModelIdentifierMappingQuery
    {
        return (new ModelIdentifierMappingQuery())
            ->setKeyword($this->keyword)
            ->setStatus($this->status === null ? null : Status::from($this->status));
    }

    /**
     * 将接口分页参数转换为统一分页对象。
     */
    public function toPage(): Page
    {
        return new Page($this->page, $this->pageSize);
    }
}
