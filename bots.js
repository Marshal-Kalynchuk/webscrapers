const puppeteer = require('puppeteer')

class Puppet {

  constructor(config, devMode = false) {
    /**Configuration of puppeteer */

    this.browserArgs = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: !devMode,
      ignoreHTTPSErrors: true,
      defaultViewport: null
    }
    // Sets standard rate limiting if not defined in config
    this.config = {
      navigation_delay: config.navigation_delay || 2000,
      action_delay: config.action_delay || 1000,
      initial_url: config.initial_url,
      search_url: config.search_url,
      card_sel: config.card_sel,
      card_fields: config.card_fields
    }

    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';
  }
  // Starts Puppeteer page and browser with default settings
  async start() {
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
      if (this.config.initial_url) {
        await page.goto(this.config.initial_url)
      }
      this.browser = browser
      this.page = page
    } catch (err) {
      console.log("puppeteer failed to start\r", err)
    }
  }
  // Navigates to the given url
  async navigate(url) {
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    })
    await delay(this.config.navigation_delay)
  }
  // Extracts data that is in list format
  async listData() {
    return await this.page.evaluate(async (config) => {
      return [...document.querySelectorAll(config.card_sel)].map(card => {
        let object = {}
        for (const [key, value] of Object.entries(config.card_fields)) {
          object[key] = card.querySelector(value[0]) ? card.querySelector(value[0])[value[1]] : undefined
        }
        return object
      })
    }, this.config)
  }
  // Compounds searchUrl, navigate, and listData to easily scrape search
  async scrape({
    field_1 = undefined,
    field_2 = undefined,
    url = this.config.search_url
  } = {}) {

    url = url.replace("field_1", field_1).replace("field_2", field_2)
    let data = undefined
    let attempts = 0
    const max_attempts = 6

    while (attempts < max_attempts) {
      try {
        await this.navigate(url)
        data = await this.listData()
        break
      } catch {
        console.log(`Something threw an error. Assumed to be due to authwall.`)
        console.log(`Attempting to by-pass authwall... Attempt: ${attempts}/${max_attempts}`)
        await this.authwall()
        attempts += 1
      }
    }
    return data
  }
  // Closes Puppeteer page and browser
  async quit() {
    await this.page.close()
    await this.browser.close()
  }
  // Generic authwall bypass:
  async authwall() {
    // Do nothing. Will just re-navigate to search url.
  }
};

class GoogleBot extends Puppet {
  constructor(devMode = false) {
    const config = {
      navigation_delay: 7000,
      search_url: "https://google.com/search?q=field_1",
      card_sel: "div.jtfYYd",
      card_fields: {
        url: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a", "href"],
        title: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a > h3", "innerText"],
        description: ["div.NJo7tc.Z26q7c.uUuwM > div.VwiC3b", "innerText"]
      }
    }
    super(config, devMode)
  }
};

class EmailBot extends GoogleBot {
  constructor(devMode = false) {
    super(devMode)
    this.devMode = devMode
    // Define identifing scheme for email formats
    this.identifiers = {
      first_name: "first_name",
      first_initial: "first_initial",

      last_name: "last_name",
      last_initial: "last_initial"
    }
  }
  async init() {
    this.RocketBot = new RocketBot(this.devMode)
    await this.RocketBot.start()
    await this.start()
  }

