<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser\Driver;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\ExcelFileParserDriverInterface;
use Exception;
use PhpOffice\PhpSpreadsheet\IOFactory as PhpSpreadsheetIOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Exception as ReaderException;
use Vtiful\Kernel\Excel;

class ExcelFileParserDriver implements ExcelFileParserDriverInterface
{
    public function parse(string $filePath, string $url, string $fileExtension): string
    {
        $fileExtension = strtolower($fileExtension);
        if (in_array($fileExtension, ['xlsx', 'xlsm'])) {
            return $this->parseByXlsWriter($filePath, $fileExtension);
        }
        return $this->parseBySpreedSheet($filePath, $fileExtension);
    }

    private function parseByXlsWriter(string $filePath, string $fileExtension): string
    {
        try {
            $excel = new Excel([
                'path' => dirname($filePath),
            ]);
            $excelFile = $excel->openFile(basename($filePath));
            $sheetList = $excelFile->sheetList();
            $content = '';
            foreach ($sheetList as $sheetName) {
                $content .= '## ' . $sheetName . "\n";
                $sheet = $excelFile->openSheet($sheetName, Excel::SKIP_EMPTY_ROW);
                $row = $sheet->nextRow();
                while (! empty($row)) {
                    $csvRow = array_map(fn ($cell) => $this->formatCsvCell((string) $cell), $row);
                    // 整行都是空字符串，跳过
                    if (array_filter($csvRow, function ($value) {
                        return $value !== '';
                    }) === []) {
                        $row = $sheet->nextRow();
                        continue;
                    }
                    $csvRow = implode(',', $csvRow);
                    $content .= $csvRow . "\n";
                    $row = $sheet->nextRow();
                }
                $content .= "\n";
            }
        } catch (Exception $e) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read Excel file: %s', $e->getMessage()));
        }
        return $content;
    }

    private function parseBySpreedSheet(string $filePath, string $fileExtension): string
    {
        try {
            $reader = PhpSpreadsheetIOFactory::createReaderForFile($filePath);
            $spreadsheet = $reader->load($filePath);
            $content = '';

            foreach ($spreadsheet->getSheetNames() as $sheetName) {
                $content .= '## ' . $sheetName . "\n";
                $worksheet = $spreadsheet->getSheetByName($sheetName);
                $highestRow = $worksheet->getHighestRow();
                $highestColumn = $worksheet->getHighestColumn();

                for ($row = 1; $row <= $highestRow; ++$row) {
                    $rowData = [];
                    for ($col = 'A'; $col <= $highestColumn; ++$col) {
                        $cellValue = $worksheet->getCell($col . $row)->getValue();
                        $rowData[] = $this->formatCsvCell(strval($cellValue ?? ''));
                    }
                    $content .= implode(',', $rowData) . "\n";
                }
                $content .= "\n";
            }
        } catch (ReaderException $e) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read Excel file: %s', $e->getMessage()));
        }
        return $content;
    }

    /**
     * 格式化CSV单元格内容，对特殊内容添加引号.
     */
    private function formatCsvCell(string $value): string
    {
        // 如果单元格内容为空，直接返回空字符串
        if ($value === '') {
            return '';
        }

        // 如果单元格内容包含以下任意字符，需要用引号包围
        if (str_contains($value, ',')
            || str_contains($value, '"')
            || str_contains($value, "\n")
            || str_contains($value, "\r")
            || str_starts_with($value, ' ')
            || str_ends_with($value, ' ')) {
            // 转义双引号
            $value = str_replace('"', '""', $value);
            return '"' . $value . '"';
        }

        return $value;
    }
}
