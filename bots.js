const puppeteer = require('puppeteer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios')

class DataStore {
  constructor(path, data_model) {
    this.path = path;
    this.data_model = data_model;
    this.data = JSON.parse(fs.readFileSync(path));
  };
  create() {
    return this.data_model;
  };
  get(field, query, max_results) {
    let results = [];
    for (let obj of this.data) {
      if (obj[field] === query){
        results.push(obj);
      };
    };
    return results;
  };
  put(objs) {
    // enable naming protection off model.
    objs = objs.map(function(obj){obj.id = uuidv4(); return obj})
    // Add duplicate protection
    this.data.push(...objs)
    fs.writeFileSync(this.path, JSON.stringify(this.data), function (err) {
    if (err) {
      console.log(err);
      }
    });
    return objs  
  };
  post(id, field, value) {
    let changed = undefined
    for (let obj of this.data){
      if (obj.id === id){
        obj[field] = value
        changed = obj
        break
      }
    }
    fs.writeFileSync(this.path, JSON.stringify(this.data), function (err) {
    if (err) {
      console.log(err);
      }
    });
    this.data = JSON.parse(fs.readFileSync(this.path))
    return changed
  };
  delete(id) {
    let deleted = undefined
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].id === id) {
        deleted = this.data.splice(i, 1)
      }
    }
    fs.writeFileSync(this.path, JSON.stringify(this.data), function (err) {
      if (err) {
        console.log(err);
        }
      });
    return deleted
  }

}
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
      if ((req.resourceType() == 'ximage') ||
        (req.resourceType() == 'xstylesheet') ||
        (req.resourceType() == 'xfont') ||
        (req.resourceType() == 'xgif')
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
      navigation_delay: 30000,
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
      navigation_delay: 12000,
      card_sel: "tbody tr",
      card_fields: {
        format: ["td:nth-child(2)", "innerText"],
        score: ["td:nth-child(3) > div > span", "innerText"]
      }
    };
    this.signalhire_config = {
      navigation_delay: 12000,
      card_sel: "tbody > tr",
      card_fields: {
        format: ["td:nth-child(2) > a", "innerText"],
        score: ["td:nth-child(3)", "innerText"]
      }
    };
    this.webspotter_config = {
      navigation_delay: 10000,
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
    this.formats_file = "./files/formats_file.json";
    this.api_key = "at_mp0pXIJFeZBYXnzgopWktb7uBBTbf";
    this.general_formats = ["info", "hello"]

    this.datastore = new DataStore(this.formats_file, this.format_model)
  };
  async general_format(company_name, website){
    let results = []
    const domain = website.split("//")[1].split("/")[0].replace("www.", "")
    let general_format = String
    let format = Object
    let api_data = Object
    for (let prefix of this.general_formats){
      general_format = prefix + "@" + domain
      format = {company_name: company_name, format: general_format, type: this.type_identifiers.general, score: 0, is_valid: false, api_data: undefined}
      console.log("Calling API...")
      await axios.get(`https://emailverification.whoisxmlapi.com/api/v2?apiKey=${this.api_key}&emailAddress=${general_format}`).then((resp)=>{
        format.api_data = resp.data
        if (resp.data.smtpCheck == 'true'){
          format.is_valid = true
          format.score = 100
        }
      })
      results.push(format)
      if (format.is_valid){
        break
      }
    }
    return results
  };
  async get_format(company_name, website = undefined, {overwrite_undefined = false, api_calls = false} = {}){

    let results = this.datastore.get("company_name", company_name, 30);
    if (!results.length) {
      results = await this.scrape_formats(company_name, website);
      if (results[0].format == undefined && website && api_calls){
        results = await this.general_format(company_name, website)
      }
      this.datastore.put(results);
    } else if (results[0].format == undefined && overwrite_undefined && website && api_calls){
      const delete_id = results[0].id

      this.datastore.delete(delete_id)
      results = await this.general_format(company_name, website)
      this.datastore.put(results)
    }
    if (results.length && results[0].format == undefined){
      return undefined;
    } else {
      return results.filter(res=>res.origin == 'rocketreach').sort(function (a, b) {
        return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0)})[0] ||
      results.filter(res=>res.origin == 'signalhire').sort(function (a, b) {
        return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0)})[0] ||
      results.filter(res=>res.type == 'general' && res.is_valid == true)[0] || undefined;
    };
  };
  async scrape_formats(company_name, website = undefined, opt = {api_calls: false}) {
    // Check that company name is given:
    if (company_name == undefined){ throw "Company name not given." }
    // Extract website domain if given:
    const website_domain = website ? website.split("//")[1].split("/")[0].replace("www.", "").split(".")[0] : undefined
    // Remove chars for clean comparison:
    const remove_lite = ["(", ")", "{", "}", " '", "' ", "'"];
    const remove_full = ["CORP", "INC", "LTD", "LLC", /\([^()]*\)/g, "(", ")", "{", "}", "'", ".", ",", " ", "-", 
    "AGENCY", "TECHNOLOGIES", "SOLUTIONS", "SERVICES", "CORPORATION", "CONSULTING", "GROUP", "SYSTEMS", "TECHNOLOGY", "PARTNERS", /[^a-zA-Z\d\s:\u00C0-\u00FF]/g];
    // Get search results from google:
    console.log("Searching for email formats...");
    const search_query = (website_domain ? '"'+website_domain+'"' : company_name.replaceAll(" ", "+"))+'+email+format';
    const search_results = await this.scrape(this.google_config, { field_1: search_query });
    // Scrape relavent pages: 
    let scraped_formats = []
    let title, compare_title, compare_name, description = ""
    for (let res of search_results){
      if (res.description && res.title){
        title = res.title.toUpperCase();
        compare_title = this.format_string(title.split("EMAIL FORMAT")[0].split(":")[0], remove_full);
        compare_name = this.format_string(company_name.toUpperCase().split(":")[0], remove_full);
        description = res.description.toUpperCase()
        if (compare_title == compare_name && title.includes("EMAIL FORMAT") && !description.includes("0 EMAIL FORMATS")){
          if (res.url.includes("rocketreach")){
            scraped_formats.push(...(await this.scrape(this.rocket_config, {url: res.url})).map(function(obj){obj.origin = "rocketreach"; return obj}));
          } else if (res.url.includes("signalhire")){
            scraped_formats.push(...(await this.scrape(this.signalhire_config, {url: res.url})).map(function(obj){obj.origin = "signalhire"; return obj}));
          } /**else if (res.url.includes("webspotter")){
            scraped_formats.push(...(await this.scrape(this.webspotter_config, {url: res.url})).map(function(obj){obj.origin = "webspotter"; return obj}));
          };  ### Detrimental bug with selectors selecting unwanted data. No uniqness among js selectors on webspotters.com. */
        };
      };
    };
    // Format formats into usable form:
    const formatted_formats = scraped_formats.map(format=>{
      if (format.format && !format.format.includes("//")) {
        const email_domain = format.format.split("@")[1];
        if (website_domain ? website_domain == email_domain.split(".")[0] : true){
          const user_format = format.format
          .split("@")[0]
          .toUpperCase()
          .replaceAll("{", "")
          .replaceAll("}", "")
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
          format.format = (user_format + "@" + email_domain).toLowerCase();
          format.score = parseInt(format.score)
          format.company_name = company_name
          format.type = this.type_identifiers.personal
        } else {
          return undefined
        }
      } else {
        return undefined
      }
      return format
    }).filter( Boolean )
    return formatted_formats.length ? formatted_formats : [{company_name: company_name, format: undefined}]
  };
  format_string(string, args){
    string = string.toUpperCase();
    args.forEach(arg=>string = string.replaceAll(arg, ""));
    return string.trim();
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
  DataStore: DataStore,
  linkedin_config: linkedin_config,
};

