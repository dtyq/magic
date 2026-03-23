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
        if (! Schema::hasTable('magic_super_magic_user_agents')) {
            Schema::create('magic_super_magic_user_agents', static function (Blueprint $table) {
                $table->bigIncrements('id')->comment('Primary key ID');
                $table->string('organization_code', 64)->comment('Organization code');
                $table->string('user_id', 64)->comment('Owner user ID');
                $table->string('agent_code', 64)->comment('Agent code');
                $table->bigInteger('agent_version_id')->nullable()->comment('Installed agent version ID');
                $table->string('source_type', 32)->comment('Ownership source type');
                $table->bigInteger('source_id')->nullable()->comment('Source record ID');
                $table->timestamps();
                $table->softDeletes();

                $table->unique(['organization_code', 'user_id', 'agent_code', 'deleted_at'], 'uk_org_user_agent_code');
                $table->index(['organization_code', 'user_id'], 'idx_org_user');
                $table->index(['organization_code', 'agent_code'], 'idx_org_agent_code');
                $table->index(['agent_version_id'], 'idx_agent_version_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
