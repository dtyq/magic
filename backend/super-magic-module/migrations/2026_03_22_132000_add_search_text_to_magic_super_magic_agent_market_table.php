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
        if (Schema::hasTable('magic_super_magic_agent_market')) {
            Schema::table('magic_super_magic_agent_market', static function (Blueprint $table) {
                if (! Schema::hasColumn('magic_super_magic_agent_market', 'search_text')) {
                    $table->text('search_text')
                        ->nullable()
                        ->after('role_i18n')
                        ->comment('统一小写搜索字段，聚合版本名称、描述、角色等文本');
                }
            });
        }
    }

    public function down(): void
    {
    }
};
