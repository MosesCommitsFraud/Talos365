// Add-in in Office neu anmelden – z. B. nach Änderungen an manifest.xml oder den Menüband-Icons.
// 1. abmelden, 2. Office-Add-in-Cache (Wef) leeren, 3. neu anmelden.
// Office (Word, PowerPoint, Excel) vorher komplett schließen.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd) => {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
  } catch {
    console.log('  (übersprungen)');
  }
};

run('npx office-addin-dev-settings unregister manifest.xml');

const wef = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Office', '16.0', 'Wef');
if (fs.existsSync(wef)) {
  try {
    fs.rmSync(wef, { recursive: true, force: true });
    console.log(`Office-Add-in-Cache geleert: ${wef}`);
  } catch (err) {
    console.log(`Cache konnte nicht geleert werden (läuft Office noch?): ${err.message}`);
  }
}

run('npx office-addin-dev-settings register manifest.xml');

// Office lädt die Menüband-Icons beim Start vom lokalen Server. Läuft er dann nicht,
// zeigt Office ein graues Sechseck – bis zum nächsten Neustart.
const https = require('https');
https
  .get('https://localhost:3000/assets/icon-32.png', { rejectUnauthorized: false, timeout: 3000 }, (res) => {
    res.resume();
    console.log(res.statusCode === 200 ? '\nServer läuft und liefert die Icons. Jetzt Word/PowerPoint/Excel öffnen.' : `\nServer antwortet mit HTTP ${res.statusCode} – „npm.cmd run build“ ausgeführt?`);
  })
  .on('error', () => {
    console.log('\nACHTUNG: Der Server läuft nicht. Erst „npm.cmd start“ (eigenes Fenster), DANN Office öffnen – sonst zeigt das Menüband ein Sechseck statt des Logos.');
  });
