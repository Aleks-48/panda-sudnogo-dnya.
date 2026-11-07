import json, unittest
from unittest.mock import patch
from evaluator import CQAEvaluator

class LLMValidationTests(unittest.TestCase):
    def setUp(self):
        self.c=[{'id':'x','name':'Test','weight':100,'max_points':1,'allowed_scores':'[0,1]','allow_na':False}]
        self.d={'language':'RU','channel':'chat','transcript':[{'speaker':'operator','text':'Здравствуйте, я Анна.','timestamp':'00:03'}]}
        self.r={'criterion_id':'x','score':1,'is_na':False,'explanation':'Есть представление','quote':'я Анна','evidence_index':0,'needs_review':False}
    def run_rows(self,rows):
        with patch.object(CQAEvaluator,'_call_ollama',return_value=rows):
            return CQAEvaluator('ollama').evaluate_dialogue(self.d,self.c)
    def test_valid_response_source_timestamp(self):
        self.r['timestamp']='invented'
        result=self.run_rows({'evaluations':[self.r]})
        self.assertEqual(result['total_score'],100)
        self.assertEqual(result['criteria_results'][0]['timestamp'],'00:03')
    def test_fabricated_quote_blocks_total(self):
        self.r['quote']='Несуществующий текст'
        result=self.run_rows([self.r])
        self.assertIsNone(result['total_score']); self.assertTrue(result['needs_review'])
        self.assertEqual(result['criteria_results'][0]['quote'],'')
    def test_string_false_not_truthy(self):
        self.r['is_na']='false'
        self.assertIsNone(self.run_rows([self.r])['total_score'])
    def test_missing_duplicate_invalid_scale(self):
        for rows in [[],[self.r,self.r],[dict(self.r,score=.3)]]:
            with self.subTest(rows=rows):
                self.assertEqual(self.run_rows(rows)['error_code'],'model_unavailable_or_invalid_response')
    def test_json_fence(self):
        self.assertEqual(CQAEvaluator._parse_response('```json\n'+json.dumps({'evaluations':[self.r]})+'\n```'),[self.r])
    def test_no_network_fallback(self):
        with patch.object(CQAEvaluator,'_call_ollama',side_effect=ValueError('private secret')), patch('requests.post') as call:
            result=CQAEvaluator('ollama').evaluate_dialogue(self.d,self.c)
            call.assert_not_called()
            self.assertNotIn('secret',json.dumps(result))
    def test_official_prompt_not_legacy(self):
        prompt=CQAEvaluator('mock')._build_prompt(self.d,self.c)
        self.assertIn('Запрос ИИН не равен',prompt)
        self.assertIn('evidence_index',prompt)
        self.assertNotIn('Работа с возражениями',prompt)

if __name__=='__main__': unittest.main()
