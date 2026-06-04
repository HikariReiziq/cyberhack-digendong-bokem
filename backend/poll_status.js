async function getBody() {
  try {
    const res = await fetch('https://main.d1duzg6kl2wvnh.amplifyapp.com');
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const body = await res.text();
    console.log('Body:', body.slice(0, 3000));
  } catch (e) {
    console.error('Error:', e);
  }
}
getBody();
