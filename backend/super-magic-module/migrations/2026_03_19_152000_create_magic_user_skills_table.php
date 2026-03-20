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
        if (! Schema::hasTable('magic_user_skills')) {
            Schema::create('magic_user_skills', static function (Blueprint $table) {
                $table->bigIncrements('id')->comment('Primary key ID');
                $table->string('organization_code', 64)->comment('Organization code');
                $table->string('user_id', 64)->comment('Owner user ID');
                $table->string('skill_code', 64)->comment('Skill code');
                $table->bigInteger('skill_version_id')->nullable()->comment('Installed skill version ID');
                $table->string('source_type', 32)->comment('Ownership source type');
                $table->bigInteger('source_id')->nullable()->comment('Source record ID');
                $table->timestamps();
                $table->softDeletes();

                $table->unique(['organization_code', 'user_id', 'skill_code'], 'uk_org_user_skill_code');
                $table->index(['organization_code', 'user_id'], 'idx_org_user');
                $table->index(['organization_code', 'skill_code'], 'idx_org_skill_code');
                $table->index(['skill_version_id'], 'idx_skill_version_id');
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
