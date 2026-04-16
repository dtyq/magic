<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'input_modes' => [
        'standard' => '普通文生视频模式，不依赖任何参考素材。',
        'omni_reference' => '上传1~:max_count 份图 / 视 / 音参考素材，搭配文字指令，自由联动多元素生成专属互动创意。示例：综合 @图片 1的主体、@视频 3的动态、@音频 2的音色，融合1~:max_count 份素材，生成一段氛围感短片。',
        'keyframe_guided' => [
            'start_end' => '用首帧定格起点，尾帧定格终点，搭配文字描述，让 AI 补全从起点到终点的动态故事。',
            'start_only' => '用首帧定格起点，搭配文字描述，让 AI 为画面赋予动态，生成连贯的视频故事。',
        ],
        'image_reference' => [
            'single' => '上传 1 张参考图，搭配文字，生成高度匹配视频。示例：参考 @图片 1，生成动态视频。',
            'multiple' => '上传1~:max_count 张参考图片，搭配文字描述，让 AI 精准融合多图素材，生成与原图风格、主体及内容高度一致的视频。示例：参考 @图片 1 风格、@图片 2 场景，生成自然流畅的动态视频。',
        ],
    ],
];
