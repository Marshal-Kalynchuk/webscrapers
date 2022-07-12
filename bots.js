const puppeteer = require('puppeteer')

class Puppet {

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
      if (this.config.initial_url) {
        await page.goto(this.config.initial_url)
      }
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
    await delay(this.config.navigation_delay)
  }
  async searchURL(field_1, field_2) {
    return await this.config.search_url.replace("field_1", field_1).replace("field_2", field_2)
  }
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
  async pageData() {

  }
  async scrapeSearch(field_1, field_2 = undefined) {
    const search_url = await this.searchURL(field_1, field_2)
    let data = undefined
    let attempts = 0
    const max_attempts = 6
    while(attempts < max_attempts){
      try{
        await this.navigate(search_url)
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
    // To-Do - Create dynamic for more complex search results -- google search results
  }
  async scrapePage() {}

  async quit(){
    await this.page.close()
    await this.browser.close()
  }

  // Generic authwall bypass:
  async authwall(){
    // Do nothing. Will just re-navigate to search url.
  }

};

class GoogleBot extends Puppet {
  constructor(devMode = false) {
    const config = {
      navigation_delay: 2000,
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
  async scrape(field_1) {
    let results = await this.scrapeSearch(field_1)
    /**Custom Script for Google Banners etc... */
    return results
  }
};

class EmailTemplate{
  constructor(company_name, email_template, template_score, result_info){
    this.company_name = company_name
    this.email_template = email_template
    this.template_score = template_score
    this.result_info = result_info
  }
}

class EmailBot extends GoogleBot {
  constructor(devMode = false) {
    super(devMode)

    // Define identifing scheme for email formats
    this.identifiers = {
      first_name: "first_name",
      first_initial: "first_initial",

      last_name: "last_name",
      last_initial: "last_initial"
    }
  }
  async find(company_name, max_results=3) {
    console.log("Looking for email templates...")
    company_name = company_name.toUpperCase()
    const search_query = company_name.replace(' ', '+') + '+email+format'
    const search_results = await this.scrape(search_query)
    let email_templates = []
    
    /** To-Do Impliment domain checking over name checking. 
     * The current solution does not account for addmore vs. addmore group.
     * Temporary solution is to only get emails from rocket reach.
     * this solves the issue of weirdly formatted emails like j.d@domain.com*/

    // TODO Overhaul results combing to get emails along with assosiated chance 
    // ie. (The email formate is janedoe@rocketreach.com 80% of the time...)
    for (let res of search_results) {
      let words = res.description.split(" ")
      let res_company_name =  res.title.toUpperCase().split("EMAIL FORMAT")[0].trim()
      // Skip irrelavent results:
      if (res_company_name == company_name){
        for (let i = 0; i < words.length; i++){
          let maybe_email = extractEmails(words[i])
          if (maybe_email){
            let raw_email = maybe_email[0]
            if (!raw_email.includes("*")) {
              
              let temp = raw_email.split("@")
              let raw_format = temp[0]
                .toUpperCase()
                .replace("{", "")
                .replace("}", "")
              let domain = temp[1]
              let format = ""

              // First name handling:
              if (raw_format.includes("J")) {
                if (raw_format.includes("JOHN") || raw_format.includes("JANE")) {
                  format += this.identifiers.first_name
                } else {
                  format += this.identifiers.first_initial
                }
              } else if (raw_format.includes("F")) {
                if (raw_format.includes("FIRST")) {
                  format += this.identifiers.first_name
                } else {
                  format += this.identifiers.first_initial
                }
              }

              // Last name handling
              if (raw_format.includes("D")) {
                if (raw_format.includes("DOE")) {
                  format += this.identifiers.last_name
                } else {
                  format += this.identifiers.last_initial
                }
              } else if (raw_format.includes("L")) {
                if (raw_format.includes("LAST")) {
                  format += this.identifiers.last_name
                } else {
                  format += this.identifiers.last_initial
                }
              }

              // Putting email together:
              let email_template = format + "@" + domain
          
              // Determining email score if possible
              let score = 0
              for (let j = i; j < words.length; j++){
                if (words[j].includes("%")){
                  score = parseInt(words[j])
                  break
                }
                else if (words[j].toUpperCase().includes("PERCENT")){
                  score = parseInt(words[j-1])
                  break
                }
              }
              const template = new EmailTemplate(res_company_name, email_template, score, res)
              email_templates.push(template)
            }
          }
        }
      }
    }
   
    if (email_templates.length){
      // Sort based on score
      email_templates = email_templates.sort((a,b) => (a.template_score > b.template_score) ? -1 : ((b.template_score > a.template_score) ? 1 : 0))
      // Trucate to max_results
      let return_templates = email_templates.slice(0, max_results)
      // Console output
      let info = return_templates.map(function(a){return [a.email_template, a.template_score]})
      console.log("Found templates:", info)
      return return_templates
    }
    else {
      console.log("No templates found.")
      return undefined
    }
    
  }

};

// To-Do - Implement rate limiting feature in config.
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
};

function capitalizeWords(arr) {
  return arr.map(element => {
    return element.charAt(0).toUpperCase() + element.substring(1).toLowerCase();
  });
}

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