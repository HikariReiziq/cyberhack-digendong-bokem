async function test() {
  const url = 'http://localhost:4000/api/floor-plan-upload';
  
  // A tiny 1x1 transparent PNG in base64
  const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const buffer = Buffer.from(base64Image, 'base64');
  
  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: 'image/png' }), 'floor_plan.png');
  
  try {
    console.log('Sending upload request to local backend...');
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    console.log('Status:', res.status, res.statusText);
    const data = await res.json();
    console.log('Response:', data);
  } catch (e) {
    console.error('Error calling local backend:', e);
  }
}

test();
