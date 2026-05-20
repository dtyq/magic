<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Kernel\MagicPermission;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Util\Permission\Annotation\CheckProviderModelPermission;
use App\Infrastructure\Util\Permission\Service\ProviderModelPermissionResolver;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\HttpServer\Contract\RequestInterface;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ProviderModelPermissionResolverTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testResolvePermissionKeyByRequestCategoryForPlatformVideoModel(): void
    {
        $request = $this->mockRequest(
            input: static fn (string $key, mixed $default = null): mixed => match ($key) {
                'category' => 'vgm',
                'model_type' => null,
                default => $default,
            }
        );

        $resolver = new ProviderModelPermissionResolver(
            new MagicPermission(),
            Mockery::mock(ProviderConfigDomainService::class),
            Mockery::mock(ProviderModelDomainService::class),
        );

        $permissionKey = $resolver->resolvePermissionKey(
            CheckProviderModelPermission::SCOPE_PLATFORM,
            CheckProviderModelPermission::SOURCE_REQUEST_CATEGORY,
            'query',
            $this->createAuthorization(),
            $request,
        );

        $this->assertSame('platform.model.video.query', $permissionKey);
    }

    public function testResolvePermissionKeyByModelIdForWorkspaceImageModel(): void
    {
        $request = $this->mockRequest(
            route: static fn (string $key): mixed => $key === 'modelId' ? 'model-1' : null,
            input: static fn (string $key, mixed $default = null): mixed => $default
        );

        $modelEntity = new ProviderModelEntity();
        $modelEntity->setCategory(Category::VLM);
        $modelEntity->setModelType(ModelType::IMAGE_TO_IMAGE);

        $providerModelDomainService = Mockery::mock(ProviderModelDomainService::class);
        $providerModelDomainService->shouldReceive('getById')->once()->andReturn($modelEntity);

        $resolver = new ProviderModelPermissionResolver(
            new MagicPermission(),
            Mockery::mock(ProviderConfigDomainService::class),
            $providerModelDomainService,
        );

        $permissionKey = $resolver->resolvePermissionKey(
            CheckProviderModelPermission::SCOPE_WORKSPACE,
            CheckProviderModelPermission::SOURCE_MODEL_ID,
            'edit',
            $this->createAuthorization(),
            $request,
        );

        $this->assertSame('workspace.model.image.edit', $permissionKey);
    }

    public function testResolvePermissionKeyByProviderConfigIdForPlatformTextModel(): void
    {
        $request = $this->mockRequest(
            route: static fn (string $key): mixed => $key === 'serviceProviderConfigId' ? '99' : null,
            input: static fn (string $key, mixed $default = null): mixed => $default
        );

        $providerConfigEntity = new ProviderConfigEntity();
        $providerConfigEntity->setServiceProviderId(88);

        $providerEntity = new ProviderEntity();
        $providerEntity->setCategory(Category::LLM);

        $providerConfigDomainService = Mockery::mock(ProviderConfigDomainService::class);
        $providerConfigDomainService->shouldReceive('getProviderConfig')->once()->andReturn($providerConfigEntity);
        $providerConfigDomainService->shouldReceive('getProviderById')->once()->andReturn($providerEntity);

        $resolver = new ProviderModelPermissionResolver(
            new MagicPermission(),
            $providerConfigDomainService,
            Mockery::mock(ProviderModelDomainService::class),
        );

        $permissionKey = $resolver->resolvePermissionKey(
            CheckProviderModelPermission::SCOPE_PLATFORM,
            CheckProviderModelPermission::SOURCE_PROVIDER_CONFIG_ID,
            'query',
            $this->createAuthorization(),
            $request,
        );

        $this->assertSame('platform.model.text.query', $permissionKey);
    }

    public function testResolvePermissionKeyByProviderConfigRequestForWorkspaceImageModel(): void
    {
        $request = $this->mockRequest(
            input: static fn (string $key, mixed $default = null): mixed => match ($key) {
                'id' => null,
                'service_provider_id' => '77',
                default => $default,
            },
            route: static fn (string $key): mixed => null
        );

        $providerEntity = new ProviderEntity();
        $providerEntity->setCategory(Category::VLM);

        $providerConfigDomainService = Mockery::mock(ProviderConfigDomainService::class);
        $providerConfigDomainService->shouldReceive('getProviderById')->once()->andReturn($providerEntity);

        $resolver = new ProviderModelPermissionResolver(
            new MagicPermission(),
            $providerConfigDomainService,
            Mockery::mock(ProviderModelDomainService::class),
        );

        $permissionKey = $resolver->resolvePermissionKey(
            CheckProviderModelPermission::SCOPE_WORKSPACE,
            CheckProviderModelPermission::SOURCE_PROVIDER_CONFIG_REQUEST,
            'edit',
            $this->createAuthorization(),
            $request,
        );

        $this->assertSame('workspace.model.image.edit', $permissionKey);
    }

    private function createAuthorization(): MagicUserAuthorization
    {
        $authorization = new MagicUserAuthorization();
        $authorization->setOrganizationCode('ORG_TEST');
        $authorization->setId('user_test');

        return $authorization;
    }

    /**
     * @param null|callable(string): mixed $route
     * @param null|callable(string, mixed): mixed $input
     */
    private function mockRequest(?callable $route = null, ?callable $input = null): RequestInterface
    {
        $request = Mockery::mock(RequestInterface::class);
        $request->shouldReceive('route')->andReturnUsing($route ?? static fn (): mixed => null);
        $request->shouldReceive('input')->andReturnUsing($input ?? static fn (string $key, mixed $default = null): mixed => $default);

        return $request;
    }
}
