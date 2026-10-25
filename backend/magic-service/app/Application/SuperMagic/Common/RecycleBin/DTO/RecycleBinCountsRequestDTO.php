<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\RecycleBin\DTO;

use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinFileQuery;
use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

class RecycleBinCountsRequestDTO
{
    private ?string $keyword = null;

    private ?int $projectId = null;

    public function __construct(array $data)
    {
        if (isset($data['keyword']) && ! empty($data['keyword'])) {
            $this->keyword = trim((string) $data['keyword']);
        }
        if (array_key_exists('project_id', $data)) {
            if (! is_string($data['project_id']) && ! is_int($data['project_id'])) {
                throw new InvalidArgumentException('recycle_bin.query.project_invalid');
            }
            $this->projectId = RecycleBinFileQuery::parseProjectId((string) $data['project_id']);
            // 项目搜索不做全量 COUNT；命中数量由有限查询取得的记录确定。
            if ($this->keyword !== null && $this->keyword !== '') {
                throw new InvalidArgumentException('recycle_bin.query.count_keyword_invalid');
            }
        }
    }

    public static function fromRequest(RequestInterface $request): self
    {
        return new self($request->all());
    }

    public function getKeyword(): ?string
    {
        return $this->keyword;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }
}
