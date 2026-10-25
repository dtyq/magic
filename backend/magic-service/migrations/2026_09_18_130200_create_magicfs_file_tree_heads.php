<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Exception\QueryException;
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * Create the root-file revision heads used by the durable MagicFS feed.
 * The journal schema (including root_file_id/revision) is created in the
 * preceding migration; this table is the serialization point for allocating a
 * strictly monotonic cursor per logical root directory. Existing roots are
 * initialized separately by `magicfs:initialize-file-tree-heads`; this
 * migration is schema-only.
 */
return new class extends Migration {
    public function up(): void
    {
        $tableName = 'magic_fs_file_tree_heads';
        if ($this->tableExists($tableName)) {
            return;
        }

        try {
            Schema::create($tableName, static function (Blueprint $table): void {
                $table->unsignedBigInteger('root_file_id')->primary()->comment('文件树根目录 ID');
                $table->unsignedBigInteger('revision')->default(0)->comment('文件树范围内单调递增 revision');
                $table->unsignedBigInteger('oldest_revision')->default(1)->comment('oldest retained revision');
                $table->dateTime('updated_at');
                $table->comment('MagicFS file-tree heads keyed by root_file_id');
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
        Schema::dropIfExists('magic_fs_file_tree_heads');
    }

    /** @phpstan-impure */
    private function tableExists(string $tableName): bool
    {
        return Schema::hasTable($tableName);
    }
};
