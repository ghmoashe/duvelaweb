// Friend-duel invites (vela.cafe/app.html?friend=CODE) reach the browser when the
// Hub app did not take the universal link (app not installed, or an in-app browser
// such as WhatsApp/Telegram). Forward to the bridge page before the auth redirect runs.
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    if (!params.get('friend')) return;
    window.location.replace('./duel-invite.html' + window.location.search);
  } catch (error) {
    // Ignore: the normal app flow continues.
  }
})();
