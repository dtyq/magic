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
        if (Schema::hasTable('magic_contact_id_mapping')) {
            return;
        }
        Schema::create('magic_contact_id_mapping', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('origin_id', 255)->comment('源id');
            $table->string('new_id', 255)->comment('新id');
            // 映射类型：用户 id、部门 id、空间 id，组织 id
            $table->string('mapping_type', 32)->comment('映射类型（user、department、space、organization）');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['new_id', 'mapping_type'], 'new_id_mapping_type');
            $table->unique(['origin_id', 'mapping_type'], 'unique_origin_id_mapping_type');
            $table->comment('部门、用户、组织编码、空间编码等的映射关系记录');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_contact_id_mapping');
    }
};
