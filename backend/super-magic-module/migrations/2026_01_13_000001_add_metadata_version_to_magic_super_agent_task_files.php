<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_super_agent_task_files', function (Blueprint $table) {
            $table->integer('latest_version')
                ->default(0)
                ->after('latest_modified_task_id')
                ->comment('Latest version number of the file');

            $table->unsignedInteger('metadata_version')
                ->default(1)
                ->after('latest_version')
                ->comment('元数据版本号，用于 MagicFS 缓存失效检测（包含重命名、移动等元数据操作）');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
