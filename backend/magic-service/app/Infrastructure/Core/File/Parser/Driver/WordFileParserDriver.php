<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser\Driver;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\WordFileParserDriverInterface;
use Exception;
use PhpOffice\PhpWord\Element\Image;
use PhpOffice\PhpWord\Element\Text;
use PhpOffice\PhpWord\Element\TextRun;
use PhpOffice\PhpWord\IOFactory;

class WordFileParserDriver implements WordFileParserDriverInterface
{
    public function parse(string $filePath, string $url, string $fileExtension): string
    {
        try {
            /*
             * phpword 不支持旧格式的.doc
             * Throw an exception since making further calls on the ZipArchive would cause a fatal error.
             * This prevents fatal errors on corrupt archives and attempts to open old "doc" files.
             */
            if ($fileExtension === 'docx') {
                $reader = IOFactory::load($filePath, 'Word2007');
            } else {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'flow.node.loader.unsupported_file_type', ['file_extension' => $fileExtension]);
            }

            $content = '';
            foreach ($reader->getSections() as $section) {
                foreach ($section->getElements() as $element) {
                    if ($element instanceof TextRun) {
                        foreach ($element->getElements() as $subElement) {
                            if ($subElement instanceof Text) {
                                $text = $subElement->getText();
                                if (is_string($text)) {
                                    $content .= $text;
                                }
                            } elseif ($subElement instanceof Image) {
                                $imageData = $subElement->getImageStringData(true);
                                $imageType = $subElement->getImageType();
                                $content .= sprintf("\n![image](data:%s;base64,%s)\n", $imageType, $imageData);
                            }
                        }
                        $content .= "\r\n";
                    } elseif ($element instanceof Image) {
                        $imageData = $element->getImageStringData(true);
                        $imageType = $element->getImageType();
                        $content .= sprintf("\n![image](data:%s;base64,%s)\n", $imageType, $imageData);
                    }
                }
            }
            return $content;
        } catch (Exception $e) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read Word file: %s', $e->getMessage()));
        }
    }
}
