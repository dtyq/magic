<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\OCR;

enum OCRClientType: string
{
    case VOLCE = 'volce';
    case Volcengine = 'Volcengine';
}
