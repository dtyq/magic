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
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\FileTreeBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeChangesBatchRequestDTO;
use App\Interfaces\SuperMagic\File\MagicFS\DTO\Request\GetFileTreeChangesRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/**
 * 批量拉取接口：逐 root 鉴权 + 逐 root 复用单 root 结果语义。
 *
 * 用假 domain service 覆盖，不需要数据库；鉴权只在项目级收口做断言
 * （真正的项目成员判定属于 AbstractAppService，这里不重复测）。
 *
 * @internal
 */
class MagicFSFileAppServiceChangeFeedBatchTest extends TestCase
{
    public function testBatchAssemblesPerRootResultsFromSingleRootPath(): void
    {
        [$service, $domain] = $this->service();
        $calls = [];
        $domain->method('getFileById')->willReturn($this->rootFile());
        $domain->method('getFileTreeChanges')->willReturnCallback(
            function (string $rootFileId, int $sinceRevision, int $limit) use (&$calls): array {
                $calls[] = [$rootFileId, $sinceRevision, $limit];

                return match ($rootFileId) {
                    '100' => $this->feed([$this->row(5)], 5),
                    '200' => $this->feed([$this->row(1, '20'), $this->row(2, '20'), $this->row(3, '20')], 3),
                    default => throw new RuntimeException('unexpected root in fixture: ' . $rootFileId),
                };
            }
        );

        $results = $service->getFileTreeChangesBatch($this->authorization(), $this->request([
            ['root_file_id' => '100', 'since_revision' => 4],
            ['root_file_id' => '200', 'since_revision' => 0],
        ]))['results'];

        // 每个 root 都走单 root 路径，并且都要求 VIEWER。
        self::assertSame([['100', 4, 256], ['200', 0, 256]], $calls);
        self::assertSame([MemberRole::VIEWER, MemberRole::VIEWER], $service->checkedRoles);

        self::assertSame('100', $results[0]['root_file_id']);
        self::assertSame(5, $results[0]['revision'], 'revision 是观测到的 head');
        self::assertSame(5, $results[0]['next_revision']);
        self::assertFalse($results[0]['has_more']);
        self::assertFalse($results[0]['cursor_expired']);
        self::assertSame([5], array_column($results[0]['changes'], 'revision'));

        self::assertSame('200', $results[1]['root_file_id']);
        self::assertSame(3, $results[1]['revision']);
        self::assertSame(3, $results[1]['next_revision']);
        self::assertFalse($results[1]['has_more']);
    }

    public function testBatchResultCarriesHasMoreAndCursorExpired(): void
    {
        [$service, $domain] = $this->service();
        $domain->method('getFileById')->willReturn($this->rootFile());
        $domain->method('getFileTreeChanges')->willReturnCallback(
            fn (string $rootFileId): array => $rootFileId === '100'
                // 还有下一页：has_more 由 domain 判定，出参必须原样透传。
                ? $this->feed([$this->row(5)], 6, true)
                // journal 已压缩：客户端必须整体失效并在 head 处重新开始。
                : ['rows' => [], 'head' => 9, 'oldest' => 8, 'revision' => 9, 'has_more' => false, 'cursor_expired' => true]
        );

        $results = $service->getFileTreeChangesBatch($this->authorization(), $this->request([
            ['root_file_id' => '100', 'since_revision' => 4, 'limit' => 1],
            ['root_file_id' => '200', 'since_revision' => 3, 'limit' => 1],
        ]))['results'];

        self::assertTrue($results[0]['has_more']);
        self::assertSame([5], array_column($results[0]['changes'], 'revision'));
        self::assertSame(5, $results[0]['next_revision']);
        self::assertSame(6, $results[0]['revision']);

        self::assertTrue($results[1]['cursor_expired']);
        self::assertSame([], $results[1]['changes']);
        self::assertSame(9, $results[1]['next_revision'], '游标过期时 next_revision 直接跳到 head');
        self::assertSame(9, $results[1]['revision']);
    }

    public function testBatchFailsClosedBeforeReadingAnyFeedWhenARootIsNotAuthorized(): void
    {
        [$service, $domain] = $this->service();
        $domain->method('getFileById')->willReturn($this->rootFile());
        $domain->expects(self::never())->method('getFileTreeChanges');
        $service->denyProjectAccess = true;

        try {
            $service->getFileTreeChangesBatch($this->authorization(), $this->request([
                ['root_file_id' => '100', 'since_revision' => 0],
                ['root_file_id' => '200', 'since_revision' => 0],
            ]));
            self::fail('任何一个 root 鉴权失败都必须整体失败，不能返回半份结果');
        } catch (BusinessException $exception) {
            self::assertSame(SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value, $exception->getCode());
        }

        // 鉴权在读取之前收口：一行 journal 都没读，也不存在"跳过这个 root"的分支。
        self::assertSame([MemberRole::VIEWER], $service->checkedRoles);
    }

    public function testBatchRejectsEmptyAndOversizedRootLists(): void
    {
        [$service] = $this->service();

        foreach ([[], $this->manyRoots($service->maxBatchRoots() + 1)] as $roots) {
            try {
                $service->getFileTreeChangesBatch($this->authorization(), $this->request($roots));
                self::fail('空列表或超出上限都必须被拒绝');
            } catch (BusinessException $exception) {
                self::assertSame(GenericErrorCode::ParameterValidationFailed->value, $exception->getCode());
            }
        }
    }

