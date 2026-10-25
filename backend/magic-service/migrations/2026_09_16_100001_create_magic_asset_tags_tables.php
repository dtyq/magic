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
        if (! Schema::hasTable('magic_asset_tags')) {
            Schema::create('magic_asset_tags', static function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('organization_code', 64);
                $table->unsignedBigInteger('parent_id')->default(0);
                $table->string('node_type', 16)->default('tag')->comment('group 或 tag');
                $table->json('name_i18n');
                $table->tinyInteger('status')->default(1);
                $table->integer('sort')->default(0);
                $table->string('owner_uid', 64)->nullable()->comment('自定义标签归属人；官方标签为空');
                $table->string('created_uid', 64)->nullable();
                $table->string('updated_uid', 64)->nullable();
                $table->timestamps();
                $table->softDeletes();
                $table->index(['organization_code', 'owner_uid', 'status'], 'idx_asset_tag_visibility');
                $table->index(['organization_code', 'parent_id', 'sort'], 'idx_asset_tag_tree');
            });
        }

        if (! Schema::hasTable('magic_asset_tag_relations')) {
            Schema::create('magic_asset_tag_relations', static function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('organization_code', 64);
                $table->unsignedBigInteger('asset_id');
                $table->unsignedBigInteger('tag_id');
                $table->string('created_uid', 64)->nullable();
                $table->timestamps();
                $table->unique(['asset_id', 'tag_id'], 'uk_asset_tag');
                $table->index(['organization_code', 'tag_id', 'asset_id'], 'idx_asset_tag_lookup');
            });
        }
    }

    public function down(): void
    {
    }
};
