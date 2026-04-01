<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Assembler;

use App\Application\Mode\Assembler\AdminModeAssembler;
use App\Application\Mode\DTO\Admin\AdminModeAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupAggregateDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupDTO;
use App\Application\Mode\DTO\Admin\AdminModeGroupModelDTO;
use App\Application\Mode\DTO\ValueObject\ModelStatus;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class AdminModeAssemblerTest extends TestCase
{
    public function testGroupAggregateToAdminDtoSeparatesImageAndVideoModels(): void
    {
        $groupAggregate = $this->createGroupAggregate();

        $dto = AdminModeAssembler::groupAggregateToAdminDTO($groupAggregate, [
            'llm-model' => ['best' => $this->createProviderModel('llm-model', Category::LLM), 'status' => ModelStatus::Normal],
            'vlm-model' => ['best' => $this->createProviderModel('vlm-model', Category::VLM), 'status' => ModelStatus::Normal],
            'vgm-model' => ['best' => $this->createProviderModel('vgm-model', Category::VGM), 'status' => ModelStatus::Normal],
        ]);

        $this->assertCount(3, $dto->getModels());
        $this->assertCount(1, $dto->getTextModels());
        $this->assertCount(1, $dto->getImageModels());
        $this->assertCount(1, $dto->getVideoModels());
        $this->assertSame(
            ['llm-model', 'vlm-model', 'vgm-model'],
            array_map(fn (AdminModeGroupModelDTO $modelDTO) => $modelDTO->getModelId(), $dto->getModels())
        );
        $this->assertSame('llm-model', $dto->getTextModels()[0]->getModelId());
        $this->assertSame('vgm-model', $dto->getVideoModels()[0]->getModelId());
    }

    public function testAggregateDtoToEntityPersistsModelsImagesAndVideosIntoRelations(): void
    {
        $aggregateDTO = new AdminModeAggregateDTO();
        $aggregateDTO->setMode(new AdminModeDTO([
            'id' => 1,
            'identifier' => 'general',
            'name_i18n' => ['zh_CN' => '通用'],
            'placeholder_i18n' => ['zh_CN' => '占位'],
            'icon' => '',
            'icon_url' => '',
            'color' => '',
            'description' => '',
            'sort' => 0,
            'icon_type' => 1,
            'status' => true,
        ]));

        $groupDTO = new AdminModeGroupAggregateDTO(
            new AdminModeGroupDTO([
                'id' => 10,
                'mode_id' => 1,
                'name_i18n' => ['zh_CN' => '默认分组'],
            ]),
            [$this->createAdminModelDto('llm-model', 'llm')],
            [$this->createAdminModelDto('vlm-model', 'vlm')],
            [$this->createAdminModelDto('vgm-model', 'vgm')],
        );
        $aggregateDTO->setGroups([$groupDTO]);

        $entity = AdminModeAssembler::aggregateDTOToEntity($aggregateDTO);

        $this->assertInstanceOf(ModeAggregate::class, $entity);
        $relations = $entity->getGroupAggregates()[0]->getRelations();
        $this->assertSame(
            ['llm-model', 'vlm-model', 'vgm-model'],
            array_map(fn (ModeGroupRelationEntity $relation) => $relation->getModelId(), $relations)
        );
    }

    public function testMixedModelsPayloadIsNormalizedIntoImageAndVideoBuckets(): void
    {
        $aggregateDTO = new AdminModeAggregateDTO([
            'mode' => [
                'id' => 1,
                'identifier' => 'general',
                'name_i18n' => ['zh_CN' => '通用'],
                'placeholder_i18n' => ['zh_CN' => '占位'],
                'icon' => '',
                'icon_url' => '',
                'color' => '',
                'description' => '',
                'sort' => 0,
                'icon_type' => 1,
                'status' => true,
            ],
            'groups' => [[
                'group' => [
                    'id' => 10,
                    'mode_id' => 1,
                    'name_i18n' => ['zh_CN' => '默认分组'],
                ],
                'models' => [
                    [
                        'id' => 'llm-relation',
                        'group_id' => '10',
                        'model_id' => 'llm-model',
                        'provider_model_id' => '101',
                        'sort' => 3,
                        'model_category' => 'llm',
                    ],
                    [
                        'id' => 'vlm-relation',
                        'group_id' => '10',
                        'model_id' => 'vlm-model',
                        'provider_model_id' => '102',
                        'sort' => 2,
                        'model_category' => 'vlm',
                    ],
                    [
                        'id' => 'vgm-relation',
                        'group_id' => '10',
                        'model_id' => 'vgm-model',
                        'provider_model_id' => '103',
                        'sort' => 1,
                        'model_category' => 'vgm',
                    ],
                ],
            ]],
        ]);

        $groupDTO = $aggregateDTO->getGroups()[0];

        $this->assertSame(['llm-model', 'vlm-model', 'vgm-model'], array_map(fn (AdminModeGroupModelDTO $dto) => $dto->getModelId(), $groupDTO->getModels()));
        $this->assertSame(['llm-model'], array_map(fn (AdminModeGroupModelDTO $dto) => $dto->getModelId(), $groupDTO->getTextModels()));
        $this->assertSame(['vlm-model'], array_map(fn (AdminModeGroupModelDTO $dto) => $dto->getModelId(), $groupDTO->getImageModels()));
        $this->assertSame(['vgm-model'], array_map(fn (AdminModeGroupModelDTO $dto) => $dto->getModelId(), $groupDTO->getVideoModels()));
    }

    public function testMixedAndCategorizedPayloadsDoNotCreateDuplicateRelations(): void
    {
        $aggregateDTO = new AdminModeAggregateDTO([
            'mode' => [
                'id' => 1,
                'identifier' => 'general',
                'name_i18n' => ['zh_CN' => '通用'],
                'placeholder_i18n' => ['zh_CN' => '占位'],
                'icon' => '',
                'icon_url' => '',
                'color' => '',
                'description' => '',
                'sort' => 0,
                'icon_type' => 1,
                'status' => true,
            ],
            'groups' => [[
                'group' => [
                    'id' => 10,
                    'mode_id' => 1,
                    'name_i18n' => ['zh_CN' => '默认分组'],
                ],
                'models' => [
                    [
                        'id' => 'llm-relation',
                        'group_id' => '10',
                        'model_id' => 'llm-model',
                        'provider_model_id' => '101',
                        'sort' => 3,
                        'model_category' => 'llm',
                    ],
                    [
                        'id' => 'vlm-relation',
                        'group_id' => '10',
                        'model_id' => 'vlm-model',
                        'provider_model_id' => '102',
                        'sort' => 2,
                        'model_category' => 'vlm',
                    ],
                    [
                        'id' => 'vgm-relation',
                        'group_id' => '10',
                        'model_id' => 'vgm-model',
                        'provider_model_id' => '103',
                        'sort' => 1,
                        'model_category' => 'vgm',
                    ],
                ],
                'text_models' => [[
                    'id' => 'llm-relation',
                    'group_id' => '10',
                    'model_id' => 'llm-model',
                    'provider_model_id' => '101',
                    'sort' => 3,
                    'model_category' => 'llm',
                ]],
                'image_models' => [[
                    'id' => 'vlm-relation',
                    'group_id' => '10',
                    'model_id' => 'vlm-model',
                    'provider_model_id' => '102',
                    'sort' => 2,
                    'model_category' => 'vlm',
                ]],
                'video_models' => [[
                    'id' => 'vgm-relation',
                    'group_id' => '10',
                    'model_id' => 'vgm-model',
                    'provider_model_id' => '103',
                    'sort' => 1,
                    'model_category' => 'vgm',
                ]],
            ]],
        ]);

        $entity = AdminModeAssembler::aggregateDTOToEntity($aggregateDTO);

        $relations = $entity->getGroupAggregates()[0]->getRelations();
        $this->assertCount(3, $relations);
        $this->assertSame(
            ['llm-model', 'vlm-model', 'vgm-model'],
            array_map(fn (ModeGroupRelationEntity $relation) => $relation->getModelId(), $relations)
        );
    }

    private function createGroupAggregate(): ModeGroupAggregate
    {
        return new ModeGroupAggregate(
            new ModeGroupEntity([
                'id' => 10,
                'mode_id' => 1,
                'name_i18n' => ['zh_CN' => '默认分组'],
                'status' => true,
            ]),
            [
                new ModeGroupRelationEntity([
                    'id' => 1,
                    'mode_id' => 1,
                    'group_id' => 10,
                    'model_id' => 'llm-model',
                    'provider_model_id' => 101,
                    'sort' => 30,
                ]),
                new ModeGroupRelationEntity([
                    'id' => 2,
                    'mode_id' => 1,
                    'group_id' => 10,
                    'model_id' => 'vlm-model',
                    'provider_model_id' => 102,
                    'sort' => 20,
                ]),
                new ModeGroupRelationEntity([
                    'id' => 3,
                    'mode_id' => 1,
                    'group_id' => 10,
                    'model_id' => 'vgm-model',
                    'provider_model_id' => 103,
                    'sort' => 10,
                ]),
            ]
        );
    }

    private function createProviderModel(string $modelId, Category $category): ProviderModelEntity
    {
        return new ProviderModelEntity([
            'id' => random_int(1000, 9999),
            'service_provider_config_id' => 1,
            'name' => strtoupper($modelId),
            'model_id' => $modelId,
            'model_version' => $modelId . '-version',
            'category' => $category->value,
            'status' => 1,
            'organization_code' => 'TGosRaFhvb',
            'config' => ['support_function' => true],
        ]);
    }

    private function createAdminModelDto(string $modelId, string $category): AdminModeGroupModelDTO
    {
        return new AdminModeGroupModelDTO([
            'id' => $modelId . '-relation',
            'group_id' => '10',
            'mode_id' => '1',
            'model_id' => $modelId,
            'provider_model_id' => random_int(100, 999),
            'sort' => 1,
            'model_category' => $category,
        ]);
    }
}
