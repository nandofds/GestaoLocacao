import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

await mkdir('artifacts', { recursive: true })
const browser = await chromium.launch()
const errors = []

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 })
desktop.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
desktop.on('pageerror', error => errors.push(error.message))
await desktop.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
await desktop.screenshot({ path: 'artifacts/dashboard-1440x1024.png', fullPage: true })
await desktop.getByRole('button', { name: 'App operacional' }).click()
await desktop.getByRole('button', { name: 'Bipar retorno' }).click()
await desktop.getByRole('button', { name: 'Ler próximo item' }).click()
await desktop.getByText(/conferido com sucesso/).waitFor()

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
mobile.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
mobile.on('pageerror', error => errors.push(error.message))
await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
await mobile.screenshot({ path: 'artifacts/mobile-home-390x844.png', fullPage: true })
await mobile.getByRole('button', { name: 'Bipar retorno' }).click()
await mobile.screenshot({ path: 'artifacts/mobile-return-390x844.png', fullPage: true })
await mobile.getByRole('button', { name: 'Ler próximo item' }).click()
await mobile.getByText(/conferido com sucesso/).waitFor()
await mobile.getByRole('button', { name: 'Voltar' }).click()
await mobile.getByRole('button', { name: 'Meus eventos' }).click()
await mobile.getByText('Congresso Tech 2025').waitFor()

console.log(JSON.stringify({ title: await desktop.title(), errors, screenshots: 3 }, null, 2))
await browser.close()
