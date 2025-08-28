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
        if (Schema::hasTable('magic_mode_group_relations')) {
            return;
        }

        Schema::create('magic_mode_group_relations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->bigInteger('mode_id')->unsigned()->default(0)->comment('模式ID');
            $table->bigInteger('group_id')->unsigned()->default(0)->comment('分组ID');
            $table->string('model_id')->default('')->comment('模型ID');
            $table->bigInteger('provider_model_id')->unsigned()->default(0)->comment('模型表主键 id');
            $table->integer('sort')->default(0)->comment('排序权重');
            $table->string('organization_code', 32)->default('')->comment('组织代码');
            $table->timestamps();
            $table->softDeletes();
        });
    }
};
