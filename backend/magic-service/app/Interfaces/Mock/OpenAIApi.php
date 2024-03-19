<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mock;

use Hyperf\HttpServer\Contract\RequestInterface;

class OpenAIApi
{
    public function chatCompletion(RequestInterface $request): array
    {
        return [
            'id' => '0217427072108484b5f1b375af5186edaba283cecedb7ecab3cf2',
            'object' => 'chat.completion',
            'created' => 1742707212,
            'choices' => [
                [
                    'finish_reason' => 'stop',
                    'index' => 0,
                    'message' => [
                        'role' => 'assistant',
                        'content' => 'Of course! I\'d be happy to help with your coding question. What are you working on or what do you need assistance with?',
                    ],
                ],
            ],
            'usage' => [
                'completion_tokens' => 27,
                'prompt_tokens' => 21,
                'total_tokens' => 48,
                'prompt_tokens_details' => [],
            ],
        ];
    }

    public function embeddings(RequestInterface $request): array
    {
        return [
            'object' => 'list',
            'data' => [
                [
                    'object' => 'embedding',
                    'embedding' => [
                        -0.01833024,
                        0.02034276,
                        -0.018185195,
                        0.013144831,
                    ],
                    'index' => 0,
                ],
            ],
            'model' => 'text-embedding-3-large',
            'usage' => [
                'prompt_tokens' => 6,
                'total_tokens' => 6,
            ],
        ];
    }
}
