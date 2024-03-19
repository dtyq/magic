<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Hyperf\Odin\Api\Request;

use GuzzleHttp\RequestOptions;
use Hyperf\Odin\Api\Request\EmbeddingRequest;

class MiscEmbeddingRequest extends EmbeddingRequest
{
    public function createOptions(): array
    {
        $this->validate();

        return [
            RequestOptions::JSON => [
                'prompt' => $this->input,
                'model' => $this->model,
            ],
        ];
    }
}
