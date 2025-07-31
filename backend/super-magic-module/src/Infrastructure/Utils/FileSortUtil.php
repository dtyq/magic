<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;

/**
 * 文件排序工具类
 * 负责文件排序算法的实现，遵循基础设施层职责.
 */
class FileSortUtil
{
    public const DEFAULT_SORT_STEP = 10000;

    public const MIN_SORT_GAP = 10;

    public const MAX_SORT_VALUE = 9223372036854775807; // bigint 最大值

    /**
     * 计算新文件的排序值
     *
     * @param TaskFileRepositoryInterface $repository 仓储接口
     * @param null|int $parentId 父目录ID
     * @param int $preFileId 前置文件ID，0表示插入第一位，-1表示插入末尾
     * @param int $projectId 项目ID（用于数据隔离）
     * @return int 计算出的排序值
     */
    public static function calculateSortValue(
        TaskFileRepositoryInterface $repository,
        ?int $parentId,
        int $preFileId,
        int $projectId
    ): int {
        if ($preFileId === 0) {
            // 插入到第一位
            return self::calculateFirstPositionSort($repository, $parentId, $projectId);
        }

        if ($preFileId === -1) {
            // 插入到末尾（默认行为）
            return self::calculateLastPositionSort($repository, $parentId, $projectId);
        }

        // 插入到指定文件之后
        return self::calculateAfterPositionSort($repository, $parentId, $preFileId, $projectId);
    }

    /**
     * 批量重排同级别文件.
     *
     * @param TaskFileRepositoryInterface $repository 仓储接口
     * @param null|int $parentId 父目录ID
     * @param int $projectId 项目ID
     * @return array 需要更新的排序数据
     */
    public static function reorderSiblings(
        TaskFileRepositoryInterface $repository,
        ?int $parentId,
        int $projectId
    ): array {
        $siblings = $repository->getSiblingsByParentId($parentId, $projectId, 'sort', 'ASC');

        $updates = [];
        foreach ($siblings as $index => $sibling) {
            $newSort = ($index + 1) * self::DEFAULT_SORT_STEP;
            if ($sibling['sort'] !== $newSort) {
                $updates[] = [
                    'file_id' => $sibling['file_id'],
                    'sort' => $newSort,
                ];
            }
        }

        return $updates;
    }

    /**
     * 获取默认排序值（用于未指定位置的新文件）.
     */
    public static function getDefaultSortValue(
        TaskFileRepositoryInterface $repository,
        ?int $parentId,
        int $projectId
    ): int {
        return self::calculateLastPositionSort($repository, $parentId, $projectId);
    }

    /**
     * 验证排序参数的有效性.
     */
    public static function validateSortParams(?int $parentId, int $preFileId, int $projectId): bool
    {
        // preFileId 为 0 或 -1 时，无需验证
        if ($preFileId <= 0) {
            return true;
        }

        // TODO: 可以添加更多验证逻辑，比如验证 preFileId 是否存在且属于同一父目录
        return true;
    }

    /**
     * 计算插入第一位的排序值
     */
    private static function calculateFirstPositionSort(
        TaskFileRepositoryInterface $repository,
        ?int $parentId,
        int $projectId
    ): int {
        $minSort = $repository->getMinSortByParentId($parentId, $projectId);

        if ($minSort === null) {
            // 没有文件，使用默认值
            return self::DEFAULT_SORT_STEP;
        }

        if ($minSort > self::DEFAULT_SORT_STEP) {
            // 最小值很大，可以使用默认值插入到前面
            return self::DEFAULT_SORT_STEP;
        }

        // 尝试计算一个更小的值，使用一半的步长
        $halfStep = intval(self::DEFAULT_SORT_STEP / 2);
        if ($minSort > $halfStep) {
            return $minSort - $halfStep;
        }

        // 如果最小值太小，无法插入合理的值，需要重排
        // 这里应该触发重排逻辑，暂时返回默认值
        return self::DEFAULT_SORT_STEP;
    }

    /**
     * 计算插入末尾的排序值
     */
    private static function calculateLastPositionSort(
        TaskFileRepositoryInterface $repository,
        ?int $parentId,
        int $projectId
    ): int {
        $maxSort = $repository->getMaxSortByParentId($parentId, $projectId);

        if ($maxSort === null) {
            return self::DEFAULT_SORT_STEP;
        }

        return $maxSort + self::DEFAULT_SORT_STEP;
    }

    /**
     * 计算插入到指定文件后的排序值
     */
    private static function calculateAfterPositionSort(
        TaskFileRepositoryInterface $repository,
        ?int $parentId,
        int $preFileId,
        int $projectId
    ): int {
        $preSort = $repository->getSortByFileId($preFileId);
        if ($preSort === null) {
            // 前置文件不存在，插入到末尾
            return self::calculateLastPositionSort($repository, $parentId, $projectId);
        }

        $nextSort = $repository->getNextSortAfter($parentId, $preSort, $projectId);

        if ($nextSort === null) {
            // 插入到末尾
            return $preSort + self::DEFAULT_SORT_STEP;
        }

        $gap = $nextSort - $preSort;
        if ($gap >= self::MIN_SORT_GAP) {
            return $preSort + intval($gap / 2);
        }

        // 空隙不够，触发重排然后重新计算
        $updates = self::reorderSiblings($repository, $parentId, $projectId);
        if (! empty($updates)) {
            $repository->batchUpdateSort($updates);

            // 重排后重新获取位置信息
            $preSort = $repository->getSortByFileId($preFileId);
            $nextSort = $repository->getNextSortAfter($parentId, $preSort, $projectId);

            if ($nextSort === null) {
                return $preSort + self::DEFAULT_SORT_STEP;
            }

            $newGap = $nextSort - $preSort;
            return $preSort + intval($newGap / 2);
        }

        // 如果重排失败，回退到末尾插入
        return self::calculateLastPositionSort($repository, $parentId, $projectId);
    }
}
