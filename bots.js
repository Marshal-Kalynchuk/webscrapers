const puppeteer = require('puppeteer');
const fs = require('fs');
const { config } = require('process');

class Puppet {
  constructor(devMode = false) {
    /**Configuration of puppeteer */
    this.browserArgs = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: !devMode,
      ignoreHTTPSErrors: true,
      defaultViewport: null
    };
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';
  };
  // Starts Puppeteer page and browser with default settings
  async init(config = {}) {
    /**Creates the puppeteer instance */

    /**Initialze browser */
    const browser = await puppeteer.launch(this.browserArgs);
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
    page.setDefaultNavigationTimeout(0);
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
    });
    await page.evaluateOnNewDocument(() => {
      // overwrite the `plugins` property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: function () {
          // this just needs to have `length > 0`, but we could mock the plugins too
          return [1, 2, 3, 4, 5];
        },
      });
    });
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
      };
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
    await page.setCookie();
    if (config.initial_url) {
      await page.goto(config.initial_url);
    };
    this.browser = browser;
    this.page = page;
    console.log("Page initialized");
  };
  // Navigates to the given url
  async navigate(url) {
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0
    });
  };
  // Extracts data that is in list format
  async list_data(config) {
    return await this.page.evaluate(async (config) => {
      return [...document.querySelectorAll(config.card_sel)].map(card => {
        let object = {};
        for (const [key, value] of Object.entries(config.card_fields)) {
          object[key] = card.querySelector(value[0]) ? card.querySelector(value[0])[value[1]] : undefined;
        };
        return object;
      });
    }, config);
  };
  // Compounds searchUrl, navigate, and listData to easily scrape search
  async scrape(config, {
    field_1 = undefined,
    field_2 = undefined,
    url = config.search_url,
  } = {}) {

    url = url.replace("field_1", field_1).replace("field_2", field_2);
    let data = undefined;
    let attempts = 0;
    const max_attempts = 6;

    while (attempts < max_attempts) {
      try {
        await this.navigate(url);
        await delay(config.navigation_delay);
        data = await this.list_data(config);
        break;
      } catch (err) {
        console.log(err);
        console.log(`Something threw an error. Assumed to be due to authwall.`);
        console.log(`Attempting to by-pass authwall... Attempt: ${attempts}/${max_attempts}`);
        await this.authwall(config);
        attempts += 1;
      };
    };
    return data;
  };
  // Closes Puppeteer page and browser
  async quit() {
    await this.page.close();
    await this.browser.close();
  };
  // Generic authwall bypass:
  async authwall(config) {
    // Do nothing. Will just re-navigate to search url.
  };
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
    };
  };
};

