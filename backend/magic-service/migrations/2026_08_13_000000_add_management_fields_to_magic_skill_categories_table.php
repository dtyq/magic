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
        if (! Schema::hasTable('magic_skill_categories')) {
            return;
        }

        Schema::table('magic_skill_categories', static function (Blueprint $table) {
            if (! Schema::hasColumn('magic_skill_categories', 'parent_id')) {
                $table->bigInteger('parent_id')->default(0)->after('id')->comment('父分类 ID，0 表示一级分类');
            }
            if (! Schema::hasColumn('magic_skill_categories', 'organization_code')) {
                $table->string('organization_code', 64)->default('')->after('parent_id')->comment('归属组织编码');
            }
            if (! Schema::hasColumn('magic_skill_categories', 'logo')) {
                $table->string('logo', 512)->nullable()->after('name_i18n')->comment('Logo 图片 URL');
            }
            if (! Schema::hasColumn('magic_skill_categories', 'status')) {
                $table->tinyInteger('status')->default(1)->after('sort_order')->comment('状态：1 显示，0 隐藏');
            }
            if (! Schema::hasColumn('magic_skill_categories', 'creator_id')) {
                $table->string('creator_id', 64)->default('')->after('status')->comment('创建者用户 ID');
            }
            if (! Schema::hasColumn('magic_skill_categories', 'modifier_id')) {
                $table->string('modifier_id', 64)->nullable()->after('creator_id')->comment('最后更新者用户 ID');
            }
            if (! Schema::hasColumn('magic_skill_categories', 'deleted_at')) {
                $table->softDeletes();
            }
            $table->index(['parent_id', 'status', 'sort_order', 'created_at'], 'idx_skill_category_parent');
        });
    }

    public function down(): void
    {
    }
};
