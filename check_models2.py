import urllib.request, json

key = 'VENICE_INFERENCE_KEY_Xz64OoFpaEBgh4KDhJ8csMFNKdlysiZDUxwOB31RDk'
req = urllib.request.Request('https://api.venice.ai/api/v1/models', headers={'Authorization': f'Bearer {key}'})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
text_models = [m for m in data.get('data',[]) if m.get('type') == 'text']
for m in text_models[30:]:
    print(m['id'])