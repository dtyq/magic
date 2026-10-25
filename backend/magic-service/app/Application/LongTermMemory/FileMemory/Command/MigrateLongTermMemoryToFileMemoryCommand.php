<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\LongTermMemory\FileMemory\Command;

use App\Application\LongTermMemory\Enum\AppCodeEnum;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 将 Super Magic 历史长期记忆迁移到用户空间 MEMORY.md.
 */
#[Command]
final class MigrateLongTermMemoryToFileMemoryCommand extends HyperfCommand
{
    private const string SOURCE_TABLE = 'magic_long_term_memories';

    private const string GLOBAL_MEMORY_PATH = '.magic/memory/global/MEMORY.md';

    private const string PROJECT_MEMORY_DIRECTORY = '.magic/memory/projects';

    private const string MEMORY_HEADING = '## 长期记忆';

    /**
     * 缓存迁移过程中已经解析的用户空间文件节点，避免重复查询相同路径.
     *
     * @var array<string, null|TaskFileEntity>
     */
    private array $userPathNodeCache = [];

    /**
     * 注入用户空间文件迁移所需的领域服务.
     */
    public function __construct(
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly FileDomainService $fileDomainService,
    ) {
        parent::__construct('migrate:long-term-memory-to-file-memory');
    }

    /**
     * 配置迁移命令参数.
     */
    public function configure(): void
    {
        parent::configure();
        $this->setDescription('将 Super Magic 历史长期记忆迁移到用户空间文件记忆');
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '仅预览，不执行任何写入');
        $this->addOption('execute', null, InputOption::VALUE_NONE, '实际提交文件记忆迁移');
        $this->addOption('all', null, InputOption::VALUE_NONE, '执行全部用户的历史记忆迁移，仅允许与 --execute --yes 一起使用');
        $this->addOption('yes', null, InputOption::VALUE_NONE, '跳过执行模式确认，仅允许与 --execute 一起使用');
        $this->addOption('org-id', null, InputOption::VALUE_OPTIONAL, '仅处理指定组织');
        $this->addOption('user-id', null, InputOption::VALUE_OPTIONAL, '仅处理指定用户');
        $this->addOption('project-id', null, InputOption::VALUE_OPTIONAL, '仅处理指定历史项目，0 表示全局');
        $this->addOption('memory-id', null, InputOption::VALUE_OPTIONAL, '仅处理指定旧记忆 ID');
        $this->addOption('batch-size', null, InputOption::VALUE_OPTIONAL, '每批读取记录数', 100);
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, '最多处理源记录数，0 表示不限制', 0);
        $this->addOption('max-errors', null, InputOption::VALUE_OPTIONAL, '达到错误数后停止继续处理', 10);
        $this->addOption('report', null, InputOption::VALUE_OPTIONAL, '输出 JSONL 迁移报告路径');
    }

    /**
     * 执行默认 dry-run 或显式 execute 迁移.
     */
    public function handle(): int
    {
        $execute = (bool) $this->input->getOption('execute');
        $dryRun = (bool) $this->input->getOption('dry-run');
        $all = (bool) $this->input->getOption('all');
        $yes = (bool) $this->input->getOption('yes');
        if ($execute && $dryRun) {
            $this->error('--dry-run 和 --execute 不能同时使用');
            return self::FAILURE;
        }
        if ($yes && ! $execute) {
            $this->error('--yes 只能与 --execute 一起使用');
            return self::FAILURE;
        }
        if ($all && ! $execute) {
            $this->error('--all 只能与 --execute 一起使用');
            return self::FAILURE;
        }

        try {
            $organizationCode = $this->nullableOption('org-id');
            $userId = $this->nullableOption('user-id');
            $projectId = $this->validatedIdOption('project-id', true);
            $memoryId = $this->validatedIdOption('memory-id', false);
            $batchSize = $this->integerOption('batch-size', 1, 1000);
            $limit = $this->integerOption('limit', 0);
            $maxErrors = $this->integerOption('max-errors', 1);
            $reportPath = $this->nullableOption('report');
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        if ($all && ($organizationCode !== null || $userId !== null || $projectId !== null || $memoryId !== null)) {
            $this->error('--all 不能与 --org-id、--user-id、--project-id 或 --memory-id 同时使用');
            return self::FAILURE;
        }
        if ($all && ! $yes) {
            $this->error('全量迁移必须同时指定 --all、--execute 和 --yes');
            return self::FAILURE;
        }
        if ($all && $reportPath === null) {
            $this->error('全量迁移必须通过 --report 指定 JSONL 迁移报告路径');
            return self::FAILURE;
        }
        if ($all && $limit > 0) {
            $this->error('全量迁移不能同时指定非零 --limit');
            return self::FAILURE;
        }
        if ($execute && ! $all && ($organizationCode === null || $userId === null)) {
            $this->error('首次执行模式必须同时指定 --org-id 和 --user-id 进行单用户灰度');
            return self::FAILURE;
        }
        if ($execute) {
            $this->warn('执行前请停止旧长期记忆写入，并避免 Agent 同时修改目标 MEMORY.md');
        }
        if ($execute && ! $yes && ! $this->confirm('将写入用户空间文件和对象存储，是否继续？', false)) {
            $this->warn('已取消');
            return self::SUCCESS;
        }

        $reportHandle = null;
        try {
            $reportHandle = $reportPath === null ? null : $this->openReport($reportPath);
            $report = $this->migrate(
                execute: $execute,
                organizationCode: $organizationCode,
                userId: $userId,
                projectId: $projectId,
                memoryId: $memoryId,
                batchSize: $batchSize,
                limit: $limit,
                maxErrors: $maxErrors,
                reportHandle: $reportHandle,
            );
            if ($reportHandle !== null) {
                $this->writeReport($reportHandle, ['result' => 'summary'] + $report);
            }
            foreach ($report as $name => $value) {
                $this->line(sprintf('%s: %d', $name, $value));
            }
            if ($report['failed_total'] > 0) {
                $this->error('历史长期记忆迁移存在失败记录，请根据报告处理后重试');
                return self::FAILURE;
            }
            $this->info($execute ? '历史长期记忆迁移完成' : 'Dry-run 完成，未执行任何写入');
            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('迁移失败: ' . $e->getMessage());
            return self::FAILURE;
        } finally {
            if ($reportHandle !== null) {
                fclose($reportHandle);
            }
        }
    }

    /**
     * 按旧 ID 游标分页查询历史记忆并执行迁移.
     *
     * @return array<string, int>
     */
    private function migrate(
        bool $execute,
        ?string $organizationCode,
        ?string $userId,
        ?string $projectId,
        ?string $memoryId,
        int $batchSize,
        int $limit,
        int $maxErrors,
        mixed $reportHandle,
    ): array {
        $report = [
            'source_total' => $this->sourceQuery($organizationCode, $userId, $projectId, $memoryId)->count(),
            'processed_total' => 0,
            'planned_total' => 0,
            'created_total' => 0,
            'skipped_duplicate_total' => 0,
            'failed_total' => 0,
        ];
        $lastId = '0';
        $selectedTotal = 0;

        while (true) {
            $rows = $this->sourceQuery($organizationCode, $userId, $projectId, $memoryId)
                ->where('id', '>', $lastId)
                ->orderBy('id')
                ->limit($batchSize)
                ->get()
                ->map(static fn (array|object $row): array => (array) $row)
                ->all();
            if ($rows === []) {
                break;
            }

            $groups = [];
            $shouldStop = false;
            foreach ($rows as $row) {
                if ($limit > 0 && $selectedTotal >= $limit) {
                    $shouldStop = true;
                    break;
                }
                $lastId = (string) ($row['id'] ?? $lastId);
                ++$selectedTotal;
                try {
                    $prepared = $this->prepareRow($row);
                    $groupKey = implode('|', [
                        $prepared['organization_code'],
                        $prepared['user_id'],
                        $prepared['target_path'],
                    ]);
                    $groups[$groupKey]['organization_code'] = $prepared['organization_code'];
                    $groups[$groupKey]['user_id'] = $prepared['user_id'];
                    $groups[$groupKey]['target_path'] = $prepared['target_path'];
                    $groups[$groupKey]['entries'][] = $prepared;
                } catch (Throwable $e) {
                    ++$report['failed_total'];
                    ++$report['processed_total'];
                    $this->writeReport($reportHandle, [
                        'result' => 'failed',
                        'legacy_id' => (string) ($row['id'] ?? ''),
                        'error' => $e->getMessage(),
                    ]);
                }
                if ($report['failed_total'] >= $maxErrors) {
                    $shouldStop = true;
                    break;
                }
            }

            if (! $this->processPreparedGroups($groups, $execute, $report, $reportHandle, $maxErrors)) {
                $shouldStop = true;
            }
            if ($shouldStop) {
                break;
            }
            if (count($rows) < $batchSize) {
                break;
            }
        }

        return $report;
    }

    /**
     * 将单条数据库记忆转换为目标文件写入参数.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function prepareRow(array $row): array
    {
        $legacyId = $this->requiredString($row, 'id');
        $organizationCode = $this->requiredString($row, 'org_id');
        $userId = $this->requiredString($row, 'user_id');
        $projectId = $this->normalizeProjectId($row['project_id'] ?? null);
        $content = $this->normalizeMemoryContent((string) ($row['content'] ?? ''));
        $targetPath = $projectId === null
            ? self::GLOBAL_MEMORY_PATH
            : sprintf('%s/p_%s/MEMORY.md', self::PROJECT_MEMORY_DIRECTORY, $projectId);

        return [
            'legacy_id' => $legacyId,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'project_id' => $projectId,
            'target_path' => $targetPath,
            'enabled' => (bool) ($row['enabled'] ?? true),
            'content' => $content,
            'content_chars' => mb_strlen($content),
            'content_bytes' => strlen($content),
            'content_sha256' => hash('sha256', $content),
        ];
    }

    /**
     * 按目标文件批量预检或写入迁移记录，并更新迁移报告.
     *
     * @param array<string, array<string, mixed>> $groups
     * @param array<string, int> $report
     */
    private function processPreparedGroups(
        array $groups,
        bool $execute,
        array &$report,
        mixed $reportHandle,
        int $maxErrors,
    ): bool {
        foreach ($groups as $group) {
            $pendingEntries = [];
            try {
                $currentContent = $this->readUserTextFile(
                    $group['organization_code'],
                    $group['user_id'],
                    $group['target_path'],
                ) ?? '';
                [$nextContent, $pendingEntries, $duplicateEntries] = $this->mergeHistoricalMemories(
                    $currentContent,
                    $group['entries'],
                );

                foreach ($duplicateEntries as $entry) {
                    ++$report['skipped_duplicate_total'];
                    ++$report['processed_total'];
                    $this->writeReport($reportHandle, ['result' => 'skipped_duplicate'] + $this->reportEntry($entry));
                }

                if ($pendingEntries !== [] && $execute) {
                    $this->writeUserTextFile(
                        $group['organization_code'],
                        $group['user_id'],
                        $group['target_path'],
                        $nextContent,
                    );
                }

                foreach ($pendingEntries as $entry) {
                    ++$report['planned_total'];
                    if ($execute) {
                        ++$report['created_total'];
                    }
                    ++$report['processed_total'];
                    $this->writeReport(
                        $reportHandle,
                        ['result' => $execute ? 'created' : 'planned'] + $this->reportEntry($entry),
                    );
                }
            } catch (Throwable $e) {
                foreach ($pendingEntries === [] ? $group['entries'] : $pendingEntries as $entry) {
                    ++$report['failed_total'];
                    ++$report['processed_total'];
                    $this->writeReport(
                        $reportHandle,
                        ['result' => 'failed', 'error' => $e->getMessage()] + $this->reportEntry($entry),
                    );
                }
            }

            if ($report['failed_total'] >= $maxErrors) {
                return false;
            }
        }
        return true;
    }

    /**
     * 构造固定筛选条件，迁移只读取 Super Magic 的 active 正式记忆.
     */
    private function sourceQuery(
        ?string $organizationCode,
        ?string $userId,
        ?string $projectId,
        ?string $memoryId,
    ): Builder {
        $query = Db::table(self::SOURCE_TABLE)
            ->where('app_id', AppCodeEnum::SUPER_MAGIC->value)
            ->where('status', 'active')
            ->where('enabled', 1)
            ->whereNull('deleted_at')
            ->whereRaw("TRIM(content) <> ''");
        if ($organizationCode !== null) {
            $query->where('org_id', $organizationCode);
        }
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }
        if ($memoryId !== null) {
            $query->where('id', $memoryId);
        }
        if ($projectId === '0') {
            $query->where(static function (Builder $builder): void {
                $builder->whereNull('project_id')->orWhere('project_id', 0);
            });
        } elseif ($projectId !== null) {
            $query->where('project_id', $projectId);
        }
        return $query;
    }

    /**
     * 将历史记忆追加到自然 Markdown 的历史记忆章节中.
     *
     * @param array<int, array<string, mixed>> $entries
     * @return array{string, array<int, array<string, mixed>>, array<int, array<string, mixed>>}
     */
    private function mergeHistoricalMemories(string $document, array $entries): array
    {
        $lines = preg_split('/\R/u', $document) ?: [];
        [$headingIndex, $sectionEnd] = $this->findHistorySection($lines);
        $knownContents = [];
        if ($headingIndex !== null) {
            for ($index = $headingIndex + 1; $index < $sectionEnd; ++$index) {
                if (preg_match('/^-\s+(?<content>.+)$/u', trim($lines[$index]), $matches) === 1) {
                    $knownContents[$this->duplicateKey($matches['content'])] = true;
                }
            }
        }

        $pendingEntries = [];
        $duplicateEntries = [];
        foreach ($entries as $entry) {
            $key = $this->duplicateKey($entry['content']);
            if (isset($knownContents[$key])) {
                $duplicateEntries[] = $entry;
                continue;
            }
            $knownContents[$key] = true;
            $pendingEntries[] = $entry;
        }
        if ($pendingEntries === []) {
            return [$document, [], $duplicateEntries];
        }

        $newLines = array_map(static fn (array $entry): string => '- ' . $entry['content'], $pendingEntries);
        if ($headingIndex === null) {
            $content = rtrim($document);
            $content .= ($content === '' ? '' : "\n\n") . self::MEMORY_HEADING . "\n\n";
            $content .= implode("\n", $newLines) . "\n";
            return [$content, $pendingEntries, $duplicateEntries];
        }

        $before = array_slice($lines, 0, $sectionEnd);
        while ($before !== [] && trim((string) end($before)) === '') {
            array_pop($before);
        }
        $after = array_slice($lines, $sectionEnd);
        while ($after !== [] && trim((string) reset($after)) === '') {
            array_shift($after);
        }
        $mergedLines = [...$before, '', ...$newLines];
        if ($after !== []) {
            $mergedLines[] = '';
            $mergedLines = [...$mergedLines, ...$after];
        }
        return [rtrim(implode("\n", $mergedLines)) . "\n", $pendingEntries, $duplicateEntries];
    }

    /**
     * 定位历史记忆章节及下一个二级章节的位置.
     *
     * @param string[] $lines
     * @return array{null|int, int}
     */
    private function findHistorySection(array $lines): array
    {
        $headingIndex = null;
        foreach ($lines as $index => $line) {
            if (trim($line) === self::MEMORY_HEADING) {
                $headingIndex = $index;
                continue;
            }
            if ($headingIndex !== null && preg_match('/^##\s+/u', trim($line)) === 1) {
                return [$headingIndex, $index];
            }
        }
        return [$headingIndex, count($lines)];
    }

    /**
     * 读取用户空间中的目标文本文件，不存在时返回 null.
     */
    private function readUserTextFile(string $organizationCode, string $userId, string $relativePath): ?string
    {
        $root = $this->getUserSpaceRoot($organizationCode, $userId, false);
        if ($root === null) {
            return null;
        }
        $file = $this->resolveUserFile($root, $organizationCode, $userId, $relativePath);
        if ($file === null) {
            return null;
        }
        if ($file->getIsDirectory()) {
            throw new RuntimeException('目标记忆文件路径指向目录: ' . $relativePath);
        }
        return $this->readCloudText($organizationCode, $file->getFileKey());
    }

    /**
     * 创建目录链并完整覆盖用户空间中的目标文本文件.
     */
    private function writeUserTextFile(
        string $organizationCode,
        string $userId,
        string $relativePath,
        string $content,
    ): void {
        $segments = $this->pathSegments($relativePath);
        $fileName = array_pop($segments);
        if ($fileName === null || $fileName === '') {
            throw new InvalidArgumentException('目标记忆文件名不能为空');
        }

        $parent = $this->getUserSpaceRoot($organizationCode, $userId, true);
        if ($parent === null) {
            throw new RuntimeException('用户空间根目录不存在');
        }
        $currentPath = '';
        foreach ($segments as $segment) {
            $currentPath = $currentPath === '' ? $segment : $currentPath . '/' . $segment;
            $child = $this->getUserPathNode(
                $parent,
                $organizationCode,
                $userId,
                $currentPath,
                $segment,
            );
            if ($child === null) {
                $child = $this->magicFSFileDomainService->createFile(
                    name: $segment,
                    parentId: (string) $parent->getFileId(),
                    isDirectory: true,
                    source: TaskFileSource::AGENT,
                );
                $this->cacheUserPathNode($organizationCode, $userId, $currentPath, $child);
            }
            if (! $child->getIsDirectory() || ! $this->belongsToUserSpace($child, $organizationCode, $userId)) {
                throw new RuntimeException('目标记忆目录路径被文件占用: ' . $relativePath);
            }
            $parent = $child;
        }

        $filePath = $currentPath === '' ? $fileName : $currentPath . '/' . $fileName;
        $file = $this->getUserPathNode(
            $parent,
            $organizationCode,
            $userId,
            $filePath,
            $fileName,
        );
        if ($file === null) {
            $file = $this->magicFSFileDomainService->createFile(
                name: $fileName,
                parentId: (string) $parent->getFileId(),
                isDirectory: false,
                source: TaskFileSource::AGENT,
            );
            $this->cacheUserPathNode($organizationCode, $userId, $filePath, $file);
        }
        if ($file->getIsDirectory() || ! $this->belongsToUserSpace($file, $organizationCode, $userId)) {
            throw new RuntimeException('目标记忆文件路径被目录占用: ' . $relativePath);
        }

        $this->writeCloudText($organizationCode, $file->getFileKey(), $content);
        $writtenContent = $this->readCloudText($organizationCode, $file->getFileKey());
        if (! hash_equals(hash('sha256', $content), hash('sha256', $writtenContent))) {
            throw new RuntimeException('目标记忆文件写入后校验失败: ' . $relativePath);
        }
        $this->magicFSFileDomainService->updateFile(
            (string) $file->getFileId(),
            ['size' => strlen($content)],
        );
    }

    /**
     * 从用户空间根目录解析目标文件.
     */
    private function resolveUserFile(
        TaskFileEntity $root,
        string $organizationCode,
        string $userId,
        string $relativePath,
    ): ?TaskFileEntity {
        $current = $root;
        $currentPath = '';
        foreach ($this->pathSegments($relativePath) as $segment) {
            $currentPath = $currentPath === '' ? $segment : $currentPath . '/' . $segment;
            $current = $this->getUserPathNode(
                $current,
                $organizationCode,
                $userId,
                $currentPath,
                $segment,
            );
            if ($current === null || ! $this->belongsToUserSpace($current, $organizationCode, $userId)) {
                return null;
            }
        }
        return $current;
    }

    /**
     * 从对象存储读取 UTF-8 文本.
     */
    private function readCloudText(string $organizationCode, string $fileKey): string
    {
        $temporaryPath = tempnam(sys_get_temp_dir(), 'memory_migration_read_');
        if ($temporaryPath === false) {
            throw new RuntimeException('无法创建迁移读取临时文件');
        }
        try {
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $fileKey,
                $temporaryPath,
                StorageBucketType::SandBox,
            );
            $content = file_get_contents($temporaryPath);
            if ($content === false) {
                throw new RuntimeException('无法读取迁移目标文件');
            }
            if (! mb_check_encoding($content, 'UTF-8')) {
                throw new RuntimeException('迁移目标文件不是有效的 UTF-8 文本');
            }
            return $content;
        } finally {
            @unlink($temporaryPath);
        }
    }

    /**
     * 将 UTF-8 文本完整覆盖到对象存储.
     */
    private function writeCloudText(string $organizationCode, string $fileKey, string $content): void
    {
        if (! mb_check_encoding($content, 'UTF-8')) {
            throw new RuntimeException('待迁移内容不是有效的 UTF-8 文本');
        }
        $temporaryPath = tempnam(sys_get_temp_dir(), 'memory_migration_write_');
        if ($temporaryPath === false) {
            throw new RuntimeException('无法创建迁移写入临时文件');
        }
        try {
            if (file_put_contents($temporaryPath, $content) === false) {
                throw new RuntimeException('无法写入迁移临时文件');
            }
            $uploadFile = new UploadFile(
                $temporaryPath,
                dirname($fileKey),
                basename($fileKey),
                false,
            );
            $this->fileDomainService->uploadByCredential(
                $organizationCode,
                $uploadFile,
                StorageBucketType::SandBox,
                false,
                'text/markdown; charset=utf-8',
            );
        } finally {
            @unlink($temporaryPath);
        }
    }

    /**
     * 规范化并校验用户空间相对路径.
     *
     * @return string[]
     */
    private function pathSegments(string $relativePath): array
    {
        $normalized = trim($relativePath, '/');
        if ($normalized === '') {
            return [];
        }
        $segments = explode('/', $normalized);
        foreach ($segments as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..' || str_contains($segment, '\\')) {
                throw new InvalidArgumentException('目标记忆路径包含无效片段');
            }
        }
        return $segments;
    }

    /**
     * 校验文件节点属于指定用户空间.
     */
    private function belongsToUserSpace(TaskFileEntity $entity, string $organizationCode, string $userId): bool
    {
        return $entity->getProjectId() === 0
            && $entity->getOrganizationCode() === $organizationCode
            && $entity->getUserId() === $userId
            && $entity->getSpaceType() === 'user';
    }

    /**
     * 获取用户空间根目录，并按需创建后写入命令级缓存.
     */
    private function getUserSpaceRoot(
        string $organizationCode,
        string $userId,
        bool $create,
    ): ?TaskFileEntity {
        $cacheKey = $this->userPathCacheKey($organizationCode, $userId, '');
        if (array_key_exists($cacheKey, $this->userPathNodeCache)) {
            $root = $this->userPathNodeCache[$cacheKey];
            if ($root !== null || ! $create) {
                return $root;
            }
        }

        if ($create) {
            $rootId = $this->taskFileDomainService->findOrCreateUserRootDirectory($userId, $organizationCode);
            $root = $this->taskFileDomainService->getById($rootId);
            if ($root === null) {
                throw new RuntimeException('用户空间根目录不存在');
            }
        } else {
            $root = $this->taskFileRepository->findUserSpaceRootDirectory($userId, $organizationCode);
        }

        if ($root !== null && ! $this->belongsToUserSpace($root, $organizationCode, $userId)) {
            throw new RuntimeException('用户空间根目录归属不正确');
        }
        $this->userPathNodeCache[$cacheKey] = $root;
        return $root;
    }

    /**
     * 查询并缓存用户空间指定父目录下的文件节点.
     */
    private function getUserPathNode(
        TaskFileEntity $parent,
        string $organizationCode,
        string $userId,
        string $relativePath,
        string $fileName,
    ): ?TaskFileEntity {
        $cacheKey = $this->userPathCacheKey($organizationCode, $userId, $relativePath);
        if (array_key_exists($cacheKey, $this->userPathNodeCache)) {
            return $this->userPathNodeCache[$cacheKey];
        }

        $node = $this->taskFileDomainService->getByProjectParentAndName(0, $parent->getFileId(), $fileName);
        $this->userPathNodeCache[$cacheKey] = $node;
        return $node;
    }

    /**
     * 将新创建的用户空间文件节点写入命令级缓存.
     */
    private function cacheUserPathNode(
        string $organizationCode,
        string $userId,
        string $relativePath,
        TaskFileEntity $entity,
    ): void {
        $cacheKey = $this->userPathCacheKey($organizationCode, $userId, $relativePath);
        $this->userPathNodeCache[$cacheKey] = $entity;
    }

    /**
     * 生成用户空间路径缓存键.
     */
    private function userPathCacheKey(string $organizationCode, string $userId, string $relativePath): string
    {
        return implode("\0", [$organizationCode, $userId, $relativePath]);
    }

    /**
     * 将历史记忆正文压平为单行自然文本.
     */
    private function normalizeMemoryContent(string $content): string
    {
        $normalized = trim(str_replace(["\r\n", "\r"], "\n", $content));
        if ($normalized === '') {
            throw new InvalidArgumentException('历史记忆内容不能为空');
        }
        if (! mb_check_encoding($normalized, 'UTF-8')) {
            throw new InvalidArgumentException('历史记忆内容必须使用 UTF-8 编码');
        }
        return trim((string) preg_replace('/\s+/u', ' ', $normalized));
    }

    /**
     * 生成历史记忆正文去重键.
     */
    private function duplicateKey(string $content): string
    {
        return mb_strtolower($this->normalizeMemoryContent($content));
    }

    /**
     * 构造不包含原始正文的迁移报告字段.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    private function reportEntry(array $entry): array
    {
        return [
            'legacy_id' => $entry['legacy_id'],
            'organization_code' => $entry['organization_code'],
            'user_id' => $entry['user_id'],
            'project_id' => $entry['project_id'],
            'target_path' => $entry['target_path'],
            'enabled' => $entry['enabled'],
            'content_chars' => $entry['content_chars'],
            'content_bytes' => $entry['content_bytes'],
            'content_sha256' => $entry['content_sha256'],
        ];
    }

    /**
     * 读取非空命令筛选字符串.
     */
    private function nullableOption(string $name): ?string
    {
        $value = $this->input->getOption($name);
        $value = is_string($value) ? trim($value) : '';
        return $value === '' ? null : $value;
    }

    /**
     * 读取并校验十进制 ID 参数.
     */
    private function validatedIdOption(string $name, bool $allowZero): ?string
    {
        $value = $this->nullableOption($name);
        if ($value === null) {
            return null;
        }
        $pattern = $allowZero ? '/^(?:0|[1-9][0-9]*)$/' : '/^[1-9][0-9]*$/';
        if (preg_match($pattern, $value) !== 1) {
            throw new RuntimeException(sprintf('--%s 必须是%s十进制整数', $name, $allowZero ? '非负' : '正'));
        }
        return $value;
    }

    /**
     * 读取并校验命令行整数参数.
     */
    private function integerOption(string $name, int $minimum, ?int $maximum = null): int
    {
        $value = trim((string) $this->input->getOption($name));
        if (preg_match('/^[0-9]+$/', $value) !== 1) {
            throw new RuntimeException(sprintf('--%s 必须是整数', $name));
        }
        $number = filter_var($value, FILTER_VALIDATE_INT);
        if ($number === false || $number < $minimum || ($maximum !== null && $number > $maximum)) {
            $range = $maximum === null ? sprintf('不小于 %d', $minimum) : sprintf('介于 %d 和 %d 之间', $minimum, $maximum);
            throw new RuntimeException(sprintf('--%s 必须%s', $name, $range));
        }
        return $number;
    }

    /**
     * 读取数据库中的非空字符串字段.
     *
     * @param array<string, mixed> $row
     */
    private function requiredString(array $row, string $field): string
    {
        $value = trim((string) ($row[$field] ?? ''));
        if ($value === '') {
            throw new RuntimeException('历史记忆字段为空: ' . $field);
        }
        return $value;
    }

    /**
     * 将旧项目 ID 归一化为文件记忆使用的项目作用域.
     */
    private function normalizeProjectId(mixed $value): ?string
    {
        $projectId = trim((string) ($value ?? ''));
        if ($projectId === '' || $projectId === '0') {
            return null;
        }
        if (preg_match('/^[1-9][0-9]*$/', $projectId) !== 1) {
            throw new RuntimeException('历史记忆 project_id 无效: ' . $projectId);
        }
        return $projectId;
    }

    /**
     * 创建机器可读迁移报告文件.
     *
     * @return resource
     */
    private function openReport(string $path)
    {
        $handle = fopen($path, 'ab');
        if ($handle === false) {
            throw new RuntimeException('无法打开迁移报告文件: ' . $path);
        }
        return $handle;
    }

    /**
     * 追加一条 JSONL 报告；没有指定报告文件时不执行任何操作.
     *
     * @param null|resource $handle
     * @param array<string, mixed> $entry
     */
    private function writeReport(mixed $handle, array $entry): void
    {
        if (! is_resource($handle)) {
            return;
        }
        $encoded = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false || fwrite($handle, $encoded . PHP_EOL) === false) {
            throw new RuntimeException('无法写入迁移报告');
        }
    }
}
