function onFormSubmit(e) {
  try {
    // メールアドレスを取得（フォーム設定「回答者からの入力」の場合）
    const email = e.response.getRespondentEmail();

    if (!email) {
      Logger.log('メールアドレスが見つかりません');
      return;
    }

    Logger.log('メールアドレス取得: ' + email);

    const subject = "【Delightlink】お問い合わせありがとうございます";
    const body = `お問い合わせありがとうございます。

内容を確認次第、ご連絡させていただきます。
今しばらくお待ちください。
もし、3日経っても連絡がない場合はお手数ですが、以下メールアドレスまでお問い合わせください。
kazuhiro.ando.co@gmail.com

このメールは自動送信されています。

---
Delightlink
代表　安藤　和宏
kazuhiro.ando.co@gmail.com`;

    GmailApp.sendEmail(email, subject, body);
    Logger.log('メール送信成功: ' + email);

  } catch (error) {
    Logger.log('エラー: ' + error.toString());
  }
}
