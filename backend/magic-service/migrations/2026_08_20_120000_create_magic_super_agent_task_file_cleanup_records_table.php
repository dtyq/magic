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
        if (Schema::hasTable('magic_super_agent_task_file_cleanup_records')) {
            return;
        }

        Schema::create('magic_super_agent_task_file_cleanup_records', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('deletion_operation_id', 64);
            $table->unsignedBigInteger('original_file_id');
            $table->unsignedBigInteger('project_id')->default(0);
            $table->unsignedBigInteger('topic_id')->default(0);
            $table->unsignedBigInteger('task_id')->default(0);
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('user_id', 128)->default('');
            $table->string('organization_code', 64)->default('');
            $table->string('file_name', 256)->default('');
            $table->string('file_key', 500)->default('');
            $table->string('space_type', 32)->default('project');
            $table->boolean('is_directory')->default(false);
            $table->string('deletion_policy', 32);
            $table->string('delete_source', 32);
            $table->string('delete_reason', 64)->default('');
            $table->string('deleted_by', 128)->default('');
            $table->json('snapshot');
            $table->string('record_type', 16)->default('root');
            $table->unsignedBigInteger('root_file_id')->default(0);
            $table->string('status', 16)->default('pending');
            $table->text('error_message')->nullable();
            $table->unsignedInteger('attempt_count')->default(0);
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('archived_at')->useCurrent();
            $table->unique(['deletion_operation_id', 'original_file_id'], 'uk_delete_operation_file');
            $table->index(['status', 'claimed_at'], 'idx_cleanup_status_claimed');
            $table->index(['root_file_id', 'status'], 'idx_cleanup_root_status');
        });
    }

    public function down(): void
    {
    }
};
