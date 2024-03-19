<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Command;

use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\SuperMagic\Application\SuperAgent\Service\MessageQueueCompensationAppService;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Helper\Table;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

/**
 * Message Queue Compensation Command.
 * 消息队列补偿验证命令 - 手动执行补偿任务验证功能.
 */
#[Command]
class MessageQueueCompensationCommand extends HyperfCommand
{
    use HasLogger;

    public function __construct(
        protected ContainerInterface $container,
        protected MessageQueueCompensationAppService $compensationAppService,
    ) {
        parent::__construct('superagent:queue-compensation');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('Manual message queue compensation task for testing and verification');
        $this->addOption('loop', 'l', InputOption::VALUE_NONE, 'Run in loop mode');
        $this->addOption('times', 't', InputOption::VALUE_OPTIONAL, 'Number of times to run (only in loop mode)', 5);
        $this->addOption('interval', 'i', InputOption::VALUE_OPTIONAL, 'Interval between runs in seconds', 10);
        $this->addOption('debug', 'd', InputOption::VALUE_NONE, 'Enable debug mode with detailed output');
        $this->addOption('stats-only', 's', InputOption::VALUE_NONE, 'Show only statistics without detailed logs');
    }

    public function handle(): void
    {
        $this->showHeader();

        $isLoop = $this->input->getOption('loop');
        $times = (int) $this->input->getOption('times');
        $interval = (int) $this->input->getOption('interval');
        $debug = $this->input->getOption('debug');
        $statsOnly = $this->input->getOption('stats-only');

        $this->showConfiguration($isLoop, $times, $interval, $debug, $statsOnly);

        if ($isLoop) {
            $this->runLoopMode($times, $interval, $debug, $statsOnly);
        } else {
            $this->runSingleMode($debug, $statsOnly);
        }
    }

    /**
     * Show command header.
     * 显示命令头部信息.
     */
    private function showHeader(): void
    {
        $this->info('');
        $this->info('🔄 Message Queue Compensation Verification');
        $this->info('==========================================');
        $this->info('');
    }

    /**
     * Show current configuration.
     * 显示当前配置信息.
     */
    private function showConfiguration(bool $isLoop, int $times, int $interval, bool $debug, bool $statsOnly): void
    {
        $enabled = config('super-magic.user_message_queue.enabled', true);
        $whitelist = config('super-magic.user_message_queue.whitelist', []);

        $this->info('📋 Current Configuration:');
        $this->info('   • Enabled: ' . ($enabled ? '✅ YES' : '❌ NO'));
        $this->info('   • Organization Filter: ' . (empty($whitelist) ? 'All organizations' : 'Whitelist (' . count($whitelist) . ' orgs)'));

        if (! empty($whitelist)) {
            $this->info('   • Whitelisted Orgs: ' . implode(', ', $whitelist));
        }

        $this->info('   • Execution Mode: ' . ($isLoop ? "Loop ({$times} times, {$interval}s interval)" : 'Single'));
        $this->info('   • Debug Mode: ' . ($debug ? '✅ ON' : '❌ OFF'));
        $this->info('   • Stats Only: ' . ($statsOnly ? '✅ ON' : '❌ OFF'));
        $this->info('');

        if (! $enabled) {
            $this->warn('⚠️  WARNING: Message queue compensation is DISABLED in configuration!');
            $this->info('   Set USER_MESSAGE_QUEUE_ENABLED=true to enable compensation.');
            $this->info('');
        }
    }

    /**
     * Run single compensation execution.
     * 运行单次补偿执行.
     */
    private function runSingleMode(bool $debug, bool $statsOnly): void
    {
        $this->info('🚀 Starting single compensation execution...');
        $this->info('');

        $result = $this->executeCompensationWithTiming($debug, $statsOnly);

        $this->showExecutionResult($result, 1);
        $this->info('✅ Single execution completed!');
    }

    /**
     * Run loop mode compensation execution.
     * 运行循环模式补偿执行.
     */
    private function runLoopMode(int $times, int $interval, bool $debug, bool $statsOnly): void
    {
        $this->info("🔄 Starting loop mode execution ({$times} times, {$interval}s interval)...");
        $this->info('');

        $totalStats = ['processed' => 0, 'success' => 0, 'failed' => 0, 'skipped' => 0];
        $executionTimes = [];

        for ($i = 1; $i <= $times; ++$i) {
            $this->info("📍 Execution #{$i}/{$times}");
            $this->info(str_repeat('-', 50));

            $result = $this->executeCompensationWithTiming($debug, $statsOnly);

            // Accumulate stats
            foreach ($result['stats'] as $key => $value) {
                $totalStats[$key] += $value;
            }
            $executionTimes[] = $result['execution_time'];

            if (! $statsOnly) {
                $this->showCompactResult($result, $i);
            }

            if ($i < $times) {
                $this->info("⏳ Waiting {$interval} seconds before next execution...");
                $this->info('');
                sleep($interval);
            }
        }

        $this->showLoopSummary($totalStats, $executionTimes, $times);
    }

