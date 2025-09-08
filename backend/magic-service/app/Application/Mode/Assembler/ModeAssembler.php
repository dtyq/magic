<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Assembler;

use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeDTO;
use App\Application\Mode\DTO\ModeGroupAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use Hyperf\Contract\TranslatorInterface;

class ModeAssembler
{
    public static function aggregateToDTO(ModeAggregate $aggregate, array $providerModels = []): ModeAggregateDTO
    {
        $dto = new ModeAggregateDTO();
        $dto->setMode(self::modeToDTO($aggregate->getMode()));

        $groupAggregatesDTOs = [];
        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            $groupDTO = self::groupAggregateToDTO($groupAggregate, $providerModels);
            // 只有当分组下有模型时才添加（前台过滤空分组）
            if (! empty($groupDTO->getModels())) {
                $groupAggregatesDTOs[] = $groupDTO;
            }
        }

        $dto->setGroups($groupAggregatesDTOs);

        return $dto;
    }

    public static function groupAggregateToDTO(ModeGroupAggregate $groupAggregate, array $providerModels): ModeGroupAggregateDTO
    {
        $dto = new ModeGroupAggregateDTO();
        $dto->setGroup(self::groupEntityToDTO($groupAggregate->getGroup()));
        $locale = di(TranslatorInterface::class)->getLocale();

        $models = [];
        foreach ($groupAggregate->getRelations() as $relation) {
            $modelDTO = new ModeGroupModelDTO($relation->toArray());

            // 过滤掉套餐的情况
            $providerModelId = $relation->getModelId();
            if (isset($providerModels[$providerModelId])) {
                $providerModel = $providerModels[$providerModelId];
                $modelDTO->setModelName($providerModel->getName());
                $modelDTO->setModelIcon($providerModel->getIcon());

                $description = '';
                $translate = $providerModel->getTranslate();
                if (is_array($translate) && isset($translate['description'][$locale])) {
                    $description = $translate['description'][$locale];
                } else {
                    $description = $providerModel->getDescription();
                }
                $modelDTO->setModelDescription($description);
                $models[] = $modelDTO;
            }
        }

        $dto->setModels($models);

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

    /**
     * 将ModeAggregate转换为扁平化的分组DTO数组.
     * @param $providerModels ProviderModelEntity[]
     * @return ModeGroupDetailDTO[]
     */
    public static function aggregateToFlatGroupsDTO(ModeAggregate $aggregate, array $providerModels = []): array
    {
        $flatGroups = [];

        foreach ($aggregate->getGroupAggregates() as $groupAggregate) {
            $modeGroupEntity = $groupAggregate->getGroup();
            $modeGroupDetailDTO = new ModeGroupDetailDTO($modeGroupEntity->toArray());
            $locale = di(TranslatorInterface::class)->getLocale();
            $modeGroupDetailDTO->setName($modeGroupEntity->getNameI18n()[$locale]);

            // 设置模型信息
            $models = [];
            foreach ($groupAggregate->getRelations() as $relation) {
                $modelDTO = new ModeGroupModelDTO($relation->toArray());

                // 如果提供了模型信息，则填充模型名称和图标
                $providerModelId = $relation->getModelId();
                if (isset($providerModels[$providerModelId])) {
                    $providerModel = $providerModels[$providerModelId];
                    $modelDTO->setModelName($providerModel->getName());
                    $modelDTO->setModelIcon($providerModel->getIcon());

                    $description = '';
                    $translate = $providerModel->getTranslate();
                    if (is_array($translate) && isset($translate['description'][$locale])) {
                        $description = $translate['description'][$locale];
                    } else {
                        $description = $providerModel->getDescription();
                    }
                    $modelDTO->setModelDescription($description);
                    $models[] = $modelDTO;
                }
            }

            // 只有当分组下有模型时才添加（前台过滤空分组）
            if (! empty($models)) {
                $modeGroupDetailDTO->setModels($models);
                $modeGroupDetailDTO->sortModels(); // 对模型排序
                $flatGroups[] = $modeGroupDetailDTO;
            }
        }

        // 对分组排序（降序，越大越前）
        usort($flatGroups, function ($a, $b) {
            return $b->getSort() <=> $a->getSort();
        });

        return $flatGroups;
    }

    private static function groupEntityToDTO(ModeGroupEntity $getGroup)
    {
        $dto = new ModeGroupDTO($getGroup->toArray());
        $locale = di(TranslatorInterface::class)->getLocale();
        $dto->setName($getGroup->getNameI18n()[$locale]);
        return $dto;
    }
}
