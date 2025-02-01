import { test, expect, _electron as electron, Page } from '@playwright/test'
import path from 'path'
import URL from 'url'
import jwt from 'jsonwebtoken'

const __filename = URL.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// const screenshotPath = (name: string) =>
//   path.resolve(__dirname, "screenshot", `${name}.png`);

const generateToken = (
  userId: string = '52177dc0-1a37-426c-b5e1-e9f54e6604a4',
  username: string = 'Don',
  createdAt: string = '2025-01-27T21:32:22.914Z'
) => {
  const payload = {
    userId,
    username,
    createdAt
  }

  return jwt.sign(payload, 'JWT_SECRET_KEY', {
    expiresIn: 24 * 60 * 60 // 1 day
  })
}

// TODO: setup beforeEacn and afterEach hooks

// TODO: do a registration journey

test('launch app', async () => {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../out/main/index.js')],
    env: { E2E_TESTING: 'true' }
  })

  const [, appPackaged] = await electronApp.evaluate(async ({ app }) => {
    return [app.getAppPath(), app.isPackaged]
  })
  expect(appPackaged).toBe(false)

  const window: Page = await electronApp.firstWindow()

  // window.on('console', (msg) => console.log(msg.text()))

  await expect(window).toHaveScreenshot('landing-page.png')

  // Test login form client side validation
  await window.getByTestId('login-submit').click()
  await expect(window).toHaveScreenshot('login-form-errors.png')

  // Test login form unauthorized server response
  await window.route('*/**/api/v1/login', async (route) => {
    await route.fulfill({ status: 401 })
  })
  await window.getByTestId('login-username').fill('don')
  await window.getByTestId('login-password').fill('password')
  await window.getByTestId('login-submit').click()

  await expect(window).toHaveScreenshot('login-unathorized.png')

  const userId = '52177dc0-1a37-426c-b5e1-e9f54e6604a4'
  const authToken = generateToken()

  // Test login form authorized server response, and redirect to list page
  await window.route('*/**/api/v1/login', async (route, request) => {
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        json: {
          id: userId,
          token: authToken
        }
      })
    } else {
      await route.abort()
    }
  })

  await window.route('*/**/api/v1/lists', async (route, request) => {
    if (
      request.method() === 'GET' &&
      request.headers()['authorization'] === `Bearer ${authToken}`
    ) {
      await route.fulfill({
        status: 200,
        json: [
          {
            id: '1cd8f28f-9d01-46dc-bf76-497b2c2432ab',
            user_id: userId,
            name: 'Don lists',
            created_at: '2025-01-31T12:53:06.884Z'
          }
        ]
      })
    } else {
      await route.abort()
    }
  })

  await window.getByTestId('login-submit').click()
  await expect(window).toHaveScreenshot('lists-page.png')

  // Naviate and test todo list page
  const lists = await window.getByRole('main').getByRole('listitem')
  const count = await lists.count()
  expect(count).toBe(1)

  // Naviate and test todo list page

  // TOOD: File bug report for this issue
  // https://github.com/microsoft/playwright/releases/tag/v1.48.0
  // https://playwright.dev/docs/mock#mock-websockets

  // ws://localhost:3000/socket.io/?EIO=4&transport=websocket
  await window.routeWebSocket(/.*/, (ws) => {
    console.log('ws message:', ws)
    ws.onMessage((message) => {
      console.log('ws message:', message)
      ws.send('response')
    })
  })

  await lists.nth(0).getByRole('link').click()

  await window.waitForTimeout(100)
  await expect(window).toHaveScreenshot('list-don_list-page.png')

  // Exit app.
  await electronApp.close()
})
