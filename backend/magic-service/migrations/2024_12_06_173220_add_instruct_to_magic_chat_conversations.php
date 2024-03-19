<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class AddInstructToMagicChatConversations extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('magic_chat_conversations', function (Blueprint $table) {
            $table->json('instructs')->nullable()->comment('交互指令');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('magic_chat_conversations', function (Blueprint $table) {
            $table->dropColumn('instructs');
        });
    }
}
