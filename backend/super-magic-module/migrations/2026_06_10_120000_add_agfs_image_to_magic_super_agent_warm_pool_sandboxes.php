<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    private string $table = 'magic_super_agent_warm_pool_sandboxes';

    public function up(): void
    {
        if (! Schema::hasTable($this->table)) {
            return;
        }

        if (! Schema::hasColumn($this->table, 'agfs_image')) {
            Schema::table($this->table, function (Blueprint $table) {
                // 该 sandbox 跑的 agfs 镜像。warm-pool 的“镜像代际”由
                // (agent_image, agfs_image) 共同决定，任一切版本时整池失效。
                $table->string('agfs_image', 256)
                    ->default('')
                    ->after('agent_image')
                    ->comment('该 sandbox 跑的 agfs 镜像，image 切版本时整池失效');
            });
        }

        // 复合索引覆盖 (agent_image, agfs_image) 上的 claim / count 查询。
        if (! $this->hasIndex('idx_status_agent_agfs_image')) {
            Schema::table($this->table, function (Blueprint $table) {
                $table->index(['status', 'agent_image', 'agfs_image'], 'idx_status_agent_agfs_image');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable($this->table)) {
            return;
        }

        if ($this->hasIndex('idx_status_agent_agfs_image')) {
            Schema::table($this->table, function (Blueprint $table) {
                $table->dropIndex('idx_status_agent_agfs_image');
            });
        }

        if (Schema::hasColumn($this->table, 'agfs_image')) {
            Schema::table($this->table, function (Blueprint $table) {
                $table->dropColumn('agfs_image');
            });
        }
    }

    private function hasIndex(string $indexName): bool
    {
        $rows = Schema::getConnection()
            ->select(sprintf('SHOW INDEX FROM `%s` WHERE Key_name = ?', $this->table), [$indexName]);
        return ! empty($rows);
    }
};
