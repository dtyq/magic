<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Persistence;

use Dtyq\SuperMagic\Domain\Share\Constant\ShareUserType;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareCopyLogRepositoryInterface;
use Hyperf\DbConnection\Db;

/**
 * 分享复制日志仓储实现.
 * 注意：复制日志数据来自 magic_super_agent_project_fork 表（SuperAgent领域），
 * 但查询逻辑是Share领域的业务逻辑（按组织代码判断用户类型等），所以在此封装。
 */
class ResourceShareCopyLogRepository implements ResourceShareCopyLogRepositoryInterface
{
    /**
     * 获取分享的复制统计信息.
     *
     * @param int $sourceProjectId 源项目ID（分享关联的项目ID）
     * @param string $shareOrganizationCode 分享的组织代码（用于判断用户类型）
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member），为null则不限
     * @param bool $includeDeletedProjects 是否包含已删除项目的复制记录，默认false（不包含）
     * @return array 统计信息
     */
    public function getCopyStatistics(
        int $sourceProjectId,
        string $shareOrganizationCode,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null,
        bool $includeDeletedProjects = false
    ): array {
        $query = Db::table('magic_super_agent_project_fork')
            ->where('source_project_id', $sourceProjectId)
            ->where('status', 'finished'); // 只统计已完成的复制

        // 根据参数决定是否过滤已删除的项目
        if (! $includeDeletedProjects) {
            $query->join(
                'magic_super_agent_project',
                'magic_super_agent_project_fork.source_project_id',
                '=',
                'magic_super_agent_project.id'
            )
                ->whereNull('magic_super_agent_project.deleted_at');
        }

        // 时间范围过滤（需要指定表名，避免 JOIN 后字段歧义）
        if ($startDate !== null) {
            $query->whereDate('magic_super_agent_project_fork.created_at', '>=', $startDate);
        }
        if ($endDate !== null) {
            $query->whereDate('magic_super_agent_project_fork.created_at', '<=', $endDate);
        }

        // 用户类型过滤（通过组织代码判断）
        // 注意：复制操作需要登录（路由使用UserAuthMiddleware），所以不会有匿名用户
        if ($userType !== null) {
            if ($userType === ShareUserType::TeamMember->value) {
                $query->where('magic_super_agent_project_fork.user_organization_code', $shareOrganizationCode);
            } elseif ($userType === ShareUserType::Guest->value) {
                $query->where('magic_super_agent_project_fork.user_organization_code', '!=', $shareOrganizationCode);
            }
        }

        // 统计总数
        $totalCount = (int) $query->count();

        // 统计今日数（需要重新构建查询，因为上面已经执行了count）
        // 先判断今天是否在时间范围内，如果不在则直接返回0
        $today = date('Y-m-d');
        $isTodayInRange = true;
        if ($startDate !== null && $today < $startDate) {
            $isTodayInRange = false;
        }
        if ($endDate !== null && $today > $endDate) {
            $isTodayInRange = false;
        }

        if ($isTodayInRange) {
            // 今天在时间范围内，统计今日数据
            $todayQuery = Db::table('magic_super_agent_project_fork')
                ->where('source_project_id', $sourceProjectId)
                ->where('status', 'finished')
                ->whereDate('magic_super_agent_project_fork.created_at', $today);

            // 根据参数决定是否过滤已删除的项目
            if (! $includeDeletedProjects) {
                $todayQuery->join(
                    'magic_super_agent_project',
                    'magic_super_agent_project_fork.source_project_id',
                    '=',
                    'magic_super_agent_project.id'
                )
                    ->whereNull('magic_super_agent_project.deleted_at');
            }
            // 应用时间范围过滤（虽然今天已经在范围内，但为了保持一致性还是加上）
            if ($startDate !== null) {
                $todayQuery->whereDate('magic_super_agent_project_fork.created_at', '>=', $startDate);
            }
            if ($endDate !== null) {
                $todayQuery->whereDate('magic_super_agent_project_fork.created_at', '<=', $endDate);
            }
            // 应用用户类型过滤
            if ($userType === ShareUserType::TeamMember->value) {
                $todayQuery->where('magic_super_agent_project_fork.user_organization_code', $shareOrganizationCode);
            } elseif ($userType === ShareUserType::Guest->value) {
                $todayQuery->where('magic_super_agent_project_fork.user_organization_code', '!=', $shareOrganizationCode);
            }
            $todayCount = (int) $todayQuery->count();
        } else {
            // 今天不在时间范围内，今日统计为0
            $todayCount = 0;
        }

        // 统计团队成员数（去重）
        // 注意：复制操作需要登录，所以不会有匿名用户
        if ($userType === ShareUserType::Guest->value) {
            // 如果过滤了 guest，则团队成员数为0
            $teamMemberCount = 0;
        } else {
            $teamMemberQuery = Db::table('magic_super_agent_project_fork')
                ->where('source_project_id', $sourceProjectId)
                ->where('status', 'finished')
                ->where('magic_super_agent_project_fork.user_organization_code', $shareOrganizationCode);

            // 根据参数决定是否过滤已删除的项目
            if (! $includeDeletedProjects) {
                $teamMemberQuery->join(
                    'magic_super_agent_project',
                    'magic_super_agent_project_fork.source_project_id',
                    '=',
                    'magic_super_agent_project.id'
                )
                    ->whereNull('magic_super_agent_project.deleted_at');
            }

            if ($startDate !== null) {
                $teamMemberQuery->whereDate('magic_super_agent_project_fork.created_at', '>=', $startDate);
            }
            if ($endDate !== null) {
                $teamMemberQuery->whereDate('magic_super_agent_project_fork.created_at', '<=', $endDate);
            }
            $teamMemberCount = (int) $teamMemberQuery
                ->selectRaw('COUNT(DISTINCT magic_super_agent_project_fork.user_id) as count')
                ->value('count') ?? 0;
        }

        // 统计游客数（去重）
        if ($userType === ShareUserType::TeamMember->value) {
            // 如果过滤了 team_member，则游客数为0
            $guestCount = 0;
        } else {
            $guestQuery = Db::table('magic_super_agent_project_fork')
                ->where('source_project_id', $sourceProjectId)
                ->where('status', 'finished')
                ->where('magic_super_agent_project_fork.user_organization_code', '!=', $shareOrganizationCode);

            // 根据参数决定是否过滤已删除的项目
            if (! $includeDeletedProjects) {
                $guestQuery->join(
                    'magic_super_agent_project',
                    'magic_super_agent_project_fork.source_project_id',
                    '=',
                    'magic_super_agent_project.id'
                )
                    ->whereNull('magic_super_agent_project.deleted_at');
            }

            if ($startDate !== null) {
                $guestQuery->whereDate('magic_super_agent_project_fork.created_at', '>=', $startDate);
            }
            if ($endDate !== null) {
                $guestQuery->whereDate('magic_super_agent_project_fork.created_at', '<=', $endDate);
            }
            $guestCount = (int) $guestQuery
                ->selectRaw('COUNT(DISTINCT magic_super_agent_project_fork.user_id) as count')
                ->value('count') ?? 0;
        }

        return [
            'total_count' => $totalCount,
            'today_count' => $todayCount,
            'team_member_count' => $teamMemberCount,
            'guest_count' => $guestCount,
        ];
    }

