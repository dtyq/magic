<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicFlowMemoryHistories extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('magic_flow_memory_histories', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('conversation_id')->default('')->comment('对话ID');
            $table->string('request_id')->default('')->comment('request_id');
            $table->tinyInteger('type')->default(0)->comment('类型 1 LLM');
            $table->string('role', 80)->default('')->comment('角色');
            $table->json('content')->nullable()->comment('内容');
            $table->string('created_uid')->default('')->comment('创建者用户ID');
            $table->timestamp('created_at')->nullable()->comment('创建时间');

            $table->index('conversation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_flow_memory_histories');
    }
}
