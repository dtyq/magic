<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence;

use App\Domain\Agent\Constant\MagicAgentReleaseStatus;
use App\Domain\Agent\Constant\MagicAgentVersionStatus;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Factory\MagicAgentVersionFactory;
use App\Domain\Agent\Repository\Facade\MagicAgentVersionRepositoryInterface;
use App\Domain\Agent\Repository\Persistence\Model\MagicAgentVersionModel;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;

class MagicAgentVersionRepository implements MagicAgentVersionRepositoryInterface
{
    public function __construct(public MagicAgentVersionModel $agentVersionModel)
    {
    }

    /**
     * 获取助理版本.
     */
    public function getAgentById(string $id): MagicAgentVersionEntity
    {
        $model = $this->agentVersionModel::query()
            ->where('id', $id)
            ->first();
        if (! $model) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.agent_does_not_exist');
        }
        return MagicAgentVersionFactory::toEntity($model->toArray());
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function getAgentsByOrganization(string $organizationCode, array $agentIds, int $page, int $pageSize, string $agentName, ?string $descriptionKeyword = null): array
    {
        $offset = ($page - 1) * $pageSize;

        $builder = $this->agentVersionModel::query();
        $query = $builder
            ->where('organization_code', $organizationCode)
            ->where('enterprise_release_status', MagicAgentVersionStatus::ENTERPRISE_PUBLISHED->value)
            ->whereIn('id', $agentIds)
            ->where(function (Builder $query) use ($agentName, $descriptionKeyword) {
                $query
                    ->when(! empty($agentName), function (Builder $query) use ($agentName) {
                        $query->orWhere('robot_name', 'like', "%{$agentName}%");
                    })
                    ->when(! empty($descriptionKeyword), function (Builder $query) use ($descriptionKeyword) {
                        $query->orWhere('robot_description', 'like', "%{$descriptionKeyword}%");
                    });
            })
            ->orderByDesc('id')
            ->skip($offset)
            ->take($pageSize);

        $result = Db::select($query->toSql(), $query->getBindings());
        return MagicAgentVersionFactory::toEntities($result);
    }

    public function getAgentsByOrganizationCount(string $organizationCode, array $agentIds, string $agentName): int
    {
        $builder = $this->agentVersionModel::query();
        if (! empty($agentName)) {
            $builder->where('robot_name', 'like', "%{$agentName}%");
        }
        return $builder
            ->where('organization_code', $organizationCode)
            ->where('enterprise_release_status', MagicAgentVersionStatus::ENTERPRISE_PUBLISHED->value) // 确保外层筛选启用状态
            ->whereIn('id', $agentIds)
            ->count();
    }

    /**
     * 优化版本：直接通过JOIN查询获取启用的助理版本，避免传入大量ID.
     * @return MagicAgentVersionEntity[]
     */
    public function getEnabledAgentsByOrganization(string $organizationCode, int $page, int $pageSize, string $agentName): array
    {
        $offset = ($page - 1) * $pageSize;

        $query = $this->agentVersionModel::query()
            ->select('magic_bot_versions.*')
            ->join('magic_bots', 'magic_bots.bot_version_id', '=', 'magic_bot_versions.id')
            ->where('magic_bot_versions.organization_code', $organizationCode)
            ->where('magic_bot_versions.enterprise_release_status', MagicAgentVersionStatus::ENTERPRISE_PUBLISHED->value)
            ->where('magic_bots.organization_code', $organizationCode)
            ->where('magic_bots.status', MagicAgentVersionStatus::ENTERPRISE_ENABLED->value)
            ->when(! empty($agentName), function ($query) use ($agentName) {
                $query->where('magic_bot_versions.robot_name', 'like', "%{$agentName}%");
            })
            ->orderByDesc('magic_bot_versions.id')
            ->skip($offset)
            ->take($pageSize);

        $result = Db::select($query->toSql(), $query->getBindings());
        return MagicAgentVersionFactory::toEntities($result);
    }

