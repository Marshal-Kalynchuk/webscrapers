import puppeteer from 'puppeteer'

export class Puppet {

  constructor(config, devMode = false) {
    /**Configuration of puppeteer */
    if (devMode == true) {
      this.browserArgs = {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: false,
        ignoreHTTPSErrors: true,
        defaultViewport: null
      }
    } else {
      this.browserArgs = {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
        ignoreHTTPSErrors: true,
        defaultViewport: null
      }
    }
    this.config = config
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';
  }
  async init() {
    /**Creates the puppeteer instance */
    try {
      /**Initialze browser */
      const browser = await puppeteer.launch(this.browserArgs)
      const page = await browser.newPage();
      //Randomize viewport size
      await page.setViewport({
        width: 1600 + Math.floor(Math.random() * 100),
        height: 900 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
      });
      await page.setUserAgent(this.userAgent);
      await page.setJavaScriptEnabled(true);
      await page.setDefaultNavigationTimeout(0);
      //Skip images/styles/fonts loading for performance
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if ((req.resourceType() == 'image') ||
          (req.resourceType() == 'stylesheet') ||
          (req.resourceType() == 'font') ||
          (req.resourceType() == 'gif')
        ) {
          req.abort();
        } else {
          req.continue();
        };
      });
      await page.evaluateOnNewDocument(() => {
        // Pass webdriver check
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
      });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "languages", {
          get: function () {
            return ["en-US", "en"];
          }
        });
      })
      await page.evaluateOnNewDocument(() => {
        // overwrite the `plugins` property to use a custom getter
        Object.defineProperty(navigator, 'plugins', {
          get: function () {
            // this just needs to have `length > 0`, but we could mock the plugins too
            return [1, 2, 3, 4, 5];
          },
        });
      })
      await page.evaluateOnNewDocument(function () {
        navigator.geolocation.getCurrentPosition = function (cb) {
          setTimeout(() => {
            cb({
              'coords': {
                accuracy: 21,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                latitude: 23.129163,
                longitude: 113.264435,
                speed: null
              }
            })
          }, 1000)
        }
      });
      await page.evaluateOnNewDocument(() => {
        // Pass chrome check
        window.chrome = {
          runtime: {},
          // etc.
        };
      });
      await page.evaluateOnNewDocument(() => {
        //Pass notifications check
        const originalQuery = window.navigator.permissions.query;
        return window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
          Promise.resolve({
            state: Notification.permission
          }) :
          originalQuery(parameters)
        );
      });
      await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
          // This just needs to have `length > 0` for the current test,
          // but we could mock the plugins too if necessary.
          get: () => [1, 2, 3, 4, 5],
        });
      });
      await page.evaluateOnNewDocument(() => {
        // Overwrite the `languages` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });
      await page.setCookie()
      this.browser = browser
      this.page = page
    } catch (err) {
      console.log("puppeteer failed to start\r", err)
    }
  }
  async navigate(url) {
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    })
  }
  async searchURL(field_1, field_2) {
    return await this.config.search_url.replace("field_1", field_1).replace("field_2", field_2)
  }
  async listData() {
    return await this.page.evaluate(async (config) => {
      return [...document.querySelectorAll(config.card_Sel)].map(card => {
        let object = {}
        for (const [key, value] of Object.entries(config.card_fields)) {
          object[key] = card.querySelector(value[0]) ? card.querySelector(value[0])[value[1]] : undefined
        }
        return object
      })
    }, this.config)
  }
  async pageData() {

  }
  async scrapeSearch(field_1, field_2 = undefined) {
    let url = await this.searchURL(field_1, field_2)
    await this.navigate(url)
    return await this.listData()
  }
  async scrapePage() {
  }
}

export class GoogleBot extends Puppet {
  constructor(devMode = false) {
    const config = {
      search_url: "https://google.com/search?q=field_1",
      card_Sel: "div.jtfYYd",
      card_fields: {
        url: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a", "href"],
        title: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a > h3", "innerText"],
        description: ["div.NJo7tc.Z26q7c.uUuwM > div", "innerText"]
      }
    }
    super(config, devMode)
  }
}

export class EmailBot extends GoogleBot {
  constructor() {
    super()
  }
  async findEmailFormat(query) {

    const results = await this.scrapeSearch(query)

    for (let i = 0; i < results.length; i++) {
      if (results[i].url.includes("rocketreach") && results[i].title.includes("Email Format")) {
        let format = "";
        let raw_format = "";
        if (results[i].description.includes("email format is")) {
          raw_format = results[i].description.split("email format is")[1].split("(")[0]
        } else if (results[i].description.includes("email formats:")) {
          let temp = results[i].description.split("@")[0];
          raw_format = temp.split(" ")[temp.split(" ").length - 1];
        }
        if (raw_format.includes("first_initial")) {
          format = "first_initial";
        } else if (raw_format.includes("first")) {
          format = "first_name";
        }
        if (raw_format.includes("last_initial")) {
          format = format + "last_initial";
        } else if (raw_format.includes("last")) {
          format = format + "last_name";
        }
        return format;
      }
    }
    return undefined
  }

}

export class LinkedinScraper extends Puppet {
  constructor(devMode = false) {
    const config = {
      search_url: "https://www.linkedin.com/jobs/search?keywords=field_1&location=field_2",
      card_Sel: ".base-card",
      card_fields: {
        company_name: [".hidden-nested-link", "innerText"],
        linkedin_url: [".hidden-nested-link", "href"]
      },
      page_fields: [

      ]
    }
    super(config, devMode)
  }
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
};