from fastapi.testclient import TestClient
from app.main import app
import sys
import traceback

try:
    print("Executing final TestClient POST...")
    client = TestClient(app, raise_server_exceptions=True)
    response = client.post(
        "/api/v1/ingest/",
        json={"events": [{"event_id": "test", "event_name": "test", "occurred_at": "2024-03-30T12:00:00Z"}]},
        headers={"X-API-Key": "test_key_3477ebfce44747b982b446c556ed212f"}
    )
    print("Response Status Code:", response.status_code)
    print("Response Text:", response.text)
except Exception as e:
    print("Caught Exception during TestClient execution:")
    traceback.print_exc()
