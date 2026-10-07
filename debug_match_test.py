import json
from app import app

print('APP OK')
print('MATCH ROUTES:', [str(r) for r in app.url_map.iter_rules() if '/api/match' in str(r)])
with app.test_client() as client:
    rv = client.post('/api/match/check', json={'query': 'test'})
    print('STATUS', rv.status_code)
    print('DATA', rv.get_data(as_text=True))
