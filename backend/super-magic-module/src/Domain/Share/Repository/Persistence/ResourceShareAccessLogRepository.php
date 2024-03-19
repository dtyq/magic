<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareUserType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareAccessLogEntity;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareAccessLogRepositoryInterface;
use Dtyq\SuperMagic\Domain\Share\Repository\Model\ResourceShareAccessLogModel;

/**
 * 分享访问日志仓储实现.
 */
class ResourceShareAccessLogRepository extends AbstractRepository implements ResourceShareAccessLogRepositoryInterface
{
    public function __construct(
        protected ResourceShareAccessLogModel $model
    ) {
    }

    /**
     * 创建访问日志记录.
     *
     * @param ResourceShareAccessLogEntity $accessLog 访问日志实体
     * @return ResourceShareAccessLogEntity 创建后的实体（包含ID）
     */
    public function create(ResourceShareAccessLogEntity $accessLog): ResourceShareAccessLogEntity
    {
        $attributes = $this->entityToModelAttributes($accessLog);

        // 生成ID
        $attributes['id'] = IdGenerator::getSnowId();

        // 设置创建时间（如果没有设置）
        if (empty($attributes['created_at'])) {
            $attributes['created_at'] = date('Y-m-d H:i:s');
        }

        // 创建记录
        $model = $this->model::query()->create($attributes);

        // 返回实体
        return $this->modelToEntity($model->toArray());
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
        $query = $this->model->newQuery()->where('share_id', $shareId);

        // 时间范围过滤
        if ($startDate !== null) {
            $query->whereDate('access_time', '>=', $startDate);
        }
        if ($endDate !== null) {
            $query->whereDate('access_time', '<=', $endDate);
        }

        // 用户类型过滤
        if ($userType !== null) {
            if ($userType === ShareUserType::Anonymous->value) {
                // 匿名用户包括 anonymous 和 guest 类型
                $query->where(function ($q) {
                    $q->where('user_type', ShareUserType::Anonymous->value)
                        ->orWhere('user_type', ShareUserType::Guest->value)
                        ->orWhereNull('user_id');
                });
            } else {
                $query->where('user_type', $userType);
            }
        }

        // 总访问次数（基于当前过滤条件）
        $totalCount = $query->count();

        // 今日访问次数（在已过滤的基础上，再过滤今日）
        $todayQuery = clone $query;
        $todayCount = $todayQuery->whereDate('access_time', date('Y-m-d'))->count();

        // 团队成员访问人数（去重）
        // 如果已经按 user_type 过滤为 team_member，则统计 team_member 的人数
        // 如果已经按 user_type 过滤为其他类型，则 team_member_count 为 0
        // 如果没有按 user_type 过滤，则统计所有 team_member 的人数
        if ($userType === ShareUserType::TeamMember->value || $userType === null) {
            $teamMemberQuery = $this->model->newQuery()->where('share_id', $shareId);
            if ($startDate !== null) {
                $teamMemberQuery->whereDate('access_time', '>=', $startDate);
            }
            if ($endDate !== null) {
                $teamMemberQuery->whereDate('access_time', '<=', $endDate);
            }
            $teamMemberQuery->where('user_type', ShareUserType::TeamMember->value);
            $teamMemberCount = (int) $teamMemberQuery
                ->whereNotNull('user_id')
                ->selectRaw('COUNT(DISTINCT user_id) as count')
                ->value('count') ?? 0;
        } else {
            // 如果过滤的是其他类型，则 team_member_count 为 0
            $teamMemberCount = 0;
        }

        // 匿名用户访问人数（去重，基于IP地址）
        // guest 类型被归类为匿名用户
        // 如果已经按 user_type 过滤为 anonymous 或 guest，则统计匿名用户的人数
        // 如果已经按 user_type 过滤为 team_member，则 anonymous_count 为 0
        // 如果没有按 user_type 过滤，则统计所有匿名用户的人数
        if ($userType === ShareUserType::Anonymous->value || $userType === ShareUserType::Guest->value || $userType === null) {
            $anonymousQuery = $this->model->newQuery()->where('share_id', $shareId);
            if ($startDate !== null) {
                $anonymousQuery->whereDate('access_time', '>=', $startDate);
            }
            if ($endDate !== null) {
                $anonymousQuery->whereDate('access_time', '<=', $endDate);
            }
            // 如果过滤的是 guest，则只统计 guest 类型；如果过滤的是 anonymous，则统计 anonymous 和 guest；如果没有过滤，则统计所有匿名用户
            if ($userType === ShareUserType::Guest->value) {
                $anonymousQuery->where('user_type', ShareUserType::Guest->value);
            } elseif ($userType === ShareUserType::Anonymous->value) {
                $anonymousQuery->where(function ($q) {
                    $q->where('user_type', ShareUserType::Anonymous->value)
                        ->orWhere('user_type', ShareUserType::Guest->value)
                        ->orWhereNull('user_id');
                });
            } else {
                // 没有过滤，统计所有匿名用户
                $anonymousQuery->where(function ($q) {
                    $q->where('user_type', ShareUserType::Anonymous->value)
                        ->orWhere('user_type', ShareUserType::Guest->value)
                        ->orWhereNull('user_id');
                });
            }
            $anonymousCount = (int) $anonymousQuery
                ->whereNotNull('ip_address')
                ->selectRaw('COUNT(DISTINCT ip_address) as count')
                ->value('count') ?? 0;
        } else {
            // 如果过滤的是 team_member，则 anonymous_count 为 0
            $anonymousCount = 0;
        }

        return [
            'total_count' => $totalCount,
            'today_count' => $todayCount,
            'team_member_count' => $teamMemberCount,
            'anonymous_count' => $anonymousCount,
        ];
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
        $query = $this->model->newQuery()->where('share_id', $shareId);

        // 时间范围过滤
        if ($startDate !== null) {
            $query->whereDate('access_time', '>=', $startDate);
        }
        if ($endDate !== null) {
            $query->whereDate('access_time', '<=', $endDate);
        }

        // 用户类型过滤
        if ($userType !== null) {
            if ($userType === ShareUserType::Anonymous->value) {
                // 匿名用户包括 anonymous 和 guest 类型
                $query->where(function ($q) {
                    $q->where('user_type', ShareUserType::Anonymous->value)
                        ->orWhere('user_type', ShareUserType::Guest->value)
                        ->orWhereNull('user_id');
                });
            } else {
                $query->where('user_type', $userType);
            }
        }

        // 计算总数
        $total = $query->count();

        // 分页查询
        $offset = ($page - 1) * $pageSize;
        $logs = $query->orderBy('access_time', 'desc')
            ->offset($offset)
            ->limit($pageSize)
            ->get();

        // 转换为数组格式
        $list = [];
        foreach ($logs as $log) {
            $list[] = [
                'id' => $log->id,
                'access_time' => $log->access_time,
                'user_type' => $log->user_type,
                'user_id' => $log->user_id,
                'user_name' => $log->user_name,
                'ip_address' => $log->ip_address,
            ];
        }

        return [
            'total' => $total,
            'list' => $list,
        ];
    }

