<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Command;

use App\Application\SuperMagic\Task\DTO\SandboxRestartOptions;
use App\Application\SuperMagic\Task\DTO\SandboxRestartOutcome;
use App\Application\SuperMagic\Task\DTO\SandboxRestartResult;
use App\Application\SuperMagic\Task\Service\SandboxRestartAppService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageVersion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodDeletion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxPodSnapshot;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartPlan;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRestartScope;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use RuntimeException;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * 全量重启沙箱，让它们换用网关当前发布的镜像.
 *
 * 为什么是"重启"而不是"给沙箱发一条消息"：脚本无法判断沙箱里有没有任务在跑。
 * 发"继续"这类消息，即使 Agent 正在执行，也可能被理解成新的指令
 * （例如 Agent 正在问用户"可以这样做吗"，收到"继续"就真的执行了）。
 * 因此这里只做两件事：删掉旧 pod、按同一套初始化流程重建新 pod——
 * 初始化不会发送任何聊天消息，用户不会凭空收到一条回复。
 *
 * 目标镜像默认取网关当前发布版本；`--agent-image` / `--agfs-image` 可以显式指定
 * 这次重建要跑的镜像（回滚演练、验证"重启确实换了镜像"），未指定的一侧继续跟随发布。
 *
 * 用法示例：
 *   # 只看看会重启谁
 *   php bin/hyperf.php sandbox:restart-all --dry-run
 *
 *   # 灰度：先重启最老的 20 个
 *   php bin/hyperf.php sandbox:restart-all --limit=20 --concurrency=4
 *
 *   # 镜像已是最新也想强制重建（例如配置漂移）
 *   php bin/hyperf.php sandbox:restart-all --force
 *
 *   # 把沙箱重启到一个旧镜像（演练），随后不带参数 --dry-run 应能看到它们需要重启
 *   php bin/hyperf.php sandbox:restart-all --agent-image=repo/magic/super-magic:5.0.77
 */
#[Command]
class RestartAllSandboxCommand extends HyperfCommand
{
    /**
     * 每处理多少个目标至少打一行进度（单个沙箱重建可能十几秒）.
     */
    private const PROGRESS_EVERY = 10;

    /**
     * 距上次进度行超过多少秒就补一行.
     */
    private const PROGRESS_INTERVAL_SECONDS = 30.0;

    protected ?string $name = 'sandbox:restart-all';

    private ContainerInterface $container;

    private float $lastProgressAt = 0.0;

    private int $completedTargets = 0;

