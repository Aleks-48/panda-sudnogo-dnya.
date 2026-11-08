"""Run with local uvicorn on :8765 and a disposable synthetic-only DB."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto('http://127.0.0.1:8765')
    page.locator('.dialogue-item').first.click()
    page.locator('#btn-run-eval').click()
    page.locator('.crit-card').first.wait_for()
    page.locator('.btn-appeal').first.click()
    page.locator('#appeal-comment').fill('Synthetic browser review')
    page.locator('#btn-confirm-appeal').click()
    page.locator('#appeal-modal').wait_for(state='hidden')
    page.locator('[data-tab="appeals-tab"]').click()
    page.get_by_role('button',name='Рассмотреть').first.click()
    page.locator('#review-new-score').fill('1')
    page.locator('#review-comment').fill('Synthetic verified')
    page.locator('#btn-save-decision').click()
    page.locator('#decision-modal').wait_for(state='hidden')
    page.locator('[data-tab="checklist-tab"]').click()
    page.locator('.criteria-edit-card').first.get_by_role('button',name='Редактировать').click()
    name=page.locator('#edit-crit-name').input_value()
    page.locator('#edit-crit-name').fill(name+" <test> O'Reilly")
    page.locator('#btn-save-criterion').click()
    page.locator('#criterion-modal').wait_for(state='hidden')
    page.locator('.criteria-edit-card').filter(has_text="O'Reilly").get_by_role('button',name='Редактировать').click()
    assert page.locator('#edit-crit-name').input_value()==name+" <test> O'Reilly"
    page.keyboard.press('Escape')
    page.locator('#criterion-modal').wait_for(state='hidden')
    record={'conversation_id':'browser-import','language':'RU','channel':'agent chat','transcript':[{'speaker':'operator','timestamp':'00:01','text':'<img src=x onerror="window.injected=true"> Synthetic'}]}
    page.locator('#local-json-file').set_input_files({'name':'synthetic.json','mimeType':'application/json','buffer':json.dumps([record]).encode()})
    page.wait_for_timeout(500)
    page.locator('[data-tab="dialogues-tab"]').click()
    page.locator('.dialogue-item').filter(has_text='browser-import').click()
    page.locator('.msg-text').first.wait_for()
    assert page.locator('.msg-text img').count()==0
    assert page.evaluate('window.injected') is None
    page.locator('#btn-run-eval').click()
    page.locator('.crit-card').first.wait_for()
    page.screenshot(path='/tmp/cqa-ux.png',full_page=True)
    assert not errors,errors
    print('PASS: import, evaluate, appeal, decision, criterion edit, apostrophes/XSS and Escape; no browser JS errors')
    browser.close()
