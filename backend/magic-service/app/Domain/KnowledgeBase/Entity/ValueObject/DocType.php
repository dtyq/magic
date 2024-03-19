<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

enum DocType: int
{
    case UNKNOWN = 0;
    case TXT = 1;
    case MARKDOWN = 2;
    case PDF = 3;
    case HTML = 4;
    case XLSX = 5;
    case XLS = 6;
    case DOC = 7;
    case DOCX = 8;
    case CSV = 9;
    case XML = 10;
    case HTM = 11;
    case PPT = 12;
    case JSON = 13;

    public static function fromExtension(string $extension): self
    {
        $extension = strtolower($extension);
        return match ($extension) {
            'txt' => self::TXT,
            'markdown', 'md' => self::MARKDOWN,
            'pdf' => self::PDF,
            'html' => self::HTML,
            'xlsx' => self::XLSX,
            'xls' => self::XLS,
            'doc' => self::DOC,
            'docx' => self::DOCX,
            'csv' => self::CSV,
            'htm' => self::HTM,
            'xml' => self::XML,
            'ppt' => self::PPT,
            'json' => self::JSON,
            default => self::UNKNOWN,
        };
    }
}
