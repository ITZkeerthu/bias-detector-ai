import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from attribute_extractor import extract_attributes  # noqa: E402
from bias_scorer import calculate_input_bias_score  # noqa: E402


def _names(text):
    return {a["attribute"] for a in extract_attributes(text)}


def test_neutral_text_has_no_findings():
    assert extract_attributes("The management team classes the skimming report.") == []


def test_substrings_do_not_trigger_gender_or_age():
    names = _names("The candidate will manage the pipeline")
    assert "gender" not in names
    assert "age" not in names


def test_gender_whole_word_detected():
    assert "gender" in _names("She is a pregnant applicant")


def test_multiword_keyword_detected():
    assert "family_status" in _names("Candidate took a gap year")


def test_asian_name_indicator_requires_whole_word():
    assert "race" not in _names("He was skimming the document")
    assert "race" in _names("Applicant: Nguyen")


def test_score_zero_for_no_findings_and_capped():
    assert calculate_input_bias_score([], []) == 0.0
    attrs = [{"attribute": "race", "confidence": 0.95}] * 10
    assert calculate_input_bias_score(attrs, []) <= 100.0
