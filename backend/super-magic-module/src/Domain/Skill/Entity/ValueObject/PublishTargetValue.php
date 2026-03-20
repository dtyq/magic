<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

/**
 * Skill 发布目标值。
 *
 * 这个值对象只描述“定向发布”携带的成员/部门范围：
 * - `PRIVATE / ORGANIZATION / MARKET` 正常情况下不应携带该对象
 * - `MEMBER` 使用该对象保存指定成员和指定部门
 */
class PublishTargetValue extends AbstractValueObject
{
    /**
     * @var array<string>
     */
    protected array $userIds = [];

    /**
     * @var array<string>
     */
    protected array $departmentIds = [];

    public static function fromArray(?array $data): ?self
    {
        if ($data === null) {
            return null;
        }

        return new self($data);
    }

    /**
     * @return array<string>
     */
    public function getUserIds(): array
    {
        return $this->userIds;
    }

    /**
     * @param array<mixed> $userIds
     */
    public function setUserIds(array $userIds): void
    {
        $this->userIds = $this->normalizeIds($userIds);
    }

    /**
     * @return array<string>
     */
    public function getDepartmentIds(): array
    {
        return $this->departmentIds;
    }

    /**
     * @param array<mixed> $departmentIds
     */
    public function setDepartmentIds(array $departmentIds): void
    {
        $this->departmentIds = $this->normalizeIds($departmentIds);
    }

    public function hasTargets(): bool
    {
        return $this->userIds !== [] || $this->departmentIds !== [];
    }

    public function isEmpty(): bool
    {
        return ! $this->hasTargets();
    }

    public function containsUserId(string $userId): bool
    {
        return in_array(trim($userId), $this->userIds, true);
    }

    public function toArray(): array
    {
        return [
            'user_ids' => $this->userIds,
            'department_ids' => $this->departmentIds,
        ];
    }

    /**
     * @param array<mixed> $ids
     * @return array<string>
     */
    private function normalizeIds(array $ids): array
    {
        return array_values(array_unique(array_filter(array_map(
            static fn (mixed $value) => is_scalar($value) ? trim((string) $value) : '',
            $ids
        ))));
    }
}
