<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\LLMTestAppService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\Proxy\ProxyConfigResolverInterface;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Odin\Model\AbstractModel;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class LLMTestAppServiceTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

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

    public function testLlmConnectivityModelByConfigAppliesResolvedProxy(): void
    {
        $this->assertConnectivityModelByConfigAppliesResolvedProxy(false);
    }

    public function testEmbeddingConnectivityModelByConfigAppliesResolvedProxy(): void
    {
        $this->assertConnectivityModelByConfigAppliesResolvedProxy(true);
    }

    private function assertConnectivityModelByConfigAppliesResolvedProxy(bool $embedding): void
    {
        $proxyUrl = 'socks5h://user:pass@127.0.0.1:1080';
        $resolver = new class($proxyUrl) implements ProxyConfigResolverInterface {
            public array $resolvedConfigs = [];

            public function __construct(private readonly string $proxyUrl)
            {
            }

            public function resolve(array $config = []): ?string
            {
                $this->resolvedConfigs[] = $config;
                return $this->proxyUrl;
            }
        };
        ApplicationContext::setContainer($this->container($resolver));

        $service = (new ReflectionClass(LLMTestAppService::class))->newInstanceWithoutConstructor();
        $method = new ReflectionMethod($service, 'createConnectivityModelByConfig');
        $method->setAccessible(true);

        $model = $method->invoke($service, ProviderCode::OpenAI->value, [
            'api_key' => 'test-key',
            'url' => 'https://example.com/v1',
            'use_proxy' => true,
            'proxy_server' => [
                'id' => 12,
            ],
        ], 'gpt-4o-mini', $embedding);

        $this->assertInstanceOf(AbstractModel::class, $model);
        $this->assertSame($proxyUrl, $model->getApiRequestOptions()->getProxy());
        $this->assertSame(12, $resolver->resolvedConfigs[0]['proxy_server']['id'] ?? null);
    }

    private function container(ProxyConfigResolverInterface $resolver): ContainerInterface
    {
        return new class($resolver) implements ContainerInterface {
            public function __construct(private readonly ProxyConfigResolverInterface $resolver)
            {
            }

            public function get(string $id): mixed
            {
                return match ($id) {
                    ProxyConfigResolverInterface::class => $this->resolver,
                    PhpSerializerPacker::class => new PhpSerializerPacker(),
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return $default;
                        }

                        public function has(string $keys): bool
                        {
                            return false;
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    },
                    default => throw new RuntimeException('Unsupported service: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [ProxyConfigResolverInterface::class, PhpSerializerPacker::class, ConfigInterface::class], true);
            }
        };
    }
}
