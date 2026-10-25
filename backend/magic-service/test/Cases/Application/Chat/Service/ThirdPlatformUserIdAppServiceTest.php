<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Chat\Service;

use App\Application\Chat\Service\ThirdPlatformUserIdAppService;
use App\Domain\Chat\Repository\Facade\MagicContactIdMappingRepositoryInterface;
use App\Domain\Contact\Entity\MagicThirdPlatformIdMappingEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\PlatformType;
use App\Domain\Contact\Service\MagicThirdPlatformDomainService;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\Domain\OrganizationEnvironment\Entity\MagicOrganizationEnvEntity;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use Hyperf\Logger\LoggerFactory;
use Monolog\Handler\TestHandler;
use Monolog\Logger;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * 通用来源身份解析的隔离测试，不读取真实组织或账号。
 * @internal
 */
final class ThirdPlatformUserIdAppServiceTest extends TestCase
{
    /**
     * 验证去重、空值、平台切换和原始字符串的保留。
     */
    #[DataProvider('mappingCases')]
    public function testResolveUsesAccountAndCurrentSource(array $originIds, string $platform, string $expected): void
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environment = new MagicEnvironmentEntity(['id' => 7, 'third_platform_type' => $platform]);
        $environments->expects(self::once())->method('getOrganizationEnvironmentByMagicOrganizationCode')
            ->with('mock-org')->willReturn(new MagicOrganizationEnvEntity(['environment_id' => 7]));
        $environments->expects(self::once())->method('getMagicEnvironmentById')->with(7)->willReturn($environment);
        $repository->expects(self::once())->method('getScopedUserIdsMapping')
            ->with($environment, 'mock-account', 'mock-org', PlatformType::from($platform))
            ->willReturn(array_map(static fn (string $id) => new MagicThirdPlatformIdMappingEntity(['origin_id' => $id]), $originIds));
        [$service, $handler] = $this->service($repository, $environments);

