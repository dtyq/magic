<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

return [
    'volcengine' => [
        'app_id' => env('ASR_VKE_APP_ID', ''),
        'token' => env('ASR_VKE_TOKEN', ''),
        'cluster' => env('ASR_VKE_CLUSTER', ''),
        'hot_words' => json_decode(env('ASR_VKE_HOTWORDS_CONFIG') ?? '[]', true) ?: [],
        'replacement_words' => json_decode(env('ASR_VKE_REPLACEMENT_WORDS_CONFIG') ?? '[]', true) ?: [],

        // 语音识别请求配置参数 @see https://www.volcengine.com/docs/6561/1354868
        'request_config' => [
            // 模型名称，当前只有bigmodel
            'model_name' => 'bigmodel',
            // 模型版本号，400 最新
            'model_version' => '400',
            // 文本规范化 (ITN) 是自动语音识别 (ASR) 后处理管道的一部分
            // ITN 的任务是将 ASR 模型的原始语音输出转换为书面形式，以提高文本的可读性
            // 例如，"一九七零年"->"1970年"和"一百二十三美元"->"$123"
            'enable_itn' => true,
            // 启用标点符号识别
            'enable_punc' => true,
            // 语义顺滑：提高自动语音识别（ASR）结果的文本可读性和流畅性
            // 通过删除或修改ASR结果中的不流畅部分，如停顿词、语气词、语义重复词等
            'enable_ddc' => true,
            // 开启后可返回说话人的信息，10人以内，效果较好
            'enable_speaker_info' => true,
        ],
    ],
    'text_replacer' => [ // 目前火山大模型仅支持热词，不支持替换，用于极端情况下备用
        'fuzz' => [
            'replacement' => [
            ],
            'threshold' => 70,
        ],
    ],
];
