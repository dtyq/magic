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
        if (Schema::hasTable('knowledge_base_bindings') && ! Schema::hasColumn('knowledge_base_bindings', 'metadata')) {
            Schema::table('knowledge_base_bindings', static function (Blueprint $table) {
                $table->json('metadata')->nullable()->after('updated_uid')->comment('绑定关系扩展配置');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('knowledge_base_bindings') && Schema::hasColumn('knowledge_base_bindings', 'metadata')) {
            Schema::table('knowledge_base_bindings', static function (Blueprint $table) {
                $table->dropColumn('metadata');
            });
        }
    }
};
