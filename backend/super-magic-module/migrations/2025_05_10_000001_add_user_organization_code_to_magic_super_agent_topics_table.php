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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_topics', 'user_organization_code')) {
                $table->string('user_organization_code', 64)->default('')->comment('用户组织编码')->after('user_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_topics', 'user_organization_code')) {
                $table->dropColumn('user_organization_code');
            }
        });
    }
};