    /**
     * 已经实时打印过结果的目标（按对象身份记录）。
     *
     * 并发执行时结果是"边跑边出"的，命令通过回调即时打印；没有回调（例如流程在
     * execute() 内部提前返回）的结果在收尾时补打，保证一条都不漏。
     *
     * @var array<int, true>
     */
    private array $printedResults = [];

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        parent::__construct();
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Restart sandbox pods onto the target agent/agfs images (gateway release by default, or the images you specify)');
        $this->setHelp(<<<'HELP'
Replaces sandbox pods that do not run the target images. The target is the
sandbox gateway's current release, unless --agent-image / --agfs-image names
the images to launch instead.

The command never sends a chat message to the in-pod Agent: it deletes the old
pod(s) and rebuilds the sandbox through the normal initialization path, so a
user cannot receive an unexpected reply such as "continue".

Targets are read from the sandbox gateway pod list, not from business tables,
so pods that already exited are not resurrected. Per topic, every pod seen in
the list is deleted and exactly one new sandbox is created.

What happens per topic:
  1. waiting / running / waiting_for_user tasks are suspended first, so they are
     not reported as failed while the pod is gone;
  2. every pod the gateway lists for that topic is deleted (including drifted
     duplicates); a failed delete is recorded but does not block the rebuild;
  3. exactly one sandbox is rebuilt through the normal initialization path. That
     path prefers the warm pool: once the old pod is gone the pinned-sandbox
     guard no longer applies, so a ready pod is claimed and mounted instead of
     cold-starting. A claimed pod always matches the target images, because the
     claim is keyed by the image pair.

--sandbox-id narrows the run to the topic(s) that own the named sandboxes; every pod
of a selected topic is still replaced (a topic with drifted duplicate pods must be
rebuilt as a whole), and nothing else is touched -- no warm-pool or orphan cleanup.
An id that is missing from the gateway list, or that belongs to no topic, fails the
run before any pod is deleted.

Unbound warm-pool pods are deleted without rebuild only when they still run
outdated images; a pooled pod already on the release images is kept, because
deleting it would just make the refill loop build the same pod again. Warm-pool
pods are also kept when --scope=magic-claw (not our scope) and when you specify
images (the pool serves the release, not this run); --force still replaces them.
Orphan pods (no owning topic) are always deleted without rebuild.

Exit codes:
  0  every targeted sandbox was restarted (or nothing needed a restart)
  1  at least one sandbox failed to delete/rebuild, or the plan could not be built
     (e.g. the target images are unreadable and --force was not given)

Examples:
  php bin/hyperf.php sandbox:restart-all --dry-run
  php bin/hyperf.php sandbox:restart-all --limit=20 --concurrency=4
  php bin/hyperf.php sandbox:restart-all --scope=magic-claw --code=my-claw
  php bin/hyperf.php sandbox:restart-all --force
  php bin/hyperf.php sandbox:restart-all --agent-image=repo/magic/super-magic:5.0.77 --dry-run
  php bin/hyperf.php sandbox:restart-all --sandbox-id=971048413989916673 --agent-image=repo/magic/super-magic:5.0.77
HELP);
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'Print the plan without deleting or rebuilding anything');
        $this->addOption('force', null, InputOption::VALUE_NONE, 'Restart even when the pod already runs the target images');
        $this->addOption(
            'scope',
            null,
            InputOption::VALUE_OPTIONAL,
            'Which sandboxes to process: "all" (default) or "magic-claw"',
            SandboxRestartScope::All->value
        );
        $this->addOption('code', null, InputOption::VALUE_OPTIONAL, 'Only restart the Magic Claw with this code (implies --scope=magic-claw)', '');
        $this->addOption(
            'status',
            null,
            InputOption::VALUE_OPTIONAL,
            'Comma separated pod statuses to list (e.g. Running,NotReady); empty means every status',
            $this->defaultStatusOption()
        );
        $this->addOption('limit', null, InputOption::VALUE_OPTIONAL, 'Maximum number of topics to restart, 0 means unlimited', 0);
        $this->addOption('concurrency', null, InputOption::VALUE_OPTIONAL, 'How many topics to restart in parallel', 1);
        $this->addOption(
            'sandbox-id',
            null,
            InputOption::VALUE_REQUIRED,
            'Only restart the topic(s) that own these sandboxes (comma separated). '
            . 'Every pod of a selected topic is replaced, so pick one id per topic when duplicates exist.'
        );
        $this->addOption(
            'agent-image',
            null,
            InputOption::VALUE_REQUIRED,
            'Launch the rebuilt sandboxes with this agent image (full reference with a tag or digest, '
            . 'e.g. repo/magic/super-magic:5.0.92). Omit to follow the gateway release; '
            . 'specifying an image is for rollback drills, not for normal rollouts.'
        );
        $this->addOption(
            'agfs-image',
            null,
            InputOption::VALUE_REQUIRED,
            'Launch the rebuilt sandboxes with this agfs (magicfs) image; same rules as --agent-image'
        );
    }

    public function handle(): int
    {
        try {
            $options = $this->buildOptions();
        } catch (Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $this->printOptions($options);

        /** @var SandboxRestartAppService $service */
        $service = $this->container->get(SandboxRestartAppService::class);

        $startedAt = microtime(true);
        try {
            $plan = $service->plan($options);
        } catch (Throwable $e) {
            $this->error('Failed to build the restart plan: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->printPlan($plan, $options);

        if ($options->isDryRun() || $plan->isEmpty()) {
            $this->printEmptySummary($plan, $options, microtime(true) - $startedAt);
            return self::SUCCESS;
        }

        $total = $plan->getTargetCount();
        $this->line(sprintf(
            'Restarting %d topic(s) and deleting %d extra pod(s)...',
            $total,
            $plan->getDeletionCount()
        ));

        $this->lastProgressAt = microtime(true);
        $this->completedTargets = 0;
        $executeStartedAt = microtime(true);

        $this->printedResults = [];
        try {
            $outcome = $service->execute(
                $plan,
                $options,
                fn (SandboxRestartResult $result) => $this->printResultLive($total, $result, $executeStartedAt)
            );
        } catch (Throwable $e) {
            $this->error('Restart aborted: ' . $e->getMessage());
            return self::FAILURE;
        }

        // 回调没覆盖到的结果（例如执行中途异常）在这里补齐，保证每个目标都有一行结论。
        foreach ($outcome->getResults() as $result) {
            if (! isset($this->printedResults[spl_object_id($result)])) {
                $this->printResultLive($total, $result, $executeStartedAt);
            }
        }

        $this->printOutcome($outcome, $executeStartedAt);

        return $outcome->hasFailures() ? self::FAILURE : self::SUCCESS;
    }

    /**
     * --status 的默认值。默认不过滤：退出的、未就绪的、卡在 CrashLoop 的旧 pod
     * 同样占着旧镜像，发布时都该被替换。旧命令名可覆盖为历史上的 Running。
     */
    protected function defaultStatusOption(): string
    {
        return '';
    }

    /**
     * 解析 CLI 参数；非法值在动手前就失败，避免"跑了一半才发现参数错了".
     */
    protected function buildOptions(): SandboxRestartOptions
    {
        $scopeOption = (string) $this->input->getOption('scope');
        $scope = SandboxRestartScope::fromOption($scopeOption);
        if ($scope === null) {
            throw new RuntimeException(sprintf(
                'Invalid --scope value "%s", allowed: %s',
                $scopeOption,
                implode(', ', array_map(static fn (SandboxRestartScope $case): string => $case->value, SandboxRestartScope::cases()))
            ));
        }

        $code = trim((string) $this->input->getOption('code'));
        if ($code !== '') {
            $scope = SandboxRestartScope::MagicClaw;
        }

        return new SandboxRestartOptions(
            force: (bool) $this->input->getOption('force'),
            scope: $scope,
            clawCode: $code,
            limit: (int) $this->input->getOption('limit'),
            statuses: $this->parseStatuses((string) $this->input->getOption('status')),
            dryRun: (bool) $this->input->getOption('dry-run'),
            concurrency: (int) $this->input->getOption('concurrency'),
            requestedAgentImage: $this->parseRequestedImage('agent-image'),
            requestedAgfsImage: $this->parseRequestedImage('agfs-image'),
            sandboxIds: $this->parseSandboxIds(),
        );
    }

    /**
     * 解析 --sandbox-id：逗号分隔，去空、去重。
     *
     * 这里只做"长得像不像一个 id"的校验（非空、无空白），是否存在留给用例层——
     * 只有拿到网关清单之后才能判断 id 真假，而那时仍然在删除任何 pod 之前。
     *
     * @return string[]
     */
    private function parseSandboxIds(): array
    {
        $raw = $this->input->getOption('sandbox-id');
        if ($raw === null) {
            return [];
        }

        $ids = [];
        foreach (explode(',', (string) $raw) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            if (preg_match('/\s/', $part) === 1) {
                throw new RuntimeException(sprintf('Invalid --sandbox-id value "%s": ids must not contain whitespace', $part));
            }
            $ids[$part] = $part;
        }

        if ($ids === []) {
            throw new RuntimeException('--sandbox-id must not be empty when given; omit the option to restart every matching sandbox');
        }

        return array_values($ids);
    }

    /**
     * 解析命令行指定的镜像引用.
     *
     * 这里做"引用长得对不对"的最小校验，而不是等删完 pod 才发现名字打错：
     *   - 必须是一条完整引用（带仓库路径），裸名字在内部镜像里几乎总是笔误；
     *   - 必须带 tag 或 digest，否则等于隐式 :latest，回滚演练会变成"指定当前最新"。
     *
     * 未提供该选项时返回空串（= 跟随网关发布版本）。
     */
    private function parseRequestedImage(string $option): string
    {
        $raw = $this->input->getOption($option);
        if ($raw === null) {
            return '';
        }

        $value = trim((string) $raw);
        if ($value === '') {
            throw new RuntimeException(sprintf('--%s must not be empty when given; omit the option to follow the gateway release', $option));
        }
        if (preg_match('/\s/', $value) === 1) {
            throw new RuntimeException(sprintf('Invalid --%s value "%s": image references must not contain whitespace', $option, $value));
        }
        if (! str_contains($value, '/')) {
            throw new RuntimeException(sprintf(
                'Invalid --%s value "%s": expected a full image reference such as repo.example.com/magic/super-magic:5.0.92',
                $option,
                $value
            ));
        }
        if (SandboxImageVersion::extractTag($value) === '' && ! str_contains($value, '@')) {
            throw new RuntimeException(sprintf(
                'Invalid --%s value "%s": add an explicit tag or digest (e.g. :5.0.92 or @sha256:...); '
                . 'an implicit ":latest" would silently target "whatever is newest", which defeats the purpose',
                $option,
                $value
            ));
        }

        return $value;
    }

    /**
     * @return string[] 规范化后的状态列表；空数组表示不过滤
     */
    private function parseStatuses(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '' || strcasecmp($raw, 'any') === 0) {
            return [];
        }

        $allowed = [];
        foreach (SandboxStatus::getAllStatuses() as $status) {
            $allowed[strtolower($status)] = $status;
        }

        $statuses = [];
        foreach (explode(',', $raw) as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            $canonical = $allowed[strtolower($part)] ?? null;
            if ($canonical === null) {
                throw new RuntimeException(sprintf(
                    'Invalid --status value "%s", allowed: %s, or "any" to disable the filter',
                    $part,
                    implode(', ', SandboxStatus::getAllStatuses())
                ));
            }
            $statuses[$canonical] = $canonical;
        }

        return array_values($statuses);
    }

    private function printOptions(SandboxRestartOptions $options): void
    {
        $this->line(sprintf(
            'Options: dry_run=%s, force=%s, scope=%s, code=%s, status=%s, limit=%d, concurrency=%d',
            $options->isDryRun() ? 'true' : 'false',
            $options->isForce() ? 'true' : 'false',
            $options->getScope()->value,
            $options->getClawCode() === '' ? 'all' : $options->getClawCode(),
            $options->getStatuses() === [] ? 'any' : implode(',', $options->getStatuses()),
            $options->getLimit(),
            $options->getConcurrency()
        ));
    }

    /**
     * 动手前把"按哪一版镜像、清单多大、要重启几个、为什么跳过"一次打清楚.
     *
     * 目标镜像必须显式打出来：dry-run 的结论只有在"按哪一版判定"明确了才有意义，
     * 尤其是用 --agent-image / --agfs-image 做回滚演练时，pod 比目标"更新"也会被判成需要重启。
     */
    private function printPlan(SandboxRestartPlan $plan, SandboxRestartOptions $options): void
    {
        $target = $plan->getTarget();
        $sandboxIds = $options->getSandboxIds();
        $this->line(sprintf('Sandbox list: %d pod(s)', $plan->getListedPods()));
        if ($sandboxIds !== []) {
            $this->line(sprintf(
                'Restricted to --sandbox-id: %s (every pod of their topic is replaced)',
                implode(', ', $sandboxIds)
            ));
        }
        $this->line(sprintf(
            'Target images (%s): %s',
            $target->hasSpecifiedImages() ? 'specified for this run' : 'gateway release',
            $target->describe()
        ));
        $this->line(sprintf(
            'Targets: %d topic(s) to rebuild, %d pod(s) to delete only, %d topic(s) already on the target images',
            $plan->getTargetCount(),
            $plan->getDeletionCount(),
            $plan->getUpToDateTopics()
        ));

        if ($plan->getSkippedPodCount() > 0) {
            $this->line('Skipped: ' . $this->formatSkipReasons($plan));
        }

        foreach ($plan->getTargets() as $target) {
            if ($target->hasDuplicatePods()) {
                $this->line(sprintf(
                    '[DUPLICATE] topic_id=%d has %d sandbox pods: %s',
                    $target->getTopicId(),
                    count($target->getPods()),
                    implode(', ', array_map(
                        static fn (SandboxPodSnapshot $pod): string => $pod->describe(),
                        $target->getPods()
                    ))
                ));
            }
        }

        if (! $options->isDryRun()) {
            // 逐条明细只在 -v 下打印，否则上百行会把进度淹没。
            if ($this->output->isVerbose()) {
                foreach ($plan->getTargets() as $index => $target) {
                    $this->line(sprintf(
                        '[TARGET] %d/%d %s, project_id=%d, deletes=%s, recreates=1',
                        $index + 1,
                        $plan->getTargetCount(),
                        $target->describe(),
                        $target->getProjectId(),
                        implode(', ', $target->getSandboxIds())
                    ));
                }
                foreach ($plan->getDeletions() as $deletion) {
                    $this->line(sprintf(
                        '[DELETE] sandbox_id=%s, reason=%s',
                        $deletion->getPod()->getSandboxId(),
                        $deletion->getReason()
                    ));
                }
            }
            return;
        }

        foreach ($plan->getTargets() as $index => $target) {
            $this->line(sprintf(
                '[TARGET] %d/%d %s, project_id=%d, deletes=%s, recreates=1',
                $index + 1,
                $plan->getTargetCount(),
                $target->describe(),
                $target->getProjectId(),
                implode(', ', $target->getSandboxIds())
            ));
        }
        foreach ($plan->getDeletions() as $deletion) {
            $this->line(sprintf(
                '[DELETE] sandbox_id=%s, reason=%s',
                $deletion->getPod()->getSandboxId(),
                $deletion->getReason()
            ));
        }
    }

    private function formatSkipReasons(SandboxRestartPlan $plan): string
    {
        $parts = [];
        foreach ($plan->getSkippedByReason() as $reason => $pods) {
            $examples = array_slice(array_map(
                static fn (SandboxPodSnapshot $pod): string => $pod->getSandboxId(),
                $pods
            ), 0, 2);
            $parts[] = sprintf('%s=%d (e.g. %s)', $reason, count($pods), implode(', ', $examples));
        }
        return implode('; ', $parts);
    }

    private function printEmptySummary(SandboxRestartPlan $plan, SandboxRestartOptions $options, float $elapsed): void
    {
        $this->line('');
        $this->info('Sandbox restart summary:');
        $this->line('  dry_run: ' . ($options->isDryRun() ? 'true' : 'false'));
        $this->line('  listed: ' . $plan->getListedPods());
        $this->line('  targets: ' . $plan->getTargetCount());
        $this->line('  deletions: ' . $plan->getDeletionCount());
        $this->line('  up_to_date: ' . $plan->getUpToDateTopics());
        $this->line('  skipped: ' . $plan->getSkippedPodCount());
        $this->line('  elapsed: ' . self::formatDuration($elapsed));
    }

    private function printOutcome(SandboxRestartOutcome $outcome, float $startedAt): void
    {
        foreach ($outcome->getDeletionFailures() as $failure) {
            /** @var SandboxPodDeletion $deletion */
            $deletion = $failure['pod'];
            $this->error(sprintf(
                '  [DELETE_FAIL] sandbox_id=%s, reason=%s, error=%s',
                $deletion->getPod()->getSandboxId(),
                $deletion->getReason(),
                $failure['error']
            ));
        }

        $this->line('');
        $this->info('Sandbox restart summary:');
        $this->line('  restarted: ' . $outcome->getRestartedCount());
        $this->line('  failed: ' . $outcome->getFailedCount());
        $this->line('  deleted_only: ' . count($outcome->getDeletedPods()));
        $this->line('  delete_failures: ' . $outcome->getDeleteFailureCount());
        $this->line('  suspended_tasks: ' . $outcome->getSuspendedTasks());
        $this->line('  elapsed: ' . self::formatDuration(microtime(true) - $startedAt));
    }

    /**
     * 打印一个目标的结果，并顺带打心跳.
     *
     * 序号是"完成序号"而不是计划序号：并发执行时目标完成的先后与计划顺序不同，
     * 用完成序号才能让运维一眼看出还剩几个、已经跑了多久。
     */
    private function printResultLive(int $total, SandboxRestartResult $result, float $startedAt): void
    {
        $this->printedResults[spl_object_id($result)] = true;
        $ordinal = ++$this->completedTargets;

        if ($result->isRestarted()) {
            $this->info(sprintf(
                '[%d/%d] [OK] topic_id=%d, new_sandbox_id=%s, took %s',
                $ordinal,
                $total,
                $result->getTopicId(),
                $result->getNewSandboxId(),
                self::formatDuration($result->getDurationSeconds())
            ));
        } else {
            $this->error(sprintf(
                '[%d/%d] [FAIL] topic_id=%d, sandbox_ids=%s, error=%s',
                $ordinal,
                $total,
                $result->getTopicId(),
                implode(',', $result->getTarget()->getSandboxIds()),
                $result->getError()
            ));
        }

        // 删除失败不阻断重建，但必须单独可见，否则会被"重建成功"掩盖。
        foreach ($result->getFailedSandboxIds() as $sandboxId) {
            $this->error(sprintf(
                '  [DELETE_FAIL] topic_id=%d, sandbox_id=%s',
                $result->getTopicId(),
                $sandboxId
            ));
        }

        $this->printProgress($total, $startedAt);
    }

    /**
     * 长任务心跳：每完成若干个目标，或距上次打印超过阈值就打一行，带已完成数与 ETA.
     *
     * 单个话题重建要等工作区 ready（十几秒到几分钟），没有心跳的话运维无法判断
     * 是卡住了还是正常推进。
     */
    private function printProgress(int $total, float $startedAt): void
    {
        $done = $this->completedTargets;
        if ($done >= $total) {
            return;
        }

        $now = microtime(true);
        $elapsed = $now - $startedAt;
        $sinceLastLine = $now - $this->lastProgressAt;
        if ($done % self::PROGRESS_EVERY !== 0 && $sinceLastLine < self::PROGRESS_INTERVAL_SECONDS) {
            return;
        }
        $this->lastProgressAt = $now;

        $remaining = $total - $done;
        $averageSeconds = $done > 0 ? $elapsed / $done : 0.0;
        $this->line(sprintf(
            '  progress: %d/%d topics done, elapsed %s, eta ~%s',
            $done,
            $total,
            self::formatDuration($elapsed),
            self::formatDuration($averageSeconds * $remaining)
        ));
    }

    private static function formatDuration(float $seconds): string
    {
        if ($seconds < 1) {
            return sprintf('%dms', (int) round($seconds * 1000));
        }
        if ($seconds < 60) {
            return sprintf('%.1fs', $seconds);
        }

        return sprintf('%dm%02ds', (int) floor($seconds / 60), (int) round(fmod($seconds, 60)));
    }
}
