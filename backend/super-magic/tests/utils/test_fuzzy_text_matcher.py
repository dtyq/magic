from app.utils.fuzzy_text_matcher import (
    find_in_text,
    find_unique_in_filenames,
    normalize_filename_for_match,
    normalize_for_match,
)


def test_normalize_for_match_handles_low_risk_unicode_variants():
    assert normalize_for_match("ＡＢＣ１２３") == "ABC123"
    assert normalize_for_match("alpha\u200bbeta") == "alphabeta"
    assert normalize_for_match("a…b") == "a...b"
    assert normalize_for_match("a–b—a−b―a﹣b－a") == "a-b-a-b-a-b-a"


def test_find_in_text_handles_unicode_combining_forms():
    haystack = "title: cafe\u0301"
    result = find_in_text("café", haystack)

    assert result is not None
    assert result.actual == "cafe\u0301"
    assert result.warning


def test_find_in_text_maps_expanded_ellipsis_back_to_actual_text():
    result = find_in_text("a...b", "prefix a…b suffix")

    assert result is not None
    assert result.actual == "a…b"
    assert result.warning


def test_normalize_filename_for_match_only_ignores_extension_case():
    assert normalize_filename_for_match("Report.PDF") == "Report.pdf"
    assert normalize_filename_for_match("REPORT.pdf") != normalize_filename_for_match("report.pdf")


def test_find_unique_in_filenames_accepts_extension_case_only(tmp_path):
    actual = tmp_path / "Report.PDF"
    actual.write_text("content", encoding="utf-8")

    result = find_unique_in_filenames("Report.pdf", tmp_path)

    assert result is not None
    assert result.path == actual


def test_normalize_filename_for_match_handles_medium_risk_filename_symbols():
    assert normalize_filename_for_match("mock《title》 - 1.TXT") == normalize_filename_for_match('mock"title"_1.txt')
    assert normalize_filename_for_match("A ( B ).txt") == normalize_filename_for_match("A(B).TXT")
    assert normalize_filename_for_match("1、 文件.txt") == normalize_filename_for_match("1.文件.TXT")
    assert normalize_filename_for_match("Title: Subtitle.txt") == normalize_filename_for_match("Title-Subtitle.TXT")


def test_find_unique_in_filenames_handles_medium_risk_filename_symbols(tmp_path):
    actual = tmp_path / "mock《title》 - 1.TXT"
    actual.write_text("content", encoding="utf-8")

    result = find_unique_in_filenames('mock"title"_1.txt', tmp_path)

    assert result is not None
    assert result.path == actual
