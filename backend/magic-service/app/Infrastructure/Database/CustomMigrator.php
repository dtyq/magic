<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Database;

use Hyperf\Database\Migrations\Migrator;
use Throwable;

/**
 * 自定义迁移执行器
 * 支持通过环境变量 AUTO_MIGRATION 控制是否真正执行实际的数据库迁移
 * - AUTO_MIGRATION=true: 执行完整的迁移流程（执行 up() 方法并记录）
 * - AUTO_MIGRATION=false: 只记录迁移，不执行 up() 方法。
 */
class CustomMigrator extends Migrator
{
    /**
     * 重写 runUp 方法，根据环境变量决定是否真正执行迁移。
     *
     * @param string $file 迁移文件路径
     * @param int $batch 批次号
     * @param bool $pretend 是否为预览模式
     * @throws Throwable
     */
    protected function runUp(string $file, int $batch, bool $pretend): void
    {
        // 1. 解析迁移类别
        // 重要：使用 resolvePath，兼容具名迁移类 & `return new class extends Migration {}` 匿名迁移
        $migration = $this->resolvePath($file);
        $name = $this->getMigrationName($file);

        // 2. 如果是预览模式，直接调用父类方法
        if ($pretend) {
            $this->pretendToRun($migration, 'up');
            return;
        }

        // 3. 检查是否允许自动迁移
        $autoMigration = env('AUTO_MIGRATION', true);

        // 4. 根据环境变量决定是否真正执行迁移
        if ($autoMigration) {
            // 允许自动迁移，执行完整迁移
            $this->note("<comment>Migrating:</comment> {$name}");
            $this->runMigration($migration, 'up');
            $this->note("<info>Migrated:</info>  {$name}");
        } else {
            // 不允许自动迁移，只做迁移记录信息
            $this->note("<comment>Skipping (AUTO_MIGRATION=false):</comment> {$name}");
            $this->note("<info>Migration record saved (without execution):</info> {$name}");
        }

        // 5. 无论是否执行迁移，都记录到 migrations 表
        $this->repository->log($name, $batch);
    }
}
