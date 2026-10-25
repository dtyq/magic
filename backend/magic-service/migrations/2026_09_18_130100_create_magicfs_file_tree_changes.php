<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Exception\QueryException;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

return new class extends Migration {
    public function up(): void
    {
        $tableName = 'magic_super_agent_task_file_tree_changes';
        if ($this->tableExists($tableName)) {
            return;
        }

        try {
            Schema::create($tableName, static function (Blueprint $table): void {
                $table->bigIncrements('change_id')->comment('全局单调递增变更游标');
                $table->unsignedBigInteger('root_file_id')->comment('文件树根目录 ID');
                $table->unsignedBigInteger('revision')->comment('文件树范围内单调递增游标');
                $table->unsignedBigInteger('file_id');
                $table->unsignedBigInteger('parent_id')->nullable();
                $table->unsignedBigInteger('old_parent_id')->nullable();
                $table->string('name', 512)->default('');
                $table->string('old_name', 512)->nullable();
                $table->string('operation', 32)->comment('create/update/move/delete/restore');
                $table->unsignedBigInteger('file_version')->default(0);
                $table->json('file_snapshot')->nullable()->comment('变更时的轻量文件元数据快照');
                $table->dateTime('created_at');

                $table->unique(
                    ['root_file_id', 'revision'],
                    'uniq_magicfs_file_tree_change_root_revision'
                );
                $table->index(['file_id', 'change_id'], 'idx_magicfs_file_tree_change_file_cursor');
                $table->index(['root_file_id', 'revision'], 'idx_magicfs_file_tree_change_root_cursor');
                $table->comment('MagicFS durable file-tree change journal keyed by root_file_id');
            });
        } catch (QueryException $exception) {
            // Another pod may have created the table after the existence check.
            if (! $this->tableExists($tableName)) {
                throw $exception;
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_task_file_tree_changes');
    }

    /** @phpstan-impure */
    private function tableExists(string $tableName): bool
    {
        return Schema::hasTable($tableName);
    }
};