  async find(company_name) {
    console.log("Looking for email templates...")

    // Define globals
    const regex = /\([^()]*\)/g
    let format = {
      email_template: undefined,
      template_score: 0
    }
    let reason = ""
    // Get search results from google
    const search_query = company_name.replace(' ', '+') + '+email+format+rocketreach'
    const search_results = await this.scrape({
      field_1: search_query
    })

    // Loop through search results
    results_loop: for (const search_result of search_results) {

      // Skips null results
      if (!search_result.description || !search_result.title) {
        continue
      }

      // Format search result data
      // Format description
      const description = search_result.description
        .replace("(", "")
        .replace(")", "")
        .replace("{", "")
        .replace("}", "")
        .replace("'", "")
        .replace("'", "")

      // Format title
      const title = search_result.title.toUpperCase()
      const title_company_name = title
        .split("EMAIL FORMAT")[0]
        .replace("CORP", "")
        .replace("INC", "")
        .replace("LTD", "")
        .replaceAll(".", "")
        .replaceAll(",", "")
        .replaceAll("'", "")
        .replaceAll(regex, "")
        .trim()

      // Format company name
      company_name = company_name
        .toUpperCase()
        .replace("CORP", "")
        .replace("INC", "")
        .replace("LTD", "")
        .replaceAll(".", "")
        .replaceAll(",", "")
        .replaceAll("'", "")
        .replaceAll(regex, "")
        .trim()

      // Skip irrelavent search results:
      if (title_company_name == company_name) {
        // RocketReach block:
        if (title.includes("ROCKETREACH")) {
          // Get email formats from description
          const extracted = extractEmails(description)
          // Get Format from description
          if (extracted && !description.split(" ").includes(".")) {

            format.email_template = extracted[0]

            // Get format score
            const words = description.split(" ")
            for (let i = 0; i < words.length; i++) {
              if (words[i].includes("%")) {
                format.template_score = parseInt(words[i])
                break results_loop
              } else if (words[i].includes("PERCENT")) {
                format.template_score = parseInt(words[i - 1])
                break results_loop
              }
            }
          }
          // Get Format from Rocket Reach
          else {
            console.log("Searching Rocket Reach for format")
            const rocket_url = search_result.url
            const rocket_results = await this.RocketBot.scrape({
              url: rocket_url
            })
            if (rocket_results) {
              format.email_template = rocket_results[0].email_template
              format.template_score = parseInt(rocket_results[0].template_score)
              break results_loop
            }
          }
        }
      }
    }
    // If the format was found
    if (format.email_template) {

      const user_format_example = format.email_template.split("@")[0].toUpperCase()
      const domain = format.email_template.split("@")[1]
      let user_format = ""

      // First name handeling
      if (user_format_example.includes("J")) {
        if (user_format_example.includes("JOHN") || user_format_example.includes("JANE")) {
          user_format += this.identifiers.first_name
        } else {
          user_format += this.identifiers.first_initial
        }
      } else if (user_format_example.includes("F")) {
        if (user_format_example.includes("FIRST")) {
          user_format += this.identifiers.first_name
        } else {
          user_format += this.identifiers.first_initial
        }
      }

      // Last name handeling
      if (user_format_example.includes("D")) {
        if (user_format_example.includes("DOE")) {
          user_format += this.identifiers.last_name
        } else {
          user_format += this.identifiers.last_initial
        }
      } else if (user_format_example.includes("L")) {
        if (user_format_example.includes("LAST")) {
          user_format += this.identifiers.last_name
        } else {
          user_format += this.identifiers.last_initial
        }
      }

      // Putting email together:
      format.email_template = user_format + "@" + domain
      console.log(format)
      return [format]

    } else {
      console.log("No formats found.")
      return undefined
    }

  }

  // email_templates = email_templates.sort((a,b) => (a.template_score > b.template_score) ? -1 : ((b.template_score > a.template_score) ? 1 : 0))

  async quit() {
    await this.page.close()
    await this.browser.close()
    await this.RocketBot.page.close()
    await this.RocketBot.browser.close()
  }

};

class RocketBot extends Puppet {
  constructor(devMode = false) {
    const config = {
      navigation_delay: 7000,
      card_sel: "tbody tr",
      card_fields: {
        email_template: ["td:nth-child(2)", "innerText"],
        template_score: ["td:nth-child(3) > div > span", "innerText"]
      }
    }
    super(config, devMode)
  }
}

class LinkedinBot extends Puppet {
  constructor(devMode = false) {
    const config = {
      navigation_delay: 100000,
      action_delay: 15000,
      initial_url: "https://www.linkedin.com",
      search_url: "https://www.linkedin.com/jobs/search?keywords=field_1&location=field_2",
      card_sel: ".base-card",
      card_fields: {
        company_name: [".hidden-nested-link", "innerText"],
        linkedin_url: [".hidden-nested-link", "href"]
      },
      page_fields: [

      ]
    }
    super(config, devMode)
  }
  async init() {
    await this.start()
  }
};

function extractEmails(text) {
  return text.match(/(?:[a-z0-9+!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi);
};

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
};

module.exports = {
  EmailBot: EmailBot,
  LinkedinBot: LinkedinBot
}