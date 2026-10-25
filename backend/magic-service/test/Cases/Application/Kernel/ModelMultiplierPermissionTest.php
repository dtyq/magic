<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Application\Permission\Service\RoleAppService;
use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Domain\Kernel\Service\PlatformSettingsDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Locker\Excpetion\LockException;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\DTO\Request\ModelBillingMultiplierUpdateRequest;
use App\Interfaces\Kernel\DTO\Request\PlatformSettingsUpdateRequest;
use App\Interfaces\Kernel\Facade\ModelBillingMultiplierApi;
use App\Interfaces\Kernel\Facade\ModelBillingPreviewApi;
use App\Interfaces\Kernel\Facade\PlatformSettingsApi;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionMethod;
use ReflectionProperty;
use RuntimeException;

/** 只使用模拟权限、存储和锁验证独立倍率权限，不访问外部服务。
 * @internal
 */
final class ModelMultiplierPermissionTest extends TestCase
{
    private ?ContainerInterface $previous = null;

    private Redis $redis;

    /** 为权限树与错误翻译提供隔离容器。 */
    protected function setUp(): void
    {
        $this->previous = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;
        $base = dirname(__DIR__, 4);
        $config = new Config([
            'app_env' => 'testing',
            'permission_menu' => require $base . '/config/autoload/permission_menu.php',
            'permission_menu_v1' => require $base . '/config/autoload/permission_menu_v1.php',
            'error_message' => require $base . '/config/autoload/error_message.php',
        ]);
        $translator = $this->createStub(TranslatorInterface::class);
        $translator->method('trans')->willReturnArgument(0);
        $this->redis = $this->getMockBuilder(Redis::class)->disableOriginalConstructor()->addMethods(['get', 'del'])->getMock();
        $this->redis->method('del')->willReturn(1);
        $container = $this->createStub(\Hyperf\Contract\ContainerInterface::class);
        $container->method('make')->willReturnCallback(fn (string $id) => $this->createStub($id));
        $container->method('has')->willReturn(true);
        $container->method('get')->willReturnCallback(fn (string $id) => match ($id) {
            ConfigInterface::class => $config,
            MagicPermissionInterface::class => new MagicPermission(),
            TranslatorInterface::class => $translator,
            Redis::class => $this->redis,
            default => throw new RuntimeException('Unexpected dependency: ' . $id),
        });
        ApplicationContext::setContainer($container);
    }

    /** 恢复其他单测的容器状态。 */
    protected function tearDown(): void
    {
        if ($this->previous !== null) {
            ApplicationContext::setContainer($this->previous);
        } else {
            (new ReflectionProperty(ApplicationContext::class, 'container'))->setValue(null, null);
        }
    }

    /** 新权限不从平台信息或模型管理继承，但编辑包含查询且限官方组织。 */
    public function testPermissionIsolationAndTrees(): void
    {
        $permissions = new MagicPermission();
        $query = 'platform.ai.model_multiplier.query';
        foreach ([[], ['platform.setting.platform_info.edit'], ['platform.ai.model_management.edit']] as $grants) {
            $this->assertFalse($permissions->checkPermission($query, $grants, true));
        }
        $this->assertTrue($permissions->checkPermission($query, ['platform.ai.model_multiplier.edit'], true));
        $this->assertFalse($permissions->checkPermission('platform.ai.model_multiplier.edit', [$query], true));
        $this->assertFalse($permissions->checkPermission($query, ['platform.ai.model_multiplier.edit'], false));
        $this->assertTrue($permissions->checkPermission($query, [MagicPermission::PLATFORM_PERMISSIONS], true));
        foreach ([$permissions->getPermissionTree(true), $permissions->getPermissionTreeV1(true)] as $tree) {
            $this->assertStringContainsString($query, json_encode($tree));
            $this->assertStringContainsString('模型倍率', json_encode($tree, JSON_UNESCAPED_UNICODE));
        }
        $this->assertStringNotContainsString($query, json_encode($permissions->getPermissionTree(false)));
    }

    /** 配置和价格快照均使用倍率专属权限注解。 */
    public function testEndpointAnnotations(): void
    {
        foreach ([[ModelBillingMultiplierApi::class, 'show', MagicOperationEnum::QUERY], [ModelBillingMultiplierApi::class, 'update', MagicOperationEnum::EDIT], [ModelBillingPreviewApi::class, 'show', MagicOperationEnum::QUERY]] as [$class, $method, $operation]) {
            $permission = (new ReflectionMethod($class, $method))->getAttributes(CheckPermission::class)[0]->newInstance();
            $this->assertSame(MagicResourceEnum::PLATFORM_AI_MODEL_MULTIPLIER->value . '.' . $operation->value, $permission->getPermissionKey());
        }
    }

    /** 无倍率权限的旧混合请求整次拒绝，不能部分保存其他字段。 */
    public function testLegacyMixedRequestCannotBypassPermission(): void
    {
        $service = $this->createMock(PlatformSettingsAppService::class);
        $service->expects($this->never())->method('update');
        $roles = $this->createMock(RoleAppService::class);
        $roles->expects($this->once())->method('hasPermission')->with($this->anything(), 'mock-user', 'platform.ai.model_multiplier.edit')->willReturn(false);
        $authorization = $this->createStub(MagicUserAuthorization::class);
        $authorization->method('getId')->willReturn('mock-user');
        $authorization->method('getOrganizationCode')->willReturn('mock-organization');
        $api = $this->getMockBuilder(PlatformSettingsApi::class)->setConstructorArgs([$service, $roles])->onlyMethods(['getAuthorization'])->getMock();
        $api->method('getAuthorization')->willReturn($authorization);
        $request = $this->createStub(PlatformSettingsUpdateRequest::class);
        $request->method('validated')->willReturn(['global_system_prompt' => 'mock prompt', 'model_billing_multiplier' => ['enabled' => false]]);
        $this->expectException(BusinessException::class);
        $api->update($request);
    }

