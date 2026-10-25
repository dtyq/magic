<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Chat\Service;

use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Application\Chat\Service\ThirdPlatformUserIdAppService;
use App\Application\SuperMagic\Task\Service\UserInfoAppService;
use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicThirdPlatformDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Entity\MagicOrganizationEnvEntity;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Repository\Facade\OrganizationRepositoryInterface;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use ReflectionProperty;

/**
 * 验证公共聚合向实时接口传递字段，全部依赖均为 Mock。
 * @internal
 */
final class MagicUserInfoAppServiceTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    /**
     * 仅为 DataIsolation 提供内存环境配置，不启动应用容器。
     */
    protected function setUp(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->with(ConfigInterface::class)->willReturn(new Config(['app_env' => 'testing']));
        ApplicationContext::setContainer($container);
    }

    /**
     * 恢复原容器，避免污染其他隔离测试。
     */
    protected function tearDown(): void
    {
        (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, $this->previousContainer);
    }

    /**
     * 同一次公共资料查询经接口 DTO 后保留来源 ID，且不改变手机号脱敏。
     */
    public function testSharedProfileReachesCurrentUserResponse(): void
    {
        $user = new MagicUserEntity(['user_id' => 'mock-user', 'magic_id' => 'mock-account', 'organization_code' => 'mock-org', 'nickname' => 'Mock user', 'avatar_url' => '']);
        $users = $this->createMock(MagicUserDomainService::class);
        $users->method('getUserById')->with('mock-user')->willReturn($user);
        $accounts = $this->createMock(MagicAccountDomainService::class);
        $departmentRepository = $this->createMock(MagicDepartmentUserRepositoryInterface::class);
        $departmentRepository->method('getDepartmentUsersByUserIds')->willReturn([]);
        $profiles = new MagicUserInfoAppService($users, $accounts, new MagicDepartmentUserDomainService($departmentRepository), $this->createMock(MagicDepartmentDomainService::class), $this->thirdPlatform());
        $organizationRepository = $this->createMock(OrganizationRepositoryInterface::class);
        $organizationRepository->method('getByCode')->with('mock-org')->willReturn(new OrganizationEntity(['name' => 'Mock organization']));
        $organizations = new OrganizationDomainService($organizationRepository, $users, $this->createMock(OrganizationAdminDomainService::class));
        $authorization = $this->createMock(MagicUserAuthorization::class);
        $authorization->method('getId')->willReturn('mock-user');
        $authorization->method('getMagicId')->willReturn('mock-account');
        $authorization->method('getOrganizationCode')->willReturn('mock-org');
        $authorization->method('getUserType')->willReturn(UserType::Human);

        $response = (new UserInfoAppService($profiles, $users, $organizations))->getUserInfo($authorization)->toArray();
        self::assertSame('00123', $response['user']['third_platform_id']);
        self::assertSame('mock-user', $response['user']['id']);
        self::assertSame('mock-account', $response['user']['magic_id']);
        self::assertSame('', $response['user']['phone']);
    }

    /**
     * 缺失用户时返回兼容的空字段，不查询映射。
     */
    public function testEmptyProfileDoesNotResolveIdentity(): void
    {
        $users = $this->createMock(MagicUserDomainService::class);
        $users->method('getUserById')->willReturn(null);
        $profiles = new MagicUserInfoAppService($users, $this->createMock(MagicAccountDomainService::class), new MagicDepartmentUserDomainService($this->createMock(MagicDepartmentUserRepositoryInterface::class)), $this->createMock(MagicDepartmentDomainService::class), $this->thirdPlatform(false));
        self::assertSame('', $profiles->getUserInfo('mock-missing', new DataIsolation())['third_platform_id']);
    }

    /**
     * 只替换外部依赖，实际执行 readonly 域服务的解析逻辑。
     */
    private function thirdPlatform(bool $expectQuery = true): ThirdPlatformUserIdAppService
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $repository->expects($expectQuery ? self::once() : self::never())->method('getScopedUserIdsMapping')
            ->willReturn([new MagicThirdPlatformIdMappingEntity(['origin_id' => '00123'])]);
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environments->method('getOrganizationEnvironmentByMagicOrganizationCode')->willReturn(new MagicOrganizationEnvEntity(['environment_id' => 7]));
        $environments->method('getMagicEnvironmentById')->willReturn(new MagicEnvironmentEntity(['id' => 7, 'third_platform_type' => 'feishu']));
        $factory = $this->createMock(LoggerFactory::class);
        $factory->method('get')->willReturn(new NullLogger());
        return new ThirdPlatformUserIdAppService(new MagicThirdPlatformDomainService($repository, $factory), $environments, $factory);
    }
}
