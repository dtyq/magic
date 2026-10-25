<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\RecycleBin\Entity;

use DateTimeImmutable;
use DateTimeZone;
use Exception;
use InvalidArgumentException;
use JsonException;

/** 项目文件查询的范围与翻页边界；不承担目录分类或文件内容读取。 */
final class RecycleBinFileQuery
{
    public const MAX_SEARCH_HOURS = 360;

    public const MAX_SEARCH_RESULTS = 1000;

    public readonly int $projectId;

    public readonly ?string $deletedFrom;

    public readonly ?string $deletedTo;

    public function __construct(
        string $projectId,
        public readonly ?string $keyword,
        ?string $deletedFrom,
        ?string $deletedTo,
        public readonly ?string $cursor,
        public readonly bool $includeTotal,
    ) {
        $this->projectId = self::parseProjectId($projectId);
        $from = $deletedFrom !== null ? self::parseTime($deletedFrom) : null;
        $to = $deletedTo !== null ? self::parseTime($deletedTo) : null;
        if (($from === null) !== ($to === null) || ($keyword !== null && $from === null)) {
            throw new InvalidArgumentException('recycle_bin.query.time_required');
        }
        if ($from !== null && $to !== null) {
            $duration = $to->getTimestamp() - $from->getTimestamp();
            if ($duration <= 0 || $duration > self::MAX_SEARCH_HOURS * 3600) {
                throw new InvalidArgumentException('recycle_bin.query.time_range_invalid');
            }
        }
        $this->deletedFrom = $from?->format('Y-m-d H:i:s');
        $this->deletedTo = $to?->format('Y-m-d H:i:s');
    }

    public static function parseProjectId(string $value): int
    {
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) {
            throw new InvalidArgumentException('recycle_bin.query.project_invalid');
        }
        return $id;
    }

    /** @return null|array{deleted_at: string, id: int, snapshot_id: int, snapshot_time: string} */
    public function readCursor(string $userId): ?array
    {
        if ($this->cursor === null) {
            return null;
        }
        try {
            $json = base64_decode($this->cursor, true);
            $data = $json === false ? null : json_decode($json, true, 8, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new InvalidArgumentException('recycle_bin.query.cursor_invalid');
        }
        if (! is_array($data)
            || ($data['scope'] ?? null) !== $this->scopeKey($userId)
            || ! is_string($data['deleted_at'] ?? null)
            || ! is_string($data['snapshot_time'] ?? null)
            || ! is_string($data['id'] ?? null)
            || ! is_string($data['snapshot_id'] ?? null)) {
            throw new InvalidArgumentException('recycle_bin.query.cursor_invalid');
        }
        $id = filter_var($data['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $snapshotId = filter_var($data['snapshot_id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false || $snapshotId === false || $id > $snapshotId
            || ! self::isStoredTime($data['deleted_at']) || ! self::isStoredTime($data['snapshot_time'])
            || $data['deleted_at'] > $data['snapshot_time']) {
            throw new InvalidArgumentException('recycle_bin.query.cursor_invalid');
        }
        return [
            'deleted_at' => $data['deleted_at'],
            'id' => $id,
            'snapshot_id' => $snapshotId,
            'snapshot_time' => $data['snapshot_time'],
        ];
    }

    public function nextCursor(string $userId, RecycleBinEntity $last, int $snapshotId, string $snapshotTime): string
    {
        // scope 防止把旧查询的游标用于新条件；权限仍由每次数据库查询独立校验。
        return base64_encode(json_encode([
            'scope' => $this->scopeKey($userId),
            'deleted_at' => $last->getDeletedAt(),
            'id' => (string) $last->getId(),
            'snapshot_id' => (string) $snapshotId,
            'snapshot_time' => $snapshotTime,
        ], JSON_THROW_ON_ERROR));
    }

    private function scopeKey(string $userId): string
    {
        return hash('sha256', json_encode([
            $userId, $this->projectId, $this->keyword, $this->deletedFrom, $this->deletedTo,
        ], JSON_THROW_ON_ERROR));
    }

    private static function parseTime(string $value): DateTimeImmutable
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) {
            throw new InvalidArgumentException('recycle_bin.query.time_invalid');
        }
        try {
            $time = new DateTimeImmutable($value);
        } catch (Exception) {
            throw new InvalidArgumentException('recycle_bin.query.time_invalid');
        }
        $errors = DateTimeImmutable::getLastErrors();
        if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) {
            throw new InvalidArgumentException('recycle_bin.query.time_invalid');
        }
        return $time->setTimezone(new DateTimeZone('Asia/Shanghai'));
    }

    private static function isStoredTime(string $value): bool
    {
        $time = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value);
        return $time !== false && $time->format('Y-m-d H:i:s') === $value;
    }
}
