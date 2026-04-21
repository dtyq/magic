<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\Service;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderModelDomainServiceTest extends TestCase
{
    #[DataProvider('dynamicCategoryModelTypeProvider')]
    public function testSyncAggregateModelCreatesDynamicModelWithModelTypeMatchedToCategory(
        string $category,
        Category $expectedCategory,
        ModelType $expectedModelType
    ): void {
        $repository = $this->createMock(ProviderModelRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('getByModelId')
            ->with($this->isInstanceOf(ProviderDataIsolation::class), 'dynamic-model')
            ->willReturn(null);
        $repository->expects($this->once())
            ->method('create')
            ->with(
                $this->isInstanceOf(ProviderDataIsolation::class),
                $this->callback(function (ProviderModelEntity $entity) use ($expectedCategory, $expectedModelType): bool {
                    $this->assertSame($expectedCategory, $entity->getCategory());
                    $this->assertSame($expectedModelType, $entity->getModelType());
                    $this->assertSame(ProviderModelType::DYNAMIC, $entity->getType());

                    return true;
                })
            )
            ->willReturnArgument(1);

        $service = $this->createService($repository);

        $model = $service->syncAggregateModel(
            $this->dataIsolation(),
            'dynamic-model',
            'Dynamic Model',
            [['model_id' => 'base-model']],
            category: $category
        );

        $this->assertSame($expectedCategory, $model->getCategory());
        $this->assertSame($expectedModelType, $model->getModelType());
    }

    #[DataProvider('dynamicCategoryModelTypeProvider')]
    public function testSyncAggregateModelUpdatesDynamicModelTypeWhenCategoryChanges(
        string $category,
        Category $expectedCategory,
        ModelType $expectedModelType
    ): void {
        $existingModel = new ProviderModelEntity([
            'id' => 123,
            'service_provider_config_id' => 0,
            'name' => 'Old Dynamic Model',
            'model_id' => 'dynamic-model',
            'model_version' => 'v1.0',
            'category' => Category::LLM->value,
            'model_type' => ModelType::LLM->value,
            'config' => ['support_function' => true],
            'organization_code' => 'org-test',
            'status' => Status::Enabled->value,
            'type' => ProviderModelType::DYNAMIC->value,
            'aggregate_config' => [
                'models' => [['model_id' => 'old-base-model']],
                'strategy' => 'permission_fallback',
                'strategy_config' => ['order' => 'asc'],
            ],
        ]);

        $repository = $this->createMock(ProviderModelRepositoryInterface::class);
        $repository->expects($this->once())
            ->method('getByModelId')
            ->with($this->isInstanceOf(ProviderDataIsolation::class), 'dynamic-model')
            ->willReturn($existingModel);
        $repository->expects($this->once())
            ->method('saveModel')
            ->with(
                $this->isInstanceOf(ProviderDataIsolation::class),
                $this->callback(function (SaveProviderModelDTO $dto) use ($expectedCategory, $expectedModelType): bool {
                    $this->assertSame($expectedCategory, $dto->getCategory());
                    $this->assertSame($expectedModelType, $dto->getModelType());

                    return true;
                })
            )
            ->willReturnCallback(static function (ProviderDataIsolation $dataIsolation, SaveProviderModelDTO $dto): ProviderModelEntity {
                return new ProviderModelEntity($dto->toArray());
            });

        $service = $this->createService($repository);

        $model = $service->syncAggregateModel(
            $this->dataIsolation(),
            'dynamic-model',
            'Updated Dynamic Model',
            [['model_id' => 'base-model']],
            category: $category
        );

        $this->assertSame($expectedCategory, $model->getCategory());
        $this->assertSame($expectedModelType, $model->getModelType());
    }

    public static function dynamicCategoryModelTypeProvider(): array
    {
        return [
            'vlm uses image-to-image model type' => [Category::VLM->value, Category::VLM, ModelType::IMAGE_TO_IMAGE],
            'vgm uses text-to-video model type' => [Category::VGM->value, Category::VGM, ModelType::TEXT_TO_VIDEO],
        ];
    }

    private function createService(ProviderModelRepositoryInterface $repository): ProviderModelDomainService
    {
        return new ProviderModelDomainService(
            $repository,
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class)
        );
    }

    private function dataIsolation(): ProviderDataIsolation
    {
        return ProviderDataIsolation::create(currentOrganizationCode: 'org-test');
    }
}
