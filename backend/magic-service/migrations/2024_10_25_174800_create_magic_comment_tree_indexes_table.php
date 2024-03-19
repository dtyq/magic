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
        if (Schema::hasTable('magic_comment_tree_indexes')) {
            return;
        }
        Schema::create('magic_comment_tree_indexes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('ancestor_id')->index()->comment('祖先节点id, comments表的主键id');
            $table->unsignedBigInteger('descendant_id')->index()->comment('后代节点id, comments表的主键id');
            $table->unsignedInteger('distance')->comment('祖先节点到后代节点的距离');
            $table->string('organization_code')->index()->comment('组织code');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comment_tree_indexes');
    }
};
