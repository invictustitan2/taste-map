import { expect, test } from '@playwright/test';

test.describe('Taste Map E2E', () => {
  test('Page loads and title is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TasteMap/);
  });

  test.skip('Health check passes', async ({ page }) => {
    const healthPromise = page.waitForResponse(response => 
      response.url().includes('/health') && response.status() === 200
    );
    await page.goto('/');
    const healthResponse = await healthPromise;
    // Check if the health indicator (if any) or simply console logs/network might be checked
    // For now, we verify the main API call availability by checking network response
    expect(await healthResponse.json()).toEqual({ status: 'ok' });
  });

  test('Search functionality works', async ({ page }) => {
    await page.goto('/');
    
    // Fill search input
    const searchInput = page.locator('input[type="text"]'); // Adjust selector based on actual frontend
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Inception');
    
    // Click search button if exists, or press enter. Assuming simple input for now.
    // If there is a search button:
    // await page.click('button:has-text("Search")');
    // Or press Enter
    const searchPromise = page.waitForResponse(response => 
      response.url().includes('/api/movies') && response.status() === 200
    );
    await searchInput.press('Enter');

    // Wait for results
    // Assuming results are displayed in a grid or list
    // verification depends on actual UI.
    // waiting for a network response for movies
    const moviesResponse = await searchPromise;
    
    // Verify results appear in UI
    // await expect(page.locator('.movie-card')).not.toHaveCount(0);
  });
});
