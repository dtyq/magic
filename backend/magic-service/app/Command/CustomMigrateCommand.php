<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Infrastructure\Database\CustomMigrator;
use Hyperf\Command\Annotation\Command;
use Hyperf\Database\Commands\Migrations\MigrateCommand;

/**
 * 自定义迁移命令
 * 使用 CustomMigrator 来支持环境变量控制迁移执行。
 *
 * 用法:
 * php bin/hyperf.php migrate
 *
 * 环境变量说明:
 * - AUTO_MIGRATION=true: 执行实际的迁移操作
 * - AUTO_MIGRATION=false: 只记录迁移，不执行实际操作
 */
#[Command]
class CustomMigrateCommand extends MigrateCommand
{
    /**
     * 构造函数
     * 注入自定义的 CustomMigrator.
     *
     * @param CustomMigrator $migrator 自定义迁移执行器
     */
    public function __construct(CustomMigrator $migrator)
    {
        // 调用父类构造函数，传入自定义的 Migrator
        parent::__construct($migrator);
    }
}