    /** 专用请求在过滤之前拒绝无关顶层和未知倍率字段。 */
    public function testDedicatedRequestRejectsUnrelatedFields(): void
    {
        foreach ([['global_system_prompt' => 'mock'], ['model_billing_multiplier' => ['unknown' => 'mock']]] as $payload) {
            $request = $this->getMockBuilder(ModelBillingMultiplierUpdateRequest::class)->disableOriginalConstructor()->onlyMethods(['all', 'getUploadedFiles'])->getMock();
            $request->method('all')->willReturn($payload);
            $request->method('getUploadedFiles')->willReturn([]);
            try {
                (new ReflectionMethod($request, 'validationData'))->invoke($request);
                $this->fail('Unknown fields must be rejected');
            } catch (BusinessException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /** 持久化最新值在锁内读取，交错的其他设置更新不能被倍率更新覆盖。 */
    public function testUpdatesReadLatestPersistedSettingsInsideLock(): void
    {
        $stored = PlatformSettings::fromArray(['global_system_prompt' => 'new prompt'])->toArray();
        $locked = false;
        $locker = $this->createMock(LockerInterface::class);
        $locker->expects($this->exactly(2))->method('spinLock')->willReturnCallback(static function () use (&$locked): bool {
            $locked = true;
            return true;
        });
        $locker->expects($this->exactly(2))->method('release')->willReturnCallback(static function () use (&$locked): bool {
            $locked = false;
            return true;
        });
        $repository = $this->createMock(MagicUserSettingRepositoryInterface::class);
        $repository->expects($this->exactly(2))->method('getGlobal')->willReturnCallback(function () use (&$stored, &$locked): MagicUserSettingEntity {
            $this->assertTrue($locked);
            $entity = new MagicUserSettingEntity();
            $entity->setValue($stored);
            return $entity;
        });
        $repository->expects($this->exactly(2))->method('saveGlobal')->willReturnCallback(static function (MagicUserSettingEntity $entity) use (&$stored): MagicUserSettingEntity {
            $stored = $entity->getValue();
            return $entity;
        });
        $this->redis->expects($this->never())->method('get');
        $service = new PlatformSettingsAppService(new PlatformSettingsDomainService($repository, $this->redis, $locker));
        $result = $service->updateModelBillingMultiplier(['enabled' => true, 'input_price' => '2', 'output_price' => '8']);
        $this->assertSame('new prompt', $result->toArray()['global_system_prompt']);
        $this->assertSame('0.028', $result->getModelBillingMultiplier()->basePriceCny);
        $service->update(static function (PlatformSettings $current): PlatformSettings {
            $data = $current->toArray();
            $data['global_system_prompt'] = 'another prompt';
            return PlatformSettings::fromArray($data);
        });
        $this->assertSame('0.028', $stored['model_billing_multiplier']['base_price_cny']);
        $this->assertSame('another prompt', $stored['global_system_prompt']);
    }

    /** 管理读取跳过空展示缓存，多次刷新均返回持久化单价，不触发写入。 */
    public function testAdminReadsPersistedPricesWithoutUsingDisplayCache(): void
    {
        $entity = new MagicUserSettingEntity();
        $entity->setValue(['model_billing_multiplier' => ['enabled' => true, 'currency' => 'CNY', 'input_price' => '2', 'output_price' => '3', 'usd_to_cny_rate' => '6']]);
        $repository = $this->createMock(MagicUserSettingRepositoryInterface::class);
        $repository->expects($this->exactly(2))->method('getGlobal')->willReturn($entity);
        $repository->expects($this->never())->method('saveGlobal');
        $this->redis->expects($this->never())->method('get');
        $locker = $this->createMock(LockerInterface::class);
        $service = new PlatformSettingsAppService(new PlatformSettingsDomainService($repository, $this->redis, $locker));
        $api = new ModelBillingMultiplierApi($service);
        foreach (range(1, 2) as $attempt) {
            $settings = $api->show()['model_billing_multiplier'];
            $this->assertSame('2', $settings['input_price']);
            $this->assertSame('3', $settings['output_price']);
            $this->assertSame('0.023', $settings['base_price_cny']);
        }
    }

    /** 未取到锁不能写入，回调异常也必须释放已经取得的锁。 */
    public function testLockFailureAndExceptionRelease(): void
    {
        $repository = $this->createMock(MagicUserSettingRepositoryInterface::class);
        $repository->expects($this->never())->method('saveGlobal');
        $locker = $this->createMock(LockerInterface::class);
        $locker->method('spinLock')->willReturnOnConsecutiveCalls(false, true);
        $locker->expects($this->once())->method('release')->willReturn(true);
        $service = new PlatformSettingsDomainService($repository, $this->redis, $locker);
        try {
            $service->update(static fn () => new PlatformSettings());
            $this->fail('Missing lock must fail');
        } catch (LockException) {
            $this->addToAssertionCount(1);
        }
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('mock failure');
        $service->update(static fn () => throw new RuntimeException('mock failure'));
    }
}