    /**
     * 将实体转换为模型属性数组.
     *
     * @param ResourceShareAccessLogEntity $entity 实体
     * @return array 模型属性数组
     */
    protected function entityToModelAttributes(ResourceShareAccessLogEntity $entity): array
    {
        return [
            'share_id' => $entity->getShareId(),
            'access_time' => $entity->getAccessTime(),
            'user_type' => $entity->getUserType(),
            'user_id' => $entity->getUserId(),
            'user_name' => $entity->getUserName(),
            'organization_code' => $entity->getOrganizationCode(),
            'ip_address' => $entity->getIpAddress(),
            'created_at' => $entity->getCreatedAt(),
        ];
    }

    /**
     * 将模型数组转换为实体.
     *
     * @param array $data 模型数据
     * @return ResourceShareAccessLogEntity 实体
     */
    protected function modelToEntity(array $data): ResourceShareAccessLogEntity
    {
        $entity = new ResourceShareAccessLogEntity();
        $entity->setId((int) ($data['id'] ?? 0));
        $entity->setShareId((int) ($data['share_id'] ?? 0));
        $entity->setAccessTime($data['access_time'] ?? '');
        $entity->setUserType($data['user_type'] ?? '');
        $entity->setUserId($data['user_id'] ?? null);
        $entity->setUserName($data['user_name'] ?? null);
        $entity->setOrganizationCode($data['organization_code'] ?? null);
        $entity->setIpAddress($data['ip_address'] ?? null);
        $entity->setCreatedAt($data['created_at'] ?? null);

        return $entity;
    }
}
