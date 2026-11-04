"""Real Python classification against the disposable Higia registry; no legacy client."""
import json
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

from saudevianet_mcp.campaign_source import classify_campaign_contacts
from saudevianet_mcp.higia_clinic_registry import HigiaClinicRegistry

unavailable = False


async def classify(request):
    if request.headers.get('authorization') != 'Bearer fixture-only':
        return JSONResponse({}, status_code=401)
    config = json.loads(Path('/tmp/higia-admin-homolog-fixture/session.json').read_text())
    registry = HigiaClinicRegistry('http://127.0.0.1:3105/api', config['registryToken'])
    try:
        result = classify_campaign_contacts(
            (await request.json())['items'], load_records=registry.listed_records,
            registry_available=not unavailable, now=datetime.now(timezone.utc),
        )
        return JSONResponse(result)
    finally:
        registry._client.close()


async def toggle(request):
    global unavailable
    if request.headers.get('authorization') != 'Bearer fixture-only':
        return JSONResponse({}, status_code=401)
    unavailable = (await request.json())['unavailable'] is True
    return JSONResponse({'unavailable': unavailable})


if __name__ == '__main__':
    uvicorn.run(Starlette(routes=[
        Route('/internal/confirmations/classify', classify, methods=['POST']),
        Route('/fixture/registry-failure', toggle, methods=['POST']),
    ]), host='127.0.0.1', port=8877, access_log=False, log_level='warning')
