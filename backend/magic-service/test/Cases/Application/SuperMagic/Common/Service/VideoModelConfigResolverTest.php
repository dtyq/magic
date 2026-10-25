<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Common\Service;

use App\Application\ModelGateway\Mapper\ModelAttributes;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\SuperMagic\Common\Service\VideoModelConfigResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\Core\DataIsolation\BaseOrganizationInfoManager;
use App\Infrastructure\Core\DataIsolation\BaseSubscriptionManager;
use App\Infrastructure\Core\DataIsolation\BaseThirdPlatformDataIsolationManager;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoModel;
use DateTime;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use ReflectionProperty;
use RuntimeException;

/**
 * @internal
 */
class VideoModelConfigResolverTest extends TestCase
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

    public function testOrganizationModelDoesNotFallbackToOfficialFeaturedConfig(): void
    {
        $modelId = 'dq8ajgpv5lme_MiniMax-H3';
        $modelGatewayMapper = $this->createMock(ModelGatewayMapper::class);
        $modelEntry = new ModelEntry(
            new ModelAttributes(
                key: $modelId,
                name: 'MiniMax H3',
                label: 'MiniMax H3',
                icon: '',
                tags: [],
                createdAt: new DateTime(),
                owner: 'dq8ajgpv5lme',
                modelVersion: 'MiniMax-H3',
                providerCode: ProviderCode::MiniMax->value,
            ),
            new VideoModel([], 'MiniMax-H3', 'provider-model', ProviderCode::MiniMax),
        );
        $modelGatewayMapper->expects($this->once())
            ->method('getOrganizationVideoModel')
            ->with($this->anything(), $modelId)
            ->willReturn($modelEntry);

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === PhpSerializerPacker::class) {
                    return new PhpSerializerPacker();
                }

                throw new RuntimeException('No service is available in the value object bootstrap container');
            }

            public function has(string $id): bool
            {
                return $id === PhpSerializerPacker::class;
            }
        });
        $featuredConfig = new VideoGenerationConfig(['generation' => ['default_duration_seconds' => 5]]);
        $videoGenerationConfigDomainService = new StubVideoGenerationConfigDomainService([
            $modelId => $featuredConfig,
        ]);
        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        ApplicationContext::setContainer(new VideoModelConfigResolverTestContainer(
            modelGatewayMapper: $modelGatewayMapper,
            videoGenerationConfigDomainService: $videoGenerationConfigDomainService,
            loggerFactory: $loggerFactory,
        ));

        putenv('APP_ENV=testing');
        $dataIsolation = new DataIsolation();
        $organizationProperty = new ReflectionProperty(DataIsolation::class, 'currentOrganizationCode');
        $organizationProperty->setAccessible(true);
        $organizationProperty->setValue($dataIsolation, 'dq8ajgpv5lme');
        $this->assertSame('dq8ajgpv5lme', $dataIsolation->getCurrentOrganizationCode());

        $result = (new VideoModelConfigResolver())->findVideoGenerationConfig($modelId, $dataIsolation);

        $this->assertNull($result);
    }
}

readonly class StubVideoGenerationConfigDomainService extends VideoGenerationConfigDomainService
{
    public function __construct(private array $featuredConfigs)
    {
    }

    public function resolveFeatured(array $candidates): array
    {
        return $this->featuredConfigs;
    }

    public function resolve(string $modelVersion, string $providerModelId, ProviderCode $providerCode): ?VideoGenerationConfig
    {
        return null;
    }
}

final class VideoModelConfigResolverTestContainer implements ContainerInterface
{
    public function __construct(
        private readonly ModelGatewayMapper $modelGatewayMapper,
        private readonly VideoGenerationConfigDomainService $videoGenerationConfigDomainService,
        private readonly LoggerFactory $loggerFactory,
    ) {
    }

    public function get(string $id): mixed
    {
        return match ($id) {
            ModelGatewayMapper::class => $this->modelGatewayMapper,
            VideoGenerationConfigDomainService::class => $this->videoGenerationConfigDomainService,
            LoggerFactory::class => $this->loggerFactory,
            ConfigInterface::class => new class implements ConfigInterface {
                public function get(string $key, mixed $default = null): mixed
                {
                    return match ($key) {
                        'service_provider.office_organization' => 'official',
                        'app_env' => 'testing',
                        default => $default,
                    };
                }

                public function has(string $keys): bool
                {
                    return $keys === 'service_provider.office_organization';
                }

                public function set(string $key, mixed $value): void
                {
                }
            },
            ThirdPlatformDataIsolationManagerInterface::class => new BaseThirdPlatformDataIsolationManager(),
            SubscriptionManagerInterface::class => new BaseSubscriptionManager(),
            OrganizationInfoManagerInterface::class => new BaseOrganizationInfoManager(),
            default => throw new RuntimeException('Unsupported service: ' . $id),
        };
    }

    public function make(string $id, array $parameters = []): mixed
    {
        return $this->get($id);
    }

    public function has(string $id): bool
    {
        return true;
    }
}
