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
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * 覆盖 magicfs createFile 的 file_key 构造：话题空间文件必须落在
 * {prefix}/project_{projectId}/runtime/topic_{topicId}/{fileId}。
 *
 * @internal
 */
class MagicFSFileDomainServiceTest extends TestCase
{
    public function testCreateFileUnderTopicSpaceParentUsesTopicRuntimeKey(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::TOPIC->value, 456);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->method('getFullPrefix')->willReturn('DT001/open/');

        $entity = $this->service($taskFileRepository, null, $cloudFileRepository)
            ->createFile('hello.txt', '500', false, '', null, null, null, null, false, 456);

        $this->assertSame(
            'DT001/open/project_100/runtime/topic_456/' . $entity->getFileId(),
            $entity->getFileKey()
        );
        $this->assertSame(456, $entity->getTopicId());
        $this->assertSame(FileSpaceType::TOPIC->value, $entity->getSpaceType());
    }

    public function testCreateFileUnderTopicSpaceWithoutTopicIdThrows(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::TOPIC->value, 0);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        // 父目录缺失 topic_id 时直接失败，不查询祖先链
        $taskFileRepository->expects($this->never())
            ->method('getFilesWithParentsByIds');

        $this->expectException(BusinessException::class);

        $this->service($taskFileRepository)
            ->createFile('hello.txt', '500', true, '', null, null, null, null, false, 0);
    }

    public function testCreateFileUnderUnsupportedSpaceTypeThrows(): void
    {
        $parent = $this->parentEntity(500, 'weird');

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);

        $this->expectException(BusinessException::class);

        $this->service($taskFileRepository)
            ->createFile('hello.txt', '500', true, '', null, null, null, null, false, 0);
    }

    public function testCreateFileUnderProjectSpaceKeepsWorkspaceKey(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::PROJECT->value);

        $project = $this->createMock(ProjectEntity::class);
        $project->method('getWorkDir')->willReturn('/project_100/workspace');

        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->method('findById')->willReturn($project);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->method('getFullPrefix')->willReturn('DT001/open/');

        $entity = $this->service($taskFileRepository, $projectRepository, $cloudFileRepository)
            ->createFile('hello.txt', '500', true, '', null, null, null, null, false, 0);

        $this->assertSame(
            'DT001/open/project_100/workspace/' . $entity->getFileId(),
            $entity->getFileKey()
        );
        $this->assertSame(0, $entity->getTopicId());
        $this->assertSame(FileSpaceType::PROJECT->value, $entity->getSpaceType());
    }

    public function testCreateFileUnderUserSpaceKeepsUserWorkspaceKey(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::USER->value, 0, 'sub', 0);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->method('getFullPrefix')->willReturn('DT001/open/');

        $entity = $this->service($taskFileRepository, null, $cloudFileRepository)
            ->createFile('hello.txt', '500', true, '', null, null, null, null, false, 0);

        $this->assertSame(
            'DT001/open/user_user-1/workspace/' . $entity->getFileId(),
            $entity->getFileKey()
        );
        $this->assertSame(FileSpaceType::USER->value, $entity->getSpaceType());
    }

    /**
     * 树身份与"谁写的"必须分开：沙箱（AGFS）会把 pod 的
     * /app/.credentials/metadata.json 附到建目录/建文件请求上，其中的会话 topic
     * 不是文件树身份。落到 project 行上会让这行同时不属于 project 树（topic_id = 0
     * 的查询看不见）和 topic 树（space_type 不是 topic），并让它从 durable journal
     * 里整行消失 —— 远端挂载再也发现不了这个目录，目录下新建的文件也永远解析不出路径。
     */
    public function testCreateFileUnderProjectSpaceDropsSessionTopicButKeepsProvenance(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::PROJECT->value);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        $projectRepository = $this->projectRepository();

        $taskRepository = $this->createMock(TaskRepositoryInterface::class);
        $taskRepository->method('getTaskById')->willReturn($this->taskEntity(967076766244339713, 967076066626109442));

        $entity = $this->service(
            $taskFileRepository,
            $projectRepository,
            $this->cloudFileRepository(),
            $taskRepository
        )->createFile(
            '第1层',
            '500',
            true,
            '967076766244339713',   // 沙箱会话 task
            null,
            null,
            null,
            null,
            false,
            967076066626109442     // 沙箱会话 topic（metadata.json）
        );

        $this->assertSame(0, $entity->getTopicId(), 'project 行的 topic_id 必须是树身份 0，不能是会话 topic');
        $this->assertSame(FileSpaceType::PROJECT->value, $entity->getSpaceType());
        $this->assertSame(967076766244339713, $entity->getTaskId(), 'task_id 仍是来源信息，继续保留');
        $this->assertSame(
            967076066626109442,
            $entity->getLatestModifiedTopicId(),
            '会话来源写进 latest_modified_topic_id，信息不丢'
        );
        $this->assertSame(967076766244339713, $entity->getLatestModifiedTaskId());
    }

    /**
     * 任务查不到时，调用方显式传入的会话 topic 仍是不该丢的来源信息 —— 但只进
     * provenance 列，绝不进 topic_id。
     */
    public function testCreateFileUnderProjectSpaceKeepsExplicitTopicOnlyAsProvenance(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::PROJECT->value);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        // 默认真空 TaskRepository：getTaskById() 返回 null
        $entity = $this->service($taskFileRepository, $this->projectRepository(), $this->cloudFileRepository())
            ->createFile('星辰.txt', '500', false, '967076766244339713', null, null, null, null, false, 967076066626109442);

        $this->assertSame(0, $entity->getTopicId());
        $this->assertSame(967076066626109442, $entity->getLatestModifiedTopicId());
    }

    /**
     * user 空间的树身份是 (project_id = 0, user_id, organization_code)，会话 topic
     * 同样只是来源注解。
     */
    public function testCreateFileUnderUserSpaceDropsSessionTopic(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::USER->value, 0, 'sub', 0);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        $entity = $this->service($taskFileRepository, null, $this->cloudFileRepository())
            ->createFile('notes.md', '500', false, '', null, null, null, null, false, 967076066626109442);

        $this->assertSame(0, $entity->getTopicId());
        $this->assertSame(967076066626109442, $entity->getLatestModifiedTopicId());
        $this->assertSame(FileSpaceType::USER->value, $entity->getSpaceType());
    }

    /**
     * 话题空间的 topic_id 是树身份（来自父目录 / resolveSpaceContext），不是请求信封里
     * 的会话 topic：沙箱往别的话题空间写文件时两者本来就不同。这里是"不能改坏"的对照
     * 用例 —— 树身份取 456（file_key 的 runtime/topic_456/ 边界），会话来源记 999。
     */
    public function testCreateFileUnderTopicSpaceKeepsTreeIdentitySeparateFromSessionTopic(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::TOPIC->value, 456);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);

        $entity = $this->service($taskFileRepository, null, $this->cloudFileRepository())
            ->createFile('hello.txt', '500', false, '', null, null, null, null, false, 999);

        $this->assertSame(456, $entity->getTopicId(), 'topic 树的 topic_id 必须来自树（父目录），不是会话信封');
        $this->assertSame(999, $entity->getLatestModifiedTopicId(), '会话来源只进 provenance 列');
        $this->assertStringContainsString(
            '/runtime/topic_456/',
            $entity->getFileKey(),
            'file_key 的树边界同样来自父目录'
        );
    }

    /**
     * 建子节点只前移"父目录"的版本，且不再走祖先链：父目录行由子节点自己的
     * create 行宣告（远端按 parent_id 推导"这个目录的列表变了"），祖先再往上
     * 既没有消费者，也把 feed 放大成"深度 × 变更数"。
     */
    public function testCreateFileBumpsOnlyTheContainingDirectory(): void
    {
        $parent = $this->parentEntity(500, FileSpaceType::PROJECT->value);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFileTreeFileById')->willReturn($parent);
        $taskFileRepository->method('getByProjectParentAndName')->willReturn(null);
        $taskFileRepository->method('insert')->willReturnArgument(0);
        // 版本推进只点名父目录，且只调用一次。祖先链遍历不再由 bump 触发
        // （determineIsHidden 仍会为隐藏位检查读父链，那是另一件事）。
        $taskFileRepository->expects($this->never())->method('appendFileTreeChange');
        $taskFileRepository->expects($this->never())->method('appendFileTreeMutation');
        $taskFileRepository->expects($this->once())
            ->method('bumpMetadataVersions')
            ->with([500])
            ->willReturn(1);

        $this->service($taskFileRepository, $this->projectRepository(), $this->cloudFileRepository())
            ->createFile('第1层', '500', true);
    }

    /**
     * 删除：被删节点由 deleteByIds 各自落 delete 行，目录只前移版本；
     * 同样不得再遍历祖先链。
     */
    public function testDeleteFilesBumpsOnlyTheAffectedDirectories(): void
    {
        $file = new TaskFileEntity();
        $file->setFileId(900);
        $file->setParentId(500);
        $file->setFileName('星辰.txt');
        $file->setIsDirectory(false);

        $taskFileRepository = $this->createMock(TaskFileRepositoryInterface::class);
        $taskFileRepository->method('getFilesByIds')->willReturn([$file]);
        $taskFileRepository->expects($this->once())->method('deleteByIds')->with([900], false, null);
        $taskFileRepository->expects($this->never())->method('getFilesWithParentsByIds');
        $taskFileRepository->expects($this->once())
            ->method('bumpMetadataVersions')
            ->with([500])
            ->willReturn(1);

        $this->service($taskFileRepository)->deleteFiles(['900']);
    }

    private function projectRepository(): ProjectRepositoryInterface
    {
        $project = $this->createMock(ProjectEntity::class);
        $project->method('getWorkDir')->willReturn('/project_100/workspace');

        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->method('findById')->willReturn($project);

        return $projectRepository;
    }

    private function cloudFileRepository(): CloudFileRepositoryInterface
    {
        $cloudFileRepository = $this->createMock(CloudFileRepositoryInterface::class);
        $cloudFileRepository->method('getFullPrefix')->willReturn('DT001/open/');

        return $cloudFileRepository;
    }

    private function taskEntity(int $taskId, int $topicId): TaskEntity
    {
        $task = new TaskEntity();
        $task->setId($taskId);
        $task->setTopicId($topicId);

        return $task;
    }

    private function parentEntity(int $fileId, string $spaceType, int $topicId = 0, string $fileName = 'sub', int $projectId = 100): TaskFileEntity
    {
        $parent = new TaskFileEntity();
        $parent->setFileId($fileId);
        $parent->setUserId('user-1');
        $parent->setOrganizationCode('DT001');
        $parent->setProjectId($projectId);
        $parent->setTopicId($topicId);
        $parent->setFileName($fileName);
        $parent->setIsDirectory(true);
        $parent->setParentId(50);
        if ($spaceType !== '') {
            $parent->setSpaceType($spaceType);
        }

        return $parent;
    }

    private function service(
        TaskFileRepositoryInterface $taskFileRepository,
        ?ProjectRepositoryInterface $projectRepository = null,
        ?CloudFileRepositoryInterface $cloudFileRepository = null,
        ?TaskRepositoryInterface $taskRepository = null
    ): MagicFSFileDomainService {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        return new MagicFSFileDomainService(
            $taskFileRepository,
            $taskRepository ?? $this->createMock(TaskRepositoryInterface::class),
            $cloudFileRepository ?? $this->createMock(CloudFileRepositoryInterface::class),
            $projectRepository ?? $this->createMock(ProjectRepositoryInterface::class),
            $loggerFactory
        );
    }
}
