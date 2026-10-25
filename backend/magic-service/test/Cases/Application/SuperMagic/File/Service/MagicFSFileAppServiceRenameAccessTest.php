<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\File\Service\MagicFSFileAppService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\Utils\FileTreeBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\RenameFileRequestDTO;
use ArrayObject;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\NullLogger;

/**
 * renameFile 的鉴权边界。
 *
 * rename 是唯一一个「一次调用影响两个位置」的写操作：源在那里，目标在
 * 另一个位置。只校验源是不够的 —— 能把 A 改名成 B 的人，也就获得了
 * 覆盖 B 的能力。因此这里钉住的规则是：跨目录 rename 必须同时通过目标
 * 父目录的写权限校验。
 *
 * @internal
 */
class MagicFSFileAppServiceRenameAccessTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        parent::setUp();
        // MagicUserAuthorization::getAuthorization() resolves services from the
        // global container; keeping the previous one lets us restore it.
        $this->previousContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
        parent::tearDown();
    }

    /**
     * 同目录内改名：只需要源文件的写权限，不会为父目录再查一次。
     */
    public function testRenameWithinSameParentChecksOnlySource(): void
    {
        $source = $this->file(700, 500);

        [$service, $checkedIds] = $this->service($source);

        $dto = new RenameFileRequestDTO();
        $dto->new_name = 'renamed.txt';

        $service->renameFile($this->authorization(), '700', $dto);

        $this->assertSame(['700'], $checkedIds(), 'a same-parent rename must only authorize the source');
    }

    /**
     * 跨目录改名：目标父目录必须一起校验。否则可以把文件推进一个
     * 自己无权写入的目录，从而覆盖别人的文件。
     */
    public function testRenameIntoAnotherParentChecksThatParent(): void
    {
        $source = $this->file(701, 500);

        [$service, $checkedIds] = $this->service($source);

        $dto = new RenameFileRequestDTO();
        $dto->new_name = 'renamed.txt';
        $dto->new_parent_id = '900';

        $service->renameFile($this->authorization(), '701', $dto);

        $this->assertSame(
            ['701', '900'],
            $checkedIds(),
            'a cross-directory rename must authorize the destination parent as well'
        );
    }

    /**
     * on_exists 省略时，应用层要把领域层的默认策略传下去，而不是自己
     * 编一个（否则默认值会在传输层和领域层各有一份）。
     */
    public function testOmittedOnExistsFallsBackToDomainDefault(): void
    {
        $source = $this->file(702, 500);
        [$service, , $domainCalls] = $this->service($source, captureRename: true);

        $dto = new RenameFileRequestDTO();
        $dto->new_name = 'renamed.txt';

        $service->renameFile($this->authorization(), '702', $dto);

        $this->assertSame(
            MagicFSFileDomainService::RENAME_ON_EXISTS_REPLACE,
            $domainCalls['on_exists'] ?? null
        );
    }

    /**
     * 显式传入的策略要原样透传，不能被应用层改写。
     */
    public function testExplicitOnExistsIsForwarded(): void
    {
        $source = $this->file(703, 500);
        [$service, , $domainCalls] = $this->service($source, captureRename: true);

        $dto = new RenameFileRequestDTO();
        $dto->new_name = 'renamed.txt';
        $dto->on_exists = MagicFSFileDomainService::RENAME_ON_EXISTS_FAIL;

        $service->renameFile($this->authorization(), '703', $dto);

        $this->assertSame(MagicFSFileDomainService::RENAME_ON_EXISTS_FAIL, $domainCalls['on_exists'] ?? null);
    }

    /**
     * Builds the service through its real constructor, with the domain layer
     * mocked. Going through the constructor (rather than assigning properties on
     * a subclass) keeps the test honest about the dependency graph and avoids
     * re-declaring promoted properties with different types.
     */
    private function service(TaskFileEntity $source, bool $captureRename = false): array
    {
        $checkedIds = [];
        // A holder object rather than a by-reference variable: returning `&$x`
        // inside an array does not preserve the reference for the caller, so the
        // captured call arguments would silently stay empty.
        $domainCalls = new ArrayObject();

        $domain = $this->createMock(MagicFSFileDomainService::class);
        $domain->method('getFileById')->willReturn($source);
        $domain->method('renameFile')->willReturnCallback(
            function (string $id, string $name, ?int $parentId, string $onExists) use ($domainCalls, $source) {
                $domainCalls->exchangeArray([
                    'file_id' => $id,
                    'new_name' => $name,
                    'new_parent_id' => $parentId,
                    'on_exists' => $onExists,
                ]);
                return $source;
            }
        );

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        $service = new class($domain, $this->createMock(TaskDomainService::class), $this->createMock(TopicDomainService::class), $this->createMock(FileTreeBuilder::class), $this->createMock(EventDispatcherInterface::class), $loggerFactory, $this->createMock(PublishedMicroAppFileAccessService::class), $checkedIds) extends MagicFSFileAppService {
            /** @var array<int, string> */
            private array $checked;

            public function __construct(
                MagicFSFileDomainService $domain,
                TaskDomainService $taskDomainService,
                TopicDomainService $topicDomainService,
                FileTreeBuilder $fileTreeBuilder,
                EventDispatcherInterface $eventDispatcher,
                LoggerFactory $loggerFactory,
                PublishedMicroAppFileAccessService $publishedAccess,
                array &$checked,
            ) {
                parent::__construct(
                    $domain,
                    $taskDomainService,
                    $topicDomainService,
                    $fileTreeBuilder,
                    $eventDispatcher,
                    $loggerFactory,
                    $publishedAccess,
                );
                $this->checked = &$checked;
            }

            /** Records every file id the authorization helpers were asked about. */
            protected function assertFileAccessible(
                string $fileId,
                MagicUserAuthorization $authorization,
                MemberRole $requiredRole
            ): TaskFileEntity {
                $this->checked[] = $fileId;
                return $this->magicFSFileDomainService->getFileById($fileId);
            }

            public function checkedIds(): array
            {
                return $this->checked;
            }
        };

        $checkedFn = static fn (): array => $service->checkedIds();

        if ($captureRename) {
            return [$service, $checkedFn, $domainCalls];
        }

        return [$service, $checkedFn];
    }

    private function authorization(): MagicUserAuthorization
    {
        $auth = $this->createMock(MagicUserAuthorization::class);
        $auth->method('getId')->willReturn('user-1');
        $auth->method('getOrganizationCode')->willReturn('org');

        return $auth;
    }

    private function file(int $id, int $parentId): TaskFileEntity
    {
        $entity = new TaskFileEntity();
        $entity->setFileId($id);
        $entity->setFileName('doc.txt');
        $entity->setParentId($parentId);
        $entity->setIsDirectory(false);
        $entity->setProjectId(1);
        $entity->setUserId('user-1');
        $entity->setOrganizationCode('org');
        $entity->setSpaceType(FileSpaceType::PROJECT->value);

        return $entity;
    }
}
