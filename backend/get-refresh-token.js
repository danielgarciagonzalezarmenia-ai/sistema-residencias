const http = require('http');
const url = require('url');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function run() {
  console.log('========================================================');
  console.log('🔑 GENERADOR DE REFRESH TOKEN DE GOOGLE OAUTH2 (GMAIL API)');
  console.log('========================================================');
  console.log('\nAntes de comenzar, asegúrate de haber creado tu proyecto en Google Cloud');
  console.log('y haber creado un "ID de cliente de OAuth" para "Aplicación web"');
  console.log('con la URI de redireccionamiento autorizada establecida en:');
  console.log('👉 http://localhost:3000\n');

  const clientId = (await askQuestion('1. Ingresa tu GOOGLE_CLIENT_ID: ')).trim();
  const clientSecret = (await askQuestion('2. Ingresa tu GOOGLE_CLIENT_SECRET: ')).trim();

  if (!clientId || !clientSecret) {
    console.error('❌ Error: El Client ID y el Client Secret son obligatorios.');
    rl.close();
    process.exit(1);
  }

  // Generar la URL de autorización
  const scope = 'https://www.googleapis.com/auth/gmail.send';
  const redirectUri = 'http://localhost:3000';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  console.log('\n========================================================');
  console.log('🌐 PASO 3: ABRE EL SIGUIENTE ENLACE EN TU NAVEGADOR');
  console.log('========================================================\n');
  console.log(authUrl);
  console.log('\nInicia sesión con la cuenta de Gmail desde donde se enviarán los correos');
  console.log('y otorga los permisos correspondientes.');
  console.log('Si te sale un aviso de "Aplicación no verificada", haz clic en "Configuración avanzada" > "Ir a ... (no seguro)".\n');
  console.log('Esperando redirección en http://localhost:3000 ...\n');

  // Iniciar servidor local en el puerto 3000
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      const code = parsedUrl.query.code;

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Error: No se recibió el código de autorización</h1>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>¡Autorización exitosa! Puedes volver a la consola de comandos.</h1>');
      server.close();

      console.log('⚡ Interceptado código de autorización de Google.');
      console.log('Exchanging code for tokens...');

      // Intercambiar código por tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('\n❌ Error intercambiando el código de autorización:');
        console.error(tokenData);
        rl.close();
        process.exit(1);
      }

      console.log('\n========================================================');
      console.log('🎉 ¡CREDENCIALES OBTENIDAS CON ÉXITO!');
      console.log('========================================================\n');
      console.log(`🔑 GOOGLE_CLIENT_ID:`);
      console.log(clientId);
      console.log(`\n🔑 GOOGLE_CLIENT_SECRET:`);
      console.log(clientSecret);
      console.log(`\n🔑 GOOGLE_REFRESH_TOKEN (Guarda esto de forma segura):`);
      console.log(tokenData.refresh_token);
      console.log('\n========================================================');
      console.log('Ahora copia estas 3 variables y agrégalas en tu panel de Render.');
      console.log('========================================================\n');

      rl.close();
      process.exit(0);

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Error del servidor local</h1><p>${err.message}</p>`);
      console.error('Error en el servidor local:', err);
      rl.close();
      process.exit(1);
    }
  });

  server.listen(3000, () => {
    // Servidor activo
  });
}

run().catch(err => {
  console.error(err);
  rl.close();
});
