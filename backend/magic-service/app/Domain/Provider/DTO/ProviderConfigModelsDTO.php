<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO;

use App\Domain\Provider\Entity\ProviderModelEntity;
use Hyperf\Codec\Json;

/**
 * service_provider_config_id 对应的服务商+模型列表。
 *
 * 同一个服务商在不同的组织下有不同的 service_provider_config_id。
 * 一个service_provider_config_id对应多个具体的模型。
 */
class ProviderConfigModelsDTO extends ProviderConfigDTO
{
    /**
     * Provider模型DTO数组.
     * @var ProviderModelDetailDTO[]
     */
    protected array $models = [];

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    // ===== 模型相关字段的Getter/Setter =====

    /**
     * @return ProviderModelDetailDTO[]
     */
    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(null|array|string $models): void
    {
        if ($models === null) {
            $this->models = [];
        } elseif (is_string($models)) {
            $decoded = Json::decode($models);
            $this->models = is_array($decoded) ? $decoded : [];
        } else {
            $this->models = $models;
        }
    }

    public function hasModels(): bool
    {
        return ! empty($this->models);
    }

    public function addModel(ProviderModelEntity $model): void
    {
        // 把model转换为ProviderModelDetailDTO
        $modelDTO = new ProviderModelDetailDTO($model->toArray());
        $this->models[] = $modelDTO;
    }
}
