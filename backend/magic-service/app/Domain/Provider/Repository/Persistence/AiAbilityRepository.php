<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\AiAbilityQuery;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\AiAbilityModel;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Provider\Assembler\AiAbilityAssembler;

/**
 * AI 能力仓储实现.
 */
class AiAbilityRepository extends AbstractModelRepository implements AiAbilityRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    /**
     * 根据能力代码获取AI能力实体.
     */
    public function getByCode(ProviderDataIsolation $dataIsolation, AiAbilityCode $code): ?AiAbilityEntity
    {
        $builder = $this->createBuilder($dataIsolation, AiAbilityModel::query());
        $model = $builder->where('code', $code->value)->first();

        if ($model === null) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * 获取所有AI能力列表.
     */
    public function getAll(ProviderDataIsolation $dataIsolation): array
    {
        $builder = $this->createBuilder($dataIsolation, AiAbilityModel::query());
        $models = $builder->orderBy('sort_order')->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return $entities;
    }

    /**
     * 根据ID获取AI能力实体.
     */
    public function getById(ProviderDataIsolation $dataIsolation, int $id): ?AiAbilityEntity
    {
        $builder = $this->createBuilder($dataIsolation, AiAbilityModel::query());
        $model = $builder->where('id', $id)->first();

        if ($model === null) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * 保存AI能力实体.
     */
    public function save(AiAbilityEntity $entity): bool
    {
        $model = new AiAbilityModel();
        $model->code = $entity->getCode()->value;
        $model->organization_code = $entity->getOrganizationCode();
        $model->name_i18n = $entity->getName();
        $model->description_i18n = $entity->getDescription();
        $model->icon = $entity->getIcon();
        $model->sort_order = $entity->getSortOrder();
        $model->status = $entity->getStatus()->value;
        $model->config = $entity->getConfig();

        $result = $model->save();

        if ($result) {
            $entity->setId($model->id);
            // 使用ID加密config并更新
            $encryptedConfig = AiAbilityAssembler::encodeConfig($model->config, (string) $model->id);
            $model->config = $encryptedConfig;
            $model->save();
        }

        return $result;
    }

    /**
     * 更新AI能力实体.
     */
    public function update(AiAbilityEntity $entity): bool
    {
        $model = AiAbilityModel::query()
            ->where('organization_code', $entity->getOrganizationCode())
            ->where('code', $entity->getCode()->value)
            ->first();
        if ($model === null) {
            return false;
        }

        $model->name_i18n = $entity->getName();
        $model->description_i18n = $entity->getDescription();
        $model->icon = $entity->getIcon();
        $model->sort_order = $entity->getSortOrder();
        $model->status = $entity->getStatus()->value;

        // 加密config后再保存
        $model->config = AiAbilityAssembler::encodeConfig($entity->getConfig(), (string) $model->id);

        return $model->save();
    }

    /**
     * 根据code更新（支持选择性更新）.
     */
    public function updateByCode(ProviderDataIsolation $dataIsolation, AiAbilityCode $code, array $data): bool
    {
        if (empty($data)) {
            return false;
        }

        // 如果需要更新config，先获取记录ID进行加密
        if (! empty($data['config'])) {
            $builder = $this->createBuilder($dataIsolation, AiAbilityModel::query());
            $model = $builder->where('code', $code->value)->first();

            if ($model === null) {
                return false;
            }

            // 加密config
            $data['config'] = AiAbilityAssembler::encodeConfig($data['config'], (string) $model->id);
        }

        $data['updated_at'] = date('Y-m-d H:i:s');

        $builder = $this->createBuilder($dataIsolation, AiAbilityModel::query());
        return $builder->where('code', $code->value)->update($data) > 0;
    }

    /**
     * 分页查询AI能力列表.
     *
     * @return array{total: int, list: array<AiAbilityEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, AiAbilityQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, AiAbilityModel::query());

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        foreach ($result['list'] as $model) {
            $list[] = $this->modelToEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    /**
     * 将Model转换为Entity.
     */
    private function modelToEntity(AiAbilityModel $model): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setId($model->id);
        $entity->setCode($model->code);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setName($model->name_i18n);
        $entity->setDescription($model->description_i18n);
        $entity->setIcon($model->icon);
        $entity->setSortOrder($model->sort_order);
        $entity->setStatus($model->status);

        // 解密config
        $config = $model->config ?? [];
        if (is_string($config) && ! empty($config)) {
            // 如果config是加密的字符串，进行解密
            $config = AiAbilityAssembler::decodeConfig($config, (string) $model->id);
        }
        $entity->setConfig($config);

        return $entity;
    }
}
