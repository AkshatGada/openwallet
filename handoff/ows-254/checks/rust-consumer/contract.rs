use ows_core::policy::SpendingContext;
use serde::Deserialize;

#[derive(Deserialize)]
struct LegacySpending {
    daily_total: String,
    date: String,
}

fn main() {
    let unavailable = SpendingContext::unavailable("2026-10-18");
    let json = serde_json::to_value(&unavailable).unwrap();
    assert_eq!(json["daily_total"], serde_json::Value::Null);
    let legacy_error = serde_json::from_value::<LegacySpending>(json.clone()).err().unwrap();
    assert!(legacy_error.to_string().contains("expected a string"));
    let modern: SpendingContext = serde_json::from_value(json).unwrap();
    assert!(modern.daily_total.is_none());
    let old_json = serde_json::json!({"daily_total":"0","date":"2026-10-18"});
    let legacy: LegacySpending = serde_json::from_value(old_json.clone()).unwrap();
    assert_eq!(legacy.daily_total, "0");
    assert_eq!(legacy.date, "2026-10-18");
    let modern: SpendingContext = serde_json::from_value(old_json).unwrap();
    assert_eq!(modern.daily_total.as_deref(), Some("0"));
    println!("PASS: new Rust consumer handles null; old string schema rejects null; both accept legacy string without implying verified accounting.");
}
