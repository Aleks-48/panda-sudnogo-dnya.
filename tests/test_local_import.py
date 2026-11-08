import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
import database
import app

class LocalImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        database.DB_PATH = str(Path(self.temp.name) / 'test.db')
        self.context = TestClient(app.app)
        self.client = self.context.__enter__()
        self.record = {'conversation_id':'local-test','language':'RU','channel':'agent chat','transcript':[{'speaker':'operator','timestamp':'00:01','text':'Synthetic only'}]}
    def tearDown(self):
        self.context.__exit__(None,None,None)
        self.temp.cleanup()
    def test_import_and_duplicate_preserves_original(self):
        self.assertEqual(self.client.post('/api/import_local',json=[self.record]).json()['imported_records'],1)
        self.record['transcript'][0]['text']='Do not overwrite'
        self.assertEqual(self.client.post('/api/import_local',json=[self.record]).json()['skipped_records'],1)
        saved=self.client.get('/api/dialogues/local-test').json()['dialogue']
        self.assertEqual(saved['transcript'][0]['text'],'Synthetic only')
    def test_atomic_validation(self):
        self.assertEqual(self.client.post('/api/import_local',json=[self.record,{}]).status_code,422)
        self.assertEqual(self.client.get('/api/dialogues/local-test').status_code,404)
    def test_envelope_and_no_remote_audio(self):
        self.record['audio_url']='https://example.invalid/private'
        self.assertEqual(self.client.post('/api/import_local',json={'data':{'records':[self.record]}}).status_code,200)
        self.assertIsNone(self.client.get('/api/dialogues/local-test').json()['dialogue']['audio_url'])
    def test_bad_json_and_size(self):
        self.assertEqual(self.client.post('/api/import_local',content='{').status_code,422)
        self.assertEqual(self.client.post('/api/import_local',content=' '* (5*1024*1024+1)).status_code,413)

if __name__ == '__main__': unittest.main()
