"""Offline comparison only; never calls a model or uploads dialogues.
Usage: python scripts/compare_ground_truth.py truth.json predictions.json
Both files: list of {conversation_id, total_score, has_fatal_flaw,
criteria_results:[{criterion_id,score,is_na,needs_review?}]}.
Missing/abstained predictions count as incorrect, not silently dropped.
"""
import json, sys

def compare(truth, predictions):
    def index(items,key):
        out={r[key]:r for r in items}
        if len(out)!=len(items): raise ValueError('Duplicate '+key)
        return out
    index(truth,'conversation_id')
    pred=index(predictions,'conversation_id'); correct=total=covered=fatal=0; errors=[]
    for expected in truth:
        actual=pred.get(expected['conversation_id'],{})
        by_id=index(actual.get('criteria_results',[]),'criterion_id')
        for row in expected['criteria_results']:
            total+=1; got=by_id.get(row['criterion_id'])
            if got and not got.get('needs_review'):
                covered+=1
                correct+=int(bool(got.get('is_na'))==bool(row.get('is_na')) and (row.get('is_na') or got.get('score')==row.get('score')))
        if actual and actual.get('has_fatal_flaw')==expected.get('has_fatal_flaw'): fatal+=1
        if expected.get('total_score') is not None and actual.get('total_score') is not None:
            errors.append(abs(actual['total_score']-expected['total_score']))
    return {'dialogs':len(truth),'criterion_exact_accuracy':correct/total if total else None,
            'coverage':covered/total if total else None,'fatal_exact_accuracy':fatal/len(truth) if truth else None,
            'total_score_MAE':sum(errors)/len(errors) if errors else None,'scored_dialogs':len(errors),
            'warning':'MAE excludes missing totals; inspect coverage and scored_dialogs. This is not an official leaderboard metric.'}

if __name__=='__main__':
    with open(sys.argv[1]) as f: truth=json.load(f)
    with open(sys.argv[2]) as f: predictions=json.load(f)
    print(json.dumps(compare(truth,predictions),ensure_ascii=False,indent=2))
