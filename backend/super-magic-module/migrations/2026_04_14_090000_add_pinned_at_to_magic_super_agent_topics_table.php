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
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_agent_topics', 'pinned_at')) {
                $table->dateTime('pinned_at')->nullable()->comment('置顶时间，NULL 表示未置顶')->after('is_pinned');
            }
        });
    }

    public function down(): void
    {
        Schema::table('magic_super_agent_topics', function (Blueprint $table) {
            if (Schema::hasColumn('magic_super_agent_topics', 'pinned_at')) {
                $table->dropColumn('pinned_at');
            }
        });
    }
};
