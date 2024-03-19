<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Facade;

use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareAccessLogEntity;

/**
 * 分享访问日志仓储接口.
 */
interface ResourceShareAccessLogRepositoryInterface
{
    /**
     * 创建访问日志记录.
     *
     * @param ResourceShareAccessLogEntity $accessLog 访问日志实体
     * @return ResourceShareAccessLogEntity 创建后的实体（包含ID）
     */
    public function create(ResourceShareAccessLogEntity $accessLog): ResourceShareAccessLogEntity;

    /**
     * 获取分享的访问统计信息.
     *
     * @param int $shareId 分享ID
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member/anonymous），为null则不限
     * @return array 统计信息，包含：
     *               - total_count: 总访问次数
     *               - today_count: 今日访问次数
     *               - team_member_count: 团队成员访问人数
     *               - anonymous_count: 匿名用户访问人数
     */
    public function getAccessStatistics(
        int $shareId,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null
    ): array;

    /**
     * 获取分享的访问日志列表.
     *
     * @param int $shareId 分享ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member/anonymous），为null则不限
     * @return array 包含 total 和 list 的数组
     */
    public function getAccessLogs(
        int $shareId,
        int $page = 1,
        int $pageSize = 20,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null
    ): array;
}