class EmailBot extends GoogleBot {
  constructor(devMode = false) {
    super(devMode);
    this.rocket_config = {
      navigation_delay: 5000,
      card_sel: "tbody tr",
      card_fields: {
        format: ["td:nth-child(2)", "innerText"],
        score: ["td:nth-child(3) > div > span", "innerText"]
      }
    };
    this.signalhire_config = {
      navigation_delay: 5000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(2) > a", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      }
    };
    this.webspotter_config = {
      navigation_delay: 5000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(1)", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      }
    };
    this.format_identifiers = {
      first_name: "first_name",
      first_initial: "first_initial",
      last_name: "last_name",
      last_initial: "last_initial"
    };
    this.formats_file = "./files/formats_file.json";
    this.api_key = "at_mp0pXIJFeZBYXnzgopWktb7uBBTbf";
    this.format_model = {
      company_name: undefined,
      type: undefined,
      format: undefined,
      score: 0,
    };
    this.type_identifiers = {
      personal: "personal",
      general: "general"
    };
  };
  async generate_format(company_name, website = undefined) {

    console.log("Searching for email formats...");
    let format = this.get_format(company_name) || Object.create(this.format_model);
    
    // Found existing format
    if (format.company_name != undefined) {
      return format;
    };
    format.company_name = company_name;

    const remove_lite = ["(", ")", "{", "}", " '", "' ", "'"];
    const remove_full = ["CORP", "INC", "LTD", /\([^()]*\)/g, "(", ")", "{", "}", "'", ".", ",", " "];
    function format_string(string, args){
      string = string.toUpperCase();
      args.forEach(arg=>string = string.replaceAll(arg, ""));
      return string.trim();
    };

    // Get search results from google
    const search_query = company_name.replaceAll(" ", "+")+'+email+format';
    const search_results = await this.scrape(this.google_config, { field_1: search_query });
    /**
     * Removes all search results that do not contain the company name and that are not titled "email format"
     * Formats the title and discription for later processing
     */
    let formatted_results = search_results.map(function(res){
      if (res.description && res.title){
        const title = res.title.toUpperCase();
        const compare_title = format_string(title.split("EMAIL FORMAT")[0].split(":")[0], remove_full);
        const compare_name = format_string(company_name.toUpperCase().split(":")[0], remove_full);
        if (compare_title == compare_name && title.includes("EMAIL FORMAT")){
          return {
            title: title,
            url: res.url,
            description: format_string(res.description, remove_lite),
          };
        };
      };
    }).filter( Boolean );

    /**
     * Looks through the formatted search results, removing the ones that it analysis. 
     * If it finds an email format, it will move on to the next section. 
     * The order of analysis is: Rocket Reach > Signal Hire > Webspotter > Aeroleads > Company Page (if given) > Any
     */
    // Rocket Reach
    for (let i = 0; i < formatted_results.length && format.format == undefined; i++){
      const res = formatted_results[i];
      if (res.url.includes("rocketreach")){
        // Try get Format and score from description 
        const extracted_formats = this.extract_emails(res.description);
        if (extracted_formats) {
          format.format = extracted_formats[0];
          const words = res.description.split(" ");
          for (let j = 0; j < words.length; j++) {
            if (words[j].includes("%")) {
              format.score = parseInt(words[j]);
            } else if (words[j].includes("PERCENT")) {
              format.score = parseInt(words[j - 1]);
            }
          }
        }
        if (format.format == undefined || format.score == 0){
          // Get Format and Score from Rocket Reach
          console.log("Searching Rocket Reach for format");
          const page_results = await this.scrape(this.rocket_config, { url: res.url });
          if (page_results) {
            const page_res = this.reduce(page_results);
            format.format = page_res.format;
            format.score = page_res.score;
            format.type = this.type_identifiers.personal;
          } 
        }
        formatted_results.splice(i, 1);
      }
    }
    // Signal Hire
    for (let i = 0; i < formatted_results.length && format.format == undefined; i++){
      const res = formatted_results[i];
      if (res.url.includes("signalhire")){
        console.log("Searching Signal Hire for format");
        const page_results = await this.scrape(this.signalhire_config, { url: res.url });
        if (page_results) {
          const page_res = this.reduce(page_results);
          format.format = page_res.format;
          format.score = page_res.score;
          format.type = this.type_identifiers.personal;
        }
        formatted_results.splice(i, 1);
      }
    }
    // Webspotter
    for (let i = 0; i < formatted_results.length && format.format == undefined; i++){
      const res = formatted_results[i];
      if (res.url.includes("webspotter")){
        console.log("Searching Webspotter for format");
        const page_results = await this.scrape(this.webspotter_config, { url: res.url });
        if (page_results) {
          const page_res = this.reduce(page_results);
          page_res.format = page_res.format.replaceAll("{", "").replaceAll("}", "");
          format.format = page_res.format;
          format.score = page_res.score;
          format.type = this.type_identifiers.personal;
        }
        formatted_results.splice(i, 1);
      }
    }
    // Aeroleads
    for (let i = 0; i < formatted_results.length && format.format == undefined; i++){
      const res = formatted_results[i];
      if (res.url.includes("aeroleads")){
        console.log("Aeroleads analysis is incomplete");
      }
    }
    if (website && format.format == undefined){
      // Get company email off company website and api check as last resort
      console.log("Website analysis is incompelet");
    }

    // If the format was found
    if (format.format) {
      // Replaces *Uppercase letters with *Lowercase identifiers
      const domain = format.format.split("@")[1];
      const user_format = format.format
        .split("@")[0]
        .toUpperCase()
        .replace("FIRST", this.format_identifiers.first_name)
        .replace("LAST", this.format_identifiers.last_name)
        .replace("F", this.format_identifiers.first_initial)
        .replace("L", this.format_identifiers.last_initial)
        .replace("JANE", this.format_identifiers.first_name)
        .replace("JOHN", this.format_identifiers.first_name)
        .replace("J", this.format_identifiers.first_initial)
        .replace("DOE", this.format_identifiers.last_name)
        .replace("D", this.format_identifiers.last_initial);

      // Putting email together:
      format.format = (user_format + "@" + domain).toLowerCase();
    }
    this.put_format(format);
    return format;
  };
  get_format(company_name) {
    const formats = JSON.parse(fs.readFileSync(this.formats_file));
    for (const format of formats) {
      if (format.company_name == company_name) {
        return format;
      };
    };
    return undefined;
  };
  put_format(format){
    if (format.company_name == undefined){
      throw "Company name is undefined!";
    }
    let formats = JSON.parse(fs.readFileSync(this.formats_file));
    formats.push(format);
    fs.writeFileSync(this.formats_file, JSON.stringify(formats), function (err) {
      if (err) {
        console.log(err);
      };
    });
  };
  reduce(formats) {
    formats = formats.map(format => ({
      format: format.format,
      score: parseInt(format.score)
    }));
    // Sort Array based on scores
    formats.sort(function (a, b) {
      return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0);
    });
    // Return best result
    return formats[0];
  };
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
};
function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
};
module.exports = {
  Puppet: Puppet,
  EmailBot: EmailBot,
  linkedin_config: linkedin_config,
};