<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    /*
     * MagicFS 变更推送（Socket.IO /magicfs）。
     *
     * 拉取（GET /files/{id}/changes 与 POST /changes/batch）永远是正确的来源，
     * 这里调的是推送这个加速器：丢一条推送只会退化成一个轮询周期。
     * 客户端 plugins.magicfs.config.change_feed 里的同名参数是客户端侧策略，
     * 服务端这两个值描述服务端自己的行为，两侧不必相等。
     */
    'change_feed' => [
        // 单次推送内联的变更行上限。超过就只发 {from_revision,to_revision,truncated:true}，
        // 由客户端回拉 journal 补齐：大额批量导入不该把上万行塞进一个 websocket 帧。
        'inline_max_changes' => (int) \Hyperf\Support\env('MAGICFS_CHANGE_FEED_INLINE_MAX_CHANGES', 256),
        // 合并窗口（毫秒）：窗口内同一 root 的多次写入合成一次 emit；0 = 不合并。
        // 这个值也会作为 interval_ms 回给订阅方。
        'coalesce_window_ms' => (int) \Hyperf\Support\env('MAGICFS_CHANGE_FEED_COALESCE_WINDOW_MS', 25),
    ],
];
