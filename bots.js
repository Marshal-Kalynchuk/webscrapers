const puppeteer = require('puppeteer')

class Puppet {

  constructor(devMode = false) {
    /**Configuration of puppeteer */

    this.browserArgs = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: !devMode,
      ignoreHTTPSErrors: true,
      defaultViewport: null
    }

    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';
  }
  // Starts Puppeteer page and browser with default settings
  async init(config = {}) {
    /**Creates the puppeteer instance */

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
    if (config.initial_url) {
      await page.goto(config.initial_url)
    }
    this.browser = browser
    this.page = page
    console.log("Page initialized")

  }
  // Navigates to the given url
  async navigate(url) {
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    })
  }
  // Extracts data that is in list format
  async list_data(config) {
    return await this.page.evaluate(async (config) => {
      return [...document.querySelectorAll(config.card_sel)].map(card => {
        let object = {}
        for (const [key, value] of Object.entries(config.card_fields)) {
          object[key] = card.querySelector(value[0]) ? card.querySelector(value[0])[value[1]] : undefined
        }
        return object
      })
    }, config)
  }
  // Compounds searchUrl, navigate, and listData to easily scrape search
  async scrape(config, {
    field_1 = undefined,
    field_2 = undefined,
    url = config.search_url,
  } = {}) {

    url = url.replace("field_1", field_1).replace("field_2", field_2)
    let data = undefined
    let attempts = 0
    const max_attempts = 6

    while (attempts < max_attempts) {
      try {
        await this.navigate(url)
        await delay(config.navigation_delay)
        data = await this.list_data(config)
        break
      } catch (err) {
        console.log(err)
        console.log(`Something threw an error. Assumed to be due to authwall.`)
        console.log(`Attempting to by-pass authwall... Attempt: ${attempts}/${max_attempts}`)
        await this.authwall(config)
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
  async authwall(config) {
    // Do nothing. Will just re-navigate to search url.
  }
};

class GoogleBot extends Puppet {
  constructor(devMode = false) {
    super(devMode)

    this.google_config = {
      navigation_delay: 7000,
      search_url: "https://google.com/search?q=field_1",
      card_sel: "div.jtfYYd",
      card_fields: {
        url: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a", "href"],
        title: ["div.NJo7tc.Z26q7c.jGGQ5e > div > a > h3", "innerText"],
        description: ["div.NJo7tc.Z26q7c.uUuwM > div.VwiC3b", "innerText"]
      }
    }

  }
};

class EmailBot extends GoogleBot {
  constructor(devMode = false) {
    super(devMode)

    this.rocket_config = {
      navigation_delay: 5000,
      card_sel: "tbody tr",
      card_fields: {
        format: ["td:nth-child(2)", "innerText"],
        score: ["td:nth-child(3) > div > span", "innerText"]
      }
    }

    this.signalhire_config = {
      navigation_delay: 5000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(2) > a", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      }
    }

    this.webspotter_config = {
      navigation_delay: 5000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(1)", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      }
    }

    this.identifiers = {
      first_name: "first_name",
      first_initial: "first_initial",
      last_name: "last_name",
      last_initial: "last_initial"
    }
  }
  async get_email(company_name) {
    console.log("Searching for email formats...")

    let format = { format: undefined, score: 0 }

    // Get search results from google
    const search_query = company_name.replace(' ', '+') + '+email+format'
    const search_results = await this.scrape(this.google_config, { field_1: search_query })

    // Loop through search results
    results_loop: for (const search_result of search_results) {

      // Skips null results
      if (!search_result.description || !search_result.title) {
        continue
      }

      const regex = /\([^()]*\)/g
      const remove_lite = ["(", ")", "{", "}", " '", "' ", "'"]
      const remove_full = ["CORP", "INC", "LTD", regex, "(", ")", "{", "}", "'", ".", ",", " "]

      function format_string(string, args){
        string = string.toUpperCase()
        args.forEach(arg=>string = string.replaceAll(arg, ""))
        return string.trim()
      }

      const description = format_string(search_result.description, remove_lite)
      const title = search_result.title.toUpperCase()
      const url = search_result.url
      const comparison_title = format_string(title.split("EMAIL FORMAT")[0].split(":")[0], remove_full)
      const comparison_company_name = format_string(company_name.split(":")[0], remove_full)

      // Skip irrelavent search results:
      if (comparison_title == comparison_company_name && title.includes("EMAIL FORMAT")) {

        // RocketReach block:
        if (url.includes("rocketreach")) {
          // Get email formats from description
          const extracted_formats = this.extract_emails(description)
          // Get Format from description (Really just an optimization)
          if (extracted_formats) {
            format.format = extracted_formats[0]
            // Get format score
            const words = description.split(" ")
            for (let i = 0; i < words.length; i++) {
              if (words[i].includes("%")) {
                format.score = parseInt(words[i])
                break results_loop
              } else if (words[i].includes("PERCENT")) {
                format.score = parseInt(words[i - 1])
                break results_loop
              }
            }
          }
          // Get Format from Rocket Reach
          console.log("Searching Rocket Reach for format")
          const results = await this.scrape(this.rocket_config, {
            url: search_result.url
          })
          if (results) {
            const res = this.reduce(results)
            format.format = res.format
            format.score = res.score
            break results_loop
          } else {
            this.page.goBack()
          }
          
        }

        // Signal Hire Block:
        else if (url.includes("signalhire")) {
          console.log("Searching Signal Hire for format")
          const results = await this.scrape(this.signalhire_config, { url: search_result.url })
          if (results) {
            const res = this.reduce(results)
            format.format = res.format
            format.score = res.score
            break results_loop
          } else {
            this.page.goBack()
          }
        }

        // Webspotter Block:
        else if (url.includes("webspotter")) {
          console.log("Searching Webspotter for format")
          const results = await this.scrape(this.webspotter_config, { url: search_result.url })
          if (results) {
            let res = this.reduce(results)
            res.format = res.format.replaceAll("{", "").replaceAll("}", "")
            format.format = res.format
            format.score = res.score
          } else {
            this.page.goBack()
          }
        }
      }
    }
    // If the format was found
    if (format.format) {

      // Replaces *Uppercase letters with *Lowercase identifiers
      const domain = format.format.split("@")[1]
      const user_format = format.format
        .split("@")[0]
        .toUpperCase()
        .replace("FIRST", this.identifiers.first_name)
        .replace("LAST", this.identifiers.last_name)
        .replace("F", this.identifiers.first_initial)
        .replace("L", this.identifiers.last_initial)
        .replace("JANE", this.identifiers.first_name)
        .replace("JOHN", this.identifiers.first_name)
        .replace("J", this.identifiers.first_initial)
        .replace("DOE", this.identifiers.last_name)
        .replace("D", this.identifiers.last_initial)


      // Putting email together:
      format.format = (user_format + "@" + domain).toLowerCase()
      return format

    } else {
      console.log("No formats found.")
      return undefined
    }
  }
  reduce(formats) {
    formats = formats.map(format => ({
      format: format.format,
      score: parseInt(format.score)
    }))
    // Sort Array based on scores
    formats.sort(function (a, b) {
      return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0);
    });
    // Return best result
    return formats[0]
  }
  extract_emails(text) {
    return text.match(/(?:[a-z0-9+!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi);
  };
};


const linkedin_config = {
  navigation_delay: 100000,
  action_delay: 15000,
  initial_url: "https://www.linkedin.com",
  search_url: "https://www.linkedin.com/jobs/search?keywords=field_1&location=field_2",
  card_sel: ".base-card",
  card_fields: {
    company_name: [".hidden-nested-link", "innerText"],
    linkedin_url: [".hidden-nested-link", "href"]
  },
  page_fields: []
}


function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time)
  });
};

module.exports = {
  Puppet: Puppet,
  EmailBot: EmailBot,
  linkedin_config: linkedin_config,

}