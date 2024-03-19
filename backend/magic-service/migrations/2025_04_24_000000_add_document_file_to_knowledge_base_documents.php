<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddDocumentFileToKnowledgeBaseDocuments extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            $table->json('document_file')->nullable()->comment('文档文件信息');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('knowledge_base_documents', function (Blueprint $table) {
            $table->dropColumn('document_file');
        });
    }
}
