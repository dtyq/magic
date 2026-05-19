<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingOmniVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingV3VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingV3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Guzzle\ClientFactory;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * @internal
 */
class KelingVideoAdapterRouterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $logger = $this->createMock(LoggerInterface::class);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static function (string $key, mixed $default = null): mixed {
            return match ($key) {
                'error_message' => [
                    'exception_class' => BusinessException::class,
                    'error_code_mapper' => [
                        MagicApiErrorCode::class => [4000, 4999],
                    ],
                ],
                default => $default,
            };
        });

        $translator = new class implements TranslatorInterface {
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
        };

        ApplicationContext::setContainer(new readonly class($loggerFactory, $config, $translator) implements ContainerInterface {
            public function __construct(
                private LoggerFactory $loggerFactory,
                private ConfigInterface $config,
                private TranslatorInterface $translator,
            ) {
            }

            public function get(string $id): mixed
            {
                return match ($id) {
                    LoggerFactory::class => $this->loggerFactory,
                    ConfigInterface::class => $this->config,
                    TranslatorInterface::class => $this->translator,
                    default => null,
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [
                    LoggerFactory::class,
                    ConfigInterface::class,
                    TranslatorInterface::class,
                ], true);
            }
        });
    }

    public function testSupportsModelMatchesAnyRegisteredAdapter(): void
    {
        $router = $this->createRouter();

        $this->assertTrue($router->supportsModel('kling-v3-omni', 'keling-video'));
        $this->assertTrue($router->supportsModel('YGNqszpCuuWLpyUt', 'keling-3.0-video'));
        $this->assertFalse($router->supportsModel('unknown-version', 'unknown-model'));
    }

    public function testBuildProviderPayloadDelegatesToMatchingAdapter(): void
    {
        $router = $this->createRouter();

        $operation = $this->createOperation('keling-video', 'kling-v3-omni');
        $operation->setRawRequest([
            'prompt' => '保持主体一致',
            'inputs' => [],
            'generation' => [],
        ]);

        $payload = $router->buildProviderPayload($operation);
        $this->assertSame('kling-v3-omni', $payload['model_name']);
    }

    public function testBuildProviderPayloadDelegatesToMatchingV3Adapter(): void
    {
        $router = $this->createRouter();

        $operation = $this->createOperation('keling-3.0-video', 'YGNqszpCuuWLpyUt');
        $operation->setRawRequest([
            'prompt' => '保持主体一致',
            'inputs' => [],
            'generation' => [],
        ]);

        $payload = $router->buildProviderPayload($operation);
        $this->assertSame('kling-v3', $payload['model_name']);
    }

    public function testBuildProviderPayloadRejectsUnsupportedReferenceAudios(): void
    {
        $router = $this->createRouter();
        $operation = $this->createOperation('keling-video', 'kling-v3-omni');
        $operation->setRawRequest([
            'prompt' => '{{audio_1}} 配合画面节奏',
            'inputs' => [
                'reference_audios' => [
                    ['uri' => 'https://localhost/ref.mp3'],
                ],
            ],
            'generation' => [],
        ]);

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('inputs.reference_audios is invalid');

        $router->buildProviderPayload($operation);
    }

    public function testBuildProviderPayloadThrowsWhenNoAdapterMatches(): void
    {
        $router = $this->createRouter();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('unsupported Keling video model: unknown-model (unknown-version)');

        $router->buildProviderPayload($this->createOperation('unknown-model', 'unknown-version'));
    }

    private function createRouter(): KelingVideoAdapterRouter
    {
        return new KelingVideoAdapterRouter(
            new KelingOmniVideoAdapter(
                new KelingOmniGenerationCapabilityProvider(),
                new KelingTransportFactory(
                    new ApiKeyKelingTransport(
                        new KelingVideoClient($this->createMock(ClientFactory::class))
                    )
                )
            ),
            new KelingV3VideoAdapter(
                new KelingV3GenerationCapabilityProvider(),
                new KelingTransportFactory(
                    new ApiKeyKelingTransport(
                        new KelingVideoClient($this->createMock(ClientFactory::class))
                    )
                )
            )
        );
    }

    private function createOperation(string $modelId, string $modelVersion): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-router-1',
            endpoint: 'video:' . $modelId,
            model: $modelId,
            modelVersion: $modelVersion,
            providerModelId: 'provider-model',
            providerCode: 'Keling',
            providerName: 'keling',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: ['prompt' => 'test'],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
