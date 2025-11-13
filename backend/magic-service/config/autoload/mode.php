<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
/*
 * Mode 配置文件
 */
return [
    /*
     * 隐藏的 mode 列表
     * 这些 mode 在接口中仍然会返回，但会标记为隐藏状态（is_hidden = true）
     */
    'hidden_modes' => [
        'audio_chat', // 音频聊天模式 - 隐藏模式
    ],
];
