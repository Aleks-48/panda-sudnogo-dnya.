// Local upload does not call organizer APIs and ignores remote audio URLs.
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('btn-import-json');
    const input = document.getElementById('local-json-file');
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        button.disabled = true;
        try {
            if (file.size > 5 * 1024 * 1024) throw new Error('Максимальный размер файла: 5 МБ');
            const body = await file.text();
            JSON.parse(body);
            const response = await checkedFetch('/api/import_local', {method:'POST', headers:{'Content-Type':'application/json'}, body});
            const result = await response.json();
            alert(`Добавлено: ${result.imported_records}. Уже существовали: ${result.skipped_records}. Существующие диалоги не изменены.`);
            await Promise.all([loadStats(), loadDialogues()]);
        } catch (error) { alert(`Импорт не выполнен: ${error.message}`); }
        finally { button.disabled = false; input.value = ''; }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(modal => closeModal(modal.id));
    });
});