        self::assertSame($expected, $service->resolveUserId($this->user(), 'mock-org'));
        self::assertStringNotContainsString('mock-account', json_encode($handler->getRecords(), JSON_THROW_ON_ERROR));
        if (count(array_unique(array_filter($originIds, static fn (string $id) => $id !== ''))) > 1) {
            self::assertSame('mapping_ambiguous', $handler->getRecords()[0]->context['reason']);
        }
    }

    /**
     * 合成来源映射覆盖多个平台及边界值。
     */
    public static function mappingCases(): array
    {
        return [
            '飞书' => [['mock-origin'], 'feishu', 'mock-origin'],
            '钉钉' => [['mock-origin'], 'ding_talk', 'mock-origin'],
            '天书' => [['mock-origin'], 'teamshare', 'mock-origin'],
            '企微' => [['mock-origin'], 'wecom', 'mock-origin'],
            '前导零' => [['00123'], 'feishu', '00123'],
            '零字符串' => [['0'], 'feishu', '0'],
            '无映射' => [[], 'feishu', ''],
            '空原始值' => [[''], 'feishu', ''],
            '重复同值' => [['mock-origin', 'mock-origin', ''], 'feishu', 'mock-origin'],
            '多个不同值记录告警并返回首个' => [['mock-first', 'mock-second'], 'feishu', 'mock-first'],
            '跳过空值再取首个' => [['', 'mock-first', 'mock-second'], 'feishu', 'mock-first'],
        ];
    }

    /**
     * 验证来源缺失和非法配置不会退回任意平台。
     */
    #[DataProvider('sourceCases')]
    public function testUnavailableSourceDoesNotQueryMapping(?string $source, int $environmentId): void
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $repository->expects(self::never())->method('getScopedUserIdsMapping');
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environments->method('getOrganizationEnvironmentByMagicOrganizationCode')
            ->willReturn(new MagicOrganizationEnvEntity(['environment_id' => $environmentId]));
        $environments->method('getMagicEnvironmentById')
            ->willReturn(new MagicEnvironmentEntity(['id' => $environmentId, 'third_platform_type' => $source]));
        [$service] = $this->service($repository, $environments);
        self::assertSame('', $service->resolveUserId($this->user(), 'mock-org'));
    }

    /**
     * 提供未接入、原生、非法平台和环境配置。
     */
    public static function sourceCases(): array
    {
        return [[null, 7], ['', 7], ['none', 7], ['magic', 7], ['unknown', 7], ['feishu', 0]];
    }

    /**
     * 可选查询失败不传播原始异常及敏感内容。
     */
    public function testLookupFailureIsUnknownAndLogsOnlyCategory(): void
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environments->method('getOrganizationEnvironmentByMagicOrganizationCode')
            ->willThrowException(new RuntimeException('mock-private-details'));
        [$service, $handler] = $this->service($repository, $environments);
        self::assertSame('', $service->resolveUserId($this->user(), 'mock-org'));
        self::assertSame('mapping_query_failed', $handler->getRecords()[0]->context['reason']);
        self::assertStringNotContainsString('mock-private-details', json_encode($handler->getRecords(), JSON_THROW_ON_ERROR));
    }

    /**
     * 仓储读取失败与无映射都返回未知，但内部保留失败类别。
     */
    public function testMappingRepositoryFailureDoesNotBlockProfile(): void
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $repository->method('getScopedUserIdsMapping')->willThrowException(new RuntimeException('mock-private-query'));
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environments->method('getOrganizationEnvironmentByMagicOrganizationCode')->willReturn(new MagicOrganizationEnvEntity(['environment_id' => 7]));
        $environments->method('getMagicEnvironmentById')->willReturn(new MagicEnvironmentEntity(['id' => 7, 'third_platform_type' => 'feishu']));
        [$service, $handler] = $this->service($repository, $environments);
        self::assertSame('', $service->resolveUserId($this->user(), 'mock-org'));
        self::assertSame('mapping_query_failed', $handler->getRecords()[0]->context['reason']);
        self::assertStringNotContainsString('mock-private-query', json_encode($handler->getRecords(), JSON_THROW_ON_ERROR));
    }

    /**
     * 不匹配主体及缺失账户不执行来源查询。
     */
    public function testMismatchedSubjectAndMissingAccountAreNotLookedUp(): void
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environments->expects(self::never())->method('getOrganizationEnvironmentByMagicOrganizationCode');
        [$service] = $this->service($repository, $environments);
        self::assertSame('', $service->resolveUserId($this->user(), 'mock-other-org'));
        self::assertSame('', $service->resolveUserId(new MagicUserEntity(['magic_id' => '', 'organization_code' => 'mock-org']), 'mock-org'));
    }

    /**
     * 缺失组织绑定时不搜索其他组织或环境。
     */
    public function testMissingBindingIsUnknown(): void
    {
        $repository = $this->createMock(MagicContactIdMappingRepositoryInterface::class);
        $repository->expects(self::never())->method('getScopedUserIdsMapping');
        $environments = $this->createMock(MagicOrganizationEnvDomainService::class);
        $environments->method('getOrganizationEnvironmentByMagicOrganizationCode')->willReturn(null);
        $environments->expects(self::never())->method('getMagicEnvironmentById');
        [$service] = $this->service($repository, $environments);
        self::assertSame('', $service->resolveUserId($this->user(), 'mock-org'));
    }

    /**
     * 创建纯内存的依赖和日志捕获器。
     */
    private function service(MagicContactIdMappingRepositoryInterface $repository, MagicOrganizationEnvDomainService $environments): array
    {
        $handler = new TestHandler();
        $factory = $this->createMock(LoggerFactory::class);
        $factory->method('get')->willReturn(new Logger('mock-logger', [$handler]));
        return [new ThirdPlatformUserIdAppService(new MagicThirdPlatformDomainService($repository, $factory), $environments, $factory), $handler];
    }

    /**
     * 使用不同的组织用户 ID 与账户 ID，避免掩盖查询方向错误。
     */
    private function user(): MagicUserEntity
    {
        return new MagicUserEntity(['user_id' => 'mock-org-user', 'magic_id' => 'mock-account', 'organization_code' => 'mock-org']);
    }
}
