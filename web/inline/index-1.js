document.documentElement.classList.add('js');
// If Supabase redirected us here with a password-recovery hash (the reset
// email lands on Site URL by default), forward to the dedicated page.
if (location.hash && /type=recovery/.test(location.hash)) {
  location.replace('/reset-password.html' + location.hash);
}
