<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\Provider\DTO\AiAbilityDetailDTO;
use App\Application\Provider\Service\KnowledgeBaseEmbeddingModelAbilityAppService;
use App\Domain\KnowledgeBase\Port\KnowledgeBaseGateway;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseFragmentRepositoryInterface;
use App\Domain\KnowledgeBase\Repository\Facade\KnowledgeBaseRepositoryInterface;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\UpdateAiAbilityRequest;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Contract\Api\Response\ResponseInterface as OdinResponseInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;

/**
 * @internal
 */
class KnowledgeBaseEmbeddingModelAbilityAppServiceTest extends TestCase
{
    public function testEnrichDetailUsesExistingKnowledgeBaseModelBeforeAbilityApplied(): void
    {
        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->expects($this->once())
            ->method('getCurrentEmbeddingModelId')
            ->willReturn('');
        $knowledgeBaseRepository->expects($this->once())
            ->method('getAllEmbeddingModelIds')
            ->willReturn(['BAAI/bge-base-zh-v1.5']);
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );
        $providerModelDomainService = new ProviderModelDomainService(
            $this->createMock(ProviderModelRepositoryInterface::class),
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $this->createMock(AiAbilityDomainService::class),
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $this->createMock(KnowledgeBaseGateway::class),
            $this->createMock(LLMAppService::class),
            $this->createMock(LockerInterface::class),
            $this->createMock(LoggerInterface::class),
        );

        $detail = new AiAbilityDetailDTO(
            id: 1,
            code: AiAbilityCode::KnowledgeBaseEmbeddingModel->value,
            name: '知识库嵌入模型',
            description: '',
            icon: '',
            sortOrder: 1,
            status: 1,
            config: [
                'model_id' => 'text-embedding-3-small',
            ],
        );

        $enriched = $service->enrichDetail($detail);

