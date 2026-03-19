<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use Hyperf\HttpServer\Contract\RequestInterface;

class RecycleBinListRequestDTO
{
    private ?int $resourceType = null;

    private ?string $keyword = null;

    private string $order = 'desc';

    private int $page = 1;

    private int $pageSize = 20;

    public function __construct(array $data)
    {
        if (isset($data['resource_type'])) {
            $this->resourceType = (int) $data['resource_type'];
        }
        if (isset($data['keyword']) && ! empty($data['keyword'])) {
            $this->keyword = trim($data['keyword']);
        }
        if (isset($data['order']) && in_array($data['order'], ['asc', 'desc'])) {
            $this->order = $data['order'];
        }
        if (isset($data['page'])) {
            $this->page = max(1, (int) $data['page']);
        }
        if (isset($data['page_size'])) {
            $this->pageSize = min(100, max(1, (int) $data['page_size']));
        }
    }

    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    public function getResourceType(): ?int
    {
        return $this->resourceType;
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function getOrder(): string
    {
        return $this->order;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function toArray(): array
    {
        return [
            'resource_type' => $this->resourceType,
            'keyword' => $this->keyword,
            'order' => $this->order,
            'page' => $this->page,
            'page_size' => $this->pageSize,
        ];
    }
}
