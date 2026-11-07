import os, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['LLM_PROVIDER'] = 'mock'
from fastapi.testclient import TestClient
import database
import app
from evaluator import CQAEvaluator, calculate_scores

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        database.DB_PATH = str(Path(self.tmp.name) / 'test.db')
        self.ctx = TestClient(app.app)
        self.client = self.ctx.__enter__()
    def tearDown(self):
        self.ctx.__exit__(None, None, None)
        self.tmp.cleanup()
    def test_provider(self):
        self.assertEqual(CQAEvaluator().provider, 'mock')
    def test_health_and_full_flow(self):
        self.assertEqual(self.client.get('/').status_code, 200)
        d = self.client.get('/api/dialogues').json()[0]['conversation_id']
        e = self.client.post('/api/evaluate/' + d).json()
        criterion = self.client.get('/api/criteria').json()[0]
        # Change checklist after evaluation: appeal must retain the original scale.
        criterion['max_points'] = 100
        criterion['weight'] = 0
        self.assertEqual(self.client.post('/api/criteria', json=criterion).status_code, 200)
        a = self.client.post('/api/appeals', json={'evaluation_id':e['evaluation_id'], 'conversation_id':d, 'criterion_id':criterion['id'], 'operator_comment':'Прошу проверить'}).json()
        decision = {'status':'accepted','supervisor_comment':'Проверено','new_score':99}
        self.assertEqual(self.client.post('/api/appeals/'+a['appeal_id']+'/decision',json=decision).status_code,422)
        decision['new_score']=1
        self.assertEqual(self.client.post('/api/appeals/'+a['appeal_id']+'/decision',json=decision).status_code,200)
        saved=self.client.get('/api/dialogues/'+d).json()['evaluation']
        self.assertEqual(saved['original_results'], e['criteria_results'])
        self.assertEqual(saved['checklist_snapshot'][0]['max_points'], 1)
        self.assertEqual(self.client.post('/api/appeals/'+a['appeal_id']+'/decision',json=decision).status_code,409)
        again=self.client.post('/api/evaluate/'+d).json()
        self.assertNotEqual(again['evaluation_id'],e['evaluation_id'])
        self.assertEqual(len(self.client.get('/api/dialogues').json()), len(self.client.get('/api/dialogues').json()))
    def test_dynamic_criterion_not_fabricated(self):
        c={'id':'custom','name':'Новое правило','description':'Правило','weight':10,'max_points':1,'allow_na':False,'scale_type':'binary'}
        result=CQAEvaluator().evaluate_dialogue({'transcript':[],'language':'RU'},[c])
        self.assertTrue(result['needs_review'])
        self.assertEqual(result['criteria_results'][0]['quote'],'')
    def test_invalid_scales_and_decisions(self):
        c={'id':'x','name':'X','description':'X','weight':1,'max_points':0}
        self.assertEqual(self.client.post('/api/criteria',json=c).status_code,422)
        self.assertEqual(self.client.post('/api/appeals/no/decision',json={'status':'anything','supervisor_comment':'x'}).status_code,422)
    def test_scoring(self):
        c=[{'id':'a','weight':50,'max_points':1,'allow_na':True},{'id':'b','weight':50,'max_points':5}]
        score,_,_=calculate_scores(c,[{'criterion_id':'a','is_na':True,'na_reason':'Неприменимо','score':0},{'criterion_id':'b','score':5}])
        self.assertEqual(score,100)
        with self.assertRaises(ValueError): calculate_scores(c,[{'criterion_id':'a','score':1}]*2)

class OfficialTests(unittest.TestCase):
    def setUp(self):
        import json
        self.criteria=json.loads(Path(__file__).resolve().parents[1].joinpath('official_checklist.json').read_text())
    def rows(self):
        return [{'criterion_id':c['id'],'score':c['max_points'] if not c['is_fatal'] else 0} for c in self.criteria]
    def test_official_weights_and_fatal(self):
        self.assertEqual([c['weight'] for c in self.criteria],[10,15,20,20,15,15,5,0])
        rows=self.rows(); rows[-1]['score']=1
        score,fatal,_=calculate_scores(self.criteria,rows)
        self.assertEqual(score,100); self.assertTrue(fatal)
    def test_discrete_scales(self):
        for index,bad in [(3,19),(5,5),(0,.5)]:
            rows=self.rows(); rows[index]['score']=bad
            with self.assertRaises(ValueError): calculate_scores(self.criteria,rows)
    def test_na_and_precision(self):
        rows=self.rows(); rows[2].update(is_na=True,na_reason='Общий вопрос'); rows[5]['score']=7
        score,_,_=calculate_scores(self.criteria,rows)
        self.assertEqual(score,94.38)
        with self.assertRaises(ValueError):
            rows[0].update(is_na=True,na_reason='Запрещено'); calculate_scores(self.criteria,rows)
    def test_no_weight_no_total(self):
        score,_,_=calculate_scores([self.criteria[-1]],[{'criterion_id':'c8','score':0}])
        self.assertIsNone(score)

if __name__=='__main__': unittest.main()
