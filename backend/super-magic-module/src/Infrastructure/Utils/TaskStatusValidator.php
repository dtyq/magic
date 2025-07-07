<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;

/**
 * 任务状态验证工具类.
 *
 * 提供状态转换规则验证，防止消息乱序导致的状态竞争问题
 *
 * 状态分类：
 * - 等待状态：WAITING - 可以转换到任何状态
 * - 活跃状态：RUNNING - 只能转换到终态或挂起态
 * - 可恢复状态：Suspended - 只能转换到 WAITING 或终态
 * - 终态状态：FINISHED, ERROR, Stopped - 可以转换到 WAITING 或其他终态
 */
class TaskStatusValidator
{
    /**
     * 验证状态转换是否允许.
     *
     * @param null|TaskStatus $currentStatus 当前状态
     * @param TaskStatus $newStatus 新状态
     * @return bool 是否允许转换
     */
    public static function isTransitionAllowed(?TaskStatus $currentStatus, TaskStatus $newStatus): bool
    {
        // 如果无法获取当前状态，允许转换
        if ($currentStatus === null) {
            return true;
        }

        // 相同状态，允许（幂等操作）
        if ($currentStatus === $newStatus) {
            return true;
        }

        // 应用状态转换规则
        return self::applyTransitionRules($currentStatus, $newStatus);
    }

    /**
     * 获取状态类型描述.
     *
     * @param TaskStatus $status 状态
     * @return string 状态类型
     */
    public static function getStatusType(TaskStatus $status): string
    {
        if (self::isWaitingStatus($status)) {
            return 'waiting';
        }

        if (self::isActiveStatus($status)) {
            return 'active';
        }

        if (self::isFinalStatus($status)) {
            return 'final';
        }

        if ($status === TaskStatus::Suspended) {
            return 'suspended';
        }

        return 'unknown';
    }

    /**
     * 获取拒绝转换的原因.
     *
     * @param TaskStatus $currentStatus 当前状态
     * @param TaskStatus $newStatus 新状态
     * @return string 拒绝原因
     */
    public static function getRejectReason(TaskStatus $currentStatus, TaskStatus $newStatus): string
    {
        if ($currentStatus === TaskStatus::RUNNING && $newStatus === TaskStatus::WAITING) {
            return '运行中的任务不能回到等待状态';
        }

        if ($currentStatus === TaskStatus::RUNNING && ! self::isFinalStatus($newStatus) && $newStatus !== TaskStatus::Suspended) {
            return '运行中的任务只能转换到终态或挂起态';
        }

        if (self::isFinalStatus($currentStatus) && $newStatus === TaskStatus::RUNNING) {
            return '终态任务不能直接转换为运行状态';
        }

        if (self::isFinalStatus($currentStatus) && $newStatus === TaskStatus::Suspended) {
            return '终态任务不能转换为挂起状态';
        }

        if ($currentStatus === TaskStatus::Suspended && $newStatus === TaskStatus::RUNNING) {
            return '挂起任务需要先转换为等待状态才能执行';
        }

        if ($currentStatus === TaskStatus::Suspended && ! self::isFinalStatus($newStatus) && $newStatus !== TaskStatus::WAITING) {
            return '挂起任务只能转换为等待状态或终态';
        }

        return '状态转换不符合业务规则';
    }

    /**
     * 获取允许的下一步状态
     *
     * @param TaskStatus $currentStatus 当前状态
     * @return TaskStatus[] 允许的下一步状态列表
     */
    public static function getAllowedNextStates(TaskStatus $currentStatus): array
    {
        $allowed = [];

        foreach (TaskStatus::cases() as $status) {
            if (self::isTransitionAllowed($currentStatus, $status)) {
                $allowed[] = $status;
            }
        }

        return $allowed;
    }

    /**
     * 验证状态转换链是否合法.
     *
     * @param TaskStatus[] $statusChain 状态转换链
     * @return array 验证结果 ['valid' => bool, 'invalid_step' => int|null, 'reason' => string]
     */
    public static function validateTransitionChain(array $statusChain): array
    {
        if (empty($statusChain)) {
            return ['valid' => true, 'invalid_step' => null, 'reason' => ''];
        }

        $currentStatus = null;

        foreach ($statusChain as $index => $status) {
            if (! $status instanceof TaskStatus) {
                return [
                    'valid' => false,
                    'invalid_step' => $index,
                    'reason' => "步骤 {$index} 包含无效的状态值",
                ];
            }

            if (! self::isTransitionAllowed($currentStatus, $status)) {
                $fromStatus = $currentStatus->value ?? 'null';
                return [
                    'valid' => false,
                    'invalid_step' => $index,
                    'reason' => "步骤 {$index}: {$fromStatus} → {$status->value} 转换不被允许",
                ];
            }

            $currentStatus = $status;
        }

        return ['valid' => true, 'invalid_step' => null, 'reason' => ''];
    }

    /**
     * 应用状态转换规则.
     *
     * @param TaskStatus $currentStatus 当前状态
     * @param TaskStatus $newStatus 新状态
     * @return bool 是否允许转换
     */
    private static function applyTransitionRules(TaskStatus $currentStatus, TaskStatus $newStatus): bool
    {
        // 规则1：等待态可以转换到任何状态
        if (self::isWaitingStatus($currentStatus)) {
            return true;
        }

        // 规则2：活跃态只能转换到终态或挂起态
        if (self::isActiveStatus($currentStatus)) {
            return $newStatus === TaskStatus::Suspended || self::isFinalStatus($newStatus);
        }

        // 规则3：挂起态只能转换到 WAITING 或终态
        if ($currentStatus === TaskStatus::Suspended) {
            return $newStatus === TaskStatus::WAITING || self::isFinalStatus($newStatus);
        }

        // 规则4：终态只能转换到 WAITING 或其他终态
        if (self::isFinalStatus($currentStatus)) {
            return $newStatus === TaskStatus::WAITING || self::isFinalStatus($newStatus);
        }

        // 默认允许（未知状态组合）
        return true;
    }

    /**
     * 判断是否为等待状态
     *
     * @param TaskStatus $status 状态
     * @return bool 是否为等待状态
     */
    private static function isWaitingStatus(TaskStatus $status): bool
    {
        return $status === TaskStatus::WAITING;
    }

    /**
     * 判断是否为活跃状态
     *
     * @param TaskStatus $status 状态
     * @return bool 是否为活跃状态
     */
    private static function isActiveStatus(TaskStatus $status): bool
    {
        return $status === TaskStatus::RUNNING;
    }

    /**
     * 判断是否为终态状态
     *
     * @param TaskStatus $status 状态
     * @return bool 是否为终态状态
     */
    private static function isFinalStatus(TaskStatus $status): bool
    {
        return in_array($status, [
            TaskStatus::FINISHED,
            TaskStatus::ERROR,
            TaskStatus::Stopped,
        ], true);
    }
}
