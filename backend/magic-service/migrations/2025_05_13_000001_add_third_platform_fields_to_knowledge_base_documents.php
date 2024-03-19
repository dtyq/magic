<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddThirdPlatformFieldsToKnowledgeBaseDocuments extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            $table->string('third_platform_type')->nullable()->comment('第三方平台类型');
            $table->string('third_file_id')->nullable()->comment('第三方文件ID');
            $table->index(['third_platform_type', 'third_file_id'], 'index_third_platform_type_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            $table->dropIndex('index_third_platform_type_id');
            $table->dropColumn(['third_platform_type', 'third_file_id']);
        });
    }
}