    /**
     * Execute compensation with timing.
     * 执行补偿并计时.
     */
    private function executeCompensationWithTiming(bool $debug, bool $statsOnly): array
    {
        $startTime = microtime(true);

        try {
            if ($debug && ! $statsOnly) {
                $this->info('🔍 Debug: Calling compensation service...');
            }

            $stats = $this->compensationAppService->executeCompensation();
            $executionTime = round((microtime(true) - $startTime) * 1000, 2);

            if ($debug && ! $statsOnly) {
                $this->info("🔍 Debug: Compensation completed in {$executionTime}ms");
            }

            return [
                'success' => true,
                'stats' => $stats,
                'execution_time' => $executionTime,
                'error' => null,
            ];
        } catch (Throwable $e) {
            $executionTime = round((microtime(true) - $startTime) * 1000, 2);

            return [
                'success' => false,
                'stats' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'skipped' => 0],
                'execution_time' => $executionTime,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Show detailed execution result.
     * 显示详细执行结果.
     */
    private function showExecutionResult(array $result, int $executionNumber): void
    {
        if ($result['success']) {
            $this->info("✅ Execution #{$executionNumber} completed successfully!");
        } else {
            $this->error("❌ Execution #{$executionNumber} failed!");
            $this->error('   Error: ' . $result['error']);
        }

        $this->info("   ⏱️  Execution Time: {$result['execution_time']}ms");
        $this->info('');

        // Show statistics table
        $this->showStatsTable($result['stats']);
    }

    /**
     * Show compact result for loop mode.
     * 显示循环模式的紧凑结果.
     */
    private function showCompactResult(array $result, int $executionNumber): void
    {
        $stats = $result['stats'];
        $status = $result['success'] ? '✅' : '❌';

        $this->info("{$status} #{$executionNumber}: {$result['execution_time']}ms | "
                   . "Processed: {$stats['processed']}, Success: {$stats['success']}, "
                   . "Failed: {$stats['failed']}, Skipped: {$stats['skipped']}");

        if (! $result['success']) {
            $this->error('   Error: ' . $result['error']);
        }
        $this->info('');
    }

    /**
     * Show statistics table.
     * 显示统计表格.
     */
    private function showStatsTable(array $stats): void
    {
        $table = new Table($this->output);
        $table->setHeaders(['Metric', 'Count', 'Percentage']);

        $total = max($stats['processed'], 1); // Avoid division by zero

        $rows = [
            ['Processed', $stats['processed'], $stats['processed'] > 0 ? '100%' : '0%'],
            ['Success', $stats['success'], $stats['processed'] > 0 ? round(($stats['success'] / $stats['processed']) * 100, 1) . '%' : '0%'],
            ['Failed', $stats['failed'], $stats['processed'] > 0 ? round(($stats['failed'] / $stats['processed']) * 100, 1) . '%' : '0%'],
            ['Skipped', $stats['skipped'], $stats['processed'] > 0 ? round(($stats['skipped'] / $stats['processed']) * 100, 1) . '%' : '0%'],
        ];

        $table->setRows($rows);
        $table->render();
        $this->info('');
    }

    /**
     * Show loop execution summary.
     * 显示循环执行总结.
     */
    private function showLoopSummary(array $totalStats, array $executionTimes, int $totalExecutions): void
    {
        $this->info('📊 Loop Execution Summary');
        $this->info('=========================');
        $this->info('');

        // Overall statistics
        $this->info('🎯 Overall Statistics:');
        $this->showStatsTable($totalStats);

        // Performance metrics
        $avgTime = round(array_sum($executionTimes) / count($executionTimes), 2);
        $minTime = min($executionTimes);
        $maxTime = max($executionTimes);
        $totalTime = round(array_sum($executionTimes), 2);

        $this->info('⚡ Performance Metrics:');
        $this->info("   • Total Executions: {$totalExecutions}");
        $this->info("   • Average Time: {$avgTime}ms");
        $this->info("   • Min Time: {$minTime}ms");
        $this->info("   • Max Time: {$maxTime}ms");
        $this->info("   • Total Time: {$totalTime}ms");
        $this->info('');

        // Success rate
        if ($totalStats['processed'] > 0) {
            $successRate = round(($totalStats['success'] / $totalStats['processed']) * 100, 1);
            $this->info("📈 Success Rate: {$successRate}%");
        } else {
            $this->info('📈 Success Rate: No messages processed');
        }

        $this->info('');
        $this->info('🎊 Loop execution completed successfully!');
    }
}
