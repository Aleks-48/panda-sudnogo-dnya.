"""Offline comparison only; never calls a model or uploads dialogues.
Usage: python scripts/compare_ground_truth.py truth.json predictions.json
Both files: list of {conversation_id, language?, total_score, has_fatal_flaw,
criteria_results:[{criterion_id, score, is_na, needs_review?}]}.
Missing/abstained predictions count as incorrect, not silently dropped.
"""
import json
import math
import sys


def _prf1(tp: int, fp: int, fn: int):
    precision = tp / (tp + fp) if (tp + fp) > 0 else None
    recall = tp / (tp + fn) if (tp + fn) > 0 else None
    f1 = (2 * precision * recall / (precision + recall)) if (precision and recall) else (0.0 if (tp + fp + fn) > 0 else None)
    return {
        "precision": round(precision, 4) if precision is not None else None,
        "recall": round(recall, 4) if recall is not None else None,
        "f1": round(f1, 4) if f1 is not None else None,
        "tp": tp, "fp": fp, "fn": fn
    }


def compare(truth, predictions):
    def index(items, key):
        out = {r[key]: r for r in items}
        if len(out) != len(items):
            raise ValueError('Duplicate ' + key)
        return out

    index(truth, 'conversation_id')
    pred = index(predictions, 'conversation_id')
    correct = total = covered = fatal = 0
    errors = []
    sq_errors = []
    within_5pt = 0

    per_crit_stats = {}
    per_lang_stats = {}
    na_tp = na_fp = na_fn = 0
    fatal_tp = fatal_fp = fatal_fn = 0

    for expected in truth:
        actual = pred.get(expected['conversation_id'], {})
        lang = expected.get('language') or actual.get('language') or 'UNKNOWN'
        lang_bucket = per_lang_stats.setdefault(lang, {'correct': 0, 'total': 0, 'covered': 0, 'errors': []})

        by_id = index(actual.get('criteria_results', []), 'criterion_id')
        for row in expected['criteria_results']:
            cid = row['criterion_id']
            c_bucket = per_crit_stats.setdefault(cid, {'correct': 0, 'total': 0, 'covered': 0})
            total += 1
            c_bucket['total'] += 1
            lang_bucket['total'] += 1

            exp_na = bool(row.get('is_na'))
            got = by_id.get(cid)
            if got and not got.get('needs_review'):
                covered += 1
                c_bucket['covered'] += 1
                lang_bucket['covered'] += 1
                got_na = bool(got.get('is_na'))
                score_match = (
                    got.get('score') is not None
                    and row.get('score') is not None
                    and round(float(got.get('score')), 2) == round(float(row.get('score')), 2)
                )
                is_match = int(got_na == exp_na and (exp_na or score_match))
                correct += is_match
                c_bucket['correct'] += is_match
                lang_bucket['correct'] += is_match

                if exp_na and got_na:
                    na_tp += 1
                elif not exp_na and got_na:
                    na_fp += 1
                elif exp_na and not got_na:
                    na_fn += 1
            else:
                if exp_na:
                    na_fn += 1

        exp_fatal = bool(expected.get('has_fatal_flaw'))
        fatal_valid = type(actual.get('has_fatal_flaw')) is bool and not actual.get('needs_review', False)
        fatal_row = by_id.get('c8', {})
        fatal_valid = fatal_valid and not fatal_row.get('needs_review', False)
        got_fatal = actual.get('has_fatal_flaw') if fatal_valid else None
        if fatal_valid and got_fatal == exp_fatal:
            fatal += 1
        if exp_fatal and (actual and got_fatal):
            fatal_tp += 1
        elif not exp_fatal and (actual and got_fatal):
            fatal_fp += 1
        elif exp_fatal and not (actual and got_fatal):
            fatal_fn += 1

        if expected.get('total_score') is not None and actual.get('total_score') is not None:
            diff = abs(float(actual['total_score']) - float(expected['total_score']))
            errors.append(diff)
            sq_errors.append(diff * diff)
            lang_bucket['errors'].append(diff)
            if diff <= 5.0:
                within_5pt += 1

    per_criterion_accuracy = {
        cid: {
            "exact_accuracy": round(b['correct'] / b['total'], 4) if b['total'] else None,
            "coverage": round(b['covered'] / b['total'], 4) if b['total'] else None,
            "total": b['total']
        }
        for cid, b in sorted(per_crit_stats.items())
    }
    per_language_accuracy = {
        lg: {
            "criterion_exact_accuracy": round(b['correct'] / b['total'], 4) if b['total'] else None,
            "coverage": round(b['covered'] / b['total'], 4) if b['total'] else None,
            "total_score_mae": round(sum(b['errors']) / len(b['errors']), 4) if b['errors'] else None
        }
        for lg, b in sorted(per_lang_stats.items())
    }

    return {
        'dialogs': len(truth),
        'criterion_exact_accuracy': correct / total if total else None,
        'coverage': covered / total if total else None,
        'fatal_exact_accuracy': fatal / len(truth) if truth else None,
        'total_score_mae': sum(errors) / len(errors) if errors else None,
        'total_score_MAE': sum(errors) / len(errors) if errors else None,
        'total_score_rmse': math.sqrt(sum(sq_errors) / len(sq_errors)) if sq_errors else None,
        'within_5pt_accuracy': within_5pt / len(errors) if errors else None,
        'scored_dialogs': len(errors),
        'na_metrics': _prf1(na_tp, na_fp, na_fn),
        'fatal_metrics': _prf1(fatal_tp, fatal_fp, fatal_fn),
        'per_criterion_accuracy': per_criterion_accuracy,
        'per_language_accuracy': per_language_accuracy,
        'warning': 'MAE excludes missing totals; inspect coverage and scored_dialogs. This is not an official leaderboard metric.'
    }


if __name__ == '__main__':
    with open(sys.argv[1]) as f:
        truth = json.load(f)
    with open(sys.argv[2]) as f:
        predictions = json.load(f)
    print(json.dumps(compare(truth, predictions), ensure_ascii=False, indent=2))
