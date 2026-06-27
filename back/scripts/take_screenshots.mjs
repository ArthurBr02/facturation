import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Helper to wait/sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickTab(page, tabLabel) {
  const buttons = await page.$$('button');
  for (const button of buttons) {
    const text = await page.evaluate(el => el.textContent.trim(), button);
    if (text.toLowerCase().includes(tabLabel.toLowerCase())) {
      await button.click();
      await sleep(1500);
      return true;
    }
  }
  return false;
}

async function main() {
  const screenshotsDir = './screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set high-DPI Retina viewport for ultra-crisp screenshots (perfect for Malt portfolio)
  await page.setViewport({
    width: 1440,
    height: 900,
    deviceScaleFactor: 2
  });

  console.log('Navigating to login page...');
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Capture Login screen
  console.log('Taking Login screenshot...');
  await page.screenshot({ path: path.join(screenshotsDir, '00_login.png') });

  // Log in
  console.log('Logging in...');
  await page.waitForSelector('#email');
  await page.type('#email', 'admin@example.com');
  await page.type('#password', 'admin');
  await page.click('button[type="submit"]');

  // Wait for redirect and data loading
  await sleep(4000);

  // 1. Dashboard Page
  console.log('Taking Dashboard screenshot...');
  await page.screenshot({ path: path.join(screenshotsDir, '01_dashboard.png') });

  // 2. Documents - Factures
  console.log('Taking Documents (Factures) screenshot...');
  await page.goto('http://localhost:8080/documents', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await clickTab(page, 'Factures');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '02_documents_factures.png') });

  // 3. Documents - Devis
  console.log('Taking Documents (Devis) screenshot...');
  await clickTab(page, 'Devis');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '03_documents_devis.png') });

  // 4. Documents - Contrats
  console.log('Taking Documents (Contrats) screenshot...');
  await clickTab(page, 'Contrats');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '04_documents_contrats.png') });

  // 5. Devis Detail/Edit (DEV-2026-001 - id 7)
  console.log('Taking Devis Detail screenshot...');
  await page.goto('http://localhost:8080/documents/devis/7', { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.screenshot({ path: path.join(screenshotsDir, '05_devis_detail.png') });

  // 6. Facture Detail/Edit (FAC-2026-003 - id 13 - Stark)
  console.log('Taking Facture Detail (Stark) screenshot...');
  await page.goto('http://localhost:8080/documents/factures/13', { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.screenshot({ path: path.join(screenshotsDir, '06_facture_detail_stark.png') });

  // 6b. Facture Detail/Edit (FAC-2026-004 - id 14 - Globex, overdue/finalised)
  console.log('Taking Facture Detail (Globex - overdue) screenshot...');
  await page.goto('http://localhost:8080/documents/factures/14', { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.screenshot({ path: path.join(screenshotsDir, '06_facture_detail_globex.png') });

  // 7. Contrat Detail/Edit (MNT-2026-001 - id 2)
  console.log('Taking Contrat Detail screenshot...');
  await page.goto('http://localhost:8080/documents/contrats/2', { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.screenshot({ path: path.join(screenshotsDir, '07_contrat_detail.png') });

  // 8. Clients List
  console.log('Taking Clients List screenshot...');
  await page.goto('http://localhost:8080/clients', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(screenshotsDir, '08_clients_list.png') });

  // 9. Client Detail 360 (Acme - id 7)
  console.log('Taking Client Detail 360 screenshot...');
  await page.goto('http://localhost:8080/clients/7', { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.screenshot({ path: path.join(screenshotsDir, '09_client_detail_360.png') });

  // 10. Produits List
  console.log('Taking Products List screenshot...');
  await page.goto('http://localhost:8080/produits', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(screenshotsDir, '10_produits_list.png') });

  // 11. Rapports - Seuils
  console.log('Taking Rapports (Seuils) screenshot...');
  await page.goto('http://localhost:8080/rapports', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await clickTab(page, 'Seuils');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '11_rapports_seuils.png') });

  // 12. Rapports - URSSAF
  console.log('Taking Rapports (URSSAF) screenshot...');
  await clickTab(page, 'URSSAF');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '12_rapports_urssaf.png') });

  // 13. Rapports - CA Mensuel
  console.log('Taking Rapports (CA Mensuel) screenshot...');
  await clickTab(page, 'CA mensuel');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '13_rapports_ca_mensuel.png') });

  // 14. Rapports - Livre des Recettes
  console.log('Taking Rapports (Livre des recettes) screenshot...');
  await clickTab(page, 'Livre des recettes');
  await sleep(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '14_rapports_livre_recettes.png') });

  // 15. Templates Page
  console.log('Taking Templates screenshot...');
  await page.goto('http://localhost:8080/templates', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(screenshotsDir, '15_templates.png') });

  // 16. Settings Page
  console.log('Taking Settings screenshot...');
  await page.goto('http://localhost:8080/settings', { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(screenshotsDir, '16_settings.png') });

  console.log('Closing browser...');
  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Error taking screenshots:', err);
  process.exit(1);
});
