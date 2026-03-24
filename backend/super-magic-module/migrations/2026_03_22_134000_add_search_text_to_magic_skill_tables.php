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
        if (Schema::hasTable('magic_skill_versions')) {
            Schema::table('magic_skill_versions', static function (Blueprint $table) {
                if (! Schema::hasColumn('magic_skill_versions', 'search_text')) {
                    $table->text('search_text')
                        ->nullable()
                        ->after('description_i18n')
                        ->comment('统一小写搜索字段，聚合版本名称、描述、包名等文本');
                }
            });
        }

        if (Schema::hasTable('magic_skills')) {
            Schema::table('magic_skills', static function (Blueprint $table) {
                if (! Schema::hasColumn('magic_skills', 'search_text')) {
                    $table->text('search_text')
                        ->nullable()
                        ->after('description_i18n')
                        ->comment('统一小写搜索字段，聚合技能名称、描述、包名等文本');
                }
            });
        }
    }

    public function down(): void
    {
    }
};
