<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\DTO;

use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\Infrastructure\Core\AbstractDTO;
use Throwable;

/**
 * 记忆查询 DTO.
 */
class MemoryQueryDTO extends AbstractDTO
{
    public string $orgId = '';

    public string $appId = '';

    public string $userId = '';

    public ?string $status = null;

    public ?MemoryType $type = null;

    public array $tags = [];

    public ?string $keyword = null;

    public ?string $projectId = null;

    public int $limit = 50;

    public string $orderBy = 'created_at';

    public string $orderDirection = 'desc';

    // 分页游标相关
    public ?string $pageToken = null;

    public ?string $lastOrderValue = null; // 最后一条记录的排序字段值

    public ?string $lastId = null; // 最后一条记录的ID

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }

    /**
     * 设置记忆类型.
     */
    public function setMemoryType(MemoryType|string $type): void
    {
        if (is_string($type)) {
            $this->type = MemoryType::from($type);
        } else {
            $this->type = $type;
        }
    }

    /**
     * 解析 pageToken.
     */
    public function parsePageToken(): void
    {
        if ($this->pageToken === null || $this->pageToken === '') {
            return;
        }

        try {
            $decoded = base64_decode($this->pageToken, true);
            if ($decoded === false) {
                return;
            }

            $data = json_decode($decoded, true);
            if (! is_array($data)) {
                return;
            }

            $this->lastOrderValue = $data['lastOrderValue'] ?? null;
            $this->lastId = $data['lastId'] ?? null;
        } catch (Throwable $e) {
            // 忽略解析错误，继续执行
        }
    }

    /**
     * 生成 pageToken.
     */
    public static function generatePageToken(string $lastOrderValue, string $lastId): string
    {
        $data = [
            'lastOrderValue' => $lastOrderValue,
            'lastId' => $lastId,
        ];

        return base64_encode(json_encode($data));
    }
}
