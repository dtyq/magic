<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\File\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\Database\Model\Register;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use HyperfTest\Stub\Domain\SuperMagic\File\ArrayRowConnectionStub;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

/**
 * renameFile 的身份语义与冲突策略。
 *
 * 这些用例钉住的核心不变量只有一条：**原子替换内容时，路径上的 file_id
 * 不能变**。它曾经被破坏过 —— rename 被实现成"删掉目标、源顶替"，
 * 于是每次覆盖写都会把路径挪到另一条（而且是新建的）记录上，所有按
 * file_id 持有的引用（checkpoint 快照、mention、跨项目链接）全部指向
 * 已软删的行，目标的版本链也就断了。
 *
 * 第二个不变量是冲突策略必须显式：调用方要能要求"目标已存在就失败"，
 * 而不是被迫接受覆盖。
 *
 * @internal
 */
class MagicFSFileRenameTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    /**
     * ExceptionBuilder resolves its error-code ranges through the container,
     * so these cases need one that exposes the real `error_message` config.
     *
     * The container is installed per test and restored afterwards: leaving a
     * fake container behind leaks into every later case in the same process and
     * turns an unrelated test's assertions into TypeErrors.
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->previousContainer = ApplicationContext::hasContainer() ? ApplicationContext::getContainer() : null;

        $config = $this->createMock(ConfigInterface::class);
        $config->method('get')->willReturnCallback(static function (string $key, $default = null) {
            if ($key === 'error_message') {
                return require BASE_PATH . '/config/autoload/error_message.php';
            }
            return $key === 'app_env' ? 'test' : $default;
        });

        // ExceptionBuilder also translates its message through the global
        // `trans()` helper, which resolves TranslatorInterface from the same
        // container. A container that only answers ConfigInterface makes every
        // expected BusinessException surface as a translator error instead.
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(
            static fn (string $key) => $key
        );

        // Db::transaction is part of the code under test (the domain service
        // wraps its mutations in one), so the test provides a connection whose
        // transaction() simply runs the callback. That is the same seam the
        // repository tests use — the alternative, a `protected function
        // transaction()` inside the service, would put a test-only indirection
        // into production code and hide the real transaction boundary from
        // every grep.
        $connection = new ArrayRowConnectionStub();
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        Register::setConnectionResolver($resolver);

        $services = [ConfigInterface::class => $config, TranslatorInterface::class => $translator];
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(
            static function (string $id) use ($services, $resolver) {
                if (isset($services[$id])) {
                    return $services[$id];
                }
                return match ($id) {
                    ConnectionResolverInterface::class => $resolver,
                    Db::class => new Db(ApplicationContext::getContainer()),
                    default => null,
                };
            }
        );
        $container->method('has')->willReturnCallback(
            static fn (string $id): bool => isset($services[$id])
                || in_array($id, [ConnectionResolverInterface::class, Db::class], true)
        );

        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
        parent::tearDown();
    }

    /**
     * 目标被占用 + replace：目标行存活、身份不变、拿到源的内容；源行被软删。
     */
    public function testReplaceKeepsDestinationIdentityAndAdoptsSourceContent(): void
    {
        $source = $this->file(7001, '.doc.json.tmp', 500, 11, 'org/pre/source-key');
        $destination = $this->file(7002, 'doc.json', 500, 3, 'org/pre/destination-key');
        $parent = $this->directory(500, 'workspace');

        $repo = $this->createMock(TaskFileRepositoryInterface::class);
        $repo->method('getFileTreeFileById')->willReturnMap([
            [7001, $source],
            [7002, $destination],
            [500, $parent],
        ]);
        $repo->method('getFileTreeChildByParentAndName')
            ->willReturnCallback(static fn (int $parentId, string $name) => $name === 'doc.json' ? $destination : null);

        $deleted = [];
        $repo->expects($this->once())
            ->method('deleteById')
            ->with(7001, false)
            ->willReturnCallback(static function () use (&$deleted): void {
                $deleted[] = 7001;
            });

        $copied = [];
        $cloud = $this->createMock(CloudFileRepositoryInterface::class);
        $cloud->expects($this->once())
            ->method('copyObjectByCredential')
            ->willReturnCallback(static function (...$args) use (&$copied): void {
                $copied[] = $args;
            });

        $updated = $this->service($repo, $cloud)->renameFile('7001', 'doc.json');

        // 存活下来的是目标，不是源。
        $this->assertSame(7002, (int) $updated->getFileId(), 'the destination must be the surviving row');
        $this->assertSame(11, $updated->getFileSize(), 'the destination must adopt the source content size');
        $this->assertSame(7001, (int) $source->getFileId() === 7001 ? 7001 : 0);
        $this->assertSame([7001], $deleted, 'the source row must be retired');

        // 目标的对象键没有被源顶替：内容由服务端 copy 到目标的 key 上。
        $this->assertSame('org/pre/destination-key', $updated->getFileKey(), 'destination file_key must not change');

        $this->assertCount(1, $copied, 'the source bytes must be copied onto the destination key');
        $this->assertSame('org/pre/source-key', $copied[0][2], 'copy source key');
        $this->assertSame('org/pre/destination-key', $copied[0][3], 'copy destination key');
    }

    /**
     * 目标被占用 + fail：拒绝，且不删除源、不复制对象。
     */
    public function testFailPolicyRejectsInsteadOfReplacing(): void
    {
        $source = $this->file(7101, 'a.txt', 500, 1, 'org/k/s');
        $destination = $this->file(7102, 'b.txt', 500, 2, 'org/k/d');
        $parent = $this->directory(500, 'workspace');

        $repo = $this->createMock(TaskFileRepositoryInterface::class);
        $repo->method('getFileTreeFileById')->willReturnMap([
            [7101, $source],
            [500, $parent],
        ]);
        $repo->method('getFileTreeChildByParentAndName')->willReturn($destination);
        $repo->expects($this->never())->method('deleteById');

        $cloud = $this->createMock(CloudFileRepositoryInterface::class);
        $cloud->expects($this->never())->method('copyObjectByCredential');

        $this->expectException(BusinessException::class);
        $this->service($repo, $cloud)->renameFile('7101', 'b.txt', null, MagicFSFileDomainService::RENAME_ON_EXISTS_FAIL);
    }

    /**
     * 目标为空：身份跟着源走，不产生任何删除。
     */
    public function testVacantDestinationMovesTheSourceRow(): void
    {
        $source = $this->file(7201, 'old.txt', 500, 5, 'org/k/s');
        $parent = $this->directory(500, 'workspace');

        $repo = $this->createMock(TaskFileRepositoryInterface::class);
        $repo->method('getFileTreeFileById')->willReturnMap([
            [7201, $source],
            [500, $parent],
        ]);
        $repo->method('getFileTreeChildByParentAndName')->willReturn(null);
        $repo->expects($this->never())->method('deleteById');

        $updated = $this->service($repo)->renameFile('7201', 'new.txt');

        $this->assertSame(7201, (int) $updated->getFileId(), 'a move keeps the source identity');
        $this->assertSame('new.txt', $updated->getFileName());
    }

    /**
     * 覆盖目录是被拒绝的：替换整棵子树永远是显式操作，不能由 rename 隐式完成。
     */
    public function testReplaceOntoDirectoryIsRejected(): void
    {
        $source = $this->file(7301, 'file.txt', 500, 1, 'org/k/s');
        $destination = $this->directory(7302, 'victim');
        $parent = $this->directory(500, 'workspace');

        $repo = $this->createMock(TaskFileRepositoryInterface::class);
        $repo->method('getFileTreeFileById')->willReturnMap([
            [7301, $source],
            [500, $parent],
        ]);
        $repo->method('getFileTreeChildByParentAndName')->willReturn($destination);

        $this->expectException(BusinessException::class);
        $this->service($repo)->renameFile('7301', 'victim');
    }

    /**
     * 未知的冲突策略必须在入口被拒绝，而不是被当成默认值。
     */
    public function testUnknownPolicyIsRejected(): void
    {
        $source = $this->file(7401, 'a.txt', 500, 1, 'org/k/s');
        $repo = $this->createMock(TaskFileRepositoryInterface::class);
        $repo->method('getFileTreeFileById')->willReturn($source);

        $this->expectException(BusinessException::class);
        $this->service($repo)->renameFile('7401', 'b.txt', null, 'merge');
    }

    /**
     * 空白目标名被拒绝，避免出现"没有名字"的文件。
     */
    public function testBlankNameIsRejected(): void
    {
        $source = $this->file(7501, 'a.txt', 500, 1, 'org/k/s');
        $repo = $this->createMock(TaskFileRepositoryInterface::class);
        $repo->method('getFileTreeFileById')->willReturn($source);

        $this->expectException(BusinessException::class);
        $this->service($repo)->renameFile('7501', '   ');
    }

    private function service(
        TaskFileRepositoryInterface $taskFileRepository,
        ?CloudFileRepositoryInterface $cloudFileRepository = null
    ): MagicFSFileDomainService {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        return new MagicFSFileDomainService(
            $taskFileRepository,
            $this->createMock(TaskRepositoryInterface::class),
            $cloudFileRepository ?? $this->createMock(CloudFileRepositoryInterface::class),
            $this->createMock(ProjectRepositoryInterface::class),
            $loggerFactory
        );
    }

    private function file(int $id, string $name, int $parentId, int $size, string $key): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($id);
        $entity->setFileName($name);
        $entity->setFileExtension(pathinfo($name, PATHINFO_EXTENSION));
        $entity->setParentId($parentId);
        $entity->setIsDirectory(false);
        $entity->setFileSize($size);
        $entity->setFileKey($key);
        $entity->setProjectId(1);
        $entity->setUserId('user-1');
        $entity->setOrganizationCode('org');
        $entity->setSpaceType(FileSpaceType::PROJECT->value);
        $entity->setDeletedAt(null);

        return $entity;
    }

    private function directory(int $id, string $name): TaskFileEntity
    {
        $entity = $this->file($id, $name, 0, 0, '');
        $entity->setIsDirectory(true);
        $entity->setDeletedAt(null);

        return $entity;
    }
}
