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
        if (! Schema::hasTable('magic_super_magic_agent_versions')) {
            return;
        }

        Schema::table('magic_super_magic_agent_versions', function (Blueprint $table) {
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'publish_target_type')) {
                $table->string('publish_target_type', 32)->nullable()->after('review_status')->comment('发布对象类型：PRIVATE=私有, USER=指定用户, DEPARTMENT=指定部门, ORGANIZATION=指定组织, MARKET=市场');
            }
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'publish_target_value')) {
                $table->json('publish_target_value')->nullable()->after('publish_target_type')->comment('发布对象实际值，JSON存储');
            }
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'version_description_i18n')) {
                $table->json('version_description_i18n')->nullable()->after('publish_target_value')->comment('版本描述（多语言）');
            }
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'publisher_user_id')) {
                $table->string('publisher_user_id', 40)->nullable()->after('version_description_i18n')->comment('发布者用户ID');
            }
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'published_at')) {
                $table->dateTime('published_at')->nullable()->after('publisher_user_id')->comment('发布时间');
            }
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'is_current_version')) {
                $table->boolean('is_current_version')->default(false)->after('published_at')->comment('是否当前版本');
            }
            if (! Schema::hasColumn('magic_super_magic_agent_versions', 'file_key')) {
                $table->string('file_key', 500)->nullable()->comment('Agent package file key snapshot');
            }
        });

        Schema::table('magic_super_magic_agent_versions', function (Blueprint $table) {
            if (! Schema::hasIndex('magic_super_magic_agent_versions', 'uk_org_code_version')) {
                $table->unique(['organization_code', 'code', 'version'], 'uk_org_code_version');
            }
        });
    }

    public function down(): void
    {
    }
};