        $this->assertSame('BAAI/bge-base-zh-v1.5', $enriched->config['model_id']);
        $this->assertSame(['BAAI/bge-base-zh-v1.5'], $enriched->config['current_embedding_models']);
    }

    public function testEnrichDetailUsesCurrentEffectiveKnowledgeBaseModel(): void
    {
        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->expects($this->once())
            ->method('getCurrentEmbeddingModelId')
            ->willReturn('text-embedding-3-large');
        $knowledgeBaseRepository->expects($this->once())
            ->method('getAllEmbeddingModelIds')
            ->willReturn(['text-embedding-3-small']);
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );
        $providerModelDomainService = new ProviderModelDomainService(
            $this->createMock(ProviderModelRepositoryInterface::class),
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $this->createMock(AiAbilityDomainService::class),
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $this->createMock(KnowledgeBaseGateway::class),
            $this->createMock(LLMAppService::class),
            $this->createMock(LockerInterface::class),
            $this->createMock(LoggerInterface::class),
        );

        $detail = new AiAbilityDetailDTO(
            id: 1,
            code: AiAbilityCode::KnowledgeBaseEmbeddingModel->value,
            name: '知识库嵌入模型',
            description: '',
            icon: '',
            sortOrder: 1,
            status: 1,
            config: [
                'model_id' => 'text-embedding-3-small',
            ],
        );

        $enriched = $service->enrichDetail($detail);

        $this->assertSame('text-embedding-3-large', $enriched->config['model_id']);
        $this->assertSame(['text-embedding-3-small'], $enriched->config['current_embedding_models']);
    }

    public function testEnrichDetailReturnsEmptyWhenNoKnowledgeBaseModelExists(): void
    {
        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->expects($this->once())
            ->method('getCurrentEmbeddingModelId')
            ->willReturn('');
        $knowledgeBaseRepository->expects($this->once())
            ->method('getAllEmbeddingModelIds')
            ->willReturn([]);
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );
        $providerModelDomainService = new ProviderModelDomainService(
            $this->createMock(ProviderModelRepositoryInterface::class),
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $this->createMock(AiAbilityDomainService::class),
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $this->createMock(KnowledgeBaseGateway::class),
            $this->createMock(LLMAppService::class),
            $this->createMock(LockerInterface::class),
            $this->createMock(LoggerInterface::class),
        );

        $detail = new AiAbilityDetailDTO(
            id: 1,
            code: AiAbilityCode::KnowledgeBaseEmbeddingModel->value,
            name: '知识库嵌入模型',
            description: '',
            icon: '',
            sortOrder: 1,
            status: 1,
            config: [
                'model_id' => 'text-embedding-3-small',
            ],
        );

        $enriched = $service->enrichDetail($detail);

        $this->assertSame('', $enriched->config['model_id']);
        $this->assertSame([], $enriched->config['current_embedding_models']);
    }

    public function testEnrichDetailKeepsConfiguredModelWhenExistingKnowledgeBasesUseOldModel(): void
    {
        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->expects($this->once())
            ->method('getCurrentEmbeddingModelId')
            ->willReturn('text-embedding-3-small');
        $knowledgeBaseRepository->expects($this->once())
            ->method('getAllEmbeddingModelIds')
            ->willReturn(['text-embedding-3-small']);
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );
        $providerModelDomainService = new ProviderModelDomainService(
            $this->createMock(ProviderModelRepositoryInterface::class),
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $this->createMock(AiAbilityDomainService::class),
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $this->createMock(KnowledgeBaseGateway::class),
            $this->createMock(LLMAppService::class),
            $this->createMock(LockerInterface::class),
            $this->createMock(LoggerInterface::class),
        );

        $detail = new AiAbilityDetailDTO(
            id: 1,
            code: AiAbilityCode::KnowledgeBaseEmbeddingModel->value,
            name: '知识库嵌入模型',
            description: '',
            icon: '',
            sortOrder: 1,
            status: 1,
            config: [
                'model_id' => 'BAAI/bge-base-zh-v1.5',
                'applied_model_id' => 'BAAI/bge-base-zh-v1.5',
                'applied_dimension' => 768,
            ],
        );

        $enriched = $service->enrichDetail($detail);

        $this->assertSame('BAAI/bge-base-zh-v1.5', $enriched->config['model_id']);
        $this->assertSame(['text-embedding-3-small'], $enriched->config['current_embedding_models']);
    }

    public function testUpdateSwitchesEmbeddingModelMetaWithoutRebuild(): void
    {
        $ability = new AiAbilityEntity();
        $ability->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
        $ability->setConfig([
            'model_id' => 'text-embedding-3-small',
            'applied_model_id' => 'text-embedding-3-small',
            'applied_dimension' => 1536,
        ]);

        $aiAbilityDomainService = $this->createMock(AiAbilityDomainService::class);
        $aiAbilityDomainService->method('getByCode')->willReturn($ability);
        $savedConfigs = [];
        $aiAbilityDomainService->expects($this->exactly(3))
            ->method('updateByCode')
            ->willReturnCallback(static function ($dataIsolation, AiAbilityCode $code, array $data) use (&$savedConfigs): bool {
                $savedConfigs[] = $data['config'] ?? [];
                return $code === AiAbilityCode::KnowledgeBaseEmbeddingModel;
            });

        $providerModel = new ProviderModelEntity();
        $providerModel->setModelId('test-embed');
        $providerModel->setModelType(ModelType::EMBEDDING);
        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerModelRepository->method('getAvailableByModelIdOrId')->willReturn($providerModel);
        $providerModelDomainService = new ProviderModelDomainService(
            $providerModelRepository,
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->method('getAllEmbeddingModelIds')->willReturn(['text-embedding-3-small']);
        $knowledgeBaseRepository->method('getCurrentEmbeddingModelId')->willReturn('text-embedding-3-small');
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );

        $knowledgeBaseGateway = $this->createMock(KnowledgeBaseGateway::class);
        $knowledgeBaseGateway->expects($this->once())
            ->method('rebuildStatus')
            ->willReturn(['current_run_id' => '']);
        $knowledgeBaseGateway->expects($this->never())->method('rebuild');
        $knowledgeBaseGateway->expects($this->once())
            ->method('switchEmbeddingModelMeta')
            ->with($this->callback(static function (KnowledgeBaseRequestDTO $request): bool {
                return $request->payload['target_model'] === 'test-embed'
                    && $request->payload['target_dimension'] === 3
                    && $request->dataIsolation->organizationCode === 'ORG-1'
                    && $request->dataIsolation->userId === 'U1';
            }))
            ->willReturn([
                'model' => 'test-embed',
                'vector_dimension' => 3,
            ]);

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('embeddings')
            ->with($this->callback(static fn (EmbeddingsDTO $request): bool => $request->getModel() === 'test-embed'))
            ->willReturn(new EmbeddingProbeResponse([0.1, 0.2, 0.3]));

        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())->method('mutexLock')->willReturn(true);
        $locker->expects($this->once())->method('release')->willReturn(true);

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $aiAbilityDomainService,
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $knowledgeBaseGateway,
            $llmAppService,
            $locker,
            $this->createMock(LoggerInterface::class),
        );

        $authorization = (new MagicUserAuthorization())->setOrganizationCode('ORG-1')->setId('U1');
        $request = new UpdateAiAbilityRequest();
        $request->setConfig(['model_id' => 'test-embed']);

        $this->assertTrue($service->update($authorization, $request));

        $finalConfig = end($savedConfigs);
        $this->assertSame('test-embed', $finalConfig['model_id']);
        $this->assertSame('test-embed', $finalConfig['applied_model_id']);
        $this->assertSame(3, $finalConfig['applied_dimension']);
        $this->assertArrayNotHasKey('pending_model_id', $finalConfig);
        $this->assertArrayNotHasKey('rebuild_status', $finalConfig);
        $this->assertArrayNotHasKey('rebuild_run_id', $finalConfig);
        $this->assertArrayNotHasKey('switch_model_id', $finalConfig);
        $this->assertArrayNotHasKey('switch_status', $finalConfig);
    }

    public function testUpdateDoesNotSwitchWhenSubmittedModelAlreadyEffective(): void
    {
        $ability = new AiAbilityEntity();
        $ability->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
        $ability->setConfig([
            'model_id' => 'doubao-embedding-vision',
            'applied_model_id' => 'doubao-embedding-vision',
            'applied_dimension' => 2048,
        ]);

        $aiAbilityDomainService = $this->createMock(AiAbilityDomainService::class);
        $aiAbilityDomainService->method('getByCode')->willReturn($ability);
        $savedConfigs = [];
        $aiAbilityDomainService->expects($this->once())
            ->method('updateByCode')
            ->willReturnCallback(static function ($dataIsolation, AiAbilityCode $code, array $data) use (&$savedConfigs): bool {
                $savedConfigs[] = $data['config'] ?? [];
                return $code === AiAbilityCode::KnowledgeBaseEmbeddingModel;
            });

        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->method('getAllEmbeddingModelIds')->willReturn(['doubao-embedding-vision', 'test-embed']);
        $knowledgeBaseRepository->method('getCurrentEmbeddingModelId')->willReturn('doubao-embedding-vision');
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );

        $knowledgeBaseGateway = $this->createMock(KnowledgeBaseGateway::class);
        $knowledgeBaseGateway->expects($this->never())->method('rebuildStatus');
        $knowledgeBaseGateway->expects($this->never())->method('rebuild');
        $knowledgeBaseGateway->expects($this->never())->method('switchEmbeddingModelMeta');

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->never())->method('embeddings');

        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->never())->method('mutexLock');
        $locker->expects($this->never())->method('release');

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $aiAbilityDomainService,
            $this->createMock(ProviderModelDomainService::class),
            $knowledgeBaseDomainService,
            $knowledgeBaseGateway,
            $llmAppService,
            $locker,
            $this->createMock(LoggerInterface::class),
        );

        $authorization = (new MagicUserAuthorization())->setOrganizationCode('ORG-1')->setId('U1');
        $request = new UpdateAiAbilityRequest();
        $request->setConfig(['model_id' => 'doubao-embedding-vision']);

        $this->assertTrue($service->update($authorization, $request));

        $finalConfig = end($savedConfigs);
        $this->assertSame('doubao-embedding-vision', $finalConfig['model_id']);
        $this->assertSame('doubao-embedding-vision', $finalConfig['applied_model_id']);
        $this->assertSame(2048, $finalConfig['applied_dimension']);
    }

    public function testUpdateInitializesEmbeddingModelMetaWhenNoKnowledgeBaseExists(): void
    {
        $ability = new AiAbilityEntity();
        $ability->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
        $ability->setConfig([
            'model_id' => 'test-embed',
        ]);

        $aiAbilityDomainService = $this->createMock(AiAbilityDomainService::class);
        $aiAbilityDomainService->method('getByCode')->willReturn($ability);
        $savedConfigs = [];
        $aiAbilityDomainService->expects($this->exactly(3))
            ->method('updateByCode')
            ->willReturnCallback(static function ($dataIsolation, AiAbilityCode $code, array $data) use (&$savedConfigs): bool {
                $savedConfigs[] = $data['config'] ?? [];
                return $code === AiAbilityCode::KnowledgeBaseEmbeddingModel;
            });

        $providerModel = new ProviderModelEntity();
        $providerModel->setModelId('test-embed');
        $providerModel->setModelType(ModelType::EMBEDDING);
        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerModelRepository->method('getAvailableByModelIdOrId')->willReturn($providerModel);
        $providerModelDomainService = new ProviderModelDomainService(
            $providerModelRepository,
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->method('getAllEmbeddingModelIds')->willReturn([]);
        $knowledgeBaseRepository->method('getCurrentEmbeddingModelId')->willReturn('');
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );

        $knowledgeBaseGateway = $this->createMock(KnowledgeBaseGateway::class);
        $knowledgeBaseGateway->expects($this->once())
            ->method('rebuildStatus')
            ->willReturn(['current_run_id' => '']);
        $knowledgeBaseGateway->expects($this->never())->method('rebuild');
        $knowledgeBaseGateway->expects($this->once())
            ->method('switchEmbeddingModelMeta')
            ->with($this->callback(static function (KnowledgeBaseRequestDTO $request): bool {
                return $request->payload['target_model'] === 'test-embed'
                    && $request->payload['target_dimension'] === 3;
            }))
            ->willReturn([
                'model' => 'test-embed',
                'vector_dimension' => 3,
            ]);

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('embeddings')
            ->with($this->callback(static fn (EmbeddingsDTO $request): bool => $request->getModel() === 'test-embed'))
            ->willReturn(new EmbeddingProbeResponse([0.1, 0.2, 0.3]));

        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())->method('mutexLock')->willReturn(true);
        $locker->expects($this->once())->method('release')->willReturn(true);

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $aiAbilityDomainService,
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $knowledgeBaseGateway,
            $llmAppService,
            $locker,
            $this->createMock(LoggerInterface::class),
        );

        $authorization = (new MagicUserAuthorization())->setOrganizationCode('ORG-1')->setId('U1');
        $request = new UpdateAiAbilityRequest();
        $request->setConfig(['model_id' => 'test-embed']);

        $this->assertTrue($service->update($authorization, $request));

        $finalConfig = end($savedConfigs);
        $this->assertSame('test-embed', $finalConfig['model_id']);
        $this->assertSame('test-embed', $finalConfig['applied_model_id']);
        $this->assertSame(3, $finalConfig['applied_dimension']);
        $this->assertArrayNotHasKey('switch_model_id', $finalConfig);
        $this->assertArrayNotHasKey('pending_model_id', $finalConfig);
    }

    public function testUpdateRecordsSwitchFailureWithoutLegacyPendingRebuildState(): void
    {
        $ability = new AiAbilityEntity();
        $ability->setCode(AiAbilityCode::KnowledgeBaseEmbeddingModel);
        $ability->setConfig([
            'model_id' => 'text-embedding-3-small',
            'applied_model_id' => 'text-embedding-3-small',
            'applied_dimension' => 1536,
        ]);

        $aiAbilityDomainService = $this->createMock(AiAbilityDomainService::class);
        $aiAbilityDomainService->method('getByCode')->willReturn($ability);
        $savedConfigs = [];
        $aiAbilityDomainService->expects($this->exactly(2))
            ->method('updateByCode')
            ->willReturnCallback(static function ($dataIsolation, AiAbilityCode $code, array $data) use (&$savedConfigs): bool {
                $savedConfigs[] = $data['config'] ?? [];
                return $code === AiAbilityCode::KnowledgeBaseEmbeddingModel;
            });

        $providerModel = new ProviderModelEntity();
        $providerModel->setModelId('test-embed');
        $providerModel->setModelType(ModelType::EMBEDDING);
        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerModelRepository->method('getAvailableByModelIdOrId')->willReturn($providerModel);
        $providerModelDomainService = new ProviderModelDomainService(
            $providerModelRepository,
            $this->createMock(ProviderConfigRepositoryInterface::class),
            $this->createMock(ProviderModelConfigVersionRepositoryInterface::class),
        );

        $knowledgeBaseRepository = $this->createMock(KnowledgeBaseRepositoryInterface::class);
        $knowledgeBaseRepository->method('getAllEmbeddingModelIds')->willReturn(['text-embedding-3-small']);
        $knowledgeBaseRepository->method('getCurrentEmbeddingModelId')->willReturn('text-embedding-3-small');
        $knowledgeBaseDomainService = new KnowledgeBaseDomainService(
            $knowledgeBaseRepository,
            $this->createMock(KnowledgeBaseFragmentRepositoryInterface::class),
            $this->createMock(CacheInterface::class),
        );

        $knowledgeBaseGateway = $this->createMock(KnowledgeBaseGateway::class);
        $knowledgeBaseGateway->expects($this->once())
            ->method('rebuildStatus')
            ->willReturn(['current_run_id' => '']);
        $knowledgeBaseGateway->expects($this->never())->method('rebuild');
        $knowledgeBaseGateway->expects($this->once())
            ->method('switchEmbeddingModelMeta')
            ->willThrowException(new BusinessException('switch failed'));

        $llmAppService = $this->createMock(LLMAppService::class);
        $llmAppService->expects($this->once())
            ->method('embeddings')
            ->willReturn(new EmbeddingProbeResponse([0.1, 0.2, 0.3]));

        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->once())->method('mutexLock')->willReturn(true);
        $locker->expects($this->once())->method('release')->willReturn(true);

        $service = new KnowledgeBaseEmbeddingModelAbilityAppService(
            $aiAbilityDomainService,
            $providerModelDomainService,
            $knowledgeBaseDomainService,
            $knowledgeBaseGateway,
            $llmAppService,
            $locker,
            $this->createMock(LoggerInterface::class),
        );

        $authorization = (new MagicUserAuthorization())->setOrganizationCode('ORG-1')->setId('U1');
        $request = new UpdateAiAbilityRequest();
        $request->setConfig(['model_id' => 'test-embed']);

        try {
            $service->update($authorization, $request);
            $this->fail('Expected switch failure');
        } catch (BusinessException $exception) {
            $this->assertSame('switch failed', $exception->getMessage());
        }

        $failedConfig = end($savedConfigs);
        $this->assertSame('test-embed', $failedConfig['switch_model_id']);
        $this->assertSame(3, $failedConfig['switch_dimension']);
        $this->assertSame('failed', $failedConfig['switch_status']);
        $this->assertSame('switch failed', $failedConfig['switch_last_error']);
        $this->assertArrayNotHasKey('pending_model_id', $failedConfig);
        $this->assertArrayNotHasKey('target_dimension', $failedConfig);
        $this->assertArrayNotHasKey('rebuild_status', $failedConfig);
        $this->assertArrayNotHasKey('rebuild_run_id', $failedConfig);
    }
}

final class EmbeddingProbeResponse implements OdinResponseInterface
{
    /**
     * @param array<int, float> $embedding
     */
    public function __construct(private readonly array $embedding)
    {
    }

    public function getUsage(): ?Usage
    {
        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'data' => [
                ['embedding' => $this->embedding],
            ],
        ];
    }
}
