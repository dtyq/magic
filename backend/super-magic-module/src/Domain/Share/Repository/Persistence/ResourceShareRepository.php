<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Persistence;

use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareFilterType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareRepositoryInterface;
use Dtyq\SuperMagic\Domain\Share\Repository\Model\ResourceShareModel;
use Dtyq\SuperMagic\Domain\Share\Repository\ValueObject\ResourceShareQueryVO;
use Exception;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;
use Throwable;

/**
 * 资源分享仓储实现.
 */
class ResourceShareRepository extends AbstractRepository implements ResourceShareRepositoryInterface
{
    /**
     * 构造函数.
     */
    public function __construct(protected ResourceShareModel $model)
    {
    }

    /**
     * 通过ID获取分享.
     *
     * @param int $shareId 分享ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareById(int $shareId): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()->where('id', $shareId)->whereNull('deleted_at')->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 通过分享码获取分享.
     *
     * @param string $shareCode 分享码
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareByCode(string $shareCode): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()
            ->where('share_code', $shareCode)
            ->whereNull('deleted_at')
            ->orderBy('id', 'desc')
            ->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    public function getShareByResourceId(string $resourceId): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()->where('resource_id', $resourceId)->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 通过资源ID获取分享（包括已删除的记录）.
     *
     * @param string $resourceId 资源ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareByResourceIdWithTrashed(string $resourceId): ?ResourceShareEntity
    {
        /** @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
        $model = $this->model->newQuery()->withTrashed()->where('resource_id', $resourceId)->first();
        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 查找资源对应的分享.
     *
     * @param string $resourceId 资源ID
     * @param ResourceType $resourceType 资源类型
     * @param string $userId 用户ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function findByResource(string $resourceId, ResourceType $resourceType, string $userId): ?ResourceShareEntity
    {
        $model = $this->model->newQuery()
            ->where('resource_id', $resourceId)
            ->where('resource_type', $resourceType->value)
            ->where('creator', $userId)
            ->first();

        return $model ? $this->modelToEntity($model) : null;
    }

    /**
     * 创建分享记录.
     *
     * @param array $data 分享数据
     * @return string 分享ID
     */
    public function create(array $data): string
    {
        $model = new $this->model();
        $model->fill($data);
        $model->save();

        return (string) $model->id;
    }

