<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\RecycleBin\DTO;

use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinFileQuery;
use App\Domain\SuperMagic\Common\RecycleBin\Enum\RecycleBinResourceType;
use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

class RecycleBinListRequestDTO
{
    private ?int $resourceType = null;

    private ?string $keyword = null;

    private string $order = 'desc';

    private int $page = 1;

    private int $pageSize = 20;

    private ?RecycleBinFileQuery $fileQuery = null;

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
        if (array_key_exists('project_id', $data)) {
            if (! is_string($data['project_id']) && ! is_int($data['project_id'])) {
                throw new InvalidArgumentException('recycle_bin.query.project_invalid');
            }
            if ($this->resourceType !== RecycleBinResourceType::File->value
                || $this->order !== 'desc' || $this->page !== 1) {
                throw new InvalidArgumentException('recycle_bin.query.mode_invalid');
            }
            foreach (['deleted_from', 'deleted_to', 'cursor'] as $field) {
                if (array_key_exists($field, $data) && (! is_string($data[$field]) || $data[$field] === '')) {
                    throw new InvalidArgumentException('recycle_bin.query.mode_invalid');
                }
            }
            if (isset($data['cursor']) && strlen($data['cursor']) > 2048) {
                throw new InvalidArgumentException('recycle_bin.query.cursor_invalid');
            }
            $includeTotal = filter_var($data['include_total'] ?? true, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($includeTotal === null) {
                throw new InvalidArgumentException('recycle_bin.query.mode_invalid');
            }
            $keyword = isset($data['keyword']) ? trim((string) $data['keyword']) : '';
            $this->keyword = $keyword !== '' ? $keyword : null;
            $this->fileQuery = new RecycleBinFileQuery(
                (string) $data['project_id'],
                $this->keyword,
                $data['deleted_from'] ?? null,
                $data['deleted_to'] ?? null,
                $data['cursor'] ?? null,
                $includeTotal,
            );
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

    public function getFileQuery(): ?RecycleBinFileQuery
    {
        return $this->fileQuery;
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
