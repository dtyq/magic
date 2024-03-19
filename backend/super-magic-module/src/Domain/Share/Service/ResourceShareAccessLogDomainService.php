<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Service;

use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareAccessLogEntity;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareAccessLogRepositoryInterface;

/**
 * 分享访问日志领域服务.
 */
class ResourceShareAccessLogDomainService
{
    public function __construct(
        protected ResourceShareAccessLogRepositoryInterface $accessLogRepository
    ) {
    }

    /**
     * 记录访问日志.
     *
     * @param int $shareId 分享ID
     * @param string $userType 用户类型（guest/team_member/anonymous）
     * @param null|string $userId 用户ID（登录用户有值，匿名用户为NULL）
     * @param null|string $userName 用户名（登录用户有值）
     * @param null|string $organizationCode 访问者的组织代码（登录用户有值，匿名用户为NULL）
     * @param null|string $ipAddress IP地址
     * @return ResourceShareAccessLogEntity 创建的访问日志实体
     */
    public function recordAccessLog(
        int $shareId,
        string $userType,
        ?string $userId = null,
        ?string $userName = null,
        ?string $organizationCode = null,
        ?string $ipAddress = null
    ): ResourceShareAccessLogEntity {
        $accessLog = new ResourceShareAccessLogEntity();
        $accessLog->setShareId($shareId);
        $accessLog->setAccessTime(date('Y-m-d H:i:s'));
        $accessLog->setUserType($userType);
        $accessLog->setUserId($userId);
        $accessLog->setUserName($userName);
        $accessLog->setOrganizationCode($organizationCode);
        $accessLog->setIpAddress($ipAddress);

        return $this->accessLogRepository->create($accessLog);
    }

    /**
     * 获取分享的访问统计信息.
     *
     * @param int $shareId 分享ID
     * @param null|string $startDate 开始日期（格式：Y-m-d），为null则不限
     * @param null|string $endDate 结束日期（格式：Y-m-d），为null则不限
     * @param null|string $userType 用户类型（guest/team_member/anonymous），为null则不限
     * @return array 统计信息
     */
    public function getAccessStatistics(
        int $shareId,
        ?string $startDate = null,
        ?string $endDate = null,
        ?string $userType = null
    ): array {
        return $this->accessLogRepository->getAccessStatistics($shareId, $startDate, $endDate, $userType);
    }

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
    ): array {
        return $this->accessLogRepository->getAccessLogs($shareId, $page, $pageSize, $startDate, $endDate, $userType);
    }
}
