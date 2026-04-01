<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Service;

use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\File\Service\FileDomainService;
use App\Domain\OrganizationEnvironment\DTO\MagicOrganizationEnvDTO;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\DeploymentEnum;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\SubscriptionManagerInterface;
use App\Infrastructure\Core\DataIsolation\ThirdPlatformDataIsolationManagerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\CreateProviderConfigRequest;
use App\Interfaces\Provider\DTO\UpdateProviderConfigRequest;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Mockery;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use RuntimeException;

/**
 * @internal
 */
class AdminProviderAppServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $config = Mockery::mock(ConfigInterface::class);
        $config->shouldReceive('get')->andReturnUsing(static function (string $key, mixed $default = null): mixed {
            return match ($key) {
                'app_env' => 'test',
                'service_provider.office_organization' => 'DT001',
                default => $default,
            };
        });

        $makeMap = [
            ThirdPlatformDataIsolationManagerInterface::class => Mockery::mock(ThirdPlatformDataIsolationManagerInterface::class),
            SubscriptionManagerInterface::class => Mockery::mock(SubscriptionManagerInterface::class),
            OrganizationInfoManagerInterface::class => Mockery::mock(OrganizationInfoManagerInterface::class),
        ];

        ApplicationContext::setContainer(new class($config, $makeMap) implements ContainerInterface {
            public function __construct(
                private readonly ConfigInterface $config,
                private readonly array $makeMap,
            ) {
            }

            public function get(string $id)
            {
                if ($id === ConfigInterface::class) {
                    return $this->config;
                }

                if ($id === PhpSerializerPacker::class) {
                    return new PhpSerializerPacker();
                }

                if (isset($this->makeMap[$id])) {
                    return $this->makeMap[$id];
                }

                throw new class(sprintf('No entry found for %s', $id)) extends RuntimeException implements NotFoundExceptionInterface {};
            }

            public function has(string $id): bool
            {
                return $id === ConfigInterface::class
                    || $id === PhpSerializerPacker::class
                    || isset($this->makeMap[$id]);
            }

            public function make(string $name, array $parameters = []): object
            {
                if (isset($this->makeMap[$name])) {
                    return $this->makeMap[$name];
                }

                return new $name(...array_values($parameters));
            }
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testQueriesServiceProviderTemplatesFiltersWhitelistAndAddsSchemaForDomesticPersonalSaasLlm(): void
    {
        $providerConfigDomainService = Mockery::mock(ProviderConfigDomainService::class);
        [$cloudFileRepository, $fileDomainService] = $this->makeFileDomainService();
        $providerModelDomainService = $this->makeProviderModelDomainService();
        $adminProviderDomainService = Mockery::mock(AdminProviderDomainService::class);
        $eventDispatcher = Mockery::mock(EventDispatcherInterface::class);
        $organizationAdminDomainService = Mockery::mock(OrganizationAdminDomainService::class);
        $magicOrganizationEnvDomainService = Mockery::mock(MagicOrganizationEnvDomainService::class);

        $dashScopeTemplate = $this->makeTemplateDTO(ProviderCode::DashScope);
        $deepSeekTemplate = $this->makeTemplateDTO(ProviderCode::DeepSeek);
        $openAiTemplate = $this->makeTemplateDTO(ProviderCode::OpenAI);

        $adminProviderDomainService->shouldReceive('queriesServiceProviderTemplates')
            ->once()
            ->with('org-personal', Category::LLM)
            ->andReturn([$dashScopeTemplate, $deepSeekTemplate, $openAiTemplate]);
        $organizationAdminDomainService->shouldReceive('getOrganizationInfo')
            ->once()
            ->andReturn($this->makeOrganizationEntity(1));
        $magicOrganizationEnvDomainService->shouldReceive('getOrganizationsEnvironmentDTO')
            ->once()
            ->with('org-personal')
            ->andReturn($this->makeOrganizationEnvDTO(DeploymentEnum::SaaS));
        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->with('org-personal', Mockery::type('array'), null, [], [])
            ->andReturn([]);

        $service = new AdminProviderAppService(
            $providerConfigDomainService,
            $fileDomainService,
            $providerModelDomainService,
            $adminProviderDomainService,
            $eventDispatcher,
            $organizationAdminDomainService,
            $magicOrganizationEnvDomainService,
        );

        $templates = $service->queriesServiceProviderTemplates(Category::LLM, 'org-personal');

        $this->assertCount(2, $templates);
        $this->assertSame(
            [ProviderCode::DashScope, ProviderCode::DeepSeek],
            array_map(static fn (ProviderConfigModelsDTO $template) => $template->getProviderCode(), $templates)
        );
        foreach ($templates as $template) {
            $this->assertSame(
                [
                    'api_key' => [
                        'required' => true,
                        'type' => 'string',
                    ],
                ],
                $template->getConfigSchema()
            );
        }
    }

    public function testQueriesServiceProviderTemplatesKeepsOriginalProvidersForTeamOrganization(): void
    {
        $providerConfigDomainService = Mockery::mock(ProviderConfigDomainService::class);
        [$cloudFileRepository, $fileDomainService] = $this->makeFileDomainService();
        $providerModelDomainService = $this->makeProviderModelDomainService();
        $adminProviderDomainService = Mockery::mock(AdminProviderDomainService::class);
        $eventDispatcher = Mockery::mock(EventDispatcherInterface::class);
        $organizationAdminDomainService = Mockery::mock(OrganizationAdminDomainService::class);
        $magicOrganizationEnvDomainService = Mockery::mock(MagicOrganizationEnvDomainService::class);

        $dashScopeTemplate = $this->makeTemplateDTO(ProviderCode::DashScope);
        $openAiTemplate = $this->makeTemplateDTO(ProviderCode::OpenAI);

        $adminProviderDomainService->shouldReceive('queriesServiceProviderTemplates')
            ->once()
            ->with('org-team', Category::LLM)
            ->andReturn([$dashScopeTemplate, $openAiTemplate]);
        $organizationAdminDomainService->shouldReceive('getOrganizationInfo')
            ->once()
            ->andReturn($this->makeOrganizationEntity(0));
        $magicOrganizationEnvDomainService->shouldNotReceive('getOrganizationsEnvironmentDTO');
        $cloudFileRepository->shouldReceive('getLinks')
            ->once()
            ->with('org-team', Mockery::type('array'), null, [], [])
            ->andReturn([]);

        $service = new AdminProviderAppService(
            $providerConfigDomainService,
            $fileDomainService,
            $providerModelDomainService,
            $adminProviderDomainService,
            $eventDispatcher,
            $organizationAdminDomainService,
            $magicOrganizationEnvDomainService,
        );

        $templates = $service->queriesServiceProviderTemplates(Category::LLM, 'org-team');

        $this->assertCount(2, $templates);
        $this->assertSame(
            [ProviderCode::DashScope, ProviderCode::OpenAI],
            array_map(static fn (ProviderConfigModelsDTO $template) => $template->getProviderCode(), $templates)
        );
        $this->assertSame([], $templates[0]->getConfigSchema());
        $this->assertSame([], $templates[1]->getConfigSchema());
    }

    public function testCreateProviderForcesDefaultUrlForDomesticPersonalSaasLlm(): void
    {
        $providerConfigDomainService = Mockery::mock(ProviderConfigDomainService::class);
        [$cloudFileRepository, $fileDomainService] = $this->makeFileDomainService();
        $providerModelDomainService = $this->makeProviderModelDomainService();
        $adminProviderDomainService = Mockery::mock(AdminProviderDomainService::class);
        $eventDispatcher = Mockery::mock(EventDispatcherInterface::class);
        $organizationAdminDomainService = Mockery::mock(OrganizationAdminDomainService::class);
        $magicOrganizationEnvDomainService = Mockery::mock(MagicOrganizationEnvDomainService::class);

        $providerEntity = $this->makeProviderEntity(ProviderCode::DashScope, 101);
        $savedConfigEntity = $this->makeProviderConfigEntity(101, ProviderCode::DashScope, 'org-personal', 'saved-key');

        $providerConfigDomainService->shouldReceive('getProviderById')
            ->twice()
            ->andReturn($providerEntity);
        $organizationAdminDomainService->shouldReceive('getOrganizationInfo')
            ->once()
            ->andReturn($this->makeOrganizationEntity(1));
        $magicOrganizationEnvDomainService->shouldReceive('getOrganizationsEnvironmentDTO')
            ->once()
            ->with('org-personal')
            ->andReturn($this->makeOrganizationEnvDTO(DeploymentEnum::SaaS));
        $providerConfigDomainService->shouldReceive('createProviderConfig')
            ->once()
            ->with(Mockery::type('App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation'), Mockery::on(
                static function (ProviderConfigEntity $entity): bool {
                    return $entity->getConfig()?->getApiKey() === 'saved-key'
                        && $entity->getConfig()?->getUrl() === 'https://dashscope.aliyuncs.com/compatible-mode/v1';
                }
            ))
            ->andReturn($savedConfigEntity);
        $eventDispatcher->shouldReceive('dispatch')->once();
        $cloudFileRepository->shouldNotReceive('getLinks');

        $service = new AdminProviderAppService(
            $providerConfigDomainService,
            $fileDomainService,
            $providerModelDomainService,
            $adminProviderDomainService,
            $eventDispatcher,
            $organizationAdminDomainService,
            $magicOrganizationEnvDomainService,
        );

        $request = new CreateProviderConfigRequest();
        $request->setServiceProviderId('101');
        $request->setAlias('DashScope');
        $request->setConfig([
            'api_key' => 'saved-key',
            'url' => 'https://custom.example.com/v1',
        ]);

        $authorization = $this->makeAuthorization('org-personal');
        $result = $service->createProvider($authorization, $request);

        $this->assertSame(
            'https://dashscope.aliyuncs.com/compatible-mode/v1',
            $result->getConfig()?->getUrl()
        );
    }

    public function testUpdateProviderForcesDefaultUrlForDomesticPersonalSaasLlm(): void
    {
        $providerConfigDomainService = Mockery::mock(ProviderConfigDomainService::class);
        [, $fileDomainService] = $this->makeFileDomainService();
        $providerModelDomainService = $this->makeProviderModelDomainService();
        $adminProviderDomainService = Mockery::mock(AdminProviderDomainService::class);
        $eventDispatcher = Mockery::mock(EventDispatcherInterface::class);
        $organizationAdminDomainService = Mockery::mock(OrganizationAdminDomainService::class);
        $magicOrganizationEnvDomainService = Mockery::mock(MagicOrganizationEnvDomainService::class);

        $existingConfigEntity = $this->makeProviderConfigEntity(202, ProviderCode::DeepSeek, 'org-personal', 'masked-key');
        $providerEntity = $this->makeProviderEntity(ProviderCode::DeepSeek, 202);
        $updatedConfigEntity = $this->makeProviderConfigEntity(202, ProviderCode::DeepSeek, 'org-personal', 'new-key');

        $providerConfigDomainService->shouldReceive('getConfigByIdWithoutOrganizationFilter')
            ->once()
            ->with(202)
            ->andReturn($existingConfigEntity);
        $providerConfigDomainService->shouldReceive('getProviderById')
            ->once()
            ->andReturn($providerEntity);
        $organizationAdminDomainService->shouldReceive('getOrganizationInfo')
            ->once()
            ->andReturn($this->makeOrganizationEntity(1));
        $magicOrganizationEnvDomainService->shouldReceive('getOrganizationsEnvironmentDTO')
            ->once()
            ->with('org-personal')
            ->andReturn($this->makeOrganizationEnvDTO(DeploymentEnum::SaaS));
        $providerConfigDomainService->shouldReceive('updateProviderConfig')
            ->once()
            ->with(Mockery::type('App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation'), Mockery::on(
                static function (ProviderConfigEntity $entity): bool {
                    return $entity->getConfig()?->getApiKey() === 'new-key'
                        && $entity->getConfig()?->getUrl() === 'https://api.deepseek.com';
                }
            ))
            ->andReturn($updatedConfigEntity);
        $eventDispatcher->shouldReceive('dispatch')->once();

        $service = new AdminProviderAppService(
            $providerConfigDomainService,
            $fileDomainService,
            $providerModelDomainService,
            $adminProviderDomainService,
            $eventDispatcher,
            $organizationAdminDomainService,
            $magicOrganizationEnvDomainService,
        );

        $request = new UpdateProviderConfigRequest();
        $request->setId('202');
        $request->setConfig([
            'api_key' => 'new-key',
            'url' => 'https://custom.example.com/v1',
        ]);

        $authorization = $this->makeAuthorization('org-personal');
        $result = $service->updateProvider($authorization, $request);

        $this->assertSame('https://api.deepseek.com', $result->getConfig()?->getUrl());
    }

    private function makeAuthorization(string $organizationCode): MagicUserAuthorization
    {
        return (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode($organizationCode);
    }

    /**
     * @return array{0: CloudFileRepositoryInterface, 1: FileDomainService}
     */
    private function makeFileDomainService(): array
    {
        $cloudFileRepository = Mockery::mock(CloudFileRepositoryInterface::class);

        return [$cloudFileRepository, new FileDomainService($cloudFileRepository)];
    }

    private function makeProviderModelDomainService(): ProviderModelDomainService
    {
        return new ProviderModelDomainService(
            Mockery::mock(ProviderModelRepositoryInterface::class),
            Mockery::mock(ProviderConfigRepositoryInterface::class),
            Mockery::mock(ProviderModelConfigVersionRepositoryInterface::class),
        );
    }

    private function makeOrganizationEntity(int $type): OrganizationEntity
    {
        $entity = new OrganizationEntity();
        $entity->setType($type);
        $entity->setMagicOrganizationCode('org-code');
        $entity->setName('Org');
        return $entity;
    }

    private function makeOrganizationEnvDTO(DeploymentEnum $deployment): MagicOrganizationEnvDTO
    {
        $dto = new MagicOrganizationEnvDTO();
        $dto->setDeployment($deployment);
        $dto->setEnvironmentId(1);
        $dto->setMagicOrganizationCode('org-code');
        return $dto;
    }

    private function makeTemplateDTO(ProviderCode $providerCode): ProviderConfigModelsDTO
    {
        $dto = new ProviderConfigModelsDTO();
        $dto->setProviderCode($providerCode);
        $dto->setCategory(Category::LLM);
        $dto->setIcon('');
        $dto->setName($providerCode->value);
        return $dto;
    }

    private function makeProviderEntity(ProviderCode $providerCode, int $id): ProviderEntity
    {
        $entity = new ProviderEntity();
        $entity->setId($id);
        $entity->setProviderCode($providerCode);
        $entity->setProviderType(ProviderType::Normal);
        $entity->setCategory(Category::LLM);
        $entity->setStatus(Status::Enabled);
        $entity->setName($providerCode->value);
        $entity->setDescription($providerCode->value);
        $entity->setIcon('');
        return $entity;
    }

    private function makeProviderConfigEntity(
        int $serviceProviderId,
        ProviderCode $providerCode,
        string $organizationCode,
        string $apiKey,
    ): ProviderConfigEntity {
        $entity = new ProviderConfigEntity();
        $entity->setId($serviceProviderId);
        $entity->setServiceProviderId($serviceProviderId);
        $entity->setOrganizationCode($organizationCode);
        $entity->setProviderCode($providerCode);
        $entity->setStatus(Status::Enabled);
        $entity->setAlias($providerCode->value);
        $entity->setConfig(new ProviderConfigItem([
            'api_key' => $apiKey,
            'url' => $providerCode->getDefaultUrl(),
        ]));
        return $entity;
    }
}
