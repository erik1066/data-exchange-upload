import { expect, test } from '@playwright/test';
import {
    SMALL_FILENAME,
    getFileSelection,
  } from '../resources/test-utils';
  
const cookieName = "phdo_session"
const pages = [
    {
        pageName: "root UI page",
        path: "/",
        expectedRedirect: ""
    },
    {
        pageName: "login page",
        path: "/login",
        expectedRedirect: ""
    },
    {
        pageName: "manifest page",
        path: "/manifest?data_stream_id=dextesting&data_stream_route=testevent1",
        expectedRedirect: "/manifest?data_stream_id=dextesting&data_stream_route=testevent1"
    },
    {
        pageName: "status page",
        path: "/status/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    }
]

test.describe('Upload API Auth UI Elements', () => {
    pages.forEach(({ pageName, path }) => {
        test(`requires a token for ${pageName}`, async ({ page, baseURL }) => {
            await page.goto(path)

            await expect(page.getByRole('heading', {name: "Welcome to PHDO Upload Login"})).toBeVisible()
            await expect(page.getByRole('textbox', {name: "Authentication Token *"})).toBeVisible()
            await expect(page.getByRole('button', {name: "Login"})).toBeVisible()
            
            expect(page.url()).toBe(`${baseURL}/login`)
        })

    })
})

test.describe('Upload API Auth', () => {
    let token: any
    let expiredToken: any
    let scopesToken: any

    const cookieDomain = process.env.SERVER_URL !== undefined ? new URL(process.env.SERVER_URL).hostname : "localhost"

    test.beforeAll(async ({ request }) => {
        const res = await request.get('http://localhost:3000/token')
        const json = await res.json()
        token = json.access_token

        const resExpired = await request.get('http://localhost:3000/token-expired')
        const jsonExpired = await resExpired.json()
        expiredToken = jsonExpired.access_token

        const resScopes = await request.get('http://localhost:3000/token-scopes')
        const jsonScopes = await resScopes.json()
        scopesToken = jsonScopes.access_token
    })

    test.describe('redirect', () => {
        pages.filter(p => p.expectedRedirect != undefined).forEach(({ pageName, path, expectedRedirect }) => {
            test(`redirects to ${pageName}`, async ({ page, baseURL, browser }) => {
                await page.goto(path)
    
                await expect(page.getByRole('heading', {name: "Welcome to PHDO Upload Login"})).toBeVisible()
                await expect(page.getByRole('textbox', {name: "Authentication Token *"})).toBeVisible()
                await expect(page.getByRole('button', {name: "Login"})).toBeVisible()
                
                expect(page.url()).toBe(`${baseURL}/login`)

                await page.getByRole('textbox', { name: "Authentication Token *" }).fill(token)
                await page.getByRole('button', { name: 'Login' }).click()
                await page.waitForURL(expectedRedirect)
                const cookies = await browser.contexts()[0].cookies()
                const cookie = cookies.find(({ name }) =>  name === cookieName )
                expect(cookie).not.toBeUndefined()
            })
    
        })
    })
    
    test('logs in with a valid token through the login page', async ({ browser, page }) => {
        await page.goto('/')  
        await page.getByRole('textbox', { name: "Authentication Token *" }).fill(token)
        await page.getByRole('button', { name: 'Login' }).click()
        await page.waitForURL("/")
        await expect(page.getByRole('heading', { name: 'Welcome to DEX Upload' })).toBeVisible({timeout: 12000})
        await expect(page.getByText("Start the upload process by entering a data stream and route.")).toBeVisible()
        const cookies = await browser.contexts()[0].cookies()
        const cookie = cookies.find(({ name }) =>  name === cookieName )
        expect(cookie).not.toBeUndefined()
    })

    test('cannot log in with an invalid token through the login page', async ({ page }) => {
        await page.goto('/')  
        await page.getByRole('textbox', { name: "Authentication Token *" }).fill("badtoken")
        await page.getByRole('button', { name: 'Login' }).click()
        await expect(page.url()).toContain("/login")
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })

    test('cannot log in with an expired token through the login page', async ({ page }) => { 
        await page.goto('/')  
        await page.getByRole('textbox', { name: "Authentication Token *" }).fill(expiredToken)
        await page.getByRole('button', { name: 'Login' }).click()
        await expect(page.url()).toContain("/login")
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })

    test('cannot log in with invalid scopes on token through the login page', async ({ page }) => {
        await page.goto('/')  
        await page.getByRole('textbox', { name: "Authentication Token *" }).fill(scopesToken)
        await page.getByRole('button', { name: 'Login' }).click()
        await expect(page.url()).toContain("/login")
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })
    
    test('cannot log in with a forged cookie', async ({ browser }) => {
        const cookies = [{
            name: cookieName,
            value: token,
            domain: cookieDomain,
            path: "/",
            expires: Math.floor(Date.now() / 1000) + 3600,
            httpOnly: true,
            secure: false,
            sameSite: "Lax" as const
        }]
        const context = await browser.newContext();
        context.addCookies(cookies)
        const page = await context.newPage();
        await page.goto('/');
        await expect(page.url()).toContain("/login")
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })

    test('cannot log in with an expired cookie token', async ({browser}) => {
        const cookies = [{
            name: cookieName,
            value: token,
            domain: cookieDomain,
            path: "/",
            expires: Math.floor(Date.now() / 1000) - 1,
            httpOnly: true,
            secure:  false,
            sameSite: "Lax" as const
        }]
        const context = await browser.newContext();
        context.addCookies(cookies)
        const page = await context.newPage();
        await page.goto('/');
        await expect(page.url()).toContain("/login")
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })

    test('cannot log in with an invalid cookie token', async ({browser}) => {
        const cookies = [{
            name: cookieName,
            value: "badtoken",
            domain: cookieDomain,
            path: "/",
            expires: Math.floor(Date.now() / 1000) + 3600,
            httpOnly: true,
            secure: false,
            sameSite: "Lax" as const
        }]
        const context = await browser.newContext();
        context.addCookies(cookies)
        const page = await context.newPage();
        await page.goto('/');
        await expect(page.url()).toContain("/login")
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })

    test('can log in and perform an upload', async ({ page }) => {
        const dataStream = "dextesting"
        const route = "testevent1"
        const fileSelection = getFileSelection(SMALL_FILENAME);

        await page.goto(`/`);
        await page.getByRole('textbox', { name: "Authentication Token *" }).fill(token)
        await page.getByRole('button', { name: 'Login' }).click()
        await page.getByLabel('Data Stream', { exact: true }).fill(dataStream);
        await page.getByLabel('Data Stream Route').fill(route);
        await page.getByRole('button', { name: /next/i }).click();
        const textBoxes = await page.getByRole('textbox').all();
        for (const textbox of textBoxes) {
        await textbox.fill('Test');
        }
        await page.getByRole('button', { name: /next/i }).click();

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Browse Files' }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(fileSelection);

        await expect(page.getByText('Upload Status: Complete')).toBeVisible({ timeout: 20000 });

        const logoutButton = page.getByRole('link', {name: "Logout"})
        await expect(logoutButton).toBeVisible()
        await logoutButton.click()
        await page.goto('/');
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })

    test('can log out after logging in', async ({ page, browser }) => {
        await page.goto(`/`);
        await page.getByRole('textbox', { name: "Authentication Token *" }).fill(token)
        await page.getByRole('button', { name: 'Login' }).click()
        const logoutButton = page.getByRole('link', {name: "Logout"})
        await expect(logoutButton).toBeVisible()
        await logoutButton.click()
        await page.goto(`/`);
        await expect(page.getByText("Welcome to PHDO Upload Login")).toBeVisible()
    })
})

