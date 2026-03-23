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
        Schema::table('magic_skill_versions', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_skill_versions', 'publish_target_type')) {
                $table->string('publish_target_type', 32)->default('MARKET')->comment('发布对象类型：PRIVATE=私有, MARKET=市场')->after('review_status');
            }
            if (! Schema::hasColumn('magic_skill_versions', 'publish_target_value')) {
                $table->json('publish_target_value')->nullable()->comment('发布对象实际值；PRIVATE/MARKET 为空')->after('publish_target_type');
            }
            if (! Schema::hasColumn('magic_skill_versions', 'version_description_i18n')) {
                $table->json('version_description_i18n')->nullable()->comment('版本描述（多语言）')->after('publish_target_value');
            }
            if (! Schema::hasColumn('magic_skill_versions', 'publisher_user_id')) {
                $table->string('publisher_user_id', 64)->nullable()->comment('发布者用户 ID')->after('version_description_i18n');
            }
            if (! Schema::hasColumn('magic_skill_versions', 'published_at')) {
                $table->dateTime('published_at')->nullable()->comment('发布时间')->after('publisher_user_id');
            }
            if (! Schema::hasColumn('magic_skill_versions', 'is_current_version')) {
                $table->tinyInteger('is_current_version')->default(0)->comment('是否当前版本：0=否,1=是')->after('published_at');
            }
        });

        Schema::table('magic_skill_versions', static function (Blueprint $table) {
            $table->index(['organization_code', 'code', 'is_current_version'], 'idx_skill_version_code_current');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
