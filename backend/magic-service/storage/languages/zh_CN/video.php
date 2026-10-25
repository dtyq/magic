<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'generation' => [
        'generate_audio' => [
            'name' => '生成音频',
            'description' => '是否生成音频',
        ],
        'web_search' => [
            'name' => '联网搜索',
            'description' => '是否启用联网搜索',
        ],
        'draft' => [
            'name' => '样片模式',
            'description' => '先以 480p 快速生成样片，确认效果后再以正式分辨率出片，两次出片分别计费',
        ],
    ],
    'input_modes' => [
        'standard' => '普通文生视频模式，不依赖任何参考素材。',
        'omni_reference' => '上传 1~:max_count 张参考图片生成视频；若同时上传 1 个参考视频，则参考图片最多 6 张。示例：综合 @图片 1 的主体与 @视频 1 的动态，生成一段氛围感短片。',
        'wan30_omni_reference' => '最多上传 10 张参考图片、5 个参考视频和 5 个参考音频，参考素材总数最多 20 个。示例：综合 @图片 1 的主体与 @视频 1 的动态，生成一段氛围感短片。',
        'gemini_omni_reference' => '上传 1~8 张参考图片生成视频；若同时上传 1 个参考视频，则参考图片最多 6 张。示例：综合 @图片 1 的主体与 @视频 1 的动态，生成一段氛围感短片。',
        'minimax_h3_omni_reference' => '支持最多 9 张参考图片、3 个参考视频和 3 个参考音频；参考音频需与参考图片或参考视频搭配使用。',
        'minimax_h3_omni_reference_mode' => [
            'reference_media' => '可混合上传参考图片、参考视频和参考音频；图片最多 9 张，视频和音频各最多 3 个。参考音频需搭配图片或视频。',
        ],
        'omni_reference_mode' => [
            'images_only' => '仅上传参考图片，最多支持 7 张。',
            'image_and_video' => '同时上传参考图片和 1 个参考视频时，参考图片最多支持 6 张。',
        ],
        'keyframe_guided' => [
            'start_end' => '用首帧定格起点，尾帧定格终点，搭配文字描述，让 AI 补全从起点到终点的动态故事。',
            'start_only' => '用首帧定格起点，搭配文字描述，让 AI 为画面赋予动态，生成连贯的视频故事。',
        ],
        'image_reference' => [
            'single' => '上传 1 张参考图，搭配文字，生成高度匹配视频。示例：参考 @图片 1，生成动态视频。',
            'multiple' => '上传1~:max_count 张参考图片，搭配文字描述，让 AI 精准融合多图素材，生成与原图风格、主体及内容高度一致的视频。示例：参考 @图片 1 风格、@图片 2 场景，生成自然流畅的动态视频。',
        ],
        'video_edit' => '上传 1 个参考视频，结合文字指令对原视频进行编辑或改写。',
        'video_edit_mode' => [
            'images_only' => '仅上传 1 个参考视频进行编辑。',
            'image_and_video' => '上传 1 个参考视频和最多 6 张参考图片进行编辑。',
        ],
        'draft_task' => '基于已生成的样片出正式分辨率的成片，提示词、参考素材与时长全部继承样片，无需重新填写。',
    ],
    'errors' => [
        'generic' => '视频生成失败，请检查输入内容或稍后重试。',
        'user_concurrency_limit' => '您的视频生成任务已达到同时运行上限（最多 :limit 个），请等待已有任务完成后再提交。',
        'organization_concurrency_limit' => '当前组织的视频生成任务已达到同时运行上限（最多 :limit 个），请等待组织内已有任务完成后再提交。',
        'model_resolution_not_supported' => '当前模型（:model）暂不支持 :resolution，请改为 :supported 后重试。',
    ],
];
