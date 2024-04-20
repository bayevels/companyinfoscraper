const puppeteer = require('puppeteer');
const ObjectsToCsv = require('objects-to-csv');

async function createNewPage(browser) {
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (
      request.resourceType() === 'stylesheet' ||
      request.resourceType() === 'script' ||
      request.resourceType() === 'image'
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });

  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await createNewPage(browser);

  // Navigate to the initial page
  await page.goto('https://www.goafricaonline.com/ci/annuaire/organisations-non-gouvernementales-ong', {
    timeout: 100000
  });

  let hasNextPage = true;
  let pageNum = 1;
  const data = [];

  while (hasNextPage) {
    console.log('Scraping page', pageNum);

    // Get list of elements to click
    const elementHandles = await page.$$('article');

    for (const elementHandle of elementHandles) {
      // Click on each element
      const linkHandle = await elementHandle.$('a[href]');
      const url = await page.evaluate(link => link.href, linkHandle);

      // Open link in a new page with the same configurations
      const newPage = await createNewPage(browser);
      await newPage.goto(url, {
        waitUntil: 'domcontentloaded'
      });

      // Scraping data from the new page
      const newData = await newPage.evaluate(() => {
        // Customize this function to extract data from the new page

        // Name, Address, phone, type, phones, description
        const title = document.querySelector('.text-24.ls\\:text-32.text-black.m-0.mb-3.font-bold.leading-snug').textContent.trim();
        const descriptionElement = document.querySelector('#short-description');
        const description = descriptionElement ? descriptionElement.textContent.trim() : '';
        const element = document.querySelector('.p-10.border-b.border-gray-300.last\\:border-none');
        var coordinates = '';
        var phoneNumbers = [];
        const url = document.location.href;

        if (element) {
          // Extract coordinates
          const coordinatesHeader = element.querySelector('#coordonnees');
          const coordinatesContainer = coordinatesHeader ? coordinatesHeader.nextElementSibling : null;
          coordinates = coordinatesContainer ? coordinatesContainer.querySelector('address').textContent.trim() : '';

          // Extract phone numbers
          const phoneNumberElements = coordinatesContainer ? coordinatesContainer.querySelectorAll('a[href^="tel:"]') : [];

          phoneNumberElements.forEach(phoneNumberElement => {
            const href = phoneNumberElement.getAttribute('href');
            if (href) {
              const phoneNumber = href.replace('tel:', '').trim();
              phoneNumbers.push(phoneNumber);
            }
          });

          console.log('Phone Numbers:', phoneNumbers);

        } else {
          console.log('Element not found.');
        }


        return {
          title,
          description,
          coordinates,
          phoneNumbers,
          url
        };
      });
      // Push scraped data to array
      data.push(newData);

      console.log(newData);

      // Close the new page
      await newPage.close();
    }

    // Check if there's a next page
    const nextPageButton = await page.$('a[rel="next"]');

    if (nextPageButton) {
      pageNum++;
      console.log(nextPageButton.href)
      await nextPageButton.click();
      await page.waitForNavigation();
    } else {
      hasNextPage = false;
    }
  }

  // Save the data to a CSV file
  const csv = new ObjectsToCsv(data);
  await csv.toDisk('./output.csv');

  console.log('Data saved to output.csv');

  await browser.close();

})();