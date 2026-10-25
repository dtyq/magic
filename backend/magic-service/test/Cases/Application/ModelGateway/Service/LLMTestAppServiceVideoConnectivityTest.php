<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\LLMTestAppService;
use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\Provider\Entity\ValueObject\NaturalLanguageProcessing;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use Hyperf\Context\ApplicationContext;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class LLMTestAppServiceVideoConnectivityTest extends TestCase
{
    private mixed $previousContainer = null;

    private bool $hadContainer = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->hadContainer = ApplicationContext::hasContainer();
        $this->previousContainer = $this->hadContainer ? ApplicationContext::getContainer() : null;
    }

    protected function tearDown(): void
    {
        if ($this->hadContainer && $this->previousContainer instanceof ContainerInterface) {
            ApplicationContext::setContainer($this->previousContainer);
        } else {
            $property = new ReflectionProperty(ApplicationContext::class, 'container');
            $property->setAccessible(true);
            $property->setValue(null, null);
        }

        $this->previousContainer = null;
        $this->hadContainer = false;

        parent::tearDown();
    }

    public function testVideoCategoryUsesVideoConnectivityType(): void
    {
        $service = (new ReflectionClass(LLMTestAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod(LLMTestAppService::class, 'getConnectivityTestType');
        $method->setAccessible(true);

        $this->assertSame(
            NaturalLanguageProcessing::VIDEO,
            $method->invoke($service, 'vgm', null),
        );
    }

    public function testConfigBasedVideoConnectivityUsesConfigWithoutModelLookup(): void
    {
        $adapter = $this->createMock(VideoGenerationConnectivityTestableInterface::class);
        $adapter->expects($this->once())
            ->method('testConnection')
            ->with(
                $this->callback(static fn (QueueExecutorConfig $config): bool => $config->getBaseUrl() === 'https://video.example.com/v1'
                    && $config->getApiKey() === 'secret-key'),
                'MiniMax-H3',
            )
            ->willReturn(true);

        $factory = $this->createMock(VideoGenerationProviderAdapterFactoryInterface::class);
        $factory->expects($this->once())
            ->method('createByProviderCode')
            ->with(ProviderCode::MiniMax, 'MiniMax-H3')
            ->willReturn($adapter);

        ApplicationContext::setContainer(new class($factory) implements ContainerInterface {
            public function __construct(private readonly VideoGenerationProviderAdapterFactoryInterface $factory)
            {
            }

            public function get(string $id): mixed
            {
                if ($id === VideoGenerationProviderAdapterFactoryInterface::class) {
                    return $this->factory;
                }

                throw new RuntimeException('Unsupported service: ' . $id);
            }

            public function has(string $id): bool
            {
                return $id === VideoGenerationProviderAdapterFactoryInterface::class;
            }
        });

        $request = new ConnectivityTestByConfigRequest();
        $request->setCategory('vgm');
        $request->setProviderCode(ProviderCode::MiniMax->value);
        $request->setModelVersion('MiniMax-H3');
        $request->setServiceProviderConfig([
            'url' => 'https://video.example.com/v1',
            'api_key' => 'secret-key',
        ]);

        $service = (new ReflectionClass(LLMTestAppService::class))->newInstanceWithoutConstructor();
        $response = $service->connectivityTestByConfig($request, new MagicUserAuthorization());

        $this->assertTrue($response->isStatus());
    }
}
