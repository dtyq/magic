<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\DashScopeVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\Wan30VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan30GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateProviderType;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use RuntimeException;

/**
 * @internal
 */
class DashScopeVideoAdapterRouterTest extends TestCase
{
    protected function setUp(): void
    {
        ApplicationContext::setContainer(new readonly class implements ContainerInterface {
            public function get(string $id): mixed
            {
                return $id === TranslatorInterface::class ? new class implements TranslatorInterface {
                    public function trans(string $key, array $replace = [], ?string $locale = null): string
                    {
                        return $key;
                    }

                    public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                    {
                        return $key;
                    }

                    public function getLocale(): string
                    {
                        return 'zh_CN';
                    }

                    public function setLocale(string $locale)
                    {
                        return $this;
                    }
                } : null;
            }

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class;
            }
        });
    }

    public function testProviderTypeMapsDashScopeProviderCode(): void
    {
        $this->assertSame(
            VideoGenerateProviderType::DashScope,
            VideoGenerateProviderType::fromProviderCode(ProviderCode::DashScope)
        );
    }

    public function testSupportsConnectivityTest(): void
    {
        $transport = $this->createMock(DashScopeTransportInterface::class);
        $transport->expects($this->once())->method('submitVideo')->willReturn(['output' => ['task_id' => 'connectivity-task']]);
        $transport->expects($this->once())->method('queryTask')->willReturn(['output' => [
            'code' => 'InvalidParameter',
            'message' => 'duration must be -1 or in [2,30]',
        ]]);
        $wan30VideoAdapter = new Wan30VideoAdapter(new Wan30GenerationCapabilityProvider(), $transport);

        $router = new DashScopeVideoAdapterRouter($wan30VideoAdapter);

        self::assertInstanceOf(VideoGenerationConnectivityTestableInterface::class, $router);
        self::assertTrue($router->testConnection($this->config(), 'wan3.0-video'));
    }

    public function testBuildProviderPayloadDispatchesWan30Adapter(): void
    {
        $router = new DashScopeVideoAdapterRouter($this->wan30Adapter());

        $operation = $this->createWan30Operation();
        $payload = $router->buildProviderPayload($operation);

        $this->assertSame('wan3.0-video', $payload['model']);
    }

    public function testUnknownModelThrowsRuntimeExceptionWhenRoutingOperation(): void
    {
        $router = new DashScopeVideoAdapterRouter(
            $this->wan30Adapter(),
        );

        $operation = $this->createOperation(model: 'unknown-model', modelVersion: 'unknown-model');

        $this->expectException(RuntimeException::class);
        $router->buildProviderPayload($operation);
    }

    private function wan30Adapter(): Wan30VideoAdapter
    {
        return new Wan30VideoAdapter(
            new Wan30GenerationCapabilityProvider(),
            $this->createMock(DashScopeTransportInterface::class),
        );
    }

    private function createWan30Operation(): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-dashscope-router-wan30',
            endpoint: 'video:wan3.0',
            model: 'wan3.0-video',
            modelVersion: 'wan3.0-video',
            providerModelId: 'provider-model',
            providerCode: 'DashScope',
            providerName: 'dashscope',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: ['prompt' => '生成一段视频'],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createOperation(string $model = 'unknown-model', string $modelVersion = 'unknown-model'): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-dashscope-router-1',
            endpoint: 'video:unknown',
            model: $model,
            modelVersion: $modelVersion,
            providerModelId: 'provider-model',
            providerCode: 'DashScope',
            providerName: 'dashscope',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: ['prompt' => '生成一段视频'],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function config(): QueueExecutorConfig
    {
        return new QueueExecutorConfig('https://dashscope.example', 'secret', 3, 20);
    }
}