    public function testBatchRejectsRootWithoutFileId(): void
    {
        [$service] = $this->service();

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(GenericErrorCode::ParameterValidationFailed->value);

        $service->getFileTreeChangesBatch($this->authorization(), $this->request([
            ['root_file_id' => '', 'since_revision' => 0],
        ]));
    }

    public function testRequestParsingKeepsRootsOneToOneAndNormalizesBounds(): void
    {
        $request = $this->createMock(RequestInterface::class);
        $request->method('all')->willReturn([
            'roots' => [
                ['root_file_id' => 100, 'since_revision' => -5, 'limit' => 99999],
                'not-an-object',
            ],
        ]);

        $dto = GetFileTreeChangesBatchRequestDTO::fromRequest($request);

        self::assertCount(2, $dto->roots, '形状不对的项也要占位，出参才能和入参一一对应');
        self::assertSame('100', $dto->roots[0]['root_file_id']);
        self::assertSame(0, $dto->roots[0]['since_revision']);
        self::assertSame(1000, $dto->roots[0]['limit']);
        self::assertSame('', $dto->roots[1]['root_file_id']);
        self::assertSame(256, $dto->roots[1]['limit'], '缺省 limit 与单 root 接口一致');
    }

    /**
     * @return array{0: MagicFSFileAppService, 1: MagicFSFileDomainService}
     */
    /**
     * @return array{0: RecordingFileAppService, 1: MagicFSFileDomainService&MockObject}
     */
    private function service(): array
    {
        $domain = $this->createMock(MagicFSFileDomainService::class);
        $policy = $this->createMock(PublishedMicroAppFileAccessService::class);
        $treeBuilder = $this->createMock(FileTreeBuilder::class);
        $treeBuilder->method('buildTree')->willReturn([]);

        return [new RecordingFileAppService($domain, $policy, $treeBuilder), $domain];
    }

    /**
     * @param array<int, array<string, mixed>> $roots
     */
    private function request(array $roots): GetFileTreeChangesBatchRequestDTO
    {
        $dto = new GetFileTreeChangesBatchRequestDTO();
        foreach ($roots as $root) {
            $single = GetFileTreeChangesRequestDTO::fromArray($root);
            $dto->roots[] = [
                'root_file_id' => (string) ($root['root_file_id'] ?? ''),
                'since_revision' => $single->since_revision,
                'limit' => $single->limit,
            ];
        }

        return $dto;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function manyRoots(int $count): array
    {
        $roots = [];
        for ($index = 0; $index < $count; ++$index) {
            $roots[] = ['root_file_id' => (string) (1000 + $index), 'since_revision' => 0];
        }

        return $roots;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array{rows:array<int, array<string, mixed>>,head:int,oldest:int,revision:int,has_more:bool,cursor_expired:bool}
     */
    private function feed(array $rows, int $head, bool $hasMore = false): array
    {
        return [
            'rows' => $rows,
            'head' => $head,
            'oldest' => 1,
            'revision' => $head,
            'has_more' => $hasMore,
            'cursor_expired' => false,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function row(int $revision, string $fileId = '10'): array
    {
        return [
            'revision' => $revision,
            'operation' => 'create',
            'file_id' => $fileId,
            'parent_id' => '1',
            'old_parent_id' => null,
            'name' => 'a.txt',
            'old_name' => null,
            'file_snapshot' => '{"id":"' . $fileId . '","file_metadata":{}}',
        ];
    }

    private function rootFile(): TaskFileEntity
    {
        $file = new TaskFileEntity();
        $file->setFileId(100);
        $file->setProjectId(11);
        $file->setOrganizationCode('org');
        $file->setSpaceType(FileSpaceType::PROJECT->value);
        $file->setIsDirectory(true);

        return $file;
    }

    private function authorization(): MagicUserAuthorization
    {
        $auth = new MagicUserAuthorization();
        $auth->setId('reader');
        $auth->setOrganizationCode('org');

        return $auth;
    }
}

/**
 * 测试替身：暴露批量接口用到的两处内部状态，并把项目级鉴权换成可开关的假实现。
 *
 * 具名而非匿名，是为了让它出现在 service() 的返回类型上 —— 否则
 * $service->checkedRoles / ->denyProjectAccess / ->maxBatchRoots() 对调用方
 * 和静态分析都是不存在的成员。
 */
final class RecordingFileAppService extends MagicFSFileAppService
{
    /** @var array<int, MemberRole> 每次鉴权请求的角色，按发生顺序 */
    public array $checkedRoles = [];

    public bool $denyProjectAccess = false;

    public function __construct(
        MagicFSFileDomainService $domain,
        PublishedMicroAppFileAccessService $policy,
        FileTreeBuilder $treeBuilder
    ) {
        $this->magicFSFileDomainService = $domain;
        $this->publishedMicroAppFileAccessService = $policy;
        $this->fileTreeBuilder = $treeBuilder;
        $this->logger = new NullLogger();
    }

    public function maxBatchRoots(): int
    {
        return self::MAX_CHANGE_FEED_BATCH_ROOTS;
    }

    protected function assertProjectAccessible(int $projectId, MagicUserAuthorization $authorization, MemberRole $requiredRole): void
    {
        $this->checkedRoles[] = $requiredRole;

        if ($this->denyProjectAccess) {
            throw new BusinessException(
                'project access denied',
                SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value
            );
        }
    }
}
