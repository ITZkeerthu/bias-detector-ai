import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from detector import app  # noqa: E402
from proxy_detector import detect_proxies  # noqa: E402

client = TestClient(app)


def _vars(text):
    return {p["variable"] for p in detect_proxies(text)}


def test_neutral_text_has_no_proxies():
    assert detect_proxies("Experienced engineer with Python skills.") == []


@pytest.mark.parametrize(
    "text,variable",
    [
        ("Please provide your zip code", "zip_code"),
        ("He studied at a community college", "university_name"),
        ("There was a career break in 2019", "employment_gap"),
        ("Class of 1998", "graduation_year"),
        ("She lives in a gated community", "neighborhood"),
        ("Please list your hobbies", "hobbies"),
        ("Enter your surname", "name"),
    ],
)
def test_each_proxy_rule_matches(text, variable):
    assert variable in _vars(text)


def test_matching_is_case_insensitive_and_deduplicated():
    found = detect_proxies("ZIP CODE and Postal Code and zip code")
    assert [p["variable"] for p in found] == ["zip_code"]


def test_proxy_requires_whole_words():
    assert "hobbies" not in _vars("unhobbiesque")


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_analyze_returns_score_and_decision_points():
    resp = client.post("/analyze", json={"text": "Candidate zip code and graduated in 1990"})
    assert resp.status_code == 200
    body = resp.json()
    assert 0 < body["input_bias_score"] <= 100
    assert {p["variable"] for p in body["proxy_variables"]} >= {"zip_code", "graduation_year"}
    assert len(body["decision_points"]) == len(body["proxy_variables"])


@pytest.mark.parametrize("text", ["", "   \n\t"])
def test_analyze_rejects_empty_text(text):
    assert client.post("/analyze", json={"text": text}).status_code == 422


def test_analyze_rejects_oversized_text():
    assert client.post("/analyze", json={"text": "a" * 50_001}).status_code == 422
