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
        if (Schema::hasTable('magic_skill_category_relations')) {
            return;
        }

        Schema::create('magic_skill_category_relations', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 64)->default('')->comment('归属组织编码');
            $table->string('relation_type', 32)->comment('SKILL_VERSION 或 SKILL_MARKET');
            $table->bigInteger('relation_id')->comment('版本或市场记录 ID');
            $table->bigInteger('category_id')->comment('分类 ID');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['relation_type', 'relation_id', 'category_id'], 'uk_skill_category_relation');
            $table->index(['relation_type', 'category_id'], 'idx_skill_category_type');
            $table->index(['relation_type', 'category_id', 'relation_id'], 'idx_skill_category_lookup');
            $table->index(['category_id'], 'idx_skill_category_id');
            $table->index(['organization_code', 'relation_type', 'relation_id'], 'idx_skill_category_org_relation');
        });
    }

    public function down(): void
    {
    }
};
