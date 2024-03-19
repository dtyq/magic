<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Hyperf\Database\Migrations\Migration;
use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

class CreateMagicChatDeviceTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('magic_chat_devices')) {
            return;
        }
        Schema::create('magic_chat_devices', static function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id')->default(0)->comment('账户id');
            $table->tinyInteger('type')->comment('设备类型,1:Android；2：IOS；3：Windows; 4：MacOS；5：Web');
            $table->string('brand', 20)->comment('手机服务商');
            $table->string('model', 20)->comment('机型');
            $table->string('system_version', 10)->comment('系统版本');
            $table->string('sdk_version', 10)->comment('app版本');
            $table->tinyInteger('status')->default(0)->comment('在线状态，0：离线；1：在线');
            $table->string('sid', 25)->comment('连接到服务端的sid');
            $table->string('client_addr', 25)->comment('客户端地址');
            $table->index('user_id', 'idx_user_id');
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('magic_chat_devices');
    }
}
