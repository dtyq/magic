<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Assembler;

use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeDTO;
use App\Application\Mode\DTO\ModeGroupAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Application\Mode\DTO\ValueObject\ModelStatus;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use Hyperf\Contract\TranslatorInterface;

/**
 * Mode 聚合根 DTO 装配器。
 *
 * 在统一视频参数设计里，这一层不参与任何业务判断：
 * - 不解析 provider 能力
 * - 不做多 provider 交集
 * - 只把 app 层准备好的 featured 配置挂到返回 DTO
 */
class ModeAssembler
{
    public static function aggregateToDTO(
        ModeAggregate $aggregate,
        array $providerModels = [],
        array $upgradeRequiredModelIds = [],
        array $providerImageModels = [],
        array $providerVideoModels = [],
        array $featuredVideoGenerationConfigs = [],
        bool $loadImageModelConfig = true
    ): ModeAggregateDTO {
        $dto = new ModeAggregateDTO();
        $dto->setMode(self::modeToDTO($aggregate->getMode()));

        $groupAggregatesDTOs = [];
        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            $groupDTO = self::groupAggregateToDTO(
                $groupAggregate,
                $providerModels,
                $upgradeRequiredModelIds,
                $providerImageModels,
                $providerVideoModels,
                $featuredVideoGenerationConfigs,
                $loadImageModelConfig
            );
            // 只有当分组下有模型、图像模型或视频模型时才添加（前台过滤空分组）
            if (! empty($groupDTO->getModels()) || ! empty($groupDTO->getImageModels()) || ! empty($groupDTO->getVideoModels())) {
                $groupAggregatesDTOs[] = $groupDTO;
            }
        }

        $dto->setGroups($groupAggregatesDTOs);

        return $dto;
    }

    /**
     * @param array<string, ProviderModelEntity> $providerModels
     * @param array<string, ProviderModelEntity> $providerImageModels
     * @param array<string, VideoGenerationConfig> $featuredVideoGenerationConfigs
     */
    public static function groupAggregateToDTO(
        ModeGroupAggregate $groupAggregate,
        array $providerModels,
        array $upgradeRequiredModelIds = [],
        array $providerImageModels = [],
        array $providerVideoModels = [],
        array $featuredVideoGenerationConfigs = [],
        bool $loadImageModelConfig = true
    ): ModeGroupAggregateDTO {
        $dto = new ModeGroupAggregateDTO();
        $dto->setGroup(self::groupEntityToDTO($groupAggregate->getGroup()));
        $locale = di(TranslatorInterface::class)->getLocale();

        // 处理 LLM 模型
        $models = [];
        foreach ($groupAggregate->getRelations() as $relation) {
            $modelDTO = new ModeGroupModelDTO($relation->toArray());

            // 过滤掉套餐的情况
            $providerModelId = $relation->getModelId();
            if (isset($providerModels[$providerModelId])) {
                $providerModel = $providerModels[$providerModelId];
                self::fillModelDTO($modelDTO, $providerModel, $locale, $upgradeRequiredModelIds);
                $models[] = $modelDTO;
            }
        }

        // 处理 VLM 图像模型
        $imageModels = [];
        foreach ($groupAggregate->getRelations() as $relation) {
            $modelDTO = new ModeGroupModelDTO($relation->toArray());

            $providerModelId = $relation->getModelId();
            if (isset($providerImageModels[$providerModelId])) {
                $providerModel = $providerImageModels[$providerModelId];
                self::fillModelDTO($modelDTO, $providerModel, $locale, $upgradeRequiredModelIds);

                /*
                 * 添加图像模型的尺寸信息.
                 *
                 * 说明：当前模型配置中没有尺寸模版字段，为了简化实现和维护成本，
                 * 采用配置文件方式管理各图像模型支持的尺寸和分辨率信息。
                 *
                 * 维护说明：
                 * 1. 新增模型时，在 image_models.php 中添加对应的 match 规则和 config 配置
                 * 2. 优先使用 model_version 精准匹配，避免误匹配
                 * 3. 使用 model_id 进行模糊匹配（如豆包4.0/4.5）
                 */
                if ($loadImageModelConfig) {
                    $imageModelConfig = SizeManager::matchConfig(
                        $providerModel->getModelVersion(),
                        $providerModel->getModelId()
                    );
                    if ($imageModelConfig !== null) {
                        $modelDTO->setImageSizeConfigFromArray($imageModelConfig);
                    }
                }

                $imageModels[] = $modelDTO;
            }
        }

        $videoModels = [];
        $handledVideoModelIds = [];
        foreach ($groupAggregate->getRelations() as $relation) {
            $modelDTO = new ModeGroupModelDTO($relation->toArray());

            $providerModelId = $relation->getModelId();
            if (! isset($providerVideoModels[$providerModelId])) {
                continue;
            }

            $providerModel = $providerVideoModels[$providerModelId];
            $logicalModelId = $providerModel->getModelId();
            // 同一个逻辑视频模型可能接了多个 provider，
            // featured 对外只返回一份，因此这里按逻辑 model_id 去重。
            if (isset($handledVideoModelIds[$logicalModelId])) {
                continue;
            }

            self::fillModelDTO($modelDTO, $providerModel, $locale, $upgradeRequiredModelIds);
            // 具体 video_generation_config 已经在 app/domain 层求好，这里只负责挂载。
            $modelDTO->setVideoGenerationConfig($featuredVideoGenerationConfigs[$logicalModelId] ?? null);

            $videoModels[] = $modelDTO;
            $handledVideoModelIds[$logicalModelId] = true;
        }

        $dto->setModels($models);
        $dto->setImageModels($imageModels);
        $dto->setVideoModels($videoModels);

        return $dto;
    }

    public static function modeToDTO(ModeEntity $modeEntity): ModeDTO
    {
        $translator = di(TranslatorInterface::class);
        $locale = $translator->getLocale();

        $array = $modeEntity->toArray();
        unset($array['name_i18n'], $array['placeholder_i18n']);
        $modeDTO = new ModeDTO($array);
        $modeDTO->setName($modeEntity->getNameI18n()[$locale]);
        $modeDTO->setPlaceholder($modeEntity->getPlaceholderI18n()[$locale] ?? '');
        return $modeDTO;
    }

    private static function groupEntityToDTO(ModeGroupEntity $group): ModeGroupDTO
    {
        $dto = new ModeGroupDTO($group->toArray());
        $locale = di(TranslatorInterface::class)->getLocale();
        $dto->setName($group->getNameI18n()[$locale]);
        return $dto;
    }

    /**
     * @param list<string> $upgradeRequiredModelIds
     */
    private static function fillModelDTO(
        ModeGroupModelDTO $modelDTO,
        ProviderModelEntity $providerModel,
        string $locale,
        array $upgradeRequiredModelIds
    ): void {
        $modelDTO->setModelName($providerModel->getLocalizedName($locale));
        $modelDTO->setModelIcon($providerModel->getIcon());
        $modelDTO->setModelDescription($providerModel->getLocalizedDescription($locale));

        if (! in_array($providerModel->getModelId(), $upgradeRequiredModelIds, true)) {
            return;
        }

        $modelDTO->setTags(['VIP']);
        $modelDTO->setModelStatus(ModelStatus::Disabled);
    }
}
