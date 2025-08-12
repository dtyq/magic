<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Interfaces\Provider\Assembler\ProviderConfigIdAssembler;
use DateTime;

/**
 * 服务商模板生成仓储
 * 支持为所有 ProviderCode 生成模板配置.
 */
readonly class ProviderTemplateRepository
{
    public function __construct(
        private ProviderRepositoryInterface $providerRepository,
    ) {
    }

    /**
     * 获取所有服务商的模板列表.
     * @param Category $category 服务商分类
     * @return ProviderConfigDTO[] 服务商模板列表
     */
    public function getAllProviderTemplates(Category $category): array
    {
        $templates = [];

        // 获取指定分类下所有启用的服务商
        $providers = $this->providerRepository->getByCategory($category);

        foreach ($providers as $provider) {
            // 为每个服务商创建模板配置
            $templateId = ProviderConfigIdAssembler::generateProviderTemplate($provider->getProviderCode(), $category);

            // 除了 magic 服务商，默认状态都是关闭
            $defaultStatus = $provider->getProviderCode() === ProviderCode::Official
                ? Status::Enabled
                : Status::Disabled;

            $templateData = [
                'id' => $templateId,
                'service_provider_id' => (string) $provider->getId(),
                'organization_code' => '', // 模板不绑定具体组织
                'config' => [],
                'decryptedConfig' => [],
                'status' => $defaultStatus->value,
                'alias' => '',
                'translate' => [],
                'created_at' => (new DateTime())->format('Y-m-d H:i:s'),
                'updated_at' => (new DateTime())->format('Y-m-d H:i:s'),
                'name' => $provider->getName(),
                'description' => $provider->getDescription(),
                'icon' => $provider->getIcon(),
                'provider_type' => $provider->getProviderType()->value,
                'category' => $category->value,
                'provider_code' => $provider->getProviderCode()->value,
                'remark' => '',
            ];

            $templates[] = new ProviderConfigDTO($templateData);
        }

        return $templates;
    }
}