    /**
     * 保存分享实体.
     *
     * @param ResourceShareEntity $shareEntity 资源分享实体
     * @return ResourceShareEntity 保存后的资源分享实体
     * @throws Exception
     */
    public function save(ResourceShareEntity $shareEntity): ResourceShareEntity
    {
        $data = $this->entityToArray($shareEntity);

        try {
            if ($shareEntity->getId() === 0) {
                // 创建新记录
                $data['id'] = IdGenerator::getSnowId();
                $model = $this->model::query()->create($data);
                $shareEntity->setId((int) $model->id);
            } else {
                // 更新现有记录
                /* @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
                $this->model->query()->withTrashed()->where('id', $shareEntity->getId())->update($data);
            }
            return $shareEntity;
        } catch (Exception $e) {
            throw new Exception('保存分享失败：' . $e->getMessage());
        }
    }

    /**
     * 删除分享.
     *
     * @param int $shareId 分享ID
     * @param bool $forceDelete 是否强制删除（物理删除），默认false为软删除
     * @return bool 是否成功
     */
    public function delete(int $shareId, bool $forceDelete = false): bool
    {
        if ($forceDelete) {
            // 物理删除：直接从数据库删除
            /** @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
            $model = $this->model->newQuery()->withTrashed()->find($shareId);
            if ($model) {
                return $model->forceDelete();
            }
        } else {
            // 软删除：使用 SoftDeletes trait
            $model = $this->model->newQuery()->find($shareId);
            if ($model) {
                return $model->delete();
            }
        }
        return false;
    }

    /**
     * 增加分享查看次数.
     *
     * @param string $shareCode 分享码
     * @return bool 是否成功
     */
    public function incrementViewCount(string $shareCode): bool
    {
        $result = $this->model->newQuery()
            ->where('share_code', $shareCode)
            ->increment('view_count');

        return $result > 0;
    }

    /**
     * 通过分享ID增加分享查看次数（原子操作，解决并发问题）.
     *
     * @param int $shareId 分享ID
     * @return bool 是否成功
     */
    public function incrementViewCountByShareId(int $shareId): bool
    {
        $result = $this->model->newQuery()
            ->where('id', $shareId)
            ->increment('view_count');

        return $result > 0;
    }

    /**
     * 检查分享码是否已存在.
     *
     * @param string $shareCode 分享码
     * @return bool 是否已存在
     */
    public function isShareCodeExists(string $shareCode): bool
    {
        return $this->model->newQuery()->where('share_code', $shareCode)->exists();
    }

    /**
     * 获取分享记录列表.
     *
     * @param ResourceShareQueryVO $queryVO 查询条件值对象
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 分页数据 [total, list]
     */
    public function paginate(ResourceShareQueryVO $queryVO, int $page = 1, int $pageSize = 20): array
    {
        $query = $this->model->newQuery();

        // 构建普通 WHERE 条件
        if ($queryVO->getCreatedUid() !== null) {
            $query->where('magic_resource_shares.created_uid', $queryVO->getCreatedUid());
        }

        // 处理 resource_type：支持单个值或数组
        if ($queryVO->getResourceType() !== null) {
            if ($queryVO->isResourceTypeArray()) {
                $query->whereIn('magic_resource_shares.resource_type', $queryVO->getResourceTypes());
            } else {
                $query->where('magic_resource_shares.resource_type', $queryVO->getResourceType());
            }
        }

        // Filter by project_id
        if ($queryVO->getProjectId() !== null) {
            $query->where('magic_resource_shares.project_id', $queryVO->getProjectId());
        }

        // 话题类型特殊处理：不返回已取消的分享
        $resourceTypes = $queryVO->getResourceTypes();
        $isOnlyTopicType = ! empty($resourceTypes)
            && count($resourceTypes) === 1
            && $resourceTypes[0] === ResourceType::Topic->value;

        if ($isOnlyTopicType) {
            // 话题类型：不返回已取消的分享，一次性返回全部未取消的记录（active + expired）
            $query->whereNull('magic_resource_shares.deleted_at');
        } else {
            // 其他资源类型的原有逻辑
            $filterType = $queryVO->getFilterType();
            switch ($filterType) {
                case ShareFilterType::Active->value:  // 分享中
                    $query->where('magic_resource_shares.is_enabled', 1)  // 显式使用整数
                        ->whereNull('magic_resource_shares.deleted_at')
                        ->where(function ($q) {
                            $q->whereNull('magic_resource_shares.expire_at')
                                ->orWhere('magic_resource_shares.expire_at', '>', date('Y-m-d H:i:s'));
                        });
                    break;
                case ShareFilterType::Expired->value:  // 已失效（包括被禁用或已过期）
                    $query->whereNull('magic_resource_shares.deleted_at')
                        ->where(function ($q) {
                            // 条件1: 未启用（被禁用） - 显式使用整数 0
                            $q->where('magic_resource_shares.is_enabled', 0)
                              // 条件2: 已过期
                                ->orWhere(function ($q2) {
                                    $q2->whereNotNull('magic_resource_shares.expire_at')
                                        ->where('magic_resource_shares.expire_at', '<=', date('Y-m-d H:i:s'));
                                });
                        });
                    break;
                case ShareFilterType::Cancelled->value:  // 已取消
                    /* @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
                    $query->withTrashed()  // 移除 SoftDeletes 的全局作用域
                        ->whereNotNull('magic_resource_shares.deleted_at');
                    break;
                case ShareFilterType::All->value:  // 全部 - 包含软删除的记录
                default:
                    /* @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
                    $query->withTrashed();
                    break;
            }
        }

        // 处理 keyword 搜索（根据资源类型）
        if ($queryVO->hasKeyword() && $queryVO->getResourceType() !== null) {
            $keyword = $queryVO->getKeyword();
            // 转义 LIKE 特殊字符，防止通配符注入
            // 使用 str_replace 转义，避免 addcslashes 可能的问题
            $keyword = str_replace(['%', '_', '\\'], ['\%', '\_', '\\\\'], $keyword);
            $resourceTypes = $queryVO->getResourceTypes(); // 获取资源类型数组

            // 支持多种资源类型组合的关键词搜索
            $this->applyKeywordSearch($query, $resourceTypes, $keyword);
        }

        // 为文件集类型和单文件类型添加 copy_count 关联查询（使用子查询）
        // 注意：必须在所有其他 JOIN 之后添加，避免影响 LEFT JOIN 的结果
        $resourceTypes = $queryVO->getResourceTypes();
        $hasFileCollectionType = ! empty($resourceTypes) && in_array(ResourceType::FileCollection->value, $resourceTypes, true);
        $hasFileType = ! empty($resourceTypes) && in_array(ResourceType::File->value, $resourceTypes, true);
        // 文件集类型或单文件类型都需要统计 copy_count
        $hasFileOrFileCollectionType = $hasFileCollectionType || $hasFileType;
        $isSingleFileCollectionType = count($resourceTypes) === 1 && $resourceTypes[0] == ResourceType::FileCollection->value;
        $hasKeywordSearch = $queryVO->hasKeyword() && $isSingleFileCollectionType;

        // 添加 view_count 统计：从访问日志表实时统计访问次数
        $viewCountSubquery = Db::table('magic_resource_share_access_logs')
            ->selectRaw('share_id, COUNT(*) as view_count')
            ->groupBy('share_id');

        // LEFT JOIN 访问日志统计子查询
        $query->leftJoinSub($viewCountSubquery, 'al', function ($join) {
            $join->on('magic_resource_shares.id', '=', 'al.share_id');
        });

        if ($hasFileOrFileCollectionType) {
            // 使用子查询统计复制次数，避免影响现有的JOIN逻辑
            // 只统计 status='finished' 的复制记录
            $copyCountSubquery = Db::table('magic_super_agent_project_fork')
                ->selectRaw('source_project_id, COUNT(*) as copy_count')
                ->where('status', 'finished')
                ->groupBy('source_project_id');

            // LEFT JOIN 子查询：关联复制次数统计
            // 注意：使用 LEFT JOIN 确保即使没有复制记录也能返回数据
            // 使用子查询避免影响现有的 JOIN 逻辑，特别是 keyword 搜索时的 JOIN
            // 注意：LEFT JOIN 的 ON 条件只用于关联，不用于过滤（过滤在 SELECT 的 CASE WHEN 中处理）
            $query->leftJoinSub($copyCountSubquery, 'pf', function ($join) {
                $join->on('magic_resource_shares.project_id', '=', 'pf.source_project_id');
            });

            // 明确指定字段，避免字段冲突
            // 注意：现在 keyword 搜索直接搜索 resource_name，不再 JOIN 其他表，所以不会产生重复记录和字段冲突
            // 使用 CASE WHEN 处理 project_id 为 NULL 或 resource_type 不是 FileCollection/File 的情况
            // 重要：确保只有 FileCollection 类型（resource_type = 13）或 File 类型（resource_type = 15）才统计 copy_count，其他类型返回 0
            if ($hasKeywordSearch) {
                // 有 keyword 搜索 + 单个 FileCollection 类型时，明确指定所有字段
                // 注意：虽然现在不再需要 DISTINCT（因为不再 JOIN 其他表），但保留以保持代码一致性
                $query->selectRaw('
                    DISTINCT magic_resource_shares.id,
                    magic_resource_shares.resource_id,
                    magic_resource_shares.project_id,
                    magic_resource_shares.resource_type,
                    magic_resource_shares.resource_name,
                    magic_resource_shares.share_code,
                    magic_resource_shares.share_type,
                    magic_resource_shares.password,
                    magic_resource_shares.is_password_enabled,
                    magic_resource_shares.expire_at,
                    magic_resource_shares.expire_days,
                    COALESCE(al.view_count, 0) as view_count,
                    magic_resource_shares.created_uid,
                    magic_resource_shares.updated_uid,
                    magic_resource_shares.organization_code,
                    magic_resource_shares.target_ids,
                    magic_resource_shares.extra,
                    magic_resource_shares.default_open_file_id,
                    magic_resource_shares.is_enabled,
                    magic_resource_shares.share_range,
                    magic_resource_shares.share_project,
                    magic_resource_shares.created_at,
                    magic_resource_shares.updated_at,
                    magic_resource_shares.deleted_at,
                    CASE 
                        WHEN magic_resource_shares.resource_type NOT IN (' . ResourceType::FileCollection->value . ', ' . ResourceType::File->value . ') THEN 0
                        WHEN magic_resource_shares.project_id IS NULL THEN 0 
                        ELSE COALESCE(pf.copy_count, 0) 
                    END as copy_count
                ');
            } else {
                // 没有 keyword 搜索或包含多个资源类型时，需要替换 view_count 字段
                $query->selectRaw('
                    magic_resource_shares.id,
                    magic_resource_shares.resource_id,
                    magic_resource_shares.project_id,
                    magic_resource_shares.resource_type,
                    magic_resource_shares.resource_name,
                    magic_resource_shares.share_code,
                    magic_resource_shares.share_type,
                    magic_resource_shares.password,
                    magic_resource_shares.is_password_enabled,
                    magic_resource_shares.expire_at,
                    magic_resource_shares.expire_days,
                    COALESCE(al.view_count, 0) as view_count,
                    magic_resource_shares.created_uid,
                    magic_resource_shares.updated_uid,
                    magic_resource_shares.organization_code,
                    magic_resource_shares.target_ids,
                    magic_resource_shares.extra,
                    magic_resource_shares.default_open_file_id,
                    magic_resource_shares.is_enabled,
                    magic_resource_shares.share_range,
                    magic_resource_shares.share_project,
                    magic_resource_shares.created_at,
                    magic_resource_shares.updated_at,
                    magic_resource_shares.deleted_at,
                    CASE WHEN magic_resource_shares.resource_type NOT IN (' . ResourceType::FileCollection->value . ', ' . ResourceType::File->value . ') THEN 0 WHEN magic_resource_shares.project_id IS NULL THEN 0 ELSE COALESCE(pf.copy_count, 0) END as copy_count
                ');
            }
        } else {
            // 非文件集/单文件类型，添加默认的 copy_count = 0，但需要替换 view_count
            $query->selectRaw('
                magic_resource_shares.id,
                magic_resource_shares.resource_id,
                magic_resource_shares.project_id,
                magic_resource_shares.resource_type,
                magic_resource_shares.resource_name,
                magic_resource_shares.share_code,
                magic_resource_shares.share_type,
                magic_resource_shares.password,
                magic_resource_shares.is_password_enabled,
                magic_resource_shares.expire_at,
                magic_resource_shares.expire_days,
                COALESCE(al.view_count, 0) as view_count,
                magic_resource_shares.created_uid,
                magic_resource_shares.updated_uid,
                magic_resource_shares.organization_code,
                magic_resource_shares.target_ids,
                magic_resource_shares.extra,
                magic_resource_shares.default_open_file_id,
                magic_resource_shares.is_enabled,
                magic_resource_shares.share_range,
                magic_resource_shares.share_project,
                magic_resource_shares.created_at,
                magic_resource_shares.updated_at,
                magic_resource_shares.deleted_at,
                0 as copy_count
            ');
        }

        // 按创建时间倒序排序
        $query->orderBy('magic_resource_shares.id', 'desc');

        // 注意：如果 filter_type 是 ShareFilterType::All，已经通过 withTrashed() 包含软删除记录
        // 如果 filter_type 不是 ShareFilterType::All 且不是 ShareFilterType::Cancelled，需要添加 whereNull('deleted_at')
        if ($queryVO->getFilterType() !== ShareFilterType::All->value && $queryVO->getFilterType() !== ShareFilterType::Cancelled->value) {
            // 已经在上面的 switch 中处理了，这里无需额外操作
        }

        // 对于使用了关键词搜索的查询，需要特殊处理 count
        if ($queryVO->hasKeyword() && $queryVO->getResourceType() !== null) {
            // 使用专门的计数方法来处理关键词搜索
            $total = $this->countWithKeywordSearch($queryVO);
        } else {
            // 计算总数
            $total = $query->count();
        }

        // 获取分页数据
        $models = $query->offset(($page - 1) * $pageSize)
            ->limit($pageSize)
            ->get();

        // 方案2优化：统一返回数组结构，避免数据结构不一致
        // 将模型转换为实体，并提取 copy_count 字段
        $items = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            // 统一转换为数组结构，确保数据结构一致性
            $entityArray = $entity->toArray();
            // 提取 copy_count 字段（如果存在），否则默认为 0
            $entityArray['copy_count'] = isset($model->copy_count) ? (int) $model->copy_count : 0;
            $items[] = $entityArray;
        }

        return [
            'total' => $total,
            'list' => $items,
        ];
    }

    public function getShareByResource(string $userId, string $resourceId, int $resourceType, bool $withTrashed = true): ?ResourceShareEntity
    {
        if ($withTrashed) {
            /** @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
            $query = ResourceShareModel::query()->withTrashed();
        } else {
            $query = ResourceShareModel::query();
        }
        if (! empty($userId)) {
            $query = $query->where('created_uid', $userId);
        }
        $model = $query->where('resource_id', $resourceId)->where('resource_type', $resourceType)->first();

        if (! $model) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * 批量获取分享详情.
     *
     * @param array $resourceIds 资源ID数组
     * @return array ResourceShareEntity[] 分享实体数组
     */
    public function getSharesByResourceIds(array $resourceIds): array
    {
        if (empty($resourceIds)) {
            return [];
        }

        $models = $this->model->newQuery()
            ->whereIn('resource_id', $resourceIds)
            ->whereNull('deleted_at')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $entities[] = $entity;
            }
        }

        return $entities;
    }

    /**
     * 根据项目ID查找项目分享.
     *
     * @param string $projectId 项目ID
     * @return array ResourceShareEntity[] 分享实体数组
     */
    public function getSharesByProjectId(string $projectId): array
    {
        $models = $this->model->newQuery()
            ->where('project_id', $projectId)
            ->where('resource_type', ResourceType::Project->value)
            ->whereNull('deleted_at')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entity = $this->modelToEntity($model);
            if ($entity !== null) {
                $entities[] = $entity;
            }
        }

        return $entities;
    }

    /**
     * 批量保存分享实体.
     *
     * @param array $shareEntities ResourceShareEntity[] 分享实体数组
     * @return bool 是否保存成功
     */
    public function batchSave(array $shareEntities): bool
    {
        if (empty($shareEntities)) {
            return true;
        }

        // 使用事务批量更新
        return Db::transaction(function () use ($shareEntities) {
            foreach ($shareEntities as $entity) {
                $data = $this->entityToArray($entity);
                // 使用 withTrashed 确保可以更新软删除的记录
                /* @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
                $this->model->query()
                    ->withTrashed()
                    ->where('id', $entity->getId())
                    ->update($data);
            }
            return true;
        });
    }

    /**
     * 获取用户分享的项目ID列表（去重）.
     *
     * @param string $userId 用户ID
     * @param array $resourceTypes 资源类型数组
     * @return array 项目ID数组
     */
    public function getSharedProjectIdsByUser(string $userId, array $resourceTypes): array
    {
        // 执行查询：获取去重的项目ID列表
        $query = $this->model->newQuery()
            ->where('created_uid', $userId)              // 条件1：当前用户创建的分享
            ->whereIn('resource_type', $resourceTypes)   // 条件2：指定的资源类型
            ->whereNotNull('project_id')                 // 条件3：必须有项目ID
            ->whereNull('deleted_at');                   // 条件4：未删除的分享

        $projectIds = $query->distinct()                 // 关键：数据库层面去重
            ->pluck('project_id')                        // 只取 project_id 字段
            ->map(fn ($id) => (string) $id)              // 转为字符串类型
            ->toArray();

        return array_values($projectIds);  // 重新索引数组
    }

    /**
     * 将PO模型转换为实体.
     *
     * @param ResourceShareModel $model 模型
     * @return ResourceShareEntity 实体
     */
    protected function modelToEntity(ResourceShareModel $model): ?ResourceShareEntity
    {
        $entity = new ResourceShareEntity();
        $entity->setId((int) $model->id);
        $entity->setResourceId((string) $model->resource_id);
        $entity->setResourceType((int) $model->resource_type);
        $entity->setResourceName((string) $model->resource_name);
        $entity->setShareCode(htmlspecialchars($model->share_code, ENT_QUOTES, 'UTF-8'));
        $entity->setShareType((int) $model->share_type);
        $entity->setPassword($model->password);

        // 安全处理日期 - 确保格式正确（即使为 null 也要设置）
        $entity->setExpireAt($model->expire_at ?? null);

        // 处理过期天数（即使为 null 也要设置）
        $entity->setExpireDays($model->expire_days !== null ? (int) $model->expire_days : null);

        $entity->setViewCount($model->view_count);
        $entity->setCreatedUid($model->created_uid);
        $entity->setOrganizationCode(htmlspecialchars($model->organization_code, ENT_QUOTES, 'UTF-8'));

        // 处理目标ID - 直接读取，不使用 property_exists（对 Hyperf 模型不适用）
        $targetIds = $model->target_ids ?? '[]';
        // 统一处理：如果是数组则 encode，如果是字符串则验证后使用，否则使用空数组
        if (is_array($targetIds)) {
            // Model已经解码，直接编码
            $entity->setTargetIds(Json::encode($targetIds));
        } elseif (is_string($targetIds)) {
            // 已经是JSON字符串，验证后直接使用
            try {
                Json::decode($targetIds); // 验证是否为有效JSON
                $entity->setTargetIds($targetIds);
            } catch (Throwable $e) {
                $entity->setTargetIds('[]'); // 无效JSON，使用空数组
            }
        } else {
            $entity->setTargetIds('[]');
        }

        // 处理分享范围
        $entity->setShareRange($model->share_range ?? null);

        $extra = $model->extra ?? [];
        if (is_string($extra)) {
            try {
                $decoded = Json::decode($extra);
                // 如果解码后仍然是字符串，可能是双重 JSON 编码，再尝试解码一次
                if (is_string($decoded)) {
                    $decoded = Json::decode($decoded);
                }
                $extra = is_array($decoded) ? $decoded : [];  // 确保是数组
            } catch (Throwable $e) {
                $extra = [];  // JSON 解码失败，使用空数组
            }
        } elseif (! is_array($extra)) {
            $extra = [];  // 非字符串非数组，使用空数组
        }
        $entity->setExtra($extra);

        // 处理默认打开的文件ID（即使为 null 也要设置）
        $entity->setDefaultOpenFileId($model->default_open_file_id !== null ? (int) $model->default_open_file_id : null);

        // 处理项目ID（即使为 null 也要设置）
        $entity->setProjectId($model->project_id !== null ? (string) $model->project_id : null);

        // 处理是否启用字段（邀请链接专用）
        $entity->setIsEnabled($model->is_enabled ?? true);

        // 处理密码保护是否启用字段
        $entity->setIsPasswordEnabled($model->is_password_enabled ?? false);

        // 处理是否分享整个项目
        $entity->setShareProject($model->share_project ?? false);

        // 设置时间字段（即使为 null 也要设置）
        $entity->setCreatedAt($model->created_at ?? null);
        $entity->setUpdatedAt($model->updated_at ?? null);
        $entity->setDeletedAt($model->deleted_at ?? null);

        return $entity;
    }

    /**
     * 将实体转换为数组.
     *
     * @param ResourceShareEntity $entity 实体
     * @return array 数组
     */
    protected function entityToArray(ResourceShareEntity $entity): array
    {
        // target_ids 始终存储为 JSON 字符串，兼容 update/create
        $targetIds = $entity->getTargetIdsArray();
        $targetIdsJson = Json::encode($targetIds);

        return [
            'id' => $entity->getId(),
            'resource_id' => $entity->getResourceId(),
            'resource_type' => $entity->getResourceType(),
            'resource_name' => $entity->getResourceName(),
            'share_code' => $entity->getShareCode(),
            'share_type' => $entity->getShareType(),
            'password' => $entity->getPassword(),
            'is_password_enabled' => $entity->getIsPasswordEnabled() ? 1 : 0,
            'expire_at' => $entity->getExpireAt(),
            'expire_days' => $entity->getExpireDays(),
            'view_count' => $entity->getViewCount(),
            'created_uid' => $entity->getCreatedUid(),
            'organization_code' => $entity->getOrganizationCode(),
            'target_ids' => $targetIdsJson,
            'share_range' => $entity->getShareRange(),
            'extra' => $entity->getExtra() !== null ? Json::encode($entity->getExtra()) : null,
            'default_open_file_id' => $entity->getDefaultOpenFileId(),
            'project_id' => $entity->getProjectId(),
            'is_enabled' => $entity->getIsEnabled() ? 1 : 0,
            'share_project' => $entity->isShareProject() ? 1 : 0,
            'updated_at' => $entity->getUpdatedAt(),
            'deleted_at' => $entity->getDeletedAt(),
            'updated_uid' => $entity->getUpdatedUid(),
        ];
    }

    /**
     * 计算带关键词搜索的不重复记录数.
     *
     * @param ResourceShareQueryVO $queryVO 查询条件值对象
     * @return int 总数
     */
    private function countWithKeywordSearch(ResourceShareQueryVO $queryVO): int
    {
        $countQuery = $this->model->newQuery();

        // 构建普通 WHERE 条件
        if ($queryVO->getCreatedUid() !== null) {
            $countQuery->where('magic_resource_shares.created_uid', $queryVO->getCreatedUid());
        }

        // 处理 resource_type：支持单个值或数组
        if ($queryVO->getResourceType() !== null) {
            if ($queryVO->isResourceTypeArray()) {
                $countQuery->whereIn('magic_resource_shares.resource_type', $queryVO->getResourceTypes());
            } else {
                $countQuery->where('magic_resource_shares.resource_type', $queryVO->getResourceType());
            }
        }

        // Filter by project_id
        if ($queryVO->getProjectId() !== null) {
            $countQuery->where('magic_resource_shares.project_id', $queryVO->getProjectId());
        }

        // 话题类型特殊处理：不返回已取消的分享
        $resourceTypes = $queryVO->getResourceTypes();
        $isOnlyTopicType = ! empty($resourceTypes)
            && count($resourceTypes) === 1
            && $resourceTypes[0] === ResourceType::Topic->value;

        if ($isOnlyTopicType) {
            // 话题类型没有筛选，无论是否传递 filter_type，都一次性返回全部未取消的记录（active + expired）
            // 话题类型不返回已取消的分享
            $countQuery->whereNull('magic_resource_shares.deleted_at');
        } else {
            // 其他资源类型的原有逻辑
            $filterType = $queryVO->getFilterType();
            switch ($filterType) {
                case ShareFilterType::Active->value:  // 分享中
                    $countQuery->where('magic_resource_shares.is_enabled', 1)  // 显式使用整数
                        ->whereNull('magic_resource_shares.deleted_at')
                        ->where(function ($q) {
                            $q->whereNull('magic_resource_shares.expire_at')
                                ->orWhere('magic_resource_shares.expire_at', '>', date('Y-m-d H:i:s'));
                        });
                    break;
                case ShareFilterType::Expired->value:  // 已失效（包括被禁用或已过期）
                    $countQuery->whereNull('magic_resource_shares.deleted_at')
                        ->where(function ($q) {
                            // 条件1: 未启用（被禁用） - 显式使用整数 0
                            $q->where('magic_resource_shares.is_enabled', 0)
                              // 条件2: 已过期
                                ->orWhere(function ($q2) {
                                    $q2->whereNotNull('magic_resource_shares.expire_at')
                                        ->where('magic_resource_shares.expire_at', '<=', date('Y-m-d H:i:s'));
                                });
                        });
                    break;
                case ShareFilterType::Cancelled->value:  // 已取消
                    /* @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
                    $countQuery->withTrashed()  // 移除 SoftDeletes 的全局作用域
                        ->whereNotNull('magic_resource_shares.deleted_at');
                    break;
                case ShareFilterType::All->value:  // 全部 - 包含软删除的记录
                default:
                    /* @phpstan-ignore-next-line - ResourceShareModel uses SoftDeletes trait which provides withTrashed() */
                    $countQuery->withTrashed();
                    break;
            }
        }

        // 应用关键词搜索
        $keyword = $queryVO->getKeyword();
        if (! empty($keyword)) {
            // 转义 LIKE 特殊字符，防止通配符注入
            // 使用 str_replace 转义，避免 addcslashes 可能的问题
            $keyword = str_replace(['%', '_', '\\'], ['\%', '\_', '\\\\'], $keyword);
            $this->applyKeywordSearch($countQuery, $resourceTypes, $keyword);
        }

        // 使用 COUNT(DISTINCT) 来统计不重复的记录数
        $result = $countQuery->selectRaw('COUNT(DISTINCT magic_resource_shares.id) as total')->first();

        return $result ? (int) $result->total : 0;
    }

    /**
     * 应用关键词搜索逻辑，支持多种资源类型组合.
     *
     * @param Builder $query 查询构建器
     * @param array $resourceTypes 资源类型数组
     * @param string $keyword 搜索关键词
     */
    private function applyKeywordSearch($query, array $resourceTypes, string $keyword): void
    {
        $searchConditions = [];

        foreach ($resourceTypes as $resourceType) {
            if ($resourceType == ResourceType::Topic->value) {
                // 话题类型：搜索话题名称（topic_name）OR 项目名称
                $searchConditions[] = function ($q) use ($keyword) {
                    $q->where('magic_resource_shares.resource_type', ResourceType::Topic->value)
                        ->whereExists(function ($subQuery) use ($keyword) {
                            // 使用 selectRaw 避免依赖 DB facade（某些 Hyperf 项目未启用全局 DB 类）
                            $subQuery->selectRaw('1')
                                ->from('magic_super_agent_topics as t')
                                ->whereColumn('magic_resource_shares.resource_id', 't.id')
                                ->whereNull('t.deleted_at')
                                ->where(function ($innerQ) use ($keyword) {
                                    // 搜索话题名称
                                    $innerQ->where('t.topic_name', 'LIKE', '%' . $keyword . '%')
                                        // 或者搜索项目名称
                                        ->orWhereExists(function ($projectQuery) use ($keyword) {
                                            $projectQuery->selectRaw('1')
                                                ->from('magic_super_agent_project as p')
                                                ->whereColumn('t.project_id', 'p.id')
                                                ->whereNull('p.deleted_at')
                                                ->where('p.project_name', 'LIKE', '%' . $keyword . '%');
                                        });
                                });
                        });
                };
            } elseif (in_array($resourceType, [
                ResourceType::FileCollection->value,
                ResourceType::File->value,
                ResourceType::Project->value,
            ], true)) {
                // 文件集/单文件/项目类型：搜索分享标题（resource_name）OR 项目名称
                // 注意：这些类型都使用 project_id 字段来关联项目表，而不是 resource_id
                $searchConditions[] = function ($q) use ($keyword, $resourceType) {
                    $q->where('magic_resource_shares.resource_type', $resourceType)
                        ->where(function ($subQ) use ($keyword) {
                            // 搜索分享标题
                            $subQ->where('magic_resource_shares.resource_name', 'LIKE', '%' . $keyword . '%')
                                // 或者搜索项目名称（通过 project_id 关联）
                                ->orWhereExists(function ($existsQuery) use ($keyword) {
                                    $existsQuery->selectRaw('1')
                                        ->from('magic_super_agent_project as p')
                                        ->whereColumn('magic_resource_shares.project_id', 'p.id')
                                        ->whereNull('p.deleted_at')
                                        ->where('p.project_name', 'LIKE', '%' . $keyword . '%');
                                });
                        });
                };
            }
        }

        // 如果有搜索条件，使用 OR 连接
        if (! empty($searchConditions)) {
            $query->where(function ($q) use ($searchConditions) {
                foreach ($searchConditions as $index => $condition) {
                    if ($index === 0) {
                        $q->where($condition);
                    } else {
                        $q->orWhere($condition);
                    }
                }
            });
        }
    }
}