    /**
     * 获取分享的复制日志列表.
     *
     * @param int $sourceProjectId 源项目ID（分享关联的项目ID）
     * @param string $shareOrganizationCode 分享的组织代码（用于判断用户类型）
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member），为null则不限
     * @param bool $includeDeletedProjects 是否包含已删除项目的复制记录，默认false（不包含）
     * @return array 包含 total 和 list 的数组
     */
    public function getCopyLogs(
        int $sourceProjectId,
        string $shareOrganizationCode,
        int $page = 1,
        int $pageSize = 20,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null,
        bool $includeDeletedProjects = false
    ): array {
        $query = Db::table('magic_super_agent_project_fork')
            ->where('source_project_id', $sourceProjectId)
            ->where('status', 'finished'); // 只返回已完成的复制

        // 根据参数决定是否过滤已删除的项目
        if (! $includeDeletedProjects) {
            $query->join(
                'magic_super_agent_project',
                'magic_super_agent_project_fork.source_project_id',
                '=',
                'magic_super_agent_project.id'
            )
                ->whereNull('magic_super_agent_project.deleted_at');
        }

        // 时间范围过滤（需要指定表名，避免 JOIN 后字段歧义）
        if ($startDate !== null) {
            $query->whereDate('magic_super_agent_project_fork.created_at', '>=', $startDate);
        }
        if ($endDate !== null) {
            $query->whereDate('magic_super_agent_project_fork.created_at', '<=', $endDate);
        }

        // 用户类型过滤（通过组织代码判断）
        // 注意：复制操作需要登录（路由使用UserAuthMiddleware），所以不会有匿名用户
        if ($userType !== null) {
            if ($userType === ShareUserType::TeamMember->value) {
                $query->where('magic_super_agent_project_fork.user_organization_code', $shareOrganizationCode);
            } elseif ($userType === ShareUserType::Guest->value) {
                $query->where('magic_super_agent_project_fork.user_organization_code', '!=', $shareOrganizationCode);
            }
        }

        // 计算总数
        $total = (int) $query->count();

        // 分页查询（需要指定表名和字段，避免 JOIN 后字段歧义）
        $offset = ($page - 1) * $pageSize;
        $logs = $query->select([
            'magic_super_agent_project_fork.id',
            'magic_super_agent_project_fork.user_id',
            'magic_super_agent_project_fork.user_organization_code',
            'magic_super_agent_project_fork.created_at',
        ])
            ->orderBy('magic_super_agent_project_fork.created_at', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get();

        // 转换为数组格式，并判断用户类型
        // 注意：复制操作需要登录（路由使用UserAuthMiddleware），所以只会有team_member和guest
        $list = [];
        foreach ($logs as $log) {
            // 判断用户类型：同组织为团队成员，跨组织为游客
            $userTypeValue = ($log->user_organization_code === $shareOrganizationCode) ? ShareUserType::TeamMember->value : ShareUserType::Guest->value;

            $list[] = [
                'id' => $log->id,
                'copy_time' => $log->created_at, // 复制时间（完整时间戳，前端自行拆分）
                'user_type' => $userTypeValue,
                'user_id' => $log->user_id,
                'user_name' => null, // 需要后续批量查询填充
                'user_organization_code' => $log->user_organization_code,
            ];
        }

        return [
            'total' => $total,
            'list' => $list,
        ];
    }
}
