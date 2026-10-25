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
        if (Schema::hasTable('magic_super_agent_micro_app_visits')) {
            return;
        }

        Schema::create('magic_super_agent_micro_app_visits', static function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('micro_app_id');
            $table->string('user_id', 64);
            $table->string('organization_code', 64);
            $table->dateTime('last_visited_at');
            $table->timestamps();
            $table->unique(['micro_app_id', 'user_id', 'organization_code'], 'uk_micro_app_user_org');
            $table->index(['user_id', 'organization_code', 'last_visited_at'], 'idx_user_org_last_visited');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_super_agent_micro_app_visits');
    }
};
