<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Mode\Assembler;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModeAssemblerTest extends TestCase
{
    public function testAggregateToDtoSeparatesConfiguredModelsByCategory(): void
    {
        $aggregate = $this->createAggregate();

        $dto = ModeAssembler::aggregateToDTO(
            $aggregate,
            ['llm-model' => $this->createProviderModel('llm-model', Category::LLM)],
            [],
            ['vlm-model' => $this->createProviderModel('vlm-model', Category::VLM)],
            ['vgm-model' => $this->createProviderModel('vgm-model', Category::VGM)],
        );

        $group = $dto->getGroups()[0];

        $this->assertSame(['llm-model'], array_map(fn ($model) => $model->getModelId(), $group->getModels()));
        $this->assertSame(['vlm-model'], array_map(fn ($model) => $model->getModelId(), $group->getImageModels()));
        $this->assertSame(['vgm-model'], array_map(fn ($model) => $model->getModelId(), $group->getVideoModels()));
        $this->assertNull($group->getVideoModels()[0]->getVideoGenerationConfig());
    }

    public function testAggregateToDtoAddsVeoVideoGenerationConfig(): void
    {
        $aggregate = $this->createAggregateWithSingleVideoModel('veo-3.1-fast-generate-preview');

        $dto = ModeAssembler::aggregateToDTO(
            $aggregate,
            [],
            [],
            [],
            ['veo-3.1-fast-generate-preview' => $this->createProviderModel('veo-3.1-fast-generate-preview', Category::VGM)],
            ['veo-3.1-fast-generate-preview' => new VideoGenerationConfig([
                'supported_inputs' => ['text_prompt', 'image', 'last_frame'],
                'reference_images' => [
                    'max_count' => 0,
                    'reference_types' => [],
                    'style_supported' => false,
                ],
                'generation' => [
                    'aspect_ratios' => ['16:9', '9:16'],
                    'durations' => [],
                    'resolutions' => ['720p', '1080p', '4k'],
                    'sizes' => [
                        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
                        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
                        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
                        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
                        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
                        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
                    ],
                    'default_resolution' => '720p',
                    'supports_seed' => false,
                    'supports_negative_prompt' => false,
                    'supports_generate_audio' => false,
                    'supports_person_generation' => false,
                    'supports_enhance_prompt' => false,
                    'supports_compression_quality' => false,
                    'supports_resize_mode' => false,
                    'supports_sample_count' => false,
                ],
                'constraints' => [],
            ])],
        );

        $config = $dto->getGroups()[0]->getVideoModels()[0]->getVideoGenerationConfig();

        $this->assertNotNull($config);
        $this->assertSame(['16:9', '9:16'], $config->toArray()['generation']['aspect_ratios']);
        $this->assertSame(['720p', '1080p', '4k'], $config->toArray()['generation']['resolutions']);
        $this->assertCount(6, $config->toArray()['generation']['sizes']);
        $this->assertSame(['text_prompt', 'image', 'last_frame'], $config->toArray()['supported_inputs']);
        $this->assertFalse($config->toArray()['generation']['supports_seed']);
    }

    private function createAggregate(): ModeAggregate
    {
        $mode = new ModeEntity([
            'id' => 1,
            'identifier' => 'general',
            'name_i18n' => ['zh_CN' => '通用'],
            'placeholder_i18n' => ['zh_CN' => '占位'],
            'status' => true,
        ]);
        $group = new ModeGroupEntity([
            'id' => 10,
            'mode_id' => 1,
            'name_i18n' => ['zh_CN' => '默认分组'],
            'status' => true,
        ]);

        return new ModeAggregate($mode, [
            new ModeGroupAggregate($group, [
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
            ]),
        ]);
    }

    private function createAggregateWithSingleVideoModel(string $modelId): ModeAggregate
    {
        $mode = new ModeEntity([
            'id' => 1,
            'identifier' => 'design',
            'name_i18n' => ['zh_CN' => '设计'],
            'placeholder_i18n' => ['zh_CN' => '占位'],
            'status' => true,
        ]);
        $group = new ModeGroupEntity([
            'id' => 10,
            'mode_id' => 1,
            'name_i18n' => ['zh_CN' => '视频'],
            'status' => true,
        ]);

        return new ModeAggregate($mode, [
            new ModeGroupAggregate($group, [
                new ModeGroupRelationEntity([
                    'id' => 3,
                    'mode_id' => 1,
                    'group_id' => 10,
                    'model_id' => $modelId,
                    'provider_model_id' => 103,
                    'sort' => 10,
                ]),
            ]),
        ]);
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
}
