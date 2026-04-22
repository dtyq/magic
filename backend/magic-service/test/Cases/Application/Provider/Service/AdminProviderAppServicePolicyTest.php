<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Policy\ProviderControlPolicyInterface;
use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderRepositoryInterface;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\DataIsolation\DataIsolationInterface;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationStatus;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\SaveProviderConfigRequest;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use RuntimeException;

/**
 * @internal
 */
class AdminProviderAppServicePolicyTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function make(string $id, array $parameters = []): mixed
            {
                return $this->get($id);
            }

            public function get(string $id)
            {
                return match ($id) {
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'error_message' => [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [
                                        ServiceProviderErrorCode::class => [0, PHP_INT_MAX],
                                    ],
                                ],
                                'app_env' => 'test',
                                default => $default,
                            };
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'error_message';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    },
                    TranslatorInterface::class => new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): array|string
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
                    },
                    ThirdPlatformDataIsolationManagerInterface::class => new class implements ThirdPlatformDataIsolationManagerInterface {
                        public function extends(DataIsolationInterface $parentDataIsolation): void
                        {
                        }

                        public function init(DataIsolationInterface $dataIsolation, MagicEnvironmentEntity $magicEnvironmentEntity): void
                        {
                        }

                        public function toArray(): array
                        {
                            return [];
                        }
                    },
                    SubscriptionManagerInterface::class => new class implements SubscriptionManagerInterface {
                        public function isEnabled(): bool
                        {
                            return false;
                        }

                        public function setEnabled(bool $enabled): void
                        {
                        }

                        public function setCurrentSubscription(string $subscriptionId, array $subscriptionInfo, array $modelIdsGroupByType = []): void
                        {
                        }

                        public function getCurrentSubscriptionId(): string
                        {
                            return '';
                        }

                        public function getCurrentSubscriptionInfo(): array
                        {
                            return [];
                        }

                        public function getAvailableModelIds(?ModelType $modelType): ?array
                        {
                            return null;
                        }

                        public function isValidModelAvailable(string $modelId, ?ModelType $modelType): bool
                        {
                            return true;
                        }

                        public function isPaidSubscription(): bool
                        {
                            return false;
                        }

                        public function toArray(): array
                        {
                            return [];
                        }
                    },
                    OrganizationInfoManagerInterface::class => new class implements OrganizationInfoManagerInterface {
                        public function getOrganizationId(): ?int
                        {
                            return null;
                        }

                        public function getOrganizationCode(): string
                        {
                            return '';
                        }

                        public function getOrganizationName(): string
                        {
                            return '';
                        }

                        public function getOrganizationType(): OrganizationType
                        {
                            return OrganizationType::Team;
                        }

                        public function getOrganizationStatus(): OrganizationStatus
                        {
                            return OrganizationStatus::Normal;
                        }

                        public function setOrganizationId(?int $organizationId): void
                        {
                        }

                        public function setOrganizationCode(string $organizationCode): void
                        {
                        }

                        public function setOrganizationName(string $organizationName): void
                        {
                        }

                        public function setOrganizationType(OrganizationType $organizationType): void
                        {
                        }

                        public function setOrganizationStatus(OrganizationStatus $organizationStatus): void
                        {
                        }

                        public function toArray(): array
                        {
                            return [];
                        }
                    },
                    PhpSerializerPacker::class => new PhpSerializerPacker(),
                    default => throw new RuntimeException('Unsupported service: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [
                    TranslatorInterface::class,
                    ConfigInterface::class,
                    ThirdPlatformDataIsolationManagerInterface::class,
                    SubscriptionManagerInterface::class,
                    OrganizationInfoManagerInterface::class,
                    PhpSerializerPacker::class,
                ], true);
            }
        });
    }

    public function testQueriesServiceProviderTemplatesDelegatesFilteringToPolicy(): void
    {
        $policy = $this->createMock(ProviderControlPolicyInterface::class);
        $adminProviderDomainService = $this->createMock(AdminProviderDomainService::class);
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);

        $openAiProvider = new ProviderConfigModelsDTO();
        $openAiProvider->setProviderCode(ProviderCode::OpenAI);
        $qwenProvider = new ProviderConfigModelsDTO();
        $qwenProvider->setProviderCode(ProviderCode::Qwen);
        $providers = [$openAiProvider, $qwenProvider];

        $adminProviderDomainService->expects($this->once())
            ->method('queriesServiceProviderTemplates')
            ->with('ORG_1', Category::LLM)
            ->willReturn($providers);
        $policy->expects($this->once())
            ->method('filterSelectableProviders')
            ->with('ORG_1', Category::LLM, $providers)
            ->willReturn([$qwenProvider]);
        $cloudFileRepository->method('getLinks')->willReturn([]);

        $service = $this->createService(
            policy: $policy,
            fileDomainService: new FileDomainService($cloudFileRepository),
            adminProviderDomainService: $adminProviderDomainService,
        );

        $result = $service->queriesServiceProviderTemplates(Category::LLM, 'ORG_1');

        $this->assertCount(1, $result);
        $this->assertSame(ProviderCode::Qwen, $result[0]->getProviderCode());
    }

    public function testSaveProviderConfigDelegatesPreparationToPolicy(): void
    {
        $policy = $this->createMock(ProviderControlPolicyInterface::class);
        $providerConfigDomainService = $this->createMock(ProviderConfigDomainService::class);
        $providerEntity = new ProviderEntity();
        $providerEntity->setId(11);
        $providerEntity->setName('OpenAI');
        $providerEntity->setProviderCode(ProviderCode::OpenAI);
        $providerEntity->setProviderType(ProviderType::Normal);
        $providerEntity->setCategory(Category::LLM);
        $providerEntity->setIcon('');
        $providerConfigDomainService->expects($this->once())
            ->method('getProviderById')
            ->with($this->anything(), 11)
            ->willReturn($providerEntity);

        $policy->expects($this->once())
            ->method('prepareProviderConfigForSave')
            ->with(
                'ORG_1',
                ProviderCode::OpenAI,
                Category::LLM,
                ['api_key' => 'raw-key', 'url' => 'https://raw.example.com/v1']
            )
            ->willReturn(['api_key' => 'raw-key', 'url' => 'https://normalized.example.com/v1']);

        $providerConfigDomainService->expects($this->once())
            ->method('createProviderConfig')
            ->with(
                $this->anything(),
                $this->callback(function (ProviderConfigEntity $entity): bool {
                    return $entity->getServiceProviderId() === 11
                        && $entity->getOrganizationCode() === 'ORG_1'
                        && $entity->getProviderCode() === ProviderCode::OpenAI
                        && $entity->getConfig()?->getUrl() === 'https://normalized.example.com/v1';
                })
            )
            ->willReturnCallback(static function ($dataIsolation, ProviderConfigEntity $entity): ProviderConfigEntity {
                $entity->setId(99);
                return $entity;
            });

        $service = $this->createService(
            policy: $policy,
            providerConfigDomainService: $providerConfigDomainService,
            fileDomainService: new FileDomainService($this->createMock(CloudFileRepositoryInterface::class)),
            adminProviderDomainService: $this->createMock(AdminProviderDomainService::class),
            eventDispatcher: $this->createMock(EventDispatcherInterface::class),
        );

        $authorization = $this->createMock(MagicUserAuthorization::class);
        $authorization->method('getOrganizationCode')->willReturn('ORG_1');
        $authorization->method('getId')->willReturn('USER_1');

        $request = new SaveProviderConfigRequest();
        $request->setAlias('OpenAI Custom');
        $request->setServiceProviderId('11');
        $request->setConfig([
            'api_key' => 'raw-key',
            'url' => 'https://raw.example.com/v1',
        ]);
        $request->setTranslate([]);

        $result = $service->saveProviderConfig($authorization, $request);

        $this->assertSame('99', $result->getId());
        $this->assertSame(ProviderCode::OpenAI, $result->getProviderCode());
    }

    private function createService(
        ProviderControlPolicyInterface $policy,
        ?ProviderConfigDomainService $providerConfigDomainService = null,
        ?FileDomainService $fileDomainService = null,
        ?ProviderModelDomainService $providerModelDomainService = null,
        ?AdminProviderDomainService $adminProviderDomainService = null,
        ?EventDispatcherInterface $eventDispatcher = null,
    ): AdminProviderAppService {
        $providerModelRepository = $this->createMock(ProviderModelRepositoryInterface::class);
        $providerConfigRepository = $this->createMock(ProviderConfigRepositoryInterface::class);
        $providerRepository = $this->createMock(ProviderRepositoryInterface::class);
        $providerModelConfigVersionRepository = $this->createMock(ProviderModelConfigVersionRepositoryInterface::class);

        $providerConfigDomainService ??= $this->createMock(ProviderConfigDomainService::class);
        $fileDomainService ??= new FileDomainService($this->createMock(CloudFileRepositoryInterface::class));
        $providerModelDomainService ??= new ProviderModelDomainService(
            $providerModelRepository,
            $providerConfigRepository,
            $providerModelConfigVersionRepository,
        );
        $adminProviderDomainService ??= $this->createMock(AdminProviderDomainService::class);
        $eventDispatcher ??= $this->createMock(EventDispatcherInterface::class);

        return new AdminProviderAppService(
            $providerConfigDomainService,
            $fileDomainService,
            $providerModelDomainService,
            $adminProviderDomainService,
            $eventDispatcher,
            $policy,
        );
    }
}
