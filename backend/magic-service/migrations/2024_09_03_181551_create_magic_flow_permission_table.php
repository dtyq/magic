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
        Schema::create('magic_flow_permissions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('organization_code', 20)->comment('组织编码');
            $table->unsignedTinyInteger('resource_type')->comment('资源类型');
            $table->string('resource_id', 50)->comment('资源id');
            $table->unsignedTinyInteger('target_type')->comment('目标类型');
            $table->string('target_id', 50)->comment('目标id');
            $table->unsignedTinyInteger('operation')->comment('操作');
            $table->string('created_uid', 50)->comment('创建人');
            $table->string('updated_uid', 50)->comment('修改人');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['organization_code', 'resource_type', 'resource_id', 'target_type', 'target_id'], 'idx_organization_resource_target');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_permissions');
    }
};