    /**
     * 优化版本：获取启用助理的总数.
     */
    public function getEnabledAgentsByOrganizationCount(string $organizationCode, string $agentName): int
    {
        return $this->agentVersionModel::query()
            ->join('magic_bots', 'magic_bots.bot_version_id', '=', 'magic_bot_versions.id')
            ->where('magic_bot_versions.organization_code', $organizationCode)
            ->where('magic_bot_versions.enterprise_release_status', MagicAgentVersionStatus::ENTERPRISE_PUBLISHED->value)
            ->where('magic_bots.organization_code', $organizationCode)
            ->where('magic_bots.status', MagicAgentVersionStatus::ENTERPRISE_ENABLED->value)
            ->when(! empty($agentName), function ($query) use ($agentName) {
                $query->where('magic_bot_versions.robot_name', 'like', "%{$agentName}%");
            })
            ->count();
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function getAgentsFromMarketplace(array $agentIds, int $page, int $pageSize): array
    {
        $offset = ($page - 1) * $pageSize;
        $query = $this->agentVersionModel::query()
            ->whereIn('id', $agentIds)
            ->where('app_market_status', MagicAgentVersionStatus::APP_MARKET_LISTED)
            ->orderByDesc('id')
            ->skip($offset)
            ->take($pageSize);

        $result = Db::select($query->toSql(), $query->getBindings());
        return MagicAgentVersionFactory::toEntities($result);
    }

    public function getAgentsFromMarketplaceCount(array $agentIds): int
    {
        // 使用 count() 方法来统计符合条件的记录数
        return $this->agentVersionModel::query()
            ->whereIn('id', $agentIds)
            ->where('app_market_status', MagicAgentVersionStatus::APP_MARKET_LISTED)
            ->orderByDesc('id')
            ->count();
    }

    public function insert(MagicAgentVersionEntity $agentVersionEntity): MagicAgentVersionEntity
    {
        $agentVersionEntity->setCreatedAt(date('Y-m-d H:i:s'));
        $agentVersionEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $entityArray = $agentVersionEntity->toArray();
        $entityArray['visibility_config'] = Json::encode($agentVersionEntity->getVisibilityConfig());
        $model = $this->agentVersionModel::query()->create($entityArray);
        $agentVersionEntity->setId($model->id);
        return $agentVersionEntity;
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function getReleaseAgentVersions(string $agentId): array
    {
        $query = $this->agentVersionModel::query()
            ->where('root_id', $agentId)
            ->orderByDesc('id');

        $result = Db::select($query->toSql(), $query->getBindings());
        return MagicAgentVersionFactory::toEntities($result);
    }

    public function setEnterpriseStatus(string $id, int $status): void
    {
        // 尝试更新指定 ID 的记录
        $this->agentVersionModel::query()
            ->where('id', $id)
            ->update(['enterprise_release_status' => $status]);
    }

    // 根据助理id获取最大的 version_number
    public function getAgentMaxVersion(string $agentId): string
    {
        // 查询指定 agent_id 和 user_id 下的最大版本号,这里不能用 max 取 version，因为会出现 0.3 大于 0.10的情况，但是实际是 0.10大于 0.3
        // 而版本号只能递增，因此用时间倒序取第一个即可
        $maxVersion = $this->agentVersionModel::query()
            ->where('root_id', $agentId)
            ->orderByDesc('id')
            ->limit(1)->first();

        // 如果没有找到记录，返回 0.0 作为默认值
        if ($maxVersion === null) {
            return '0.0.0';
        }

        return $maxVersion->toArray()['version_number'];
    }

    public function deleteByAgentId(string $agentId, string $organizationCode): void
    {
        // 查询指定 agent_id 和 user_id 下的最大版本号
        $this->agentVersionModel::query()
            ->where('root_id', $agentId)
            ->where('organization_code', $organizationCode)
            ->delete();
    }

    public function getDefaultVersions(array $agentIds): void
    {
    }

    /**
     * @return MagicAgentVersionEntity[]
     */
    public function listAgentVersionsByIds(array $agentVersionIds): array
    {
        $query = $this->agentVersionModel::query()->whereIn('id', $agentVersionIds);
        $result = Db::select($query->toSql(), $query->getBindings());
        return MagicAgentVersionFactory::toEntities($result);
    }

    public function updateAgentEnterpriseStatus(string $agentVersionId, int $status): void
    {
        $this->agentVersionModel::query()
            ->where('id', $agentVersionId)
            ->update(['enterprise_release_status' => $status]);
    }

    public function getNewestAgentVersionEntity(string $agentId): ?MagicAgentVersionEntity
    {
        // 获取 $agentId 通过
        $model = $this->agentVersionModel::query()
            ->where('root_id', $agentId)
            ->orderByDesc('id')
            ->limit(1)->first();
        if ($model === null) {
            return $model;
        }
        return MagicAgentVersionFactory::toEntity($model->toArray());
    }

    public function getAgentByFlowCode(string $flowCode): ?MagicAgentVersionEntity
    {
        // 获取 $agentId 通过
        $model = $this->agentVersionModel::query()
            ->where('flow_code', $flowCode)
            ->orderByDesc('id')
            ->limit(1)->first();
        if ($model === null) {
            return null;
        }
        return MagicAgentVersionFactory::toEntity($model->toArray());
    }

    public function getEnterpriseAvailableAgentIds(string $organizationCode): array
    {
        return $this->agentVersionModel::query()
            ->where('organization_code', $organizationCode)
            ->where('release_scope', MagicAgentReleaseStatus::PUBLISHED_TO_ENTERPRISE->value)
            ->groupBy('root_id')
            ->pluck('root_id')->toArray();
    }

    public function getAgentVersionsByBatch(int $offset, int $limit): array
    {
        return $this->agentVersionModel::query()
            ->orderBy('id')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->toArray();
    }

    public function updateById(MagicAgentVersionEntity $agentVersionEntity): MagicAgentVersionEntity
    {
        $model = $this->agentVersionModel::query()
            ->where('id', $agentVersionEntity->getId())
            ->first();
        if (! $model) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.agent_does_not_exist');
        }
        $model->fill($agentVersionEntity->toArray());
        $model->save();
        unset($model['agent_id'],$model['agent_name'],$model['agent_avatar'],$model['agent_description']);
        return MagicAgentVersionFactory::toEntity($model->toArray());
    }

    /**
     * 基于游标分页获取指定组织的助理版本列表.
     * @param string $organizationCode 组织代码
     * @param array $agentVersionIds 助理版本ID列表
     * @param string $cursor 游标ID，如果为空字符串则从最新开始
     * @param int $pageSize 每页数量
     */
    public function getAgentsByOrganizationWithCursor(string $organizationCode, array $agentVersionIds, string $cursor, int $pageSize): array
    {
        $query = $this->agentVersionModel::query()
            ->where('organization_code', $organizationCode)
            ->whereIn('id', $agentVersionIds)
            ->orderBy('id', 'desc')
            ->limit($pageSize);

        if ($cursor !== '') {
            $query->where('id', '<', (int) $cursor);
        }

        return Db::select($query->toSql(), $query->getBindings());
    }

    /**
     * 根据ids获取助理版本.
     * @return array<MagicAgentVersionEntity>
     */
    public function getAgentByIds(array $ids)
    {
        $model = $this->agentVersionModel::query()
            ->whereIn('id', $ids)
            ->get();
        return MagicAgentVersionFactory::toEntities($model->toArray());
    }
}
