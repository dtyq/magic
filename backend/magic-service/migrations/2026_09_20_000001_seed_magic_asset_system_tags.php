<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Application\Asset\Initializer\AssetSystemTagInitializer;
use Hyperf\Database\Migrations\Migration;

return new class extends Migration {
    public function up(): void
    {
        $result = AssetSystemTagInitializer::init();
        if (! $result['success']) {
            echo "Warning: {$result['message']}\n";
            return;
        }

        echo "{$result['message']}\n";
    }

    public function down(): void
    {
        // 系统资产标签由初始化器幂等维护，回滚时不自动删除业务数据。
    }
};
