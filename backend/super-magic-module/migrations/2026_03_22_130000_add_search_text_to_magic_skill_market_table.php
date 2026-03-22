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
        if (Schema::hasTable('magic_skill_market')) {
            Schema::table('magic_skill_market', static function (Blueprint $table) {
                if (! Schema::hasColumn('magic_skill_market', 'search_text')) {
                    $table->text('search_text')
                        ->nullable()
                        ->after('description_i18n')
                        ->comment('统一小写搜索字段，聚合版本名称、描述、包名等文本');
                }
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
