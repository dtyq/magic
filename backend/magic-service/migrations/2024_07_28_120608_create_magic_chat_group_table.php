<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicChatGroupTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 判断表是否存在
        if (Schema::hasTable('magic_chat_groups')) {
            return;
        }
        Schema::create('magic_chat_groups', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('group_name', 64)->comment('群名称')->default('');
            $table->string('group_avatar', 255)->comment('群头像')->default('');
            $table->string('group_notice', 255)->comment('群公告')->default('');
            $table->string('group_owner', 64)->comment('群主');
            // 群所属组织
            $table->string('organization_code', 64)->comment('群组织编码')->default('');
            $table->string('group_tag', 64)->comment('群标签:0:无标签,1:外部群；2：内部群;3:全员群')->default('0');
            $table->tinyInteger('group_type')->default(1)->comment('群类型,1:对话；2：话题');
            $table->tinyInteger('group_status')->default(1)->comment('群状态,1:正常；2：解散');
            // 成员上限
            $table->integer('member_limit')->default(1000)->comment('群成员上限');
            $table->softDeletes();
            $table->timestamps();
            $table->comment('群组表');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_groups');
    }
}
