<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use App\Interfaces\Agent\Assembler\FileAssembler;

/**
 * Provider相关AppService的抽象基类.
 */
abstract class AbstractProviderAppService
{
    public function __construct(
        protected FileDomainService $fileDomainService,
    ) {
    }

    /**
     * 处理模型图标，将路径转换为完整URL.
     */
    protected function processModelIcons(array $providerModelDetailDTOs): void
    {
        if (empty($providerModelDetailDTOs)) {
            return;
        }

        // 收集所有图标路径按组织编码分组
        $iconsByOrg = [];
        $iconToModelMap = [];

        foreach ($providerModelDetailDTOs as $model) {
            $icon = $model->getIcon();
            if (empty($icon)) {
                continue;
            }

            $icon = FileAssembler::formatPath($icon);
            $pos = strpos($icon, '/');
            if ($pos === false) {
                continue;
            }
            $organizationCode = substr($icon, 0, $pos);

            if (! isset($iconsByOrg[$organizationCode])) {
                $iconsByOrg[$organizationCode] = [];
            }
            $iconsByOrg[$organizationCode][] = $icon;

            if (! isset($iconToModelMap[$icon])) {
                $iconToModelMap[$icon] = [];
            }
            $iconToModelMap[$icon][] = $model;
        }

        // 批量获取图标URL
        $iconUrlMap = [];
        foreach ($iconsByOrg as $organizationCode => $icons) {
            $links = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));
            $iconUrlMap = array_merge($iconUrlMap, $links);
        }

        // 设置图标URL
        foreach ($iconUrlMap as $icon => $fileLink) {
            if (isset($iconToModelMap[$icon])) {
                $url = $fileLink ? $fileLink->getUrl() : '';
                foreach ($iconToModelMap[$icon] as $model) {
                    $model->setIcon($url);
                }
            }
        }
    }

    /**
     * 获取图像模型尺寸配置.
     */
    protected function getImageSizeConfig(ProviderModelEntity $model): ?array
    {
        if (! in_array($model->getModelType(), [ModelType::TEXT_TO_IMAGE, ModelType::IMAGE_TO_IMAGE, ModelType::IMAGE_ENHANCE], true)) {
            return null;
        }

        $imageModelConfig = SizeManager::matchConfig($model->getModelVersion(), $model->getModelId());
        if ($imageModelConfig === null) {
            return null;
        }

        return [
            'sizes' => $imageModelConfig['sizes'] ?? [],
            'max_reference_images' => $imageModelConfig['max_reference_images'] ?? 0,
        ];
    }
}
