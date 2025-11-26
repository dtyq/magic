<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

enum SearchEngineType: string
{
    // bing
    case Bing = 'bing';

    // google
    case Google = 'google';

    // tavily
    case Tavily = 'tavily';

    // duckduckgo
    case DuckDuckGo = 'duckduckgo';

    // cloudsway
    case Cloudsway = 'cloudsway';

    // magic
    case Magic = 'magic';

    // jina
    case Jina = 'jina';
}
