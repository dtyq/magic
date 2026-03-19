<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\Command;

use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\SuperMagic\Application\RecycleBin\Crontab\RecycleBinCleanupCrontab;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Throwable;

/**
 * 回收站清理命令（手动触发定时任务）.
 */
#[Command]
class RecycleBinCleanupCommand extends HyperfCommand
{
    use HasLogger;

    public function __construct(
        protected RecycleBinCleanupCrontab $recycleBinCleanupCrontab,
    ) {
        parent::__construct('recycle-bin:cleanup');
    }

    public function configure(): void
    {
        parent::configure();
        $this->setDescription('手动执行回收站过期记录清理任务（测试用）');
    }

    public function handle(): void
    {
        $this->info('');
        $this->info('🗑️  回收站过期记录清理任务');
        $this->info('==========================================');
        $this->info('');

        $this->info('🚀 开始执行清理任务...');
        $this->info('');

        $startTime = microtime(true);

        try {
            $this->recycleBinCleanupCrontab->execute();

            $elapsedTime = round((microtime(true) - $startTime) * 1000, 2);

            $this->info('');
            $this->info("✅ 清理任务执行完成！耗时：{$elapsedTime}ms");
            $this->info('');
            $this->info('💡 提示：请查看日志文件获取详细执行结果');
        } catch (Throwable $e) {
            $this->error('');
            $this->error('❌ 清理任务执行失败！');
            $this->error('错误信息：' . $e->getMessage());
            $this->error('文件：' . $e->getFile() . ':' . $e->getLine());
            $this->error('');
        }
    }
}
