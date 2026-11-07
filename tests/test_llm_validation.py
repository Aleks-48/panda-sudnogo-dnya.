import json
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluator import CQAEvaluator, calculate_scores, _detect_script_lang
from scripts.compare_ground_truth import compare


class LLMValidationTests(unittest.TestCase):
    def setUp(self):
        self.c = [{'id': 'x', 'name': 'Test', 'weight': 100, 'max_points': 1, 'allowed_scores': '[0,1]', 'allow_na': False}]
        self.d = {
            'language': 'RU',
            'channel': 'chat',
            'transcript': [{'speaker': 'operator', 'text': 'Здравствуйте, я Анна. Чем могу помочь?', 'timestamp': '00:03'}]
        }
        self.r = {
            'criterion_id': 'x', 'score': 1, 'is_na': False,
            'explanation': 'Есть представление', 'quote': 'я Анна',
            'evidence_index': 0, 'needs_review': False
        }
        self.official_criteria = json.loads(
            Path(__file__).resolve().parents[1].joinpath('official_checklist.json').read_text()
        )

    def run_rows(self, rows, dialogue=None, criteria=None):
        d = dialogue or self.d
        c = criteria or self.c
        with patch.object(CQAEvaluator, '_call_ollama', return_value=rows):
            return CQAEvaluator('ollama').evaluate_dialogue(d, c)

    def test_valid_response_source_timestamp(self):
        self.r['timestamp'] = 'invented'
        result = self.run_rows({'evaluations': [self.r]})
        self.assertEqual(result['total_score'], 100)
        self.assertEqual(result['criteria_results'][0]['timestamp'], '00:03')

    def test_fabricated_quote_blocks_total(self):
        self.r['quote'] = 'Несуществующий текст'
        result = self.run_rows([self.r])
        self.assertIsNone(result['total_score'])
        self.assertTrue(result['needs_review'])
        self.assertEqual(result['criteria_results'][0]['quote'], '')

    def test_string_false_not_truthy(self):
        self.r['is_na'] = 'false'
        self.assertIsNone(self.run_rows([self.r])['total_score'])

    def test_missing_duplicate_invalid_scale(self):
        for rows in [[], [self.r, self.r], [dict(self.r, score=.3)]]:
            with self.subTest(rows=rows):
                self.assertEqual(self.run_rows(rows)['error_code'], 'model_unavailable_or_invalid_response')

    def test_json_fence(self):
        self.assertEqual(
            CQAEvaluator._parse_response('```json\n' + json.dumps({'evaluations': [self.r]}) + '\n```'),
            [self.r]
        )

    def test_preamble_json_parsing(self):
        raw = 'Ниже приведён JSON-ответ модели:\n' + json.dumps({'evaluations': [self.r]}, ensure_ascii=False) + '\nКонец ответа.'
        self.assertEqual(CQAEvaluator._parse_response(raw), [self.r])

    def test_no_network_fallback(self):
        with patch.object(CQAEvaluator, '_call_ollama', side_effect=ValueError('private secret')), patch('requests.post') as call:
            result = CQAEvaluator('ollama').evaluate_dialogue(self.d, self.c)
            call.assert_not_called()
            self.assertNotIn('secret', json.dumps(result))

    def test_official_prompt_not_legacy(self):
        prompt = CQAEvaluator('mock')._build_prompt(self.d, self.c)
        self.assertIn('Запрос ИИН не равен', prompt)
        self.assertIn('evidence_index', prompt)
        self.assertNotIn('Работа с возражениями', prompt)

    def test_whitespace_and_outer_quotes_normalized_in_evidence(self):
        dialogue = {
            'language': 'RU',
            'channel': 'chat',
            'transcript': [
                {'speaker': 'operator', 'text': 'Здравствуйте!\nМеня зовут   Анна.\u00a0Чем могу помочь?', 'timestamp': '00:05'}
            ]
        }
        row = dict(self.r, quote='«Здравствуйте! Меня зовут Анна.»', evidence_index=0)
        result = self.run_rows({'evaluations': [row]}, dialogue=dialogue)
        self.assertEqual(result['total_score'], 100)
        self.assertFalse(result['needs_review'])
        self.assertIn(result['criteria_results'][0]['quote'], dialogue['transcript'][0]['text'])
        self.assertEqual(result['criteria_results'][0]['timestamp'], '00:05')

    def test_off_by_one_evidence_index_recovered_for_verbatim_quote(self):
        dialogue = {
            'language': 'KZ',
            'channel': 'chat',
            'transcript': [
                {'speaker': 'client', 'text': 'Сәлеметсіз бе! Комиссия қанша?', 'timestamp': '00:01'},
                {'speaker': 'operator', 'text': 'Сәлеметсіз бе! Менің атым Айгерім. Комиссия 0.05% құрайды.', 'timestamp': '00:08'}
            ]
        }
        row = dict(self.r, quote='Менің атым Айгерім', evidence_index=2)
        result = self.run_rows({'evaluations': [row]}, dialogue=dialogue)
        self.assertEqual(result['total_score'], 100)
        self.assertEqual(result['criteria_results'][0]['timestamp'], '00:08')

    def test_na_with_null_score_and_whitespace_na_reason(self):
        na_crit = [{'id': 'c3', 'name': 'Идентификация', 'weight': 20, 'max_points': 1, 'allowed_scores': '[0,1]', 'allow_na': True},
                   {'id': 'c1', 'name': 'Контакт', 'weight': 10, 'max_points': 1, 'allowed_scores': '[0,1]', 'allow_na': False}]
        rows = [
            {'criterion_id': 'c3', 'score': None, 'is_na': True, 'na_reason': 'Общий вопрос без доступа к счёту',
             'explanation': 'Идентификация не требуется', 'quote': 'Здравствуйте, я Анна', 'evidence_index': 0, 'needs_review': False},
            {'criterion_id': 'c1', 'score': 1, 'is_na': False, 'na_reason': '',
             'explanation': 'Поздоровалась и представилась', 'quote': 'я Анна', 'evidence_index': 0, 'needs_review': False}
        ]
        result = self.run_rows({'evaluations': rows}, criteria=na_crit)
        self.assertEqual(result['total_score'], 100.0)
        self.assertFalse(result['needs_review'])

        with self.assertRaises(ValueError):
            calculate_scores(na_crit, [
                {'criterion_id': 'c3', 'score': 0, 'is_na': True, 'na_reason': '   '},
                {'criterion_id': 'c1', 'score': 1, 'is_na': False}
            ])

    def test_non_triggered_fatal_c8_without_quote_requires_review(self):
        dialogue = {
            'language': 'EN',
            'channel': 'chat',
            'transcript': [
                {'speaker': 'client', 'text': 'Hello! Where can I see the tariff plan in the app?', 'timestamp': '00:01'},
                {'speaker': 'operator', 'text': 'Hello! My name is Dana. Open Settings -> Tariffs in the app.', 'timestamp': '00:06'},
                {'speaker': 'client', 'text': 'Got it, thanks!', 'timestamp': '00:12'},
                {'speaker': 'operator', 'text': 'Glad to help! Let me know if you need anything else. Have a great day!', 'timestamp': '00:18'}
            ]
        }
        evals = [
            {'criterion_id': 'c1', 'score': 1, 'is_na': False, 'na_reason': '', 'explanation': 'Greeted in EN and introduced name', 'quote': 'Hello! My name is Dana.', 'evidence_index': 1, 'needs_review': False},
            {'criterion_id': 'c2', 'score': 0, 'is_na': True, 'na_reason': 'Question was self-contained', 'explanation': 'No clarification needed', 'quote': 'Where can I see the tariff plan', 'evidence_index': 0, 'needs_review': False},
            {'criterion_id': 'c3', 'score': 0, 'is_na': True, 'na_reason': 'Public app navigation query', 'explanation': 'No personal account action', 'quote': 'Where can I see the tariff plan', 'evidence_index': 0, 'needs_review': False},
            {'criterion_id': 'c4', 'score': 20, 'is_na': False, 'na_reason': '', 'explanation': 'Exact path given', 'quote': 'Open Settings -> Tariffs in the app.', 'evidence_index': 1, 'needs_review': False},
            {'criterion_id': 'c5', 'score': 1, 'is_na': False, 'na_reason': '', 'explanation': 'Polite and helpful tone', 'quote': 'Glad to help!', 'evidence_index': 3, 'needs_review': False},
            {'criterion_id': 'c6', 'score': 10, 'is_na': False, 'na_reason': '', 'explanation': 'Clear and coherent', 'quote': 'Open Settings -> Tariffs in the app.', 'evidence_index': 1, 'needs_review': False},
            {'criterion_id': 'c7', 'score': 1, 'is_na': False, 'na_reason': '', 'explanation': 'Offered help and said goodbye', 'quote': 'Have a great day!', 'evidence_index': 3, 'needs_review': False},
            {'criterion_id': 'c8', 'score': 0, 'is_na': False, 'na_reason': '', 'explanation': 'No gross errors', 'quote': '', 'evidence_index': -1, 'needs_review': False},
        ]
        result = self.run_rows({'evaluations': evals}, dialogue=dialogue, criteria=self.official_criteria)
        self.assertIsNone(result['total_score'])
        self.assertFalse(result['has_fatal_flaw'])
        self.assertTrue(result['needs_review'])
        self.assertEqual(result['criteria_results'][-1]['quote'], '')

    def test_multilingual_language_detection_and_prompt_hints(self):
        self.assertEqual(_detect_script_lang('Сәлеметсіз бе! Менің шотым қайда?'), 'KZ')
        self.assertEqual(_detect_script_lang('Сәлеметсіз бе! Подскажите, как пополнить счёт?'), 'KZ+RU')
        self.assertEqual(_detect_script_lang('Hello, how can I withdraw funds?'), 'EN')
        self.assertEqual(_detect_script_lang('Здравствуйте, подскажите комиссию'), 'RU')

        kz_dialogue = {
            'language': 'KZ',
            'channel': 'chat',
            'transcript': [
                {'speaker': 'client', 'text': 'Сәлеметсіз бе! Дивиденд қашан түседі?', 'timestamp': '00:02'},
                {'speaker': 'operator', 'text': 'Сәлеметсіз бе! Менің есімім Нұрлан.', 'timestamp': '00:07'}
            ]
        }
        prompt = CQAEvaluator('mock')._build_prompt(kz_dialogue, self.official_criteria)
        self.assertIn('"first_client_message_lang": "KZ"', prompt)
        self.assertIn('"index": 0', prompt)
        self.assertIn('"index": 1', prompt)

    def test_compare_ground_truth_extended_metrics(self):
        truth = [
            {
                'conversation_id': 'dlg_ru',
                'language': 'RU',
                'total_score': 100.0,
                'has_fatal_flaw': False,
                'criteria_results': [
                    {'criterion_id': 'c1', 'score': 1, 'is_na': False},
                    {'criterion_id': 'c3', 'score': 0, 'is_na': True},
                ]
            },
            {
                'conversation_id': 'dlg_kz',
                'language': 'KZ',
                'total_score': 80.0,
                'has_fatal_flaw': True,
                'criteria_results': [
                    {'criterion_id': 'c1', 'score': 1, 'is_na': False},
                    {'criterion_id': 'c3', 'score': 0, 'is_na': False},
                ]
            }
        ]
        preds = [
            {
                'conversation_id': 'dlg_ru',
                'language': 'RU',
                'total_score': 98.0,
                'has_fatal_flaw': False,
                'criteria_results': [
                    {'criterion_id': 'c1', 'score': 1, 'is_na': False, 'needs_review': False},
                    {'criterion_id': 'c3', 'score': 0, 'is_na': True, 'needs_review': False},
                ]
            },
            {
                'conversation_id': 'dlg_kz',
                'language': 'KZ',
                'total_score': 80.0,
                'has_fatal_flaw': True,
                'criteria_results': [
                    {'criterion_id': 'c1', 'score': 1, 'is_na': False, 'needs_review': False},
                    {'criterion_id': 'c3', 'score': 0, 'is_na': False, 'needs_review': False},
                ]
            }
        ]
        report = compare(truth, preds)
        self.assertEqual(report['dialogs'], 2)
        self.assertEqual(report['criterion_exact_accuracy'], 1.0)
        self.assertEqual(report['coverage'], 1.0)
        self.assertEqual(report['fatal_exact_accuracy'], 1.0)
        self.assertEqual(report['total_score_mae'], 1.0)
        self.assertEqual(report['within_5pt_accuracy'], 1.0)
        self.assertEqual(report['na_metrics']['f1'], 1.0)
        self.assertEqual(report['fatal_metrics']['f1'], 1.0)
        self.assertEqual(report['per_language_accuracy']['KZ']['criterion_exact_accuracy'], 1.0)
        self.assertEqual(report['per_criterion_accuracy']['c1']['exact_accuracy'], 1.0)

    def test_missing_fatal_flag_not_counted_as_correct(self):
        truth = [{'conversation_id': 'x', 'has_fatal_flaw': False, 'criteria_results': []}]
        report = compare(truth, [{'conversation_id': 'x'}])
        self.assertEqual(report['fatal_exact_accuracy'], 0)
        self.assertIn('total_score_MAE', report)

    def test_review_fatal_flag_not_counted_as_correct(self):
        truth = [{'conversation_id': 'x', 'has_fatal_flaw': False, 'criteria_results': []}]
        pred = [{'conversation_id': 'x', 'has_fatal_flaw': False, 'criteria_results': [{'criterion_id': 'c8', 'needs_review': True}]}]
        self.assertEqual(compare(truth, pred)['fatal_exact_accuracy'], 0)

    def test_client_quote_not_invented_for_absent_fatal_evidence(self):
        rows = [{'criterion_id': 'c8', 'score': 0, 'is_na': False, 'explanation': 'No violations', 'quote': '', 'evidence_index': -1, 'needs_review': False}]
        criteria = [{'id': 'c8', 'is_fatal': True, 'weight': 0, 'fatal_on_score': 1}]
        dialogue = {'transcript': [{'speaker': 'client', 'text': 'Client only', 'timestamp': '00:01'}]}
        result = CQAEvaluator('mock')._validate_evidence(rows, dialogue, criteria)
        self.assertTrue(result[0]['needs_review'])
        self.assertEqual(result[0]['quote'], '')

    def test_russian_bar_not_kazakh(self):
        self.assertEqual(_detect_script_lang('Я открыл бар, как пополнить счёт?'), 'RU')


if __name__ == '__main__':
    unittest.main()
