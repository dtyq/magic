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
        if (Schema::hasTable('magic_model_access_roles')) {
            return;
        }

        Schema::create('magic_model_access_roles', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 64)->comment('组织编码');
            $table->string('name', 255)->comment('角色名称');
            $table->string('description', 1000)->nullable()->comment('角色描述');
            $table->tinyInteger('is_default')->default(0)->comment('是否默认角色: 0=否,1=是');
            $table->unsignedBigInteger('parent_role_id')->nullable()->comment('父角色ID');
            $table->string('created_uid', 64)->nullable()->comment('创建人用户ID');
            $table->string('updated_uid', 64)->nullable()->comment('更新人用户ID');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['organization_code', 'is_default'], 'idx_org_default');
            $table->index(['organization_code', 'parent_role_id'], 'idx_org_parent_role_id');
            $table->index(['organization_code', 'name'], 'idx_org_name');
            $table->comment('模型访问角色表');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('magic_model_access_roles');
    }
};
