<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('magic_super_agent_task_files')
            || Schema::hasColumn('magic_super_agent_task_files', 'source_file_id')) {
            return;
        }

        Schema::table('magic_super_agent_task_files', static function (Blueprint $table): void {
            $table->unsignedBigInteger('source_file_id')
                ->nullable()
                ->after('file_id')
                ->comment('直接复制来源文件ID');
            $table->index('source_file_id', 'idx_task_files_source_file_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('magic_super_agent_task_files')
            || ! Schema::hasColumn('magic_super_agent_task_files', 'source_file_id')) {
            return;
        }

        Schema::table('magic_super_agent_task_files', static function (Blueprint $table): void {
            $table->dropIndex('idx_task_files_source_file_id');
            $table->dropColumn('source_file_id');
        });
    }
};
