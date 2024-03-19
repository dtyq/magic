<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

/*
 * Create transfer audit logs table.
 *
 * This table stores audit logs for workspace and project transfer operations.
 */
return new class extends Migration {
    private const TABLE_NAME = 'magic_super_agent_transfer_logs';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable(self::TABLE_NAME)) {
            return;
        }

        Schema::create(self::TABLE_NAME, function (Blueprint $table) {
            $table->bigIncrements('id')->comment('Primary key');
            $table->string('batch_id', 64)->comment('Batch ID for grouping multiple transfers');
            $table->string('organization_code', 64)->default('')->comment('Organization code');
            $table->tinyInteger('transfer_type')->comment('Transfer type: 1=workspace, 2=project');
            $table->unsignedBigInteger('resource_id')->comment('Resource ID (workspace_id or project_id)');
            $table->string('resource_name', 255)->default('')->comment('Resource name');
            $table->string('from_user_id', 64)->comment('Original owner user ID');
            $table->string('to_user_id', 64)->comment('New owner user ID');
            $table->tinyInteger('share_to_original')->default(0)->comment('Share to original owner: 0=no, 1=yes');
            $table->string('share_role', 20)->default('')->comment('Share role: manage/editor/viewer');
            $table->integer('projects_count')->default(0)->comment('Number of projects transferred (for workspace transfer)');
            $table->integer('files_count')->default(0)->comment('Number of files transferred');
            $table->tinyInteger('status')->default(0)->comment('Status: 0=pending, 1=success, 2=failed');
            $table->string('error_message', 500)->nullable()->comment('Error message if failed');
            $table->json('extra')->nullable()->comment('Extra information (JSON)');
            $table->timestamp('created_at')->useCurrent()->comment('Created time');
            /* @phpstan-ignore-next-line - Hyperf Schema Builder may have useCurrentOnUpdate method */
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate()->comment('Updated time');

            // Indexes for common queries
            $table->index(['batch_id'], 'idx_batch_id');
            $table->index(['from_user_id'], 'idx_from_user');
            $table->index(['to_user_id'], 'idx_to_user');
            $table->index(['transfer_type', 'resource_id'], 'idx_resource');
            $table->index(['organization_code', 'created_at'], 'idx_org_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists(self::TABLE_NAME);
    }
};
