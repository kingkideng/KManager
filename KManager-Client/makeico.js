const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function run() {
  await sharp('logo.svg').resize(256, 256).png().toFile('logo.png');
  const buf = await pngToIco('logo.png');
  fs.writeFileSync('app.ico', buf);
  console.log('done');
}
run();
