<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\Kernel\SuperPermissionEnum;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ModelConfigQuery;
use App\Infrastructure\Core\ValueObject\Page;
use Qbhy\HyperfAuth\Authenticatable;

class ModelConfigAppService extends AbstractLLMAppService
{
    public function save(Authenticatable $authorization, ModelConfigEntity $modelConfigEntity): ModelConfigEntity
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::MODEL_CONFIG_ADMIN);
        return $this->modelConfigDomainService->save($this->createLLMDataIsolation($authorization), $modelConfigEntity);
    }

    public function show(Authenticatable $authorization, string $model): ModelConfigEntity
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::MODEL_CONFIG_ADMIN);
        return $this->modelConfigDomainService->show($this->createLLMDataIsolation($authorization), $model);
    }

    /**
     * 根据ID获取模型配置.
     */
    public function showById(Authenticatable $authorization, string $id): ModelConfigEntity
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::MODEL_CONFIG_ADMIN);
        return $this->modelConfigDomainService->showById($id);
    }

    /**
     * @return ModelConfigEntity[]
     */
    public function queries(Authenticatable $authorization, ModelConfigQuery $query): array
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::MODEL_CONFIG_ADMIN);
        return $this->modelConfigDomainService->queries($this->createLLMDataIsolation($authorization), Page::createNoPage(), $query)['list'];
    }

    public function enabledModels(Authenticatable $authorization): array
    {
        $query = new ModelConfigQuery();
        $query->setEnabled(true);
        $data = $this->modelConfigDomainService->queries($this->createLLMDataIsolation($authorization), Page::createNoPage(), $query);

        return array_map(function (ModelConfigEntity $modelConfigEntity) {
            return $modelConfigEntity->getModel();
        }, $data['list']);
    }

    /**
     * 获取模型的降级链，合并用户传入的降级链与系统默认的降级链.
     *
     * @param string $modelType 指定的模型类型
     * @param string[] $modelFallbackChain 用户传入的降级链
     *
     * @return string 最终的模型类型
     */
    public function getChatModelTypeByFallbackChain(string $orgCode, string $modelType = '', array $modelFallbackChain = []): string
    {
        $dataIsolation = ModelGatewayDataIsolation::create($orgCode);
        // 从组织可用的模型列表中获取所有可聊天的模型
        $odinModels = di(ModelGatewayMapper::class)->getChatModels($dataIsolation) ?? [];
        $chatModelsName = array_keys($odinModels);
        if (empty($chatModelsName)) {
            return '';
        }

        // 如果指定了模型类型且该模型存在于可用模型列表中，则直接返回
        if (! empty($modelType) && in_array($modelType, $chatModelsName)) {
            return $modelType;
        }

        // 将可用模型转为哈希表，实现O(1)时间复杂度的查找
        $availableModels = array_flip($chatModelsName);

        // 获取系统默认的降级链
        $systemFallbackChain = config('magic-api.model_fallback_chain.chat', []);

        // 合并用户传入的降级链与系统默认的降级链
        // 用户传入的降级链优先级更高
        $mergedFallbackChain = array_merge($systemFallbackChain, $modelFallbackChain);

        // 按优先级顺序遍历合并后的降级链
        foreach ($mergedFallbackChain as $modelName) {
            if (isset($availableModels[$modelName])) {
                return $modelName;
            }
        }

        // 后备方案：如果没有匹配任何优先模型，使用第一个可用模型
        return $chatModelsName[0] ?? '';
    }
}
