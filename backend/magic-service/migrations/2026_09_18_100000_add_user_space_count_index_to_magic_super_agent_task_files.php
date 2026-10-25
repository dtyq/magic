<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    private string $indexName = 'idx_user_org_space_deleted';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $tableName = 'magic_super_agent_task_files';
        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            // 发起沙箱前的用户空间文件数校验：
            // WHERE user_id = ? AND organization_code = ? AND space_type = 'user' AND deleted_at IS NULL LIMIT N。
            // 仅有 idx_user_id 时，剩余条件需逐行回表过滤；当用户行数多且匹配行少时
            // （如大量已删除或非 user 空间文件），每条消息都要扫完该用户全部行。
            // 此索引覆盖全部过滤条件（file_id 为主键由二级索引隐含携带），查询为纯索引扫描。
            if (! Schema::hasIndex($tableName, $this->indexName)) {
                $table->index(
                    ['user_id', 'organization_code', 'space_type', 'deleted_at'],
                    $this->indexName
                );
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
