// Synthetic examples; each record uses the organizer's transcript schema.
window.demoRecords = [
  {
    conversation_id: "FB-RU-024",
    title: "Доставка карты в Астане",
    language: "RU",
    channel: "agent chat",
    audio_url: null,
    transcript: [
      ["00:00", "client", "Здравствуйте! Заказала карту с доставкой. Завтра буду в офисе. Можно поменять адрес и узнать, когда приедет курьер?"],
      ["00:14", "operator", "Здравствуйте! Меня зовут Алия. В приложении у заказа уже появился статус «Передан курьеру»?"],
      ["00:39", "client", "Пока написано «Готовится к доставке». Боюсь, курьер поедет домой."],
      ["01:02", "operator", "Понимаю, неудобно ждать курьера по старому адресу. Откройте заказ в приложении, нажмите «Изменить адрес» и укажите адрес офиса."],
      ["01:46", "client", "Готово, адрес обновился. А в котором часу его ждать?"],
      ["02:18", "operator", "Курьер свяжется с вами."],
      ["02:36", "client", "Понятно, спасибо."],
      ["02:51", "operator", "Адрес доставки обновлён. Если появятся вопросы, напишите нам. До свидания!"]
    ]
  },
  {
    conversation_id: "FB-KZ-015",
    title: "Қолданбаның тілін өзгерту",
    channel: "agent chat",
    language: "KZ",
    audio_url: null,
    transcript: [
      ["00:00", "client", "Сәлеметсіз бе! Қолданбаның тілін қазақшаға қалай ауыстырамын?"],
      ["00:08", "bot", "Сізді маманға қосып жатырмыз."],
      ["00:23", "operator", "Сәлеметсіз бе! Менің атым Айдана. Профильге кіріп, «Тіл» бөлімінен «Қазақша» нұсқасын таңдаңыз."],
      ["00:55", "client", "Таптым, рақмет!"],
      ["01:09", "operator", "Тағы сұрағыңыз болса, жазыңыз. Сау болыңыз!"]
    ]
  },
  {
    conversation_id: "FB-EN-008",
    title: "Unrecognized card payment",
    channel: "agent chat",
    language: "EN",
    audio_url: null,
    transcript: [
      ["00:00", "client", "Hi, there is a payment on my card that I don't recognize. I'm worried."],
      ["00:18", "operator", "Hello! My name is Dan. I understand how worrying an unfamiliar payment is. Please freeze your card in the app while we check."],
      ["00:54", "client", "Done. Can you check the transaction for me?"],
      ["01:09", "operator", "Please confirm your identity using the secure prompt in the app. Please don't share any codes here."],
      ["01:51", "system", "Identity verification completed successfully."],
      ["02:04", "operator", "Open the payment in your history and select Report a problem. Our team will review your dispute and send an update in the app."],
      ["02:45", "client", "I've submitted it. Thank you."],
      ["02:59", "operator", "You're welcome. Your card is frozen and the report has been submitted. Please contact us if you need further help. Goodbye!"]
    ]
  }
].map(record => ({
  ...record,
  transcript: record.transcript.map(([timestamp, speaker, text]) => ({timestamp, speaker, text}))
}));
