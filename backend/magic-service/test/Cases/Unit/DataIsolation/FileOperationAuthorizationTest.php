<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\DataIsolation;

use App\Application\SuperMagic\File\Event\Subscribe\FileBatchCopySubscriber;
use App\Application\SuperMagic\File\Event\Subscribe\FileBatchMoveSubscriber;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use InvalidArgumentException;
use ReflectionMethod;

/**
 * 验证文件存储边界使用源项目身份，并保留同组织路径。
 * @internal
 */
final class FileOperationAuthorizationTest extends ContextTestCase
{
    /** 跨组织复制与移动都透传源身份，移动成功后才删除源文件。 */
    public function testCrossOrganizationUsesSourceIdentity(): void
    {
        foreach (['copyFileInCloudStorage', 'moveFileInCloudStorage'] as $method) {
            $source = $this->project('mock-source-org', 'mock-source-user');
            $target = $this->project('mock-target-org', 'mock-target-user');
            $context = new DataIsolation('mock-source-org', 'mock-source-user');
            $context->setUserAuthorizationToken('mock-token');
            $gateway = $this->createMock(SandboxGatewayInterface::class);
            $gateway->expects(self::once())->method('copyFiles')->with($context, self::anything())->willReturn(GatewayResult::success());
            $cloud = $this->createMock(CloudFileRepositoryInterface::class);
            $cloud->expects($method === 'moveFileInCloudStorage' ? self::once() : self::never())->method('deleteObjectByCredential');
            $service = $this->service(TaskFileDomainService::class, ['sandboxGateway' => $gateway, 'cloudFileRepository' => $cloud]);
            (new ReflectionMethod($service, $method))->invoke($service, $this->file(), $source, $target, 'mock/target', $context);
        }
    }

    /** 操作人或其他用户上下文不能用于源项目网关请求。 */
    public function testWrongSourceIdentityIsRejectedBeforeGateway(): void
    {
        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->expects(self::never())->method('copyFiles');
        $service = $this->service(TaskFileDomainService::class, ['sandboxGateway' => $gateway]);
        $this->expectException(InvalidArgumentException::class);
        (new ReflectionMethod($service, 'copyFileInCloudStorage'))->invoke($service, $this->file(), $this->project('mock-source-org', 'mock-source-user'), $this->project('mock-target-org', 'mock-target-user'), 'mock/target', new DataIsolation('mock-source-org', 'mock-operator'));
    }

    /** 同组织复制和移动只调用存储端口，不要求用户 token。 */
    public function testSameOrganizationDoesNotRequireAuthorization(): void
    {
        foreach (['copyFileInCloudStorage' => 'copyObjectByCredential', 'moveFileInCloudStorage' => 'renameObjectByCredential'] as $method => $operation) {
            $cloud = $this->createMock(CloudFileRepositoryInterface::class);
            $cloud->expects(self::once())->method($operation);
            $gateway = $this->createMock(SandboxGatewayInterface::class);
            $gateway->expects(self::never())->method('copyFiles');
            $service = $this->service(TaskFileDomainService::class, ['cloudFileRepository' => $cloud, 'sandboxGateway' => $gateway]);
            $project = $this->project('mock-org', 'mock-user');
            (new ReflectionMethod($service, $method))->invoke($service, $this->file(), $project, $project, 'mock/target', new DataIsolation('mock-org', 'mock-user'));
        }
    }

    /** 批量消费者按来源用户缓存上下文，不串用其他项目身份。 */
    public function testBatchSubscribersKeepSourceIdentitiesSeparate(): void
    {
        foreach ([FileBatchCopySubscriber::class, FileBatchMoveSubscriber::class] as $class) {
            $subscriber = $this->service($class, []);
            $method = new ReflectionMethod($subscriber, 'prepareSourceDataIsolation');
            $first = $method->invoke($subscriber, $this->project('mock-org', 'mock-first'));
            $same = $method->invoke($subscriber, $this->project('mock-org', 'mock-first'));
            $other = $method->invoke($subscriber, $this->project('mock-org', 'mock-other'));
            self::assertSame($first, $same);
            self::assertNotSame($first, $other);
            self::assertSame('mock-first', $first->getCurrentUserId());
            self::assertSame('mock-other', $other->getCurrentUserId());
        }
    }

    /** 创建合成项目，不触发数据库读取。 */
    private function project(string $organization, string $user): ProjectEntity
    {
        $project = new ProjectEntity();
        $project->setUserOrganizationCode($organization);
        $project->setUserId($user);
        $project->setWorkDir('mock/workdir');
        return $project;
    }

    /** 创建合成文件，不访问真实对象存储。 */
    private function file(): TaskFileEntity
    {
        $file = new TaskFileEntity();
        $file->setFileKey('mock/source');
        return $file;
    }
}
