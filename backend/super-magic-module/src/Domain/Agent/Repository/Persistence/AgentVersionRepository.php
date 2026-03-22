<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetValue;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentVersionModel;
use Hyperf\Codec\Json;
use RuntimeException;

/**
 * Agent 版本仓储实现.
 */
class AgentVersionRepository extends SuperMagicAbstractRepository implements AgentVersionRepositoryInterface
{
    public function __construct(
        protected AgentVersionModel $agentVersionModel
    ) {
    }

    /**
     * 根据 code 查找最新版本的 Agent 版本（按 version 字段降序）.
     */
    public function findLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        /** @var null|AgentVersionModel $model */
        $model = $builder
            ->where('code', $code)
            ->orderBy('version', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function countByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query())
            ->where('code', $code)
            ->whereNull('deleted_at');

        return (int) $builder->count();
    }

    public function findLatestByCreatedAtDesc(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        /** @var null|AgentVersionModel $model */
        $model = $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findCurrentOrLatestByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?AgentVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        /** @var null|AgentVersionModel $model */
        $model = $builder
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->orderBy('is_current_version', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function findCurrentOrLatestByCodes(SuperMagicAgentDataIsolation $dataIsolation, array $codes): array
    {
        $codes = array_values(array_unique(array_filter($codes)));
        if ($codes === []) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        $models = $builder
            ->whereIn('code', $codes)
            ->whereNull('deleted_at')
            ->orderBy('code')
            ->orderBy('is_current_version', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->get();

        $result = [];
        /** @var AgentVersionModel $model */
        foreach ($models as $model) {
            $code = (string) $model->code;
            if (isset($result[$code])) {
                continue;
            }
            $result[$code] = $this->toEntity($model->toArray());
        }

        return $result;
    }

    public function existsByCodeAndVersion(SuperMagicAgentDataIsolation $dataIsolation, string $code, string $version): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        return $builder
            ->where('code', $code)
            ->where('version', $version)
            ->whereNull('deleted_at')
            ->exists();
    }

    /**
     * 保存 Agent 版本.
     */
    public function save(SuperMagicAgentDataIsolation $dataIsolation, AgentVersionEntity $entity): AgentVersionEntity
    {
        $attributes = $this->entityToModelAttributes($entity);

        if ($entity->getId() && $entity->getId() > 0) {
            // 更新：通过 id 和 organization_code 查找，确保更新正确的记录
            $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
            /** @var null|AgentVersionModel $model */
            $model = $builder
                ->where('id', $entity->getId())
                ->first();
            if (! $model) {
                throw new RuntimeException('Agent version not found for update: ' . $entity->getId());
            }
            $model->fill($attributes);
            $model->save();
            return $this->toEntity($model->toArray());
        }

        // 创建
        $attributes['id'] = IdGenerator::getSnowId();
        $attributes['created_at'] = date('Y-m-d H:i:s');
        $attributes['updated_at'] = date('Y-m-d H:i:s');
        $entity->setId($attributes['id']);
        $entity->setCreatedAt($attributes['created_at']);
        $entity->setUpdatedAt($attributes['updated_at']);
        $this->agentVersionModel::query()->create($attributes);

        return $entity;
    }

    /**
     * 根据 ID 查询待审核的 Agent 版本（审核中状态）.
     */
    public function findPendingReviewById(SuperMagicAgentDataIsolation $dataIsolation, int $id): ?AgentVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        /** @var null|AgentVersionModel $model */
        $model = $builder
            ->where('id', $id)
            ->where('publish_status', PublishStatus::UNPUBLISHED->value)
            ->where('review_status', ReviewStatus::UNDER_REVIEW->value)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    /**
     * 更新 Agent 版本的审核状态和发布状态.
     */
    public function updateReviewStatus(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $id,
        ReviewStatus $reviewStatus,
        PublishStatus $publishStatus,
        string $modifier
    ): bool {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());

        $affected = $builder
            ->where('id', $id)
            ->where('publish_status', PublishStatus::UNPUBLISHED->value)
            ->where('review_status', ReviewStatus::UNDER_REVIEW->value)
            ->whereNull('deleted_at')
            ->update([
                'review_status' => $reviewStatus->value,
                'publish_status' => $publishStatus->value,
                'modifier' => $modifier,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        return $affected > 0;
    }

    public function deleteByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());

        $builder->where('code', $agentCode)->delete();

        return true;
    }

    public function clearCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $code): int
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());
        return $builder
            ->where('code', $code)
            ->where('is_current_version', 1)
            ->whereNull('deleted_at')
            ->update([
                'is_current_version' => 0,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    public function offlineByAgentCode(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query());

        $builder->where('code', $agentCode)
            ->where('publish_status', [PublishStatus::PUBLISHED->value])
            ->update(
                ['publish_status' => PublishStatus::OFFLINE->value]
            );

        $builder->where('code', $agentCode)
            ->whereIn('review_status', [ReviewStatus::UNDER_REVIEW->value])
            ->delete();

        return true;
    }

    /**
     * 根据 ID 查询 Agent 版本（不限制状态）.
     */
    public function findById(int $id): ?AgentVersionEntity
    {
        /** @var null|AgentVersionModel $model */
        $model = $this->agentVersionModel::query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if (! $model) {
            return null;
        }

        return $this->toEntity($model->toArray());
    }

    public function queriesByCode(
        SuperMagicAgentDataIsolation $dataIsolation,
        string $code,
        ?PublishTargetType $publishTargetType = null,
        ?ReviewStatus $reviewStatus = null,
        Page $page = new Page()
    ): array {
        $builder = $this->createBuilder($dataIsolation, $this->agentVersionModel::query())
            ->where('code', $code)
            ->whereNull('deleted_at');

        if ($publishTargetType !== null) {
            $builder->where('publish_target_type', $publishTargetType->value);
        }

        if ($reviewStatus !== null) {
            $builder->where('review_status', $reviewStatus->value);
        }

        $builder->orderBy('created_at', 'DESC');

        $result = $this->getByPage($builder, $page);
        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = $this->toEntity($model->toArray());
        }
        $result['list'] = $list;

        return $result;
    }

    /**
     * 将模型数据转换为实体.
     */
    protected function toEntity(array|object $data): AgentVersionEntity
    {
        $data = is_object($data) ? (array) $data : $data;

        $nameI18n = $data['name_i18n'] ?? [];
        if (is_string($nameI18n)) {
            $nameI18n = Json::decode($nameI18n);
        }

        $roleI18n = $data['role_i18n'] ?? null;
        if (is_string($roleI18n)) {
            $roleI18n = Json::decode($roleI18n);
        }

        $descriptionI18n = $data['description_i18n'] ?? null;
        if (is_string($descriptionI18n)) {
            $descriptionI18n = Json::decode($descriptionI18n);
        }

        $publishTargetValue = $data['publish_target_value'] ?? null;
        if (is_string($publishTargetValue)) {
            $publishTargetValue = Json::decode($publishTargetValue);
        }

        $versionDescriptionI18n = $data['version_description_i18n'] ?? null;
        if (is_string($versionDescriptionI18n)) {
            $versionDescriptionI18n = Json::decode($versionDescriptionI18n);
        }

        $prompt = $data['prompt'] ?? null;
        if (is_string($prompt)) {
            $prompt = Json::decode($prompt);
        }

        $tools = $data['tools'] ?? null;
        if (is_string($tools)) {
            $tools = Json::decode($tools);
        }

        $entity = new AgentVersionEntity();
        $entity->setId($data['id'] ?? null);
        $entity->setCode($data['code'] ?? '');
        $entity->setOrganizationCode($data['organization_code'] ?? '');
        $entity->setVersion($data['version'] ?? '1.0.0');
        $entity->setName($data['name'] ?? '');
        $entity->setDescription($data['description'] ?? '');
        $entity->setIcon($data['icon'] ?? null);
        $entity->setIconType($data['icon_type'] ?? 1);
        $entity->setType($data['type'] ?? 2);
        $entity->setEnabled($data['enabled'] ?? true);
        $entity->setPrompt($prompt);
        $entity->setTools($tools);
        $entity->setCreator($data['creator'] ?? '');
        $entity->setModifier($data['modifier'] ?? '');
        $entity->setNameI18n($nameI18n);
        $entity->setRoleI18n($roleI18n);
        $entity->setDescriptionI18n($descriptionI18n);
        $entity->setPublishStatus($data['publish_status'] ?? PublishStatus::UNPUBLISHED->value);
        $entity->setReviewStatus($data['review_status'] ?? ReviewStatus::PENDING->value);
        $entity->setPublishTargetType($data['publish_target_type'] ?? PublishTargetType::MARKET->value);
        $entity->setPublishTargetValue(PublishTargetValue::fromArray($publishTargetValue));
        $entity->setVersionDescriptionI18n($versionDescriptionI18n);
        $entity->setPublisherUserId($data['publisher_user_id'] ?? null);
        $entity->setPublishedAt(isset($data['published_at']) ? (is_string($data['published_at']) ? $data['published_at'] : $data['published_at']?->format('Y-m-d H:i:s')) : null);
        $entity->setIsCurrentVersion($data['is_current_version'] ?? false);
        $entity->setProjectId(isset($data['project_id']) ? (int) $data['project_id'] : null);
        $entity->setFileKey($data['file_key'] ?? null);

        if (isset($data['created_at'])) {
            $entity->setCreatedAt(is_string($data['created_at']) ? $data['created_at'] : $data['created_at']->format('Y-m-d H:i:s'));
        }
        if (isset($data['updated_at'])) {
            $entity->setUpdatedAt(is_string($data['updated_at']) ? $data['updated_at'] : $data['updated_at']->format('Y-m-d H:i:s'));
        }
        if (isset($data['deleted_at'])) {
            $entity->setDeletedAt(is_string($data['deleted_at']) ? $data['deleted_at'] : ($data['deleted_at'] ? $data['deleted_at']->format('Y-m-d H:i:s') : null));
        }

        return $entity;
    }

    /**
     * 实体转模型属性.
     */
    protected function entityToModelAttributes(AgentVersionEntity $entity): array
    {
        $attributes = [
            'code' => $entity->getCode(),
            'organization_code' => $entity->getOrganizationCode(),
            'version' => $entity->getVersion(),
            'name' => $entity->getName(),
            'description' => $entity->getDescription(),
            'icon' => $entity->getIcon(),
            'icon_type' => $entity->getIconType(),
            'type' => $entity->getType(),
            'enabled' => $entity->getEnabled() ? 1 : 0,
            'prompt' => $entity->getPrompt(),
            'tools' => $entity->getTools(),
            'creator' => $entity->getCreator(),
            'modifier' => $entity->getModifier(),
            'name_i18n' => $entity->getNameI18n() ?? [],
            'role_i18n' => $entity->getRoleI18n(),
            'project_id' => $entity->getProjectId(),
            'description_i18n' => $entity->getDescriptionI18n(),
            'publish_status' => $entity->getPublishStatus()->value,
            'review_status' => $entity->getReviewStatus()->value,
            'publish_target_type' => $entity->getPublishTargetType()->value,
            'publish_target_value' => $entity->getPublishTargetValue()?->toArray(),
            'version_description_i18n' => $entity->getVersionDescriptionI18n(),
            'publisher_user_id' => $entity->getPublisherUserId(),
            'published_at' => $entity->getPublishedAt(),
            'is_current_version' => $entity->isCurrentVersion() ? 1 : 0,
            'file_key' => $entity->getFileKey(),
        ];

        // 如果是更新操作，添加 updated_at
        if ($entity->getId() && $entity->getId() > 0) {
            $attributes['updated_at'] = date('Y-m-d H:i:s');
        }

        return $attributes;
    }
}
